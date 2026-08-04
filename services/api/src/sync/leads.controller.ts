import { Body, Controller, Delete, Get, HttpCode, HttpException, HttpStatus, Param, Post, Put, Req } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { and, count, desc, eq, sql, type SQL } from 'drizzle-orm';
import type { FastifyRequest } from 'fastify';
import type { DbClient } from '@opentelecrm/db';
import { lead, leadField } from '@opentelecrm/db';
import type { AuthContext } from '../auth/auth.guard.js';
import { DB_PROVIDER, TENANT_WRAPPER } from '../db/database.module.js';
import { AuditService } from '../audit/audit.service.js';

type TenantFn = <T>(enterpriseId: string, fn: (db: DbClient) => Promise<T>) => Promise<T>;

// Reserved top-level keys are base lead fields; everything else is a custom field by apiName.
const RESERVED = new Set([
  'identifier',
  'ownerUserId',
  'pipelineId',
  'stageId',
  'source',
  'score',
  'tags',
  'customFields',
]);

interface CreateLeadDto {
  identifier?: string;
  ownerUserId?: string;
  pipelineId?: string;
  stageId?: string;
  source?: string;
  score?: number;
  tags?: string[];
  customFields?: Record<string, unknown>;
}

interface SearchFilter {
  field: string;
  op: 'eq' | 'contains' | 'gt' | 'lt' | 'in' | 'between' | 'isNull' | 'regex';
  value?: unknown;
}

interface SearchDto {
  filters?: SearchFilter[];
  skip?: number;
  limit?: number;
}

/**
 * TeleCRM Sync-parity leads surface.
 *   POST   /enterprise/:eid/lead        create or upsert a lead
 *   GET    /enterprise/:eid/lead/:id    fetch one lead
 *   PUT    /enterprise/:eid/lead/:id    update lead fields
 *   DELETE /enterprise/:eid/lead/:id    hard delete a lead
 *   POST   /enterprise/:eid/lead/search Ledger-style search (server-side SQL filters)
 * Reads/writes always run through withTenant(eid); RLS scopes every query.
 */
@Controller('enterprise/:eid/lead')
export class LeadsController {
  constructor(
    @Inject(DB_PROVIDER) private db: DbClient,
    @Inject(TENANT_WRAPPER) private withTenant: TenantFn,
    @Inject(AuditService) private readonly auditService: AuditService,
  ) {}

  private assertTenant(req: FastifyRequest, eid: string): AuthContext {
    const auth = req.auth;
    if (!auth) throw new Error('unauthenticated');
    if (auth.enterpriseId !== eid) {
      throw new Error('enterprise mismatch');
    }
    return auth;
  }

  private notFound(code: string, message: string): HttpException {
    return new HttpException({ error: { code, message } }, HttpStatus.NOT_FOUND);
  }

  // value expression for a filter column — structural lead fields map to real
  // columns; anything else is treated as a custom field inside the custom_fields jsonb.
  private valExpr(field: string): SQL {
    const f = field.toLowerCase();
    if (f === 'identifier') return sql`identifier`;
    if (f === 'source') return sql`"source"`;
    if (f === 'pipelineid') return sql`pipeline_id`;
    if (f === 'stageid') return sql`stage_id`;
    if (f === 'score') return sql`score`;
    if (f === 'tags') return sql`tags`;
    if (f === 'lostreasonid') return sql`lost_reason_id`;
    if (f === 'owneruserid') return sql`owner_user_id`;
    return sql`custom_fields->>${field}`;
  }

  private condition(f: SearchFilter) {
    const field = f.field.toLowerCase();
    const expr = this.valExpr(f.field);

    // tags is a jsonb array column — needs containment semantics, not text extraction.
    if (field === 'tags') {
      switch (f.op) {
        case 'eq':
        case 'in':
          return Array.isArray(f.value)
            ? sql`tags ?| ${f.value as string[]}`
            : sql`tags ? ${String(f.value)}`;
        case 'contains':
          return sql`tags::text ilike ${'%' + String(f.value) + '%'}`;
        case 'isNull':
          return sql`tags IS NULL`;
        default:
          return sql`1=1`;
      }
    }

    switch (f.op) {
      case 'eq':
        // case-insensitive only for textual columns (identifier/source parity)
        if (field === 'identifier' || field === 'source') {
          return sql`lower(${expr}) = lower(${f.value as string})`;
        }
        return sql`${expr} = ${f.value}`;
      case 'contains':
        return sql`${expr} ilike ${'%' + String(f.value) + '%'}`;
      case 'gt':
        return sql`${expr}::numeric > ${String(f.value)}::numeric`;
      case 'lt':
        return sql`${expr}::numeric < ${String(f.value)}::numeric`;
      case 'in':
        return sql`${expr} = ANY(${f.value as string[]})`;
      case 'between':
        return sql`${expr}::numeric BETWEEN ${String((f.value as unknown[])[0])}::numeric AND ${String((f.value as unknown[])[1])}::numeric`;
      case 'isNull':
        return sql`${expr} IS NULL`;
      case 'regex':
        return sql`${expr} ~* ${String(f.value)}`;
      default:
        return sql`1=1`;
    }
  }

  private serialize(row: typeof lead.$inferSelect) {
    return {
      id: row.id,
      identifier: row.identifier,
      customFields: row.customFields,
      source: row.source,
      score: row.score,
      tags: row.tags ?? [],
      stageId: row.stageId,
      pipelineId: row.pipelineId,
      ownerUserId: row.ownerUserId,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  @Post()
  async create(
    @Param('eid') eid: string,
    @Req() req: FastifyRequest,
    @Body() dto: CreateLeadDto & Record<string, unknown>,
  ) {
    this.assertTenant(req, eid);

    // Merge explicit customFields with top-level apiName keys.
    const merged: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(dto) as [string, unknown][]) {
      if (!RESERVED.has(k) && v !== undefined) merged[k] = v;
    }
    Object.assign(merged, dto.customFields ?? {});

    const identifier = dto.identifier ?? this.genIdentifier();

    return this.withTenant(eid, async (db) => {
      const fieldDefs = await db
        .select({ apiName: leadField.apiName })
        .from(leadField)
        .where(sql`archived_at IS NULL`);
      const valid = new Set(fieldDefs.map((f) => f.apiName));

      // Per-field validation result.
      const fields: { apiName: string; status: string; remarks: string[] }[] = [];
      const cleanCustom: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(merged)) {
        if (valid.has(k)) {
          fields.push({ apiName: k, status: 'ACCEPTED', remarks: [] });
          if (v !== undefined && v !== null) cleanCustom[k] = v;
        } else {
          fields.push({ apiName: k, status: 'REJECTED', remarks: ['unknown field'] });
        }
      }

      // Upsert by identifier (case-insensitive).
      const existing = await db
        .select()
        .from(lead)
        .where(sql`lower(identifier) = lower(${identifier})`)
        .limit(1);

      const base = {
        identifier,
        ownerUserId: dto.ownerUserId,
        pipelineId: dto.pipelineId,
        stageId: dto.stageId,
        source: dto.source,
        score: dto.score,
        tags: dto.tags ?? [],
        customFields: cleanCustom,
      };

      if (existing[0]) {
        await db.update(lead).set(base).where(eq(lead.id, existing[0].id));
        await this.auditService.record({
          enterpriseId: eid,
          actorUserId: req.auth?.userId,
          actorTokenId: req.auth?.apiTokenId,
          action: 'lead.updated',
          resourceType: 'lead',
          resourceId: existing[0].id,
          before: existing[0],
          after: { ...existing[0], ...base },
        });
        return {
          status: 'UPDATED',
          leadId: existing[0].id,
          id: existing[0].id,
          identifier,
          fields,
          defaults: {
            pipelineId: dto.pipelineId,
            stageId: dto.stageId,
            source: dto.source,
            score: dto.score,
          },
          duplicates: [],
          parallelDuplicate: false,
        };
      }

      const inserted = await db
        .insert(lead)
        .values({ enterpriseId: eid, ...base })
        .returning({ id: lead.id });
      const lid = inserted[0]!.id;
      await this.auditService.record({
        enterpriseId: eid,
        actorUserId: req.auth?.userId,
        actorTokenId: req.auth?.apiTokenId,
        action: 'lead.created',
        resourceType: 'lead',
        resourceId: lid,
        after: { id: lid, ...base },
      });
      return {
        status: 'CREATED',
        leadId: lid,
        id: lid,
        identifier,
        fields,
        defaults: {
          pipelineId: dto.pipelineId,
          stageId: dto.stageId,
          source: dto.source,
          score: dto.score,
        },
        duplicates: [],
        parallelDuplicate: false,
      };
    });
  }

  @Get(':leadId')
  async getOne(@Param('eid') eid: string, @Param('leadId') leadId: string, @Req() req: FastifyRequest) {
    this.assertTenant(req, eid);
    const row = await this.withTenant(eid, async (db) =>
      db.select().from(lead).where(eq(lead.id, leadId)).limit(1),
    );
    if (!row[0]) throw this.notFound('LEAD_NOT_FOUND', 'Lead not found');
    return this.serialize(row[0]);
  }

  @Put(':leadId')
  async update(
    @Param('eid') eid: string,
    @Param('leadId') leadId: string,
    @Req() req: FastifyRequest,
    @Body() dto: CreateLeadDto & Record<string, unknown>,
  ) {
    this.assertTenant(req, eid);

    const merged: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(dto) as [string, unknown][]) {
      if (!RESERVED.has(k) && v !== undefined) merged[k] = v;
    }
    Object.assign(merged, dto.customFields ?? {});

    return this.withTenant(eid, async (db) => {
      const existing = await db.select().from(lead).where(eq(lead.id, leadId)).limit(1);
      if (!existing[0]) throw this.notFound('LEAD_NOT_FOUND', 'Lead not found');

      const fieldDefs = await db
        .select({ apiName: leadField.apiName })
        .from(leadField)
        .where(sql`archived_at IS NULL`);
      const valid = new Set(fieldDefs.map((f) => f.apiName));

      const fields: { apiName: string; status: string; remarks: string[] }[] = [];
      const cleanCustom: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(merged)) {
        if (valid.has(k)) {
          fields.push({ apiName: k, status: 'ACCEPTED', remarks: [] });
          if (v !== undefined && v !== null) cleanCustom[k] = v;
        } else {
          fields.push({ apiName: k, status: 'REJECTED', remarks: ['unknown field'] });
        }
      }

      const set: Partial<typeof lead.$inferInsert> = { customFields: cleanCustom };
      if (dto.identifier !== undefined) set.identifier = dto.identifier;
      if (dto.ownerUserId !== undefined) set.ownerUserId = dto.ownerUserId;
      if (dto.pipelineId !== undefined) set.pipelineId = dto.pipelineId;
      if (dto.stageId !== undefined) set.stageId = dto.stageId;
      if (dto.source !== undefined) set.source = dto.source;
      if (dto.score !== undefined) set.score = dto.score;
      if (dto.tags !== undefined) set.tags = dto.tags;

      await db.update(lead).set(set).where(eq(lead.id, leadId));
      await this.auditService.record({
        enterpriseId: eid,
        actorUserId: req.auth?.userId,
        actorTokenId: req.auth?.apiTokenId,
        action: 'lead.updated',
        resourceType: 'lead',
        resourceId: leadId,
        before: existing[0],
        after: { ...existing[0], ...set },
      });
      return { status: 'UPDATED', leadId, id: leadId, fields };
    });
  }

  @Delete(':leadId')
  async remove(@Param('eid') eid: string, @Param('leadId') leadId: string, @Req() req: FastifyRequest) {
    this.assertTenant(req, eid);
    await this.withTenant(eid, async (db) => {
      const existing = await db.select().from(lead).where(eq(lead.id, leadId)).limit(1);
      if (!existing[0]) throw this.notFound('LEAD_NOT_FOUND', 'Lead not found');
      await db.delete(lead).where(eq(lead.id, leadId));
      await this.auditService.record({
        enterpriseId: eid,
        actorUserId: req.auth?.userId,
        actorTokenId: req.auth?.apiTokenId,
        action: 'lead.deleted',
        resourceType: 'lead',
        resourceId: leadId,
        before: existing[0],
      });
    });
    return { success: true };
  }

  @Post('search')
  @HttpCode(200)
  async searchLeads(
    @Param('eid') eid: string,
    @Req() req: FastifyRequest,
    @Body() dto: SearchDto,
  ) {
    this.assertTenant(req, eid);
    const skip = dto.skip ?? 0;
    const limit = dto.limit ?? 10;
    const whereSql = (dto.filters ?? []).map((f) => this.condition(f));

    return this.withTenant(eid, async (db) => {
      const [rows, totalRows] = await Promise.all([
        db.select().from(lead).where(and(...whereSql)).orderBy(desc(lead.createdAt)).limit(limit).offset(skip),
        db.select({ c: count() }).from(lead).where(and(...whereSql)),
      ]);
      return { data: rows.map((r) => this.serialize(r)), total: totalRows[0]!.c };
    });
  }

  private genIdentifier(): string {
    return 'lead-' + crypto.randomUUID();
  }
}
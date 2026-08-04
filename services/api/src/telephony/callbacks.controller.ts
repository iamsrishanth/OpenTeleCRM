import { Body, Controller, Get, HttpCode, HttpException, HttpStatus, Param, Patch, Post, Query, Req } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { and, asc, count, eq, lte } from 'drizzle-orm';
import type { FastifyRequest } from 'fastify';
import type { DbClient } from '@opentelecrm/db';
import { callback, lead } from '@opentelecrm/db';
import type { AuthContext } from '../auth/auth.guard.js';
import { DB_PROVIDER, TENANT_WRAPPER } from '../db/database.module.js';
import { AuditService } from '../audit/audit.service.js';
import { resolveCallbackDue } from './callback-time.js';

type TenantFn = <T>(enterpriseId: string, fn: (db: DbClient) => Promise<T>) => Promise<T>;

const CHANNELS = ['in_app', 'whatsapp', 'email', 'push', 'call'];
const SOURCES = ['manual', 'dialer', 'automation', 'call_disposition'];

interface CreateCallbackDto {
  leadId?: string;
  dueAt?: string;
  quickChip?: string;
  customDueAt?: string;
  channel?: string;
  note?: string;
  source?: string;
}

/**
 * Follow-up callbacks (A1.5).
 *   POST  /enterprise/{eid}/callbacks        schedule (dueAt XOR quickChip)
 *   GET   /enterprise/{eid}/callbacks        list pending; ?due=true = overdue
 *   PATCH /enterprise/{eid}/callbacks/:id    { status: done|cancelled }
 */
@Controller('enterprise/:eid/callbacks')
export class CallbacksController {
  constructor(
    @Inject(DB_PROVIDER) private db: DbClient,
    @Inject(TENANT_WRAPPER) private withTenant: TenantFn,
    @Inject(AuditService) private readonly auditService: AuditService,
  ) {}

  private assertTenant(req: FastifyRequest, eid: string): AuthContext {
    const auth = req.auth;
    if (!auth) throw new Error('unauthenticated');
    if (auth.enterpriseId !== eid) throw new Error('enterprise mismatch');
    return auth;
  }

  private validationError(message: string): HttpException {
    return new HttpException({ error: { code: 'VALIDATION_ERROR', message } }, HttpStatus.BAD_REQUEST);
  }

  @Post()
  @HttpCode(200)
  async create(@Param('eid') eid: string, @Req() req: FastifyRequest, @Body() dto: CreateCallbackDto) {
    this.assertTenant(req, eid);

    const leadId = dto?.leadId;
    if (!leadId) throw this.validationError('leadId is required');
    if (dto?.channel !== undefined && !CHANNELS.includes(dto.channel)) {
      throw this.validationError(`channel must be one of: ${CHANNELS.join(', ')}`);
    }
    if (dto?.source !== undefined && !SOURCES.includes(dto.source)) {
      throw this.validationError(`source must be one of: ${SOURCES.join(', ')}`);
    }

    // Exactly one of dueAt or quickChip.
    const hasDueAt = typeof dto?.dueAt === 'string' && dto.dueAt.length > 0;
    const hasChip = typeof dto?.quickChip === 'string' && dto.quickChip.length > 0;
    if (hasDueAt === hasChip) {
      throw this.validationError('provide exactly one of dueAt (ISO) or quickChip (1h|3h|tomorrow_10am|custom)');
    }

    let dueAt: Date;
    if (hasDueAt) {
      const parsed = new Date(dto!.dueAt!);
      if (Number.isNaN(parsed.getTime())) throw this.validationError('dueAt must be a valid ISO timestamp');
      dueAt = parsed;
    } else {
      const resolved = resolveCallbackDue(dto!.quickChip, dto?.customDueAt);
      if (!resolved) {
        throw this.validationError('quickChip must be 1h|3h|tomorrow_10am|custom (custom requires customDueAt ISO)');
      }
      dueAt = resolved;
    }

    return this.withTenant(eid, async (db) => {
      const leadRow = await db
        .select({ id: lead.id })
        .from(lead)
        .where(and(eq(lead.enterpriseId, eid), eq(lead.id, leadId)))
        .limit(1);
      if (!leadRow[0]) {
        throw new HttpException({ error: { code: 'NOT_FOUND', message: 'lead not found' } }, HttpStatus.NOT_FOUND);
      }

      const [row] = await db
        .insert(callback)
        .values({
          enterpriseId: eid,
          leadId,
          dueAt,
          status: 'pending',
          source: dto?.source ?? 'manual',
          channel: dto?.channel ?? 'in_app',
          note: dto?.note ?? null,
        })
        .returning();
      if (!row) throw new Error('callback insert returned no row');
      await this.auditService.record({
        enterpriseId: eid,
        actorUserId: req.auth?.userId,
        actorTokenId: req.auth?.apiTokenId,
        action: 'callback.created',
        resourceType: 'callback',
        resourceId: row.id,
        after: { id: row.id, leadId, dueAt: row.dueAt.toISOString(), status: row.status },
      });
      return { id: row.id, dueAt: row.dueAt.toISOString(), status: row.status };
    });
  }

  @Get()
  async list(
    @Param('eid') eid: string,
    @Req() req: FastifyRequest,
    @Query('due') due?: string,
    @Query('leadId') leadId?: string,
  ) {
    this.assertTenant(req, eid);
    const now = new Date();

    const conds = [eq(callback.enterpriseId, eid), eq(callback.status, 'pending')];
    if (due === 'true') conds.push(lte(callback.dueAt, now));
    if (leadId) conds.push(eq(callback.leadId, leadId));

    const { rows, total } = await this.withTenant(eid, async (db) => {
      const [rows, totalRows] = await Promise.all([
        db.select().from(callback).where(and(...conds)).orderBy(asc(callback.dueAt)),
        db.select({ c: count() }).from(callback).where(and(...conds)),
      ]);
      return { rows, total: totalRows[0]!.c };
    });

    return {
      data: rows.map((r) => ({
        id: r.id,
        leadId: r.leadId,
        dueAt: r.dueAt.toISOString(),
        status: r.status,
        source: r.source,
        channel: r.channel,
        note: r.note,
        completedAt: r.completedAt,
        createdAt: r.createdAt,
      })),
      total,
    };
  }

  @Patch(':id')
  @HttpCode(200)
  async update(
    @Param('eid') eid: string,
    @Param('id') id: string,
    @Req() req: FastifyRequest,
    @Body() dto: { status?: string },
  ) {
    this.assertTenant(req, eid);
    const status = dto?.status;
    if (status !== 'done' && status !== 'cancelled') {
      throw this.validationError('status must be "done" or "cancelled"');
    }

    return this.withTenant(eid, async (db) => {
      const existing = await db
        .select()
        .from(callback)
        .where(and(eq(callback.enterpriseId, eid), eq(callback.id, id)))
        .limit(1);
      if (!existing[0]) {
        throw new HttpException({ error: { code: 'NOT_FOUND', message: 'callback not found' } }, HttpStatus.NOT_FOUND);
      }
      await db
        .update(callback)
        .set({ status, completedAt: status === 'done' ? new Date() : null })
        .where(eq(callback.id, id));
      await this.auditService.record({
        enterpriseId: eid,
        actorUserId: req.auth?.userId,
        actorTokenId: req.auth?.apiTokenId,
        action: 'callback.updated',
        resourceType: 'callback',
        resourceId: id,
        before: existing[0],
        after: { id, status, completedAt: status === 'done' ? new Date() : null },
      });
      return { id, status };
    });
  }
}

import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpException,
  NotFoundException,
  Param,
  Patch,
  Post,
  Req,
} from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { and, eq, sql } from 'drizzle-orm';
import type { FastifyRequest } from 'fastify';
import type { DbClient } from '@opentelecrm/db';
import { actionType, leadField } from '@opentelecrm/db';
import type { AuthContext } from '../auth/auth.guard.js';
import { DB_PROVIDER, TENANT_WRAPPER } from '../db/database.module.js';
import { AuditService } from '../audit/audit.service.js';

type TenantFn = <T>(enterpriseId: string, fn: (db: DbClient) => Promise<T>) => Promise<T>;

/** Built-in action-type codes that sync clients must not shadow (TeleCRM parity). */
const SYSTEM_ACTION_CODES = new Set(['note', 'call', 'whatsapp']);

/**
 * TeleCRM-parity custom actions (Sync API) + PATCH on custom fields.
 *   GET   /enterprise/{eid}/custom-actions
 *   POST  /enterprise/{eid}/custom-actions
 *   PATCH /enterprise/{eid}/custom-actions/:code
 *   PATCH /enterprise/{eid}/custom-fields/:apiName     (GET lives in metadata.controller)
 */
@Controller('enterprise/:eid')
export class MetaController {
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

  private toDto(r: { code: string; name: string; isSystem: boolean; fieldSchema: Record<string, unknown> }) {
    return { code: r.code, name: r.name, isSystem: r.isSystem, fieldSchema: r.fieldSchema };
  }

  @Get('custom-actions')
  async listActions(@Param('eid') eid: string, @Req() req: FastifyRequest) {
    this.assertTenant(req, eid);
    const rows = await this.withTenant(eid, async (db) => db.select().from(actionType));
    return { data: rows.map((r) => this.toDto(r)) };
  }

  @Post('custom-actions')
  async createAction(
    @Param('eid') eid: string,
    @Req() req: FastifyRequest,
    @Body() body: { code: string; name: string; fieldSchema?: Record<string, unknown> },
  ) {
    this.assertTenant(req, eid);
    if (!body || typeof body.code !== 'string' || typeof body.name !== 'string' || !body.code.trim() || !body.name.trim()) {
      throw new BadRequestException({ error: { code: 'BAD_REQUEST', message: 'code and name are required' } });
    }
    const code = body.code.trim();
    const lower = code.toLowerCase();
    if (SYSTEM_ACTION_CODES.has(lower)) {
      throw new HttpException(
        { error: { code: 'VALIDATION_ERROR', message: `'${code}' is a reserved system action code` } },
        422,
      );
    }
    const created = await this.withTenant(eid, async (db) => {
      const existing = await db.select().from(actionType).where(eq(actionType.code, code)).limit(1);
      if (existing[0]) {
        throw new HttpException(
          { error: { code: 'VALIDATION_ERROR', message: `action code '${code}' already exists` } },
          422,
        );
      }
      const rows = await db
        .insert(actionType)
        .values({
          enterpriseId: eid,
          code,
          name: body.name.trim(),
          fieldSchema: body.fieldSchema ?? {},
          isSystem: false,
        })
        .returning();
      const created = rows[0];
      if (!created) {
        throw new HttpException({ error: { code: 'VALIDATION_ERROR', message: 'custom action not created' } }, 422);
      }
      return created;
    });
    await this.auditService.record({
      enterpriseId: eid,
      actorUserId: req.auth?.userId,
      actorTokenId: req.auth?.apiTokenId,
      action: 'custom_action.created',
      resourceType: 'custom_action',
      resourceId: created.id,
      after: this.toDto(created),
    });
    return { data: this.toDto(created), status: 'CREATED' };
  }

  @Patch('custom-actions/:code')
  async updateAction(
    @Param('eid') eid: string,
    @Param('code') code: string,
    @Req() req: FastifyRequest,
    @Body() body: { name?: string; fieldSchema?: Record<string, unknown> },
  ) {
    this.assertTenant(req, eid);
    const updated = await this.withTenant(eid, async (db) => {
      const existing = await db.select().from(actionType).where(eq(actionType.code, code)).limit(1);
      const row = existing[0];
      if (!row) {
        throw new NotFoundException({ error: { code: 'NOT_FOUND', message: `action code '${code}' not found` } });
      }
      if (row.isSystem && body && (body.name !== undefined || body.fieldSchema !== undefined)) {
        throw new HttpException(
          { error: { code: 'VALIDATION_ERROR', message: 'system actions are immutable' } },
          422,
        );
      }
      const rows = await db
        .update(actionType)
        .set({
          name: body?.name !== undefined ? body.name : row.name,
          fieldSchema: body?.fieldSchema !== undefined ? body.fieldSchema : row.fieldSchema,
        })
        .where(eq(actionType.id, row.id))
        .returning();
      const after = rows[0] ?? row;
      await this.auditService.record({
        enterpriseId: eid,
        actorUserId: req.auth?.userId,
        actorTokenId: req.auth?.apiTokenId,
        action: 'custom_action.updated',
        resourceType: 'custom_action',
        resourceId: row.id,
        before: row,
        after,
      });
      return after;
    });
    return { data: this.toDto(updated), status: 'UPDATED' };
  }

  @Patch('custom-fields/:apiName')
  async updateField(
    @Param('eid') eid: string,
    @Param('apiName') apiName: string,
    @Req() req: FastifyRequest,
    @Body() body: { label?: string; required?: boolean; unique?: boolean; config?: Record<string, unknown> },
  ) {
    this.assertTenant(req, eid);
    const updated = await this.withTenant(eid, async (db) => {
      const existing = await db
        .select()
        .from(leadField)
        .where(and(eq(leadField.apiName, apiName), sql`archived_at IS NULL`))
        .limit(1);
      const row = existing[0];
      if (!row) {
        throw new NotFoundException({ error: { code: 'NOT_FOUND', message: `field '${apiName}' not found` } });
      }
      const rows = await db
        .update(leadField)
        .set({
          label: body?.label !== undefined ? body.label : row.label,
          required: body?.required !== undefined ? body.required : row.required,
          unique: body?.unique !== undefined ? body.unique : row.unique,
          config: body?.config !== undefined ? body.config : row.config,
        })
        .where(eq(leadField.id, row.id))
        .returning();
      const after = rows[0] ?? row;
      await this.auditService.record({
        enterpriseId: eid,
        actorUserId: req.auth?.userId,
        actorTokenId: req.auth?.apiTokenId,
        action: 'custom_field.updated',
        resourceType: 'custom_field',
        resourceId: row.id,
        before: row,
        after,
      });
      return after;
    });
    return {
      data: {
        apiName: updated.apiName, // immutable
        label: updated.label,
        type: updated.type,
        required: updated.required,
        unique: updated.unique,
        config: updated.config,
      },
      status: 'UPDATED',
    };
  }
}
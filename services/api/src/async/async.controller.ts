import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpException,
  Param,
  Post,
  Req,
} from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { and, eq, sql } from 'drizzle-orm';
import type { FastifyRequest } from 'fastify';
import type { DbClient } from '@opentelecrm/db';
import { action, actionType, enterprise, lead, leadField } from '@opentelecrm/db';
import type { AuthContext } from '../auth/auth.guard.js';
import { DB_PROVIDER, TENANT_WRAPPER } from '../db/database.module.js';
import { AuditService } from '../audit/audit.service.js';

type TenantFn = <T>(enterpriseId: string, fn: (db: DbClient) => Promise<T>) => Promise<T>;

interface IngestField {
  apiName: string;
  value: unknown;
  status: 'OK' | 'REJECTED';
  remarks?: string[];
}

interface IngestAction {
  type: string;
  code: string;
  payload: Record<string, unknown>;
  status: 'OK' | 'REJECTED';
  remarks?: string[];
}

interface IngestRecord {
  requestId: string;
  status: 'queued' | 'processed';
  fields: IngestField[];
  actions: IngestAction[];
  createdAt: number;
}

interface IngestPayload {
  fields: Record<string, unknown>;
  actions?: Array<{ type: string } & Record<string, unknown>>;
}

/**
 * In-memory ingest ledger for GET /ingest/:requestId.
 * NOTE: persistence lands with the queue worker (task T7) — until then this map
 * is process-local and lost on restart.
 */
const ingestLedger = new Map<string, IngestRecord>();

/**
 * TeleCRM-parity async ingestion surface.
 *   POST /enterprise/{eid}/autoupdatelead
 *   GET  /enterprise/{eid}/ingest/:requestId
 *
 * Fire-and-forget: the endpoint always answers 200 { success, requestId, message:'queued' }
 * and the actual DB write happens on a detached promise. ?validate=true turns the
 * call into a synchronous dry-run (zero writes). X-Strict-Mode: true rejects the
 * request with 422 on ANY unknown field instead of dropping it.
 */
@Controller('enterprise/:eid')
export class AsyncController {
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

  /** Normalize `ACTION_1001` -> `1001`, `ACTION_note` -> `note`. */
  private normalizeActionType(type: string): string {
    const t = type.trim();
    return t.toUpperCase().startsWith('ACTION_') ? t.slice('ACTION_'.length) : t;
  }

  private async loadFieldDefs(eid: string) {
    return this.withTenant(eid, async (db) => {
      const ent = await db.select().from(enterprise).where(eq(enterprise.id, eid)).limit(1);
      const fields = await db.select().from(leadField).where(sql`archived_at IS NULL`);
      const actions = await db.select().from(actionType);
      return { ent: ent[0], fieldDefs: fields, actionDefs: actions };
    });
  }

  private validatePayload(
    fields: Record<string, unknown> | undefined,
    actions: IngestPayload['actions'] | undefined,
    fieldDefs: { apiName: string }[],
    actionDefs: { code: string }[],
    leadIdentifier: string,
    strict: boolean,
  ) {
    if (!fields || typeof fields !== 'object' || Array.isArray(fields)) {
      throw new HttpException(
        { error: { code: 'VALIDATION_ERROR', message: 'fields object is required' } },
        422,
      );
    }
    const validApiNames = new Set(fieldDefs.map((f) => f.apiName));
    // The enterprise's lead identifier (default 'phone') is always a valid field,
    // even though it is not necessarily present in lead_field (it maps to lead.identifier).
    validApiNames.add(leadIdentifier);
    const fieldResults: IngestField[] = Object.entries(fields).map(([apiName, value]) => {
      if (validApiNames.has(apiName)) {
        return { apiName, value, status: 'OK' as const };
      }
      return { apiName, value, status: 'REJECTED' as const, remarks: [`unknown field: ${apiName}`] };
    });

    const rejected = fieldResults.filter((f) => f.status === 'REJECTED');
    const hasIdentifier = fieldResults.some((f) => f.apiName === leadIdentifier);

    const actionResults: IngestAction[] = (actions ?? []).map((a) => {
      const code = this.normalizeActionType(String(a.type ?? ''));
      const { type: _t, ...payload } = a;
      if (!code || !actionDefs.some((d) => d.code === code)) {
        return {
          type: a.type,
          code,
          payload,
          status: 'REJECTED' as const,
          remarks: [`unknown action type: ${a.type}`],
        };
      }
      return { type: a.type, code, payload, status: 'OK' as const };
    });

    if (strict && rejected.length > 0) {
      throw new HttpException(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: `unknown field(s): ${rejected.map((f) => f.apiName).join(', ')}`,
            details: rejected.map((f) => ({ apiName: f.apiName, remarks: f.remarks })),
          },
        },
        422,
      );
    }
    if (!hasIdentifier) {
      // The identifier (leadIdentifier, default 'phone') must always be present.
      fieldResults.push({
        apiName: leadIdentifier,
        value: undefined,
        status: 'REJECTED',
        remarks: [`missing lead identifier field: ${leadIdentifier}`],
      });
    }
    return { fieldResults, actionResults };
  }

  /** Detached, best-effort ingest. Never throws to the caller (fire-and-forget). */
  private async processIngest(
    eid: string,
    fields: Record<string, unknown>,
    actions: IngestPayload['actions'] | undefined,
    fieldResults: IngestField[],
    actionResults: IngestAction[],
    record: IngestRecord,
  ) {
    try {
      const okFields = fieldResults.filter((f) => f.status === 'OK');
      const leadIdentifier = await this.leadIdentifier(eid);
      const identifierField = okFields.find((f) => f.apiName === leadIdentifier) ?? okFields[0];
      if (!identifierField || identifierField.value === undefined || identifierField.value === null || identifierField.value === '') {
        record.status = 'processed';
        return;
      }
      const identValue = String(identifierField.value);
      await this.withTenant(eid, async (db) => {
        const custom: Record<string, unknown> = {};
        for (const f of okFields) {
          if (f.apiName === identifierField.apiName) continue;
          custom[f.apiName] = f.value;
        }
        let existing = await db
          .select()
          .from(lead)
          .where(and(eq(lead.enterpriseId, eid), eq(lead.identifier, identValue)))
          .limit(1);
        let leadId: string;
        if (existing[0]) {
          leadId = existing[0].id;
          await db.update(lead).set({ customFields: custom }).where(eq(lead.id, leadId));
        } else {
          const inserted = await db
            .insert(lead)
            .values({ enterpriseId: eid, identifier: identValue, customFields: custom, source: 'autoupdate' })
            .returning();
          leadId = inserted[0]?.id ?? '';
        }
        // Persist validated actions.
        const okActions = actionResults.filter((a) => a.status === 'OK');
        if (leadId && okActions.length > 0) {
          const defs = await db.select().from(actionType);
          for (const a of okActions) {
            const def = defs.find((d) => d.code === a.code);
            if (!def) continue;
            await db
              .insert(action)
              .values({ enterpriseId: eid, leadId, actionTypeId: def.id, payload: a.payload, note: typeof a.payload.note === 'string' ? a.payload.note : null });
          }
        }
      });
      record.status = 'processed';
    } catch (err) {
      record.status = 'processed';
    }
  }

  private async leadIdentifier(eid: string): Promise<string> {
    const { ent } = await this.loadFieldDefs(eid);
    return ent?.leadIdentifier ?? 'phone';
  }

  @Post('autoupdatelead')
  @HttpCode(200)
  async autoupdateLead(
    @Param('eid') eid: string,
    @Req() req: FastifyRequest,
    @Headers('x-strict-mode') strictHeader: string | undefined,
  ) {
    this.assertTenant(req, eid);
    const strict = String(strictHeader ?? '').trim().toLowerCase() === 'true';
    const payload = (req.body ?? {}) as IngestPayload;
    const requestId = randomUUID();
    const { ent, fieldDefs, actionDefs } = await this.loadFieldDefs(eid);
    const leadIdentifier = ent?.leadIdentifier ?? 'phone';
    const { fieldResults, actionResults } = this.validatePayload(
      payload.fields,
      payload.actions,
      fieldDefs,
      actionDefs,
      leadIdentifier,
      strict,
    );

    // ?validate=true → synchronous dry-run, ZERO writes.
    const isValidate = typeof req.query === 'object' && req.query !== null && (req.query as Record<string, unknown>).validate === 'true';
    if (isValidate) {
      return {
        success: true,
        requestId,
        validated: true,
        fields: fieldResults.map((f) => ({ apiName: f.apiName, status: f.status, remarks: f.remarks })),
        actions: actionResults.map((a) => ({ type: a.type, status: a.status, remarks: a.remarks })),
      };
    }

    const record: IngestRecord = {
      requestId,
      status: 'queued',
      fields: fieldResults,
      actions: actionResults,
      createdAt: Date.now(),
    };
    ingestLedger.set(requestId, record);
    await this.auditService.record({
      enterpriseId: eid,
      actorUserId: req.auth?.userId,
      actorTokenId: req.auth?.apiTokenId,
      action: 'async.ingested',
      resourceType: 'ingest',
      resourceId: requestId,
      after: { requestId, status: 'queued' },
    });
    void this.processIngest(eid, payload.fields, payload.actions, fieldResults, actionResults, record);
    return { success: true, requestId, message: 'queued' };
  }

  @Get('ingest/:requestId')
  async ingestStatus(@Param('eid') eid: string, @Param('requestId') requestId: string, @Req() req: FastifyRequest) {
    this.assertTenant(req, eid);
    const record = ingestLedger.get(requestId);
    if (!record) {
      throw new HttpException({ error: { code: 'NOT_FOUND', message: 'requestId not found' } }, 404);
    }
    return {
      data: {
        requestId: record.requestId,
        status: record.status,
        fields: record.fields.map((f) => ({ apiName: f.apiName, status: f.status, remarks: f.remarks })),
        actions: record.actions.map((a) => ({ type: a.type, status: a.status, remarks: a.remarks })),
      },
    };
  }
}
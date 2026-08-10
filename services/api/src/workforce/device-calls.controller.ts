/**
 * Workforce — device-side call tracking (ByteCodeEMS mobile call tracker port).
 *   POST /enterprise/{eid}/device-calls  { calls: DeviceCallDto[] }  (batch ≤ 500)
 *   GET  /enterprise/{eid}/device-calls?from&to  own list (200)
 */
import { Body, Controller, Get, HttpCode, HttpException, HttpStatus, Param, Post, Query, Req } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { and, desc, eq } from 'drizzle-orm';
import type { FastifyRequest } from 'fastify';
import type { DbClient } from '@opentelecrm/db';
import { deviceCall } from '@opentelecrm/db';
import type { AuthContext } from '../auth/auth.guard.js';
import { DB_PROVIDER, TENANT_WRAPPER } from '../db/database.module.js';
import { AuditService } from '../audit/audit.service.js';
import { MEMBER_ROLES, requireRole } from './roles.js';

type TenantFn = <T>(enterpriseId: string, fn: (db: DbClient) => Promise<T>) => Promise<T>;

const CALL_TYPES = ['incoming', 'outgoing', 'missed'];
const MAX_BATCH = 500;

interface DeviceCallDto {
  phoneNumber: string;
  callType: string;
  durationSec?: number;
  startedAt: string;
  simSlot?: string | null;
  simCarrier?: string | null;
}

@Controller('enterprise/:eid/device-calls')
export class DeviceCallsController {
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
  async importBatch(@Param('eid') eid: string, @Req() req: FastifyRequest, @Body() dto: { calls?: DeviceCallDto[] }) {
    const auth = this.assertTenant(req, eid);
    const calls = dto?.calls;
    if (!Array.isArray(calls) || calls.length === 0) throw this.validationError('calls[] is required');
    if (calls.length > MAX_BATCH) throw this.validationError(`batch size must be ≤ ${MAX_BATCH}`);

    return this.withTenant(eid, async (db) => {
      const member = await requireRole(db, eid, auth.userId, MEMBER_ROLES);
      const rows: (typeof deviceCall.$inferInsert)[] = [];
      for (const c of calls) {
        if (!c?.phoneNumber || typeof c.phoneNumber !== 'string') throw this.validationError('phoneNumber is required per call');
        if (!CALL_TYPES.includes(c.callType)) throw this.validationError(`callType must be one of: ${CALL_TYPES.join(', ')}`);
        const startedAt = new Date(c.startedAt);
        if (Number.isNaN(startedAt.getTime())) throw this.validationError('startedAt must be a valid ISO timestamp');
        rows.push({
          enterpriseId: eid,
          memberId: member.id,
          phoneNumber: c.phoneNumber,
          callType: c.callType,
          durationSec: Number(c.durationSec) || 0,
          startedAt,
          simSlot: c.simSlot ?? null,
          simCarrier: c.simCarrier ?? null,
        });
      }
      await db.insert(deviceCall).values(rows);
      await this.auditService.record({
        enterpriseId: eid,
        actorUserId: auth.userId,
        actorTokenId: auth.apiTokenId,
        action: 'device-call.imported',
        resourceType: 'device_call',
        after: { count: rows.length },
      });
      return { imported: rows.length };
    });
  }

  @Get()
  async list(@Param('eid') eid: string, @Req() req: FastifyRequest, @Query('from') from?: string, @Query('to') to?: string) {
    const auth = this.assertTenant(req, eid);
    return this.withTenant(eid, async (db) => {
      const member = await requireRole(db, eid, auth.userId, MEMBER_ROLES);
      const conds = [eq(deviceCall.enterpriseId, eid), eq(deviceCall.memberId, member.id)];
      if (from) conds.push(eq(deviceCall.startedAt, new Date(from)));
      if (to) conds.push(eq(deviceCall.startedAt, new Date(to)));
      const rows = await db.select().from(deviceCall).where(and(...conds)).orderBy(desc(deviceCall.startedAt)).limit(200);
      return {
        data: rows.map((r) => ({
          id: r.id,
          phoneNumber: r.phoneNumber,
          callType: r.callType,
          durationSec: r.durationSec,
          startedAt: r.startedAt.toISOString(),
          simSlot: r.simSlot,
          simCarrier: r.simCarrier,
        })),
        total: rows.length,
      };
    });
  }
}

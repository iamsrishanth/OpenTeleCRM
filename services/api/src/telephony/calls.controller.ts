import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpException,
  HttpStatus,
  Param,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { and, count, desc, eq, gte, lte, sql } from 'drizzle-orm';
import type { FastifyRequest } from 'fastify';
import type { DbClient } from '@opentelecrm/db';
import { action, actionType, call, lead } from '@opentelecrm/db';
import type { CallDirection, CallDisposition, CallStatus } from '@opentelecrm/contracts';
import type { AuthContext } from '../auth/auth.guard.js';
import { DB_PROVIDER, TENANT_WRAPPER } from '../db/database.module.js';
import { AuditService } from '../audit/audit.service.js';

type TenantFn = <T>(enterpriseId: string, fn: (db: DbClient) => Promise<T>) => Promise<T>;

const DIRECTIONS: readonly CallDirection[] = ['inbound', 'outbound'];
const STATUSES: readonly CallStatus[] = [
  'queued',
  'ringing',
  'in-progress',
  'completed',
  'failed',
  'no-answer',
  'missed',
  'rejected',
  'busy',
  'cancelled',
];
const DISPOSITIONS: readonly CallDisposition[] = [
  'answered',
  'no_answer',
  'busy',
  'not_connected',
  'wrong_number',
  'not_interested',
  'callback',
  'dnc',
  'converted',
  'follow_up',
  'other',
];

interface LogCallDto {
  leadId?: string;
  phone?: string;
  direction?: string;
  status?: string;
  disposition?: string;
  durationSec?: number;
  talkSec?: number;
  ringSec?: number;
  trunk?: string;
  did?: string;
  note?: string;
  recordingId?: string;
}

/**
 * Call logging / tracking surface (A1.3).
 *   POST /enterprise/{eid}/calls          log a call leg (auto-links lead by
 *                                         identifier = phone when leadId omitted)
 *   GET  /enterprise/{eid}/calls          list w/ filters (direction, status,
 *                                         disposition, leadId, from, to, skip, limit)
 *   GET  /enterprise/{eid}/calls/:id      one call (404 NOT_FOUND envelope)
 */
@Controller('enterprise/:eid/calls')
export class CallsController {
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

  private notFound(message: string): HttpException {
    return new HttpException({ error: { code: 'NOT_FOUND', message } }, HttpStatus.NOT_FOUND);
  }

  private serialize(row: typeof call.$inferSelect) {
    return {
      id: row.id,
      leadId: row.leadId,
      direction: row.direction,
      status: row.status,
      disposition: row.disposition,
      phone: row.phone,
      startedAt: row.startedAt,
      endedAt: row.endedAt,
      durationSec: row.durationSec,
      talkSec: row.talkSec,
      ringSec: row.ringSec,
      recordingId: row.recordingId,
      trunk: row.trunk,
      did: row.did,
      agentUserId: row.agentUserId,
      note: row.note,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  @Post()
  @HttpCode(200)
  async logCall(@Param('eid') eid: string, @Req() req: FastifyRequest, @Body() dto: LogCallDto) {
    this.assertTenant(req, eid);

    const phone = typeof dto?.phone === 'string' ? dto.phone.trim() : '';
    if (!phone) throw this.validationError('phone is required (E.164)');
    if (dto.direction === undefined || !DIRECTIONS.includes(dto.direction as CallDirection)) {
      throw this.validationError(`direction must be one of: ${DIRECTIONS.join(', ')}`);
    }
    if (dto.status === undefined || !STATUSES.includes(dto.status as CallStatus)) {
      throw this.validationError(`status must be one of: ${STATUSES.join(', ')}`);
    }
    if (dto.disposition !== undefined && dto.disposition !== null && !DISPOSITIONS.includes(dto.disposition as CallDisposition)) {
      throw this.validationError(`disposition must be one of: ${DISPOSITIONS.join(', ')}`);
    }

    const row = await this.withTenant(eid, async (db) => {
      let leadId: string | null = dto.leadId ?? null;
      if (!leadId) {
        // A1.6 auto-link: resolve the lead by identifier = phone (case-insensitive).
        const match = await db
          .select({ id: lead.id })
          .from(lead)
          .where(sql`lower(identifier) = lower(${phone})`)
          .limit(1);
        if (match[0]) leadId = match[0].id;
      }

      const [inserted] = await db
        .insert(call)
        .values({
          enterpriseId: eid,
          leadId,
          direction: dto.direction as CallDirection,
          status: dto.status as CallStatus,
          disposition: (dto.disposition as CallDisposition) ?? null,
          phone,
          durationSec: dto.durationSec ?? 0,
          talkSec: dto.talkSec ?? 0,
          ringSec: dto.ringSec ?? 0,
          trunk: dto.trunk ?? null,
          did: dto.did ?? null,
          note: dto.note ?? null,
          recordingId: dto.recordingId ?? null,
        })
        .returning();
      if (!inserted) throw new Error('call insert returned no row');

      // Timeline entry (system action type 'call') when the leg linked a lead.
      if (leadId) {
        const type = await db
          .select({ id: actionType.id })
          .from(actionType)
          .where(and(eq(actionType.enterpriseId, eid), eq(actionType.code, 'call')))
          .limit(1);
        if (type[0]) {
          await db.insert(action).values({
            enterpriseId: eid,
            leadId,
            actionTypeId: type[0].id,
            payload: {
              disposition: dto.disposition ?? null,
              direction: dto.direction,
              phone,
              durationSec: dto.durationSec ?? 0,
            },
            note: dto.note ?? null,
          });
        }
      }
      return inserted;
    });

    await this.auditService.record({
      enterpriseId: eid,
      actorUserId: req.auth?.userId,
      actorTokenId: req.auth?.apiTokenId,
      action: 'call.created',
      resourceType: 'call',
      resourceId: row.id,
      after: this.serialize(row),
    });

    return this.serialize(row);
  }

  @Get()
  async list(
    @Param('eid') eid: string,
    @Req() req: FastifyRequest,
    @Query('direction') direction?: string,
    @Query('status') status?: string,
    @Query('disposition') disposition?: string,
    @Query('leadId') leadId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('skip') skip?: string,
    @Query('limit') limit?: string,
  ) {
    this.assertTenant(req, eid);
    const skipN = Number(skip ?? 0);
    const limitN = Math.min(Math.max(Number(limit ?? 10), 1), 100);

    const conds = [eq(call.enterpriseId, eid)];
    if (direction) conds.push(eq(call.direction, direction));
    if (status) conds.push(eq(call.status, status));
    if (disposition) conds.push(eq(call.disposition, disposition));
    if (leadId) conds.push(eq(call.leadId, leadId));
    if (from) conds.push(gte(call.startedAt, new Date(from)));
    if (to) conds.push(lte(call.startedAt, new Date(to)));

    const { rows, total } = await this.withTenant(eid, async (db) => {
      const [rows, totalRows] = await Promise.all([
        db
          .select()
          .from(call)
          .where(and(...conds))
          .orderBy(desc(call.startedAt))
          .limit(limitN)
          .offset(skipN),
        db.select({ c: count() }).from(call).where(and(...conds)),
      ]);
      return { rows, total: totalRows[0]!.c };
    });

    return { data: rows.map((r) => this.serialize(r)), total };
  }

  @Get(':id')
  async getOne(@Param('eid') eid: string, @Param('id') id: string, @Req() req: FastifyRequest) {
    this.assertTenant(req, eid);
    const row = await this.withTenant(eid, async (db) =>
      db.select().from(call).where(and(eq(call.enterpriseId, eid), eq(call.id, id))).limit(1),
    );
    if (!row[0]) throw this.notFound('call not found');
    return this.serialize(row[0]);
  }
}

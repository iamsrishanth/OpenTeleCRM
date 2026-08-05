import { Body, Controller, HttpCode, HttpException, HttpStatus, Param, Post, Req } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { and, count, eq, gte, inArray, max, min, sql } from 'drizzle-orm';
import type { FastifyRequest } from 'fastify';
import type { DbClient } from '@opentelecrm/db';
import { action, actionType, call, callback, dndRegistry, lead } from '@opentelecrm/db';
import { scoreDialerCandidate, sortDialerCandidates, type DialerInput, type DialerScoringConfig } from '@opentelecrm/telephony';
import { resolveTelephonyDriver, telephonyProviderFor } from '@opentelecrm/telephony';
import type { CallDisposition, DialerCandidate, DialerMode } from '@opentelecrm/contracts';
import type { AuthContext } from '../auth/auth.guard.js';
import { DB_PROVIDER, TENANT_WRAPPER } from '../db/database.module.js';
import { resolveCallbackDue } from './callback-time.js';

type TenantFn = <T>(enterpriseId: string, fn: (db: DbClient) => Promise<T>) => Promise<T>;

const MODES: readonly DialerMode[] = ['power', 'preview', 'progressive'];
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

interface NextBody {
  mode?: string;
  limit?: number;
  agentUserId?: string;
  ignoreCallingWindow?: boolean;
}

interface DispositionBody {
  disposition?: string;
  note?: string;
  durationSec?: number;
  talkSec?: number;
  callbackIn?: string;
  callbackAt?: string;
  callbackNote?: string;
}

const SLA_HOURS = 24;
const MS_PER_HOUR = 3_600_000;

/** Replicates the SLA-breach fraction from scoring.ts (default config). */
function slaBreachRisk(input: DialerInput, now: Date): number {
  const ageHours = Math.max(0, (now.getTime() - new Date(input.createdAt).getTime()) / MS_PER_HOUR);
  if (input.pendingFollowUpDueAt !== null || ageHours <= SLA_HOURS) return 0;
  return Math.min(1, (ageHours - SLA_HOURS) / SLA_HOURS);
}

/**
 * Smart dialer queue (A1.1).
 *   POST /enterprise/{eid}/dialer/next                pull next candidate(s)
 *   POST /enterprise/{eid}/dialer/{leadId}/disposition wrap-up disposition
 *   POST /enterprise/{eid}/dialer/{leadId}/skip        skip (no-op v1)
 * Scoring/sorting delegate to @opentelecrm/telephony (pure fns).
 */
@Controller('enterprise/:eid/dialer')
export class DialerController {
  constructor(
    @Inject(DB_PROVIDER) private db: DbClient,
    @Inject(TENANT_WRAPPER) private withTenant: TenantFn,
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

  @Post('next')
  @HttpCode(200)
  async next(@Param('eid') eid: string, @Req() req: FastifyRequest, @Body() body: NextBody) {
    this.assertTenant(req, eid);
    if (body?.mode !== undefined && !MODES.includes(body.mode as DialerMode)) {
      throw this.validationError(`mode must be one of: ${MODES.join(', ')}`);
    }
    const limit = Math.min(Math.max(Number(body?.limit ?? 1), 1), 10);

    const now = new Date();
    const config: DialerScoringConfig = {
      now,
      ...(body?.ignoreCallingWindow === true ? { ignoreCallingWindow: true } : {}),
    };

    const result = await this.withTenant(eid, async (db) => {
      // Eligible: phone-ish identifier, not DND-registered for call/all.
      const leads = await db
        .select()
        .from(lead)
        .where(
          and(
            eq(lead.enterpriseId, eid),
            sql`identifier LIKE '+%'`,
            sql`NOT EXISTS (
              SELECT 1 FROM ${dndRegistry} d
              WHERE d.enterprise_id = ${eid}
                AND d.phone = ${lead.identifier}
                AND d.channel IN ('call', 'all')
            )`,
          ),
        );
      const ids = leads.map((l) => l.id);
      if (ids.length === 0) return [] as DialerInput[];

      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const [lastCalls, callsToday, pendingFollowUps] = await Promise.all([
        db
          .select({ leadId: call.leadId, last: max(call.startedAt) })
          .from(call)
          .where(and(eq(call.enterpriseId, eid), inArray(call.leadId, ids)))
          .groupBy(call.leadId),
        db
          .select({ leadId: call.leadId, c: count() })
          .from(call)
          .where(and(eq(call.enterpriseId, eid), inArray(call.leadId, ids), gte(call.startedAt, startOfToday)))
          .groupBy(call.leadId),
        db
          .select({ leadId: callback.leadId, dueAt: min(callback.dueAt) })
          .from(callback)
          .where(and(eq(callback.enterpriseId, eid), eq(callback.status, 'pending'), inArray(callback.leadId, ids)))
          .groupBy(callback.leadId),
      ]);

      const lastByLead = new Map(lastCalls.map((r) => [r.leadId, r.last]));
      const todayByLead = new Map(callsToday.map((r) => [r.leadId, r.c]));
      const followUpByLead = new Map(pendingFollowUps.map((r) => [r.leadId, r.dueAt]));

      return leads.map((l) => {
        const input: DialerInput = {
          leadId: l.id,
          identifier: l.identifier,
          phone: l.identifier,
          score: l.score ?? 0,
          createdAt: l.createdAt.toISOString(),
          lastDialedAt: lastByLead.get(l.id)?.toISOString() ?? null,
          callsToday: todayByLead.get(l.id) ?? 0,
          pendingFollowUpDueAt: followUpByLead.get(l.id)?.toISOString() ?? null,
        };
        return input;
      });
    });

    const ranked = sortDialerCandidates(result, config).slice(0, limit);
    const data: DialerCandidate[] = ranked.map((input) => {
      const { score, reasons } = scoreDialerCandidate(input, config);
      const ageHours = Math.max(0, (now.getTime() - new Date(input.createdAt).getTime()) / MS_PER_HOUR);
      return {
        leadId: input.leadId,
        identifier: input.identifier,
        phone: input.phone,
        score,
        reasons,
        followUpDueAt: input.pendingFollowUpDueAt,
        slaBreachRisk: slaBreachRisk(input, now),
        leadScore: input.score,
        freshnessHours: ageHours,
        lastDialedAt: input.lastDialedAt,
      };
    });

    return { data };
  }

  @Post(':leadId/dial')
  @HttpCode(200)
  async dial(
    @Param('eid') eid: string,
    @Param('leadId') leadId: string,
    @Req() req: FastifyRequest,
    @Body() body: { from?: string } | undefined,
  ) {
    this.assertTenant(req, eid);
    // Guard malformed ids before they hit the uuid-typed column (a non-UUID
    // param would 500 on the DB cast instead of 404).
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(leadId)) {
      throw new HttpException(
        { error: { code: 'LEAD_NOT_FOUND', message: 'Lead not found' } },
        HttpStatus.NOT_FOUND,
      );
    }
    return this.withTenant(eid, async (db) => {
      const leadRow = await db
        .select()
        .from(lead)
        .where(and(eq(lead.enterpriseId, eid), eq(lead.id, leadId)))
        .limit(1);
      if (!leadRow[0]) {
        throw new HttpException(
          { error: { code: 'LEAD_NOT_FOUND', message: 'Lead not found' } },
          HttpStatus.NOT_FOUND,
        );
      }
      const phone = leadRow[0].identifier;
      if (!phone || !phone.startsWith('+')) {
        throw this.validationError('lead has no dialable phone identifier');
      }

      // Real 1-click dial (A1.1): driver comes from env. With asterisk-ari the
      // originate carries enterprise_id/lead_id as channel variables so the
      // Stasis events can tenant-scope the call row updates.
      const driver = resolveTelephonyDriver();
      const provider = await telephonyProviderFor(eid, driver);
      const { callId } = await provider.dial(phone, body?.from ?? undefined, {
        variables: { enterprise_id: eid, lead_id: leadId },
      });

      const [inserted] = await db
        .insert(call)
        .values({
          enterpriseId: eid,
          leadId,
          direction: 'outbound',
          status: 'queued',
          phone,
          providerCallId: callId,
          durationSec: 0,
          talkSec: 0,
        })
        .returning({ id: call.id });
      if (!inserted) throw new Error('call insert returned no row');
      return { callId, id: inserted.id };
    });
  }

  @Post(':leadId/disposition')
  @HttpCode(200)
  async disposition(
    @Param('eid') eid: string,
    @Param('leadId') leadId: string,
    @Req() req: FastifyRequest,
    @Body() body: DispositionBody,
  ) {
    this.assertTenant(req, eid);
    const disposition = body?.disposition;
    if (disposition === undefined || !DISPOSITIONS.includes(disposition as CallDisposition)) {
      throw this.validationError(`disposition must be one of: ${DISPOSITIONS.join(', ')}`);
    }

    const now = new Date();
    return this.withTenant(eid, async (db) => {
      const leadRow = await db
        .select()
        .from(lead)
        .where(and(eq(lead.enterpriseId, eid), eq(lead.id, leadId)))
        .limit(1);
      if (!leadRow[0]) {
        throw new HttpException({ error: { code: 'LEAD_NOT_FOUND', message: 'Lead not found' } }, HttpStatus.NOT_FOUND);
      }

      // Disposition → call status (TeleCRM wrap-up semantics).
      let status: string;
      switch (disposition) {
        case 'no_answer':
          status = 'no-answer';
          break;
        case 'busy':
          status = 'busy';
          break;
        case 'not_connected':
          status = 'failed';
          break;
        default:
          status = 'completed';
      }

      const [inserted] = await db
        .insert(call)
        .values({
          enterpriseId: eid,
          leadId,
          direction: 'outbound',
          status,
          disposition,
          phone: leadRow[0].identifier,
          durationSec: body?.durationSec ?? 0,
          talkSec: body?.talkSec ?? 0,
          note: body?.note ?? null,
        })
        .returning();
      if (!inserted) throw new Error('call insert returned no row');
      const callId = inserted.id;

      // Timeline entry.
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
          payload: { disposition, note: body?.note ?? null },
          note: body?.note ?? null,
        });
      }

      // Follow-up callback from the wrap-up.
      let callbackId: string | undefined;
      if (body?.callbackIn || body?.callbackAt) {
        const dueAt = resolveCallbackDue(body.callbackIn, body.callbackAt, now);
        if (!dueAt) {
          throw new HttpException(
            { error: { code: 'VALIDATION_ERROR', message: 'callbackIn must be 1h|3h|tomorrow_10am|custom (custom requires callbackAt)' } },
            HttpStatus.BAD_REQUEST,
          );
        }
        const [cb] = await db
          .insert(callback)
          .values({
            enterpriseId: eid,
            leadId,
            dueAt,
            status: 'pending',
            source: 'call_disposition',
            channel: 'call',
            note: body?.callbackNote ?? body?.note ?? null,
          })
          .returning({ id: callback.id });
        callbackId = cb?.id;
      }

      return { id: callId, callId, ...(callbackId ? { callbackId } : {}) };
    });
  }

  @Post(':leadId/skip')
  @HttpCode(200)
  async skip(@Param('eid') eid: string, @Param('leadId') _leadId: string, @Req() req: FastifyRequest) {
    this.assertTenant(req, eid);
    // No-op for v1: scoring deprioritizes re-dials naturally via callsToday.
    return { skipped: true };
  }
}

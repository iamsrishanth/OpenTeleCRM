import { Controller, Get, HttpCode, Param, Req } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { and, desc, eq } from 'drizzle-orm';
import type { FastifyRequest } from 'fastify';
import type { DbClient } from '@opentelecrm/db';
import { action, call, lead } from '@opentelecrm/db';
import type { AuthContext } from '../auth/auth.guard.js';
import { DB_PROVIDER, TENANT_WRAPPER } from '../db/database.module.js';

type TenantFn = <T>(enterpriseId: string, fn: (db: DbClient) => Promise<T>) => Promise<T>;

/**
 * Live caller ID (A1.6) — one-tap create-lead flow.
 *   GET /enterprise/{eid}/caller-id/{phone}
 * Resolves the number to a lead (identifier match, whitespace/dash-normalized).
 * Always 200: found:true + lead profile when known, found:false +
 * suggestion 'create-lead' when unknown (the UI one-tap creates).
 */
@Controller('enterprise/:eid/caller-id')
export class CallerIdController {
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

  private normalizePhone(raw: string): string {
    return raw.replace(/[\s-]/g, '');
  }

  @Get(':phone')
  @HttpCode(200)
  async lookup(@Param('eid') eid: string, @Param('phone') phone: string, @Req() req: FastifyRequest) {
    this.assertTenant(req, eid);
    const normalized = this.normalizePhone(phone);

    const result = await this.withTenant(eid, async (db) => {
      const leadRow = await db
        .select()
        .from(lead)
        .where(and(eq(lead.enterpriseId, eid), eq(lead.identifier, normalized)))
        .limit(1);
      if (!leadRow[0]) return null;

      const lid = leadRow[0].id;
      const [lastCalls, lastActions] = await Promise.all([
        db
          .select()
          .from(call)
          .where(and(eq(call.enterpriseId, eid), eq(call.leadId, lid)))
          .orderBy(desc(call.startedAt))
          .limit(5),
        db
          .select()
          .from(action)
          .where(and(eq(action.enterpriseId, eid), eq(action.leadId, lid)))
          .orderBy(desc(action.createdAt))
          .limit(5),
      ]);
      return {
        lead: leadRow[0],
        lastCalls,
        lastActions,
      };
    });

    if (!result) {
      return { found: false, suggestion: 'create-lead' };
    }

    const { lead: l, lastCalls, lastActions } = result;
    return {
      found: true,
      lead: {
        id: l.id,
        identifier: l.identifier,
        score: l.score,
        stageId: l.stageId,
        pipelineId: l.pipelineId,
        ownerUserId: l.ownerUserId,
        source: l.source,
        tags: l.tags ?? [],
        customFields: l.customFields,
        lastCalls: lastCalls.map((c) => ({
          id: c.id,
          direction: c.direction,
          status: c.status,
          disposition: c.disposition,
          phone: c.phone,
          startedAt: c.startedAt,
          endedAt: c.endedAt,
          durationSec: c.durationSec,
          talkSec: c.talkSec,
          ringSec: c.ringSec,
          recordingId: c.recordingId,
          trunk: c.trunk,
          did: c.did,
          note: c.note,
        })),
        lastActions: lastActions.map((a) => ({
          id: a.id,
          actionTypeId: a.actionTypeId,
          userId: a.userId,
          payload: a.payload,
          note: a.note,
          createdAt: a.createdAt,
        })),
      },
      suggestion: 'create-lead',
    };
  }
}

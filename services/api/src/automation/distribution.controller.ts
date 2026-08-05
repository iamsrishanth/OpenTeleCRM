/**
 * Lead distribution endpoint (A4.5).
 *   POST /enterprise/:eid/lead/:leadId/distribute
 *     body: { mode?: 'round_robin' | 'least_loaded' | 'skill_match', skills?: string[] }
 *     response: { assignedTeamMemberId, userId, reason }
 *
 * Picks from team_member WHERE availability_state='available' AND
 * capacity > calls_in_last_24h. Persists the assignment on the lead
 * (assignedTeamMemberId + ownerUserId).
 */
import {
  Body,
  Controller,
  HttpCode,
  HttpException,
  HttpStatus,
  Param,
  Post,
  Req,
} from '@nestjs/common';
import { and, count, desc, eq, gte, isNotNull, sql, type SQL } from 'drizzle-orm';
import { Inject } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import type { DbClient } from '@opentelecrm/db';
import { call, lead, teamMember } from '@opentelecrm/db';
import type { AuthContext } from '../auth/auth.guard.js';
import { DB_PROVIDER, TENANT_WRAPPER } from '../db/database.module.js';
import { AuditService } from '../audit/audit.service.js';
import { leadAssigned } from './events.js';
import { AutomationService } from './automation.service.js';

type TenantFn = <T>(enterpriseId: string, fn: (db: DbClient) => Promise<T>) => Promise<T>;

interface DistributeDto {
  mode?: 'round_robin' | 'least_loaded' | 'skill_match';
  skills?: string[];
}

@Controller('enterprise/:eid/lead/:leadId/distribute')
export class DistributionController {
  constructor(
    @Inject(DB_PROVIDER) private db: DbClient,
    @Inject(TENANT_WRAPPER) private withTenant: TenantFn,
    @Inject(AuditService) private readonly auditService: AuditService,
    @Inject(AutomationService) private readonly automationService: AutomationService,
  ) {}

  private assertTenant(req: FastifyRequest, eid: string): AuthContext {
    const auth = req.auth;
    if (!auth) throw new Error('unauthenticated');
    if (auth.enterpriseId !== eid) throw new Error('enterprise mismatch');
    return auth;
  }

  private bad(message: string, code = 'VALIDATION_ERROR'): HttpException {
    return new HttpException({ error: { code, message } }, HttpStatus.BAD_REQUEST);
  }

  @Post()
  @HttpCode(200)
  async distribute(
    @Param('eid') eid: string,
    @Param('leadId') leadId: string,
    @Req() req: FastifyRequest,
    @Body() dto: DistributeDto,
  ) {
    this.assertTenant(req, eid);
    const mode = dto?.mode ?? 'round_robin';
    if (!['round_robin', 'least_loaded', 'skill_match'].includes(mode)) {
      throw this.bad(`mode must be one of: round_robin, least_loaded, skill_match`);
    }
    const skills = Array.isArray(dto?.skills) ? dto.skills : [];

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
      const before = leadRow[0];

      const pool = await db
        .select()
        .from(teamMember)
        .where(
          and(
            eq(teamMember.enterpriseId, eid),
            eq(teamMember.availabilityState, 'available'),
            sql`${teamMember.capacity} > 0`,
          ),
        );
      if (pool.length === 0) {
        return { assignedTeamMemberId: null, userId: null, reason: 'no-available-team-member' };
      }
      // calls in last 24h per team member
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const counts = await db
        .select({ tmId: call.agentUserId, c: count() })
        .from(call)
        .where(and(eq(call.enterpriseId, eid), gte(call.startedAt, since)))
        .groupBy(call.agentUserId);
      const callsBy = new Map<string, number>(
        counts.map((r) => [String(r.tmId), Number(r.c)]),
      );
      // Current assignment load per team member (fair-share round-robin:
      // a member with fewer assigned leads should be picked before one with
      // many, even when both have zero calls in the last 24h).
      const assignRows = await db
        .select({ tmId: lead.assignedTeamMemberId, c: count() })
        .from(lead)
        .where(
          and(
            eq(lead.enterpriseId, eid),
            isNotNull(lead.assignedTeamMemberId),
          ),
        )
        .groupBy(lead.assignedTeamMemberId);
      const assignedBy = new Map<string, number>(
        assignRows.map((r) => [String(r.tmId), Number(r.c)]),
      );
      const withLoad = pool
        .map((tm) => ({
          tm,
          calls: callsBy.get(String(tm.id)) ?? 0,
          assigned: assignedBy.get(String(tm.id)) ?? 0,
          remaining: (tm.capacity ?? 0) - (callsBy.get(String(tm.id)) ?? 0),
        }))
        .filter((x) => x.remaining > 0);
      if (withLoad.length === 0) {
        return { assignedTeamMemberId: null, userId: null, reason: 'all-at-capacity' };
      }

      let chosen: (typeof withLoad)[number] | undefined;
      if (mode === 'skill_match' && skills.length > 0) {
        // Filter to members with ALL requested skills, then rank round-robin
        // (lowest current assignment count, stable by id) so repeated calls
        // rotate fairly within the skilled pool instead of always picking the
        // first match.
        const skilled = withLoad.filter((x) => {
          const have = Array.isArray(x.tm.skills) ? x.tm.skills : [];
          return skills.every((s) => have.includes(s));
        });
        skilled.sort((a, b) =>
          a.assigned !== b.assigned ? a.assigned - b.assigned : a.tm.id < b.tm.id ? -1 : 1,
        );
        chosen = skilled[0];
      } else if (mode === 'least_loaded') {
        withLoad.sort((a, b) => a.calls - b.calls);
        chosen = withLoad[0];
      } else {
        // round_robin: pick the lowest current assignment count, stable by id
        withLoad.sort((a, b) =>
          a.assigned !== b.assigned ? a.assigned - b.assigned : a.tm.id < b.tm.id ? -1 : 1,
        );
        chosen = withLoad[0];
      }
      if (!chosen) {
        return { assignedTeamMemberId: null, userId: null, reason: 'no-match' };
      }
      const tm = chosen.tm;
      await db
        .update(lead)
        .set({ assignedTeamMemberId: tm.id, ownerUserId: tm.userId })
        .where(eq(lead.id, leadId));
      const updated = await db.select().from(lead).where(eq(lead.id, leadId)).limit(1);

      await this.auditService.record({
        enterpriseId: eid,
        actorUserId: req.auth?.userId,
        actorTokenId: req.auth?.apiTokenId,
        action: 'lead.assigned',
        resourceType: 'lead',
        resourceId: leadId,
        before,
        after: { assignedTeamMemberId: tm.id, ownerUserId: tm.userId, mode },
      });
      // Fire the automation event so lead_assigned rules see this assignment.
      const after = updated[0]!;
      leadAssigned(this.automationService, eid, {
        id: after.id,
        pipelineId: after.pipelineId,
        stageId: after.stageId,
        ownerUserId: after.ownerUserId,
        assignedTeamMemberId: after.assignedTeamMemberId,
        source: after.source,
        score: after.score,
        tags: after.tags,
        customFields: after.customFields,
      }, tm.userId, tm.id);

      return {
        assignedTeamMemberId: tm.id,
        userId: tm.userId,
        reason: mode,
      };
    });
  }
}

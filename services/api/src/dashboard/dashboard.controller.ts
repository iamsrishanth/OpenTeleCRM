/**
 * Dashboard stats controller — lightweight count aggregates for the web desk.
 *   GET /enterprise/{eid}/dashboard/stats
 *     → { leadsTotal, callsToday, openConversations, callbacksDue }
 *
 * These are derived from existing tenanted tables through withTenant (RLS).
 * Full analytics (ClickHouse ETL, ADR-0005) replaces this in P6; this is the
 * honest stopgap that lets the web dashboard drop its hardcoded MOCK_STATS.
 */
import { Controller, Get, Inject, Param, Req } from '@nestjs/common';
import { and, count, eq, gte, gt, lte } from 'drizzle-orm';
import type { FastifyRequest } from 'fastify';
import type { DbClient } from '@opentelecrm/db';
import { call, callback, conversation, lead } from '@opentelecrm/db';
import type { AuthContext } from '../auth/auth.guard.js';
import { DB_PROVIDER, TENANT_WRAPPER } from '../db/database.module.js';

type TenantFn = <T>(enterpriseId: string, fn: (db: DbClient) => Promise<T>) => Promise<T>;

function assertTenant(req: FastifyRequest, eid: string): AuthContext {
  const auth = req.auth;
  if (!auth) throw new Error('unauthenticated');
  if (auth.enterpriseId !== eid) throw new Error('enterprise mismatch');
  return auth;
}

@Controller('enterprise/:eid/dashboard')
export class DashboardController {
  constructor(
    @Inject(DB_PROVIDER) private db: DbClient,
    @Inject(TENANT_WRAPPER) private withTenant: TenantFn,
  ) {}

  @Get('stats')
  async stats(@Param('eid') eid: string, @Req() req: FastifyRequest) {
    assertTenant(req, eid);
    const now = new Date();
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);

    return this.withTenant(eid, async (db) => {
      const [leads, calls, convs, callbacks] = await Promise.all([
        db.select({ c: count() }).from(lead).where(eq(lead.enterpriseId, eid)),
        db
          .select({ c: count() })
          .from(call)
          .where(and(eq(call.enterpriseId, eid), gte(call.createdAt, startOfToday))),
        db
          .select({ c: count() })
          .from(conversation)
          .where(and(eq(conversation.enterpriseId, eid), gt(conversation.unreadCount, 0))),
        db
          .select({ c: count() })
          .from(callback)
          .where(
            and(eq(callback.enterpriseId, eid), eq(callback.status, 'pending'), lte(callback.dueAt, now)),
          ),
      ]);
      return {
        data: {
          leadsTotal: leads[0]?.c ?? 0,
          callsToday: calls[0]?.c ?? 0,
          openConversations: convs[0]?.c ?? 0,
          callbacksDue: callbacks[0]?.c ?? 0,
        },
      };
    });
  }
}

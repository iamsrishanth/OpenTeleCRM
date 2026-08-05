/**
 * A4.7 — automation quota metering (D4 divergence fix).
 *
 * D4: TeleCRM's plan docs state automation quotas inconsistently. Our fix:
 * unlimited automations in community mode, but a **per-tenant rate limiter**
 * that is documented and observable:
 *   - default limit from env `AUTOMATION_RATE_LIMIT_PER_MINUTE` (60)
 *   - per-enterprise override stored in `automation_quota`
 *     (PUT /enterprise/:eid/automations/quota)
 *   - enforcement writes a 'throttled' automation_run row, so throttled
 *     firings are visible in the run log (not silently dropped)
 *   - GET /enterprise/:eid/automations/usage exposes limit/used/reset
 *
 * Metering is a sliding 60s window over executed runs (status NOT IN
 * ('skipped','throttled')). Skipped runs are condition-evaluations that
 * produced no work; throttled runs are this limiter's own bookkeeping —
 * counting either would self-perpetuate.
 */
import { Inject, Injectable } from '@nestjs/common';
import { and, eq, gt, notInArray, sql } from 'drizzle-orm';
import type { DbClient } from '@opentelecrm/db';
import { automationQuota, automationRun } from '@opentelecrm/db';
import { DB_PROVIDER, TENANT_WRAPPER } from '../db/database.module.js';

type TenantFn = <T>(enterpriseId: string, fn: (db: DbClient) => Promise<T>) => Promise<T>;

export const DEFAULT_RATE_LIMIT_PER_MINUTE = 60;
export const WINDOW_SECONDS = 60;

export interface AutomationUsage {
  rateLimitPerMinute: number;
  used: number;
  windowSeconds: number;
  remaining: number;
  resetAt: string;
}

@Injectable()
export class AutomationMeter {
  constructor(
    @Inject(DB_PROVIDER) private db: DbClient,
    @Inject(TENANT_WRAPPER) private withTenant: TenantFn,
  ) {}

  /** Env default, validated at call time so tests can set it per-run. */
  private defaultLimit(): number {
    const raw = Number(process.env.AUTOMATION_RATE_LIMIT_PER_MINUTE ?? DEFAULT_RATE_LIMIT_PER_MINUTE);
    return Number.isFinite(raw) && raw >= 1 ? Math.floor(raw) : DEFAULT_RATE_LIMIT_PER_MINUTE;
  }

  /** Per-tenant limit: automation_quota override > env default. */
  async limitFor(eid: string): Promise<number> {
    const rows = await this.withTenant(eid, async (db) =>
      db
        .select()
        .from(automationQuota)
        .where(eq(automationQuota.enterpriseId, eid))
        .limit(1),
    );
    if (rows[0]?.rateLimitPerMinute) return rows[0].rateLimitPerMinute;
    return this.defaultLimit();
  }

  /** Executed runs in the sliding window (skipped/throttled don't count). */
  async usageInWindow(eid: string, windowSeconds = WINDOW_SECONDS): Promise<number> {
    const rows = await this.withTenant(eid, async (db) =>
      db
        .select({ c: sql<number>`count(*)::int` })
        .from(automationRun)
        .where(
          and(
            eq(automationRun.enterpriseId, eid),
            gt(automationRun.startedAt, sql`now() - make_interval(secs => ${windowSeconds})`),
            notInArray(automationRun.status, ['skipped', 'throttled']),
          ),
        ),
    );
    return rows[0]?.c ?? 0;
  }

  /**
   * Full status for the usage endpoint + enforcement.
   * resetAt is an estimate: the window slides, so the true reset is
   * "now + 60s" from the newest counted run; we report a stable horizon.
   */
  async status(eid: string): Promise<AutomationUsage> {
    const rateLimitPerMinute = await this.limitFor(eid);
    const used = await this.usageInWindow(eid);
    return {
      rateLimitPerMinute,
      used,
      windowSeconds: WINDOW_SECONDS,
      remaining: Math.max(0, rateLimitPerMinute - used),
      resetAt: new Date(Date.now() + WINDOW_SECONDS * 1000).toISOString(),
    };
  }

  /** Enforcement helper: true when a new run is allowed this window. */
  async canRun(eid: string): Promise<boolean> {
    const s = await this.status(eid);
    return s.used < s.rateLimitPerMinute;
  }

  /** Upsert a per-tenant override (clamped to >= 1). Returns the stored limit. */
  async setLimit(eid: string, rateLimitPerMinute: number): Promise<number> {
    const n = Math.max(1, Math.floor(rateLimitPerMinute));
    await this.withTenant(eid, async (db) =>
      db
        .insert(automationQuota)
        .values({ enterpriseId: eid, rateLimitPerMinute: n })
        .onConflictDoUpdate({
          target: automationQuota.enterpriseId,
          set: { rateLimitPerMinute: n, updatedAt: new Date() },
        }),
    );
    return n;
  }
}

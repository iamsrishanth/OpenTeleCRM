/**
 * Cron scheduler — drives A4.4 scheduled automations.
 *
 * Boot via OnModuleInit: a 60-second setInterval that ticks all tenants.
 * The tick:
 *   1. Iterates tenants that have any active rules (cache first, lazy refresh).
 *   2. For each rule where trigger.kind='schedule' and nextRunAt <= now,
 *      fires a synthetic 'schedule' event into AutomationService.fire().
 *   3. The engine's own re-arm (nextRunAt = next cron tick after the run)
 *      keeps the schedule moving without extra logic here.
 *
 * NB: this is intentionally a single-tick loop, not a per-tenant timer.
 * At 60s resolution the cost of a tick is one query per active tenant.
 * Real production would split this across workers, but for the in-process
 * engine that's overkill.
 */
import { Inject, Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import type { DbClient } from '@opentelecrm/db';
import { automation } from '@opentelecrm/db';
import { DB_PROVIDER } from '../db/database.module.js';
import { AutomationService } from './automation.service.js';
import { SequencesService } from '../sequences/sequences.service.js';

@Injectable()
export class AutomationScheduler implements OnModuleInit, OnModuleDestroy {
  private timer: ReturnType<typeof setInterval> | null = null;
  private inFlight = false;

  constructor(
    @Inject(DB_PROVIDER) private db: DbClient,
    @Inject(AutomationService) private readonly service: AutomationService,
    @Inject(SequencesService) private readonly sequences: SequencesService,
  ) {}

  onModuleInit(): void {
    // 60s tick. The first tick fires ~60s after boot — contract tests use
    // the manual /:id/test endpoint for deterministic schedule firing.
    this.timer = setInterval(() => {
      if (this.inFlight) return; // skip overlapping ticks
      this.inFlight = true;
      this.tick()
        .catch((err) => console.warn('[scheduler] tick failed:', err))
        .finally(() => {
          this.inFlight = false;
        });
    }, 60_000);
  }

  onModuleDestroy(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /** Public for the test contract: trigger a tick now (synchronously awaited). */
  async tick(): Promise<void> {
    const now = new Date();
    // Find any rules where the schedule is due. We don't RLS-bound this
    // because scheduler lookup needs to span tenants — AutomationService.fire
    // will tenant-scope the actual run creation.
    const rows = await this.db
      .select()
      .from(automation)
      .where(
        sql`is_active = true AND trigger_kind = 'schedule' AND next_run_at IS NOT NULL AND next_run_at <= ${now}`,
      );
    for (const r of rows) {
      // Lazy-refresh this tenant's cache so subsequent fires are O(1).
      await this.service.refreshTenant(r.enterpriseId);
      await this.service.fire({
        kind: 'schedule',
        enterpriseId: r.enterpriseId,
        correlationId: r.id,
        payload: { firedAt: now.toISOString(), cron: r.schedule?.cron ?? null },
      });
    }

    // A2.8 — advance due drip-sequence steps (startedAt + delayDays*24h <= now).
    // Best-effort: a sequence failure must never break the automation sweep.
    try {
      const res = await this.sequences.processDueSequences();
      if (res.processed > 0) {
        console.log(`[scheduler] processed ${res.processed} sequence run(s)`);
      }
    } catch (err) {
      console.warn('[scheduler] sequence processing failed:', err);
    }
  }
}

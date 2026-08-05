/**
 * SequencesService — A2.8 drip engine.
 *
 * A sequence is a time-delayed action chain: ordered steps, each with a
 * delayDays offset from the run start. A run tracks one lead's progress
 * through the chain with a currentStep cursor.
 *
 *   startSequence        — enroll a lead: create the run, execute step 0
 *                          immediately (when due), leave the rest to ticks.
 *   processSequence      — force-process all due steps of a sequence's
 *                          running runs NOW (the testable hook the 60s
 *                          scheduler tick calls per tenant).
 *   processDueSequences  — global sweep: every tenant, every running run,
 *                          advance any step whose startedAt + delayDays*24h
 *                          <= now. Called from scheduler.ts's tick.
 *
 * Step execution reuses the automation engine's ActionDispatcher executors
 * (dispatcher.ts) — same kinds, same side effects. A step that throws marks
 * the run 'failed' (execution stops); once currentStep passes the last step
 * the run is 'success'.
 */
import { Inject, Injectable } from '@nestjs/common';
import { and, asc, desc, eq } from 'drizzle-orm';
import type { DbClient } from '@opentelecrm/db';
import { enterprise, lead, sequence, sequenceRun, sequenceStep } from '@opentelecrm/db';
import { DB_PROVIDER, TENANT_WRAPPER } from '../db/database.module.js';
import { AuditService } from '../audit/audit.service.js';
import {
  ActionDispatcher,
  type ActionExecutorContext,
} from '../automation/dispatcher.js';
import type { AutomationActionKind } from '../automation/types.js';
import type {
  CreateSequenceDto,
  SequenceRunStatus,
  SequenceRunView,
  SequenceStepView,
  SequenceView,
  UpdateSequenceDto,
} from './types.js';

type TenantFn = <T>(enterpriseId: string, fn: (db: DbClient) => Promise<T>) => Promise<T>;
type SequenceRunRow = typeof sequenceRun.$inferSelect;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Shape the executor context expects for the lead snapshot. */
interface LeadSnapshot {
  id: string;
  pipelineId: string | null;
  stageId: string | null;
  ownerUserId: string | null;
  assignedTeamMemberId: string | null;
  source: string | null;
  score: number | null;
  tags: string[];
  customFields: Record<string, unknown>;
}

@Injectable()
export class SequencesService {
  constructor(
    @Inject(DB_PROVIDER) private db: DbClient,
    @Inject(TENANT_WRAPPER) private withTenant: TenantFn,
    @Inject(ActionDispatcher) private readonly dispatcher: ActionDispatcher,
    @Inject(AuditService) private readonly auditService: AuditService,
  ) {}

  // -------------------------------------------------------------------------
  // CRUD
  // -------------------------------------------------------------------------

  async createSequence(eid: string, dto: CreateSequenceDto, actorUserId?: string): Promise<SequenceView> {
    // Normalize steps: explicit stepOrder wins, else array index; clamp delay.
    const steps = (dto.steps ?? []).map((s, i) => ({
      stepOrder: s.stepOrder ?? i,
      delayDays: Math.max(0, Math.floor(Number(s.delayDays ?? 0) || 0)),
      action: { kind: s.action?.kind ?? 'notify_user', config: s.action?.config ?? {} },
    }));

    const row = await this.withTenant(eid, async (db) => {
      const [inserted] = await db
        .insert(sequence)
        .values({
          enterpriseId: eid,
          name: dto.name,
          description: dto.description ?? null,
          isActive: dto.isActive ?? true,
          triggerConfig: dto.trigger ?? {},
        })
        .returning();
      if (!inserted) throw new Error('sequence insert returned no row');
      if (steps.length > 0) {
        await db.insert(sequenceStep).values(
          steps.map((s) => ({
            sequenceId: inserted.id,
            enterpriseId: eid,
            stepOrder: s.stepOrder,
            delayDays: s.delayDays,
            action: s.action,
          })),
        );
      }
      return inserted;
    });

    await this.auditService.record({
      enterpriseId: eid,
      actorUserId,
      action: 'sequence.created',
      resourceType: 'sequence',
      resourceId: row.id,
      after: { name: row.name, steps: steps.length },
    });

    return (await this.getSequence(eid, row.id))!;
  }

  async listSequences(eid: string): Promise<SequenceView[]> {
    const rows = await this.withTenant(eid, async (db) =>
      db.select().from(sequence).where(eq(sequence.enterpriseId, eid)).orderBy(asc(sequence.createdAt)),
    );
    const views: SequenceView[] = [];
    for (const r of rows) {
      const steps = await this.listSteps(eid, r.id);
      views.push(rowToSequence(r, steps));
    }
    return views;
  }

  async getSequence(eid: string, id: string): Promise<SequenceView | null> {
    const rows = await this.withTenant(eid, async (db) =>
      db.select().from(sequence).where(and(eq(sequence.enterpriseId, eid), eq(sequence.id, id))).limit(1),
    );
    if (!rows[0]) return null;
    const steps = await this.listSteps(eid, id);
    return rowToSequence(rows[0], steps);
  }

  async updateSequence(eid: string, id: string, dto: UpdateSequenceDto, actorUserId?: string): Promise<SequenceView | null> {
    const set: Partial<typeof sequence.$inferInsert> = { updatedAt: new Date() };
    if (dto.name !== undefined) set.name = dto.name;
    if (dto.description !== undefined) set.description = dto.description;
    if (dto.isActive !== undefined) set.isActive = dto.isActive;
    if (dto.trigger !== undefined) set.triggerConfig = dto.trigger;

    const updated = await this.withTenant(eid, async (db) => {
      const [row] = await db
        .update(sequence)
        .set(set)
        .where(and(eq(sequence.enterpriseId, eid), eq(sequence.id, id)))
        .returning();
      if (!row) return null;
      if (dto.steps !== undefined) {
        // Replace the full step list (cascade-free: explicit delete).
        await db.delete(sequenceStep).where(eq(sequenceStep.sequenceId, id));
        const steps = dto.steps.map((s, i) => ({
          sequenceId: id,
          enterpriseId: eid,
          stepOrder: s.stepOrder ?? i,
          delayDays: Math.max(0, Math.floor(Number(s.delayDays ?? 0) || 0)),
          action: { kind: s.action?.kind ?? 'notify_user', config: s.action?.config ?? {} },
        }));
        if (steps.length > 0) {
          await db.insert(sequenceStep).values(steps);
        }
      }
      return row;
    });

    if (!updated) return null;
    await this.auditService.record({
      enterpriseId: eid,
      actorUserId,
      action: 'sequence.updated',
      resourceType: 'sequence',
      resourceId: id,
      after: { fields: Object.keys(dto) },
    });
    return this.getSequence(eid, id);
  }

  async deleteSequence(eid: string, id: string, actorUserId?: string): Promise<boolean> {
    const rows = await this.withTenant(eid, async (db) =>
      db
        .delete(sequence)
        .where(and(eq(sequence.enterpriseId, eid), eq(sequence.id, id)))
        .returning({ id: sequence.id }),
    );
    const ok = rows.length > 0;
    if (ok) {
      await this.auditService.record({
        enterpriseId: eid,
        actorUserId,
        action: 'sequence.deleted',
        resourceType: 'sequence',
        resourceId: id,
      });
    }
    return ok;
  }

  // -------------------------------------------------------------------------
  // Runs
  // -------------------------------------------------------------------------

  /**
   * Enroll a lead into a sequence. Creates the run (status 'running') and
   * executes step 0 immediately when it is due (delayDays 0 — the standard
   * drip entry). Later steps wait for the scheduler tick / POST :id/process.
   */
  async startSequence(eid: string, seqId: string, leadId?: string | null): Promise<SequenceRunView | null> {
    const seq = await this.getSequence(eid, seqId);
    if (!seq) return null;

    const [run] = await this.withTenant(eid, async (db) =>
      db
        .insert(sequenceRun)
        .values({
          sequenceId: seqId,
          enterpriseId: eid,
          leadId: leadId ?? null,
          status: 'running',
          currentStep: 0,
          startedAt: new Date(),
        })
        .returning(),
    );
    if (!run) throw new Error('sequence_run insert returned no row');

    // Step 0 only — the rest of the chain belongs to the tick/process hook.
    await this.executeDueSteps(eid, seq, run, 1);
    return this.getRun(eid, run.id);
  }

  async listRuns(eid: string, seqId: string, limit = 50): Promise<SequenceRunView[]> {
    const rows = await this.withTenant(eid, async (db) =>
      db
        .select()
        .from(sequenceRun)
        .where(and(eq(sequenceRun.enterpriseId, eid), eq(sequenceRun.sequenceId, seqId)))
        .orderBy(desc(sequenceRun.startedAt))
        .limit(limit),
    );
    return rows.map(rowToRun);
  }

  async getRun(eid: string, runId: string): Promise<SequenceRunView | null> {
    const rows = await this.withTenant(eid, async (db) =>
      db.select().from(sequenceRun).where(and(eq(sequenceRun.enterpriseId, eid), eq(sequenceRun.id, runId))).limit(1),
    );
    return rows[0] ? rowToRun(rows[0]) : null;
  }

  /**
   * Force-process the due steps of a sequence's running runs NOW. This is
   * the deterministic hook the contract tests use instead of the 60s tick.
   */
  async processSequence(eid: string, seqId: string): Promise<{ processed: number; runs: SequenceRunView[] }> {
    const seq = await this.getSequence(eid, seqId);
    if (!seq) return { processed: 0, runs: [] };
    const runs = await this.withTenant(eid, async (db) =>
      db
        .select()
        .from(sequenceRun)
        .where(
          and(
            eq(sequenceRun.enterpriseId, eid),
            eq(sequenceRun.sequenceId, seqId),
            eq(sequenceRun.status, 'running'),
          ),
        ),
    );
    for (const run of runs) {
      await this.executeDueSteps(eid, seq, run);
    }
    const views = (
      await Promise.all(runs.map((r) => this.getRun(eid, r.id)))
    ).filter((v): v is SequenceRunView => v !== null);
    return { processed: runs.length, runs: views };
  }

  /**
   * Global sweep for the 60s scheduler tick: every tenant, every running
   * run, advance any step that is due (startedAt + delayDays*24h <= now).
   * The enterprise table is not RLS-scoped, so enumerating tenants here is
   * safe; per-tenant work goes through withTenant like every other query.
   */
  async processDueSequences(): Promise<{ processed: number }> {
    let processed = 0;
    const tenants = await this.db.select({ id: enterprise.id }).from(enterprise);
    for (const { id: eid } of tenants) {
      const runs = await this.withTenant(eid, async (db) =>
        db.select().from(sequenceRun).where(eq(sequenceRun.status, 'running')),
      );
      const seqCache = new Map<string, SequenceView>();
      for (const run of runs) {
        let seq: SequenceView | null | undefined = seqCache.get(run.sequenceId);
        if (!seq) {
          seq = await this.getSequence(eid, run.sequenceId);
          if (!seq) continue; // cascade should have removed runs already
          seqCache.set(run.sequenceId, seq);
        }
        await this.executeDueSteps(eid, seq, run);
        processed += 1;
      }
    }
    return { processed };
  }

  // -------------------------------------------------------------------------
  // Step execution
  // -------------------------------------------------------------------------

  /**
   * Advance a run's cursor over due steps. A step is due when
   * startedAt + delayDays*24h <= now. `limit` caps how many steps run in
   * this pass (start passes 1 so only the immediate step fires at
   * enrollment; the tick/process passes use the default = all due).
   * A throwing executor fails the run; exhausting the steps succeeds it.
   */
  private async executeDueSteps(
    eid: string,
    seq: SequenceView,
    run: SequenceRunRow,
    limit = Number.MAX_SAFE_INTEGER,
  ): Promise<void> {
    const steps = seq.steps;
    let idx = run.currentStep;
    const now = Date.now();
    let executed = 0;

    while (idx < steps.length && executed < limit) {
      const step = steps[idx]!;
      const dueAt = run.startedAt.getTime() + step.delayDays * DAY_MS;
      if (dueAt > now) break; // not due yet — wait for the next tick

      const kind = String(step.action.kind ?? 'notify_user') as AutomationActionKind;
      const config = (step.action.config ?? {}) as Record<string, unknown>;
      try {
        const ctx = await this.buildContext(eid, seq, run, step);
        await this.dispatcher.dispatch(kind, config, ctx);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        await this.withTenant(eid, async (db) =>
          db
            .update(sequenceRun)
            .set({ status: 'failed', finishedAt: new Date(), error: message })
            .where(eq(sequenceRun.id, run.id)),
        );
        return;
      }

      idx += 1;
      executed += 1;
      await this.withTenant(eid, async (db) =>
        db
          .update(sequenceRun)
          .set({ currentStep: idx, updatedAt: new Date() })
          .where(eq(sequenceRun.id, run.id)),
      );
    }

    if (idx >= steps.length) {
      await this.withTenant(eid, async (db) =>
        db
          .update(sequenceRun)
          .set({ status: 'success', finishedAt: new Date(), updatedAt: new Date() })
          .where(eq(sequenceRun.id, run.id)),
      );
    }
  }

  /** Executor context: run identity + a fresh lead snapshot when leadId set. */
  private async buildContext(
    eid: string,
    seq: SequenceView,
    run: SequenceRunRow,
    step: SequenceStepView,
  ): Promise<ActionExecutorContext> {
    let leadSnapshot: LeadSnapshot | null = null;
    if (run.leadId) {
      const rows = await this.withTenant(eid, async (db) =>
        db.select().from(lead).where(eq(lead.id, run.leadId!)).limit(1),
      );
      const l = rows[0];
      if (l) {
        leadSnapshot = {
          id: l.id,
          pipelineId: l.pipelineId,
          stageId: l.stageId,
          ownerUserId: l.ownerUserId,
          assignedTeamMemberId: l.assignedTeamMemberId,
          source: l.source,
          score: l.score,
          tags: l.tags ?? [],
          customFields: l.customFields ?? {},
        };
      }
    }
    return {
      enterpriseId: eid,
      runId: run.id,
      leadId: run.leadId ?? null,
      lead: leadSnapshot,
      payload: {
        sequenceId: seq.id,
        sequenceName: seq.name,
        runId: run.id,
        leadId: run.leadId ?? null,
        stepOrder: step.stepOrder,
      },
      correlationId: run.id,
    };
  }

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  private async listSteps(eid: string, seqId: string): Promise<SequenceStepView[]> {
    const rows = await this.withTenant(eid, async (db) =>
      db
        .select()
        .from(sequenceStep)
        .where(and(eq(sequenceStep.enterpriseId, eid), eq(sequenceStep.sequenceId, seqId)))
        .orderBy(asc(sequenceStep.stepOrder)),
    );
    return rows.map((r) => ({
      id: r.id,
      sequenceId: r.sequenceId,
      stepOrder: r.stepOrder,
      delayDays: r.delayDays,
      action: r.action,
    }));
  }
}

function rowToSequence(r: typeof sequence.$inferSelect, steps: SequenceStepView[]): SequenceView {
  return {
    id: r.id,
    enterpriseId: r.enterpriseId,
    name: r.name,
    description: r.description ?? null,
    isActive: r.isActive,
    trigger: r.triggerConfig ?? {},
    steps,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  };
}

function rowToRun(r: SequenceRunRow): SequenceRunView {
  return {
    id: r.id,
    sequenceId: r.sequenceId,
    enterpriseId: r.enterpriseId,
    leadId: r.leadId,
    status: r.status as SequenceRunStatus,
    startedAt: r.startedAt,
    finishedAt: r.finishedAt,
    currentStep: r.currentStep,
    error: r.error,
  };
}

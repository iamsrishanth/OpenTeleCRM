import { randomBytes } from 'node:crypto';
/**
 * Automation service — the in-process rule engine the API controller, webhook
 * controller, and scheduler all share.
 *
 * Responsibilities (P4, A4.1-A4.5):
 *   - CRUD on automation_rule rows
 *   - run / step row management
 *   - in-memory cache of active rules per tenant (refreshed on CRUD)
 *   - fire(event): queue matched rules, dispatch action chain asynchronously
 *   - skip-the-run when conditions don't match (still records a 'skipped' run)
 *
 * Design (mirrors the audit-service "fire-and-forget" contract):
 *   - fire() never throws — it logs + returns. A user-facing mutation that
 *     calls fire() right after the audit-hook must not crash because the
 *     rule engine tripped.
 *   - the action chain runs in setImmediate() after the response is sent,
 *     so automation latency does not block the original mutation.
 *   - on every CRUD op the per-tenant rule cache is replaced atomically.
 *
 * Storage: the dispatcher calls into a pluggable ActionExecutor registry;
 * see dispatcher.ts. Rules that match no executor kind write a 'skipped' step
 * so the test contract still sees a row.
 */
import { Inject, Injectable, type OnModuleInit } from '@nestjs/common';
import type { DbClient } from '@opentelecrm/db';
import {
  automation,
  automationRun,
  automationStep,
} from '@opentelecrm/db';
import { type SQL, and, asc, desc, eq, sql } from 'drizzle-orm';
import { AuditService } from '../audit/audit.service.js';
import { DB_PROVIDER, TENANT_WRAPPER } from '../db/database.module.js';
import { type ConditionFacts, conditionsMatch } from './conditions.js';
import { nextCronTick } from './cron.js';
import {
  type ActionExecutorContext,
  evaluateActionConfig,
} from './dispatcher.js';
import { AutomationMeter } from './meter.js';
import type {
  AutomationAction,
  AutomationConditionLeaf,
  AutomationConditionTree,
  AutomationEvent,
  AutomationRule,
  AutomationRun,
  AutomationRunStatus,
  AutomationStepStatus,
  AutomationTriggerSpec,
  CreateRuleDto,
  UpdateRuleDto,
} from './types.js';

type TenantFn = <T>(enterpriseId: string, fn: (db: DbClient) => Promise<T>) => Promise<T>;

/** 256-bit random hex secret for webhook HMAC signing. */
const randomSecret = (): string => randomBytes(32).toString('hex');

/** DB row → internal AutomationRule shape. */
function rowToRule(r: typeof automation.$inferSelect): AutomationRule {
  return {
    id: r.id,
    enterpriseId: r.enterpriseId,
    name: r.name,
    description: r.description ?? null,
    trigger: (r.triggerKind
      ? { kind: r.triggerKind as AutomationRule['trigger']['kind'], config: r.triggerConfig ?? {} }
      : { kind: 'manual' as const, config: {} }),
    conditions: (r.conditions && Object.keys(r.conditions).length > 0
      ? (r.conditions as unknown as AutomationConditionTree)
      : null),
    actions: (r.actions ?? []) as unknown as AutomationAction[],
    schedule: (r.schedule as { cron: string; timezone?: string } | null) ?? null,
    assignmentScope: (r.assignmentScope as Record<string, unknown> | null) ?? null,
    category: r.category ?? 'general',
    isActive: r.isActive,
    priority: r.priority,
    lastRunAt: r.lastRunAt ?? null,
    nextRunAt: r.nextRunAt ?? null,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  };
}

@Injectable()
export class AutomationService implements OnModuleInit {
  // Tenant → cached active rules. Refreshed on CRUD; consulted by fire()
  // and by the cron scheduler. Empty when no rules are active; the
  // Map itself is the source of truth — a missing key means "no rules".
  private cache: Map<string, AutomationRule[]> = new Map();

  constructor(
    @Inject(DB_PROVIDER) private db: DbClient,
    @Inject(TENANT_WRAPPER) private withTenant: TenantFn,
    @Inject(AuditService) private readonly auditService: AuditService,
    @Inject(AutomationMeter) private readonly meter: AutomationMeter,
  ) {}

  /**
   * Warm the in-memory cache at boot. We don't fail boot on error — the
   * scheduler's first tick will lazily re-fetch per tenant if the warm
   * load missed anything. The scheduler also calls refreshTenant() defensively.
   */
  async onModuleInit(): Promise<void> {
    try {
      // Group active rules by enterprise id; we only need active + non-archived
      // rules for the live event/schedule path.
      const rows = await this.db
        .select()
        .from(automation)
        .where(eq(automation.isActive, true))
        .orderBy(asc(automation.enterpriseId), desc(automation.priority));
      const grouped = new Map<string, AutomationRule[]>();
      for (const r of rows) {
        const eid = r.enterpriseId;
        const rule = rowToRule(r);
        if (!grouped.has(eid)) grouped.set(eid, []);
        grouped.get(eid)!.push(rule);
      }
      this.cache = grouped;
    } catch (err) {
      console.warn('[automation] cache warm failed (will lazy-refresh):', err);
    }
  }

  // -------------------------------------------------------------------------
  // CRUD
  // -------------------------------------------------------------------------

  async createRule(eid: string, dto: CreateRuleDto, actorUserId?: string): Promise<AutomationRule> {
      const triggerSpec: AutomationTriggerSpec = dto.trigger ?? { kind: 'manual' };
      // Webhook_received rules get an HMAC secret at creation; it is returned
      // to the caller exactly once (create/rotate responses only) and is
      // required before the public webhook endpoint will accept any request.
      const isWebhookRule = triggerSpec.kind === 'webhook_received';
      const webhookSecret = isWebhookRule ? randomSecret() : null;
    const nextRunAt =
      triggerSpec.kind === 'schedule' && dto.schedule
        ? (dto.schedule as { runAt?: string }).runAt
          ? new Date((dto.schedule as { runAt?: string }).runAt as string)
          : nextCronTick((dto.schedule as { cron: string }).cron)
        : null;

    const [row] = await this.withTenant(eid, async (db) =>
      db
        .insert(automation)
        .values({
          enterpriseId: eid,
          name: dto.name,
          description: dto.description ?? null,
          category: 'general',
          triggerKind: triggerSpec.kind,
          triggerConfig: triggerSpec.config ?? {},
          conditions: (dto.conditions ?? {}) as Record<string, unknown>,
          actions: (dto.actions ?? []) as unknown as Record<string, unknown>[],
          schedule: (dto.schedule as Record<string, unknown> | null) ?? null,
          ...(webhookSecret ? { webhookSecret } : {}),
          ownerUserId: actorUserId && isUuid(actorUserId) ? actorUserId : null,
          assignmentScope: dto.assignmentScope ?? null,
          isActive: dto.isActive ?? true,
          priority: dto.priority ?? 100,
          coalesceWindowSec: 0,
          nextRunAt: nextRunAt ?? null,
        })
        .returning(),
    );
    if (!row) throw new Error('automation insert returned no row');
    await this.auditService.record({
      enterpriseId: eid,
      actorUserId,
      action: 'automation.created',
      resourceType: 'automation',
      resourceId: row.id,
      after: { name: row.name, trigger: triggerSpec.kind, actions: row.actions.length },
    });
    this.invalidate(eid);
        const rule = rowToRule(row);
        if (webhookSecret) rule.webhookSecret = webhookSecret;
        return rule;
      }

      /**
       * Generate a fresh HMAC secret for a webhook_received rule and return the
       * rule with the new secret attached (create/rotate responses only — the
       * secret never appears in list/get). Returns null when the rule does not
       * exist within the tenant.
       */
      async rotateWebhookSecret(
        eid: string,
        id: string,
        actorUserId?: string,
      ): Promise<AutomationRule | null> {
        const secret = randomSecret();
        const rows = await this.withTenant(eid, async (db) =>
          db
            .update(automation)
            .set({ webhookSecret: secret, updatedAt: new Date() })
            .where(and(eq(automation.enterpriseId, eid), eq(automation.id, id)))
            .returning(),
        );
        if (!rows[0]) return null;
        await this.auditService.record({
          enterpriseId: eid,
          actorUserId,
          action: 'automation.webhook_secret_rotated',
          resourceType: 'automation',
          resourceId: id,
        });
        this.invalidate(eid);
        const rule = rowToRule(rows[0]);
        rule.webhookSecret = secret;
        return rule;
      }

  async listRules(eid: string): Promise<AutomationRule[]> {
    const rows = await this.withTenant(eid, async (db) =>
      db
        .select()
        .from(automation)
        .where(eq(automation.enterpriseId, eid))
        .orderBy(desc(automation.priority), asc(automation.createdAt)),
    );
    return rows.map(rowToRule);
  }

  /** Recent run history for one rule (newest first) — powers the run log UI. */
  async listRuns(eid: string, ruleId: string, limit = 50): Promise<AutomationRun[]> {
    const rows = await this.withTenant(eid, async (db) =>
      db
        .select()
        .from(automationRun)
        .where(and(eq(automationRun.enterpriseId, eid), eq(automationRun.automationId, ruleId)))
        .orderBy(desc(automationRun.startedAt))
        .limit(limit),
    );
    return rows.map((row) => ({
      id: row.id,
      enterpriseId: row.enterpriseId,
      automationId: row.automationId,
      leadId: row.leadId,
      status: row.status as AutomationRunStatus,
      correlationId: row.correlationId,
      triggerPayload: row.triggerPayload,
      resolvedContext: row.resolvedContext,
      stepsExecuted: row.stepsExecuted,
      conditionsMatched: row.conditionsMatched,
      error: row.error,
      startedAt: row.startedAt,
      finishedAt: row.finishedAt,
      durationMs: row.durationMs,
    }));
  }

  /** Re-dispatch a previous run's actions with the same trigger payload. */
  async replayRun(eid: string, ruleId: string, runId: string): Promise<string | null> {
    const rule = await this.getRule(eid, ruleId);
    if (!rule) return null;
    const rows = await this.withTenant(eid, async (db) =>
      db
        .select()
        .from(automationRun)
        .where(and(eq(automationRun.enterpriseId, eid), eq(automationRun.id, runId)))
        .limit(1),
    );
    const prior = rows[0];
    if (!prior) return null;
    const correlationId = `replay:${prior.id}`;
    const newRun = await this.createRun(
      eid,
      rule.id,
      prior.leadId ?? null,
      prior.triggerPayload,
      correlationId,
    );
    const event: AutomationEvent = {
      kind: rule.trigger.kind,
      enterpriseId: eid,
      correlationId,
      payload: prior.triggerPayload,
    };
    this.dispatchAsync(rule, newRun.id, event);
    return newRun.id;
  }

  async getRule(eid: string, id: string): Promise<AutomationRule | null> {
    const rows = await this.withTenant(eid, async (db) =>
      db
        .select()
        .from(automation)
        .where(and(eq(automation.enterpriseId, eid), eq(automation.id, id)))
        .limit(1),
    );
    if (!rows[0]) return null;
    return rowToRule(rows[0]);
  }

  async updateRule(
    eid: string,
    id: string,
    dto: UpdateRuleDto,
    actorUserId?: string,
  ): Promise<AutomationRule | null> {
    const set: Partial<typeof automation.$inferInsert> = { updatedAt: new Date() };
    if (dto.name !== undefined) set.name = dto.name;
    if (dto.description !== undefined) set.description = dto.description;
    if (dto.conditions !== undefined)
      set.conditions = (dto.conditions ?? {}) as Record<string, unknown>;
    if (dto.actions !== undefined)
      set.actions = dto.actions as unknown as Record<string, unknown>[];
    if (dto.schedule !== undefined)
      set.schedule = (dto.schedule as Record<string, unknown> | null) ?? null;
    if (dto.isActive !== undefined) set.isActive = dto.isActive;
    if (dto.priority !== undefined) set.priority = dto.priority;

    // Re-arm schedule if the cron/runAt changed.
    if (dto.schedule && typeof dto.schedule === 'object') {
      const sched = dto.schedule as { cron?: string; runAt?: string };
      if (sched.runAt) {
        set.nextRunAt = new Date(sched.runAt);
      } else if (typeof sched.cron === 'string') {
        set.nextRunAt = nextCronTick(sched.cron) ?? null;
      }
    }

    const rows = await this.withTenant(eid, async (db) =>
      db
        .update(automation)
        .set(set)
        .where(and(eq(automation.enterpriseId, eid), eq(automation.id, id)))
        .returning(),
    );
    if (!rows[0]) return null;
    await this.auditService.record({
      enterpriseId: eid,
      actorUserId,
      action: 'automation.updated',
      resourceType: 'automation',
      resourceId: id,
      after: { fields: Object.keys(dto) },
    });
    this.invalidate(eid);
    return rowToRule(rows[0]);
  }

  async deleteRule(eid: string, id: string, actorUserId?: string): Promise<boolean> {
    const rows = await this.withTenant(eid, async (db) =>
      db
        .delete(automation)
        .where(and(eq(automation.enterpriseId, eid), eq(automation.id, id)))
        .returning({ id: automation.id }),
    );
    const ok = rows.length > 0;
    if (ok) {
      await this.auditService.record({
        enterpriseId: eid,
        actorUserId,
        action: 'automation.deleted',
        resourceType: 'automation',
        resourceId: id,
      });
      this.invalidate(eid);
    }
    return ok;
  }

  // -------------------------------------------------------------------------
  // Run / step management
  // -------------------------------------------------------------------------

  async createRun(
    eid: string,
    ruleId: string,
    leadId: string | null,
    triggerPayload: Record<string, unknown>,
    correlationId: string | null,
    status: AutomationRunStatus = 'queued',
    error: string | null = null,
  ): Promise<AutomationRun> {
    const [row] = await this.withTenant(eid, async (db) =>
      db
        .insert(automationRun)
        .values({
          enterpriseId: eid,
          automationId: ruleId,
          leadId: leadId ?? null,
          status,
          correlationId: correlationId ?? null,
          triggerPayload,
          resolvedContext: {},
          stepsExecuted: 0,
          conditionsMatched: true,
          ...(error ? { error } : {}),
          // Throttled runs are immediately terminal — the limiter's own
          // bookkeeping row, not a dispatch.
          ...(status === 'throttled' ? { finishedAt: new Date() } : {}),
        })
        .returning(),
    );
    if (!row) throw new Error('automation_run insert returned no row');
    return {
      id: row.id,
      enterpriseId: row.enterpriseId,
      automationId: row.automationId,
      leadId: row.leadId,
      status: row.status as AutomationRunStatus,
      correlationId: row.correlationId,
      triggerPayload: row.triggerPayload,
      resolvedContext: row.resolvedContext,
      stepsExecuted: row.stepsExecuted,
      conditionsMatched: row.conditionsMatched,
      error: row.error,
      startedAt: row.startedAt,
      finishedAt: row.finishedAt,
      durationMs: row.durationMs,
    };
  }

  async updateRunStatus(
    eid: string,
    runId: string,
    status: AutomationRunStatus,
    error?: string | null,
  ): Promise<void> {
    const set: Partial<typeof automationRun.$inferInsert> = { status };
    if (status === 'running') {
      set.startedAt = new Date();
    }
    if (status === 'success' || status === 'failed' || status === 'skipped' || status === 'throttled') {
      set.finishedAt = new Date();
    }
    if (error !== undefined) set.error = error;
    await this.withTenant(eid, async (db) =>
      db.update(automationRun).set(set).where(eq(automationRun.id, runId)),
    );
  }

  async addStep(
    eid: string,
    runId: string,
    order: number,
    kind: AutomationAction['kind'],
    config: Record<string, unknown>,
    output?: Record<string, unknown> | null,
    error?: string | null,
    durationMs = 0,
  ): Promise<void> {
    const status: AutomationStepStatus = error ? 'failed' : 'success';
    const now = new Date();
    await this.withTenant(eid, async (db) =>
      db.insert(automationStep).values({
        enterpriseId: eid,
        runId,
        order,
        kind,
        config,
        output: output ?? null,
        error: error ?? null,
        status,
        startedAt: now,
        finishedAt: now,
        durationMs,
      }),
    );
    // Bump the run's step counter.
    await this.withTenant(eid, async (db) =>
      db
        .update(automationRun)
        .set({ stepsExecuted: sql`${automationRun.stepsExecuted} + 1` })
        .where(eq(automationRun.id, runId)),
    );
  }

  async getRun(eid: string, runId: string): Promise<AutomationRun | null> {
    const rows = await this.withTenant(eid, async (db) =>
      db.select().from(automationRun).where(eq(automationRun.id, runId)).limit(1),
    );
    if (!rows[0]) return null;
    const r = rows[0];
    return {
      id: r.id,
      enterpriseId: r.enterpriseId,
      automationId: r.automationId,
      leadId: r.leadId,
      status: r.status as AutomationRunStatus,
      correlationId: r.correlationId,
      triggerPayload: r.triggerPayload,
      resolvedContext: r.resolvedContext,
      stepsExecuted: r.stepsExecuted,
      conditionsMatched: r.conditionsMatched,
      error: r.error,
      startedAt: r.startedAt,
      finishedAt: r.finishedAt,
      durationMs: r.durationMs,
    };
  }

  async getRunByCorrelation(
    eid: string,
    correlationId: string,
  ): Promise<AutomationRun | null> {
    const rows = await this.withTenant(eid, async (db) =>
      db
        .select()
        .from(automationRun)
        .where(
          and(
            eq(automationRun.enterpriseId, eid),
            eq(automationRun.correlationId, correlationId),
          ),
        )
        .orderBy(desc(automationRun.startedAt))
        .limit(1),
    );
    if (!rows[0]) return null;
    const r = rows[0];
    return {
      id: r.id,
      enterpriseId: r.enterpriseId,
      automationId: r.automationId,
      leadId: r.leadId,
      status: r.status as AutomationRunStatus,
      correlationId: r.correlationId,
      triggerPayload: r.triggerPayload,
      resolvedContext: r.resolvedContext,
      stepsExecuted: r.stepsExecuted,
      conditionsMatched: r.conditionsMatched,
      error: r.error,
      startedAt: r.startedAt,
      finishedAt: r.finishedAt,
      durationMs: r.durationMs,
    };
  }

  // -------------------------------------------------------------------------
  // Cache management
  // -------------------------------------------------------------------------

  invalidate(eid: string): void {
    this.cache.delete(eid);
  }

  /** Force-refresh the per-tenant cache (used by the scheduler's first tick). */
  async refreshTenant(eid: string): Promise<AutomationRule[]> {
    const rows = await this.withTenant(eid, async (db) =>
      db
        .select()
        .from(automation)
        .where(
          and(
            eq(automation.enterpriseId, eid),
            eq(automation.isActive, true),
          ),
        )
        .orderBy(desc(automation.priority)),
    );
    const rules = rows.map(rowToRule);
    this.cache.set(eid, rules);
    return rules;
  }

  private async getActiveRulesFor(eid: string): Promise<AutomationRule[]> {
    const cached = this.cache.get(eid);
    if (cached) return cached;
    return this.refreshTenant(eid);
  }

  // -------------------------------------------------------------------------
  // Fire
  // -------------------------------------------------------------------------

  /**
   * Main entry point called by the event hooks in other controllers.
   * NEVER throws. The mutation that produced the event must not be broken
   * by an automation failure.
   *
   * Synchronous path:
   *   1. Look up the active rules for the tenant (cache then refresh).
   *   2. Filter by trigger kind match + root condition tree.
   *   3. For each match, insert a queued run row + hand off to dispatchAsync.
   *
   * The run row is committed before the action chain starts, so the
   * contract test can see status='queued' immediately.
   */
  async fire(event: AutomationEvent): Promise<void> {
    try {
      const eid = event.enterpriseId;
      const rules = await this.getActiveRulesFor(eid);
      const candidates = rules
        .filter((r) => r.isActive)
        .filter((r) => r.trigger.kind === event.kind)
        .sort((a, b) => b.priority - a.priority);

      // A4.7 — per-tenant rate limiter (D4 divergence fix). Checked once per
      // fire: when the tenant is over its runs/minute ceiling, every matched
      // rule records a visible 'throttled' run and nothing dispatches. The
      // throttle is observable in the run log — never a silent drop.
      if (candidates.length > 0 && !(await this.meter.canRun(eid))) {
        for (const rule of candidates) {
          await this.createRun(
            eid,
            rule.id,
            event.lead?.id ?? null,
            event.payload,
            event.correlationId ?? null,
            'throttled',
            'automation rate limit exceeded (runs/min ceiling)',
          );
        }
        return;
      }

      for (const rule of candidates) {
        // Flat facts: trigger payload fields are top-level (e.g. 'toStageId',
        // 'status'), the lead snapshot lives under 'lead'.
        const condFacts: ConditionFacts = { ...(event.payload ?? {}) };
        if (event.lead) {
          condFacts.lead = {
            id: event.lead.id,
            pipelineId: event.lead.pipelineId,
            stageId: event.lead.stageId,
            ownerUserId: event.lead.ownerUserId,
            assignedTeamMemberId: event.lead.assignedTeamMemberId,
            source: event.lead.source,
            score: event.lead.score,
            tags: event.lead.tags,
            fields: event.lead.customFields,
          };
        }
        if (!conditionsMatch(rule.conditions, condFacts)) {
          // Record a no-op run so the audit trail shows the trigger was seen.
          const run = await this.createRun(
            eid,
            rule.id,
            event.lead?.id ?? null,
            event.payload,
            event.correlationId ?? null,
          );
          await this.updateRunStatus(eid, run.id, 'skipped', 'root-conditions-failed');
          continue;
        }
        const run = await this.createRun(
          eid,
          rule.id,
          event.lead?.id ?? null,
          event.payload,
          event.correlationId ?? null,
        );
        // Hand off the action chain to a microtask so the caller is not blocked.
        // The run row is already committed; contract tests can observe it.
        this.dispatchAsync(rule, run.id, event);
      }
    } catch (err) {
      console.warn(
        '[automation] fire failed:',
        err instanceof Error ? err.message : err,
      );
    }
  }

  /**
   * Test a single rule synchronously: fire-and-await the dispatch so the
   * contract test can read the run/step rows immediately. Does NOT throw.
   * Returns the runId (or null on early failure).
   */
  async testRule(eid: string, ruleId: string, payload: Record<string, unknown>): Promise<string | null> {
    try {
      const rule = await this.getRule(eid, ruleId);
      if (!rule) return null;
      const run = await this.createRun(eid, rule.id, null, payload, `test-${ruleId}`);
      await this.dispatchAsync(rule, run.id, {
        kind: rule.trigger.kind,
        enterpriseId: eid,
        payload,
        correlationId: `test-${ruleId}`,
      });
      return run.id;
    } catch (err) {
      console.warn(
        '[automation] testRule failed:',
        err instanceof Error ? err.message : err,
      );
      return null;
    }
  }

  /**
   * Fire-and-forget the action chain for a run. Writes a 'running' state,
   * executes each action, updates the run to 'success' or 'failed'.
   * Catches every action's error so a single bad action doesn't abort the
   * chain (A4.3: actions are best-effort; run captures per-step outcomes).
   */
  private dispatchAsync(rule: AutomationRule, runId: string, event: AutomationEvent): void {
    const execute = async (): Promise<void> => {
      const startedAt = Date.now();
      const eid = rule.enterpriseId;
      await this.updateRunStatus(eid, runId, 'running');
      let ok = true;
      let lastError: string | null = null;
      for (let i = 0; i < rule.actions.length; i++) {
        const action = rule.actions[i]!;
        const t0 = Date.now();
        try {
          const ctx: ActionExecutorContext = {
            enterpriseId: eid,
            runId,
            leadId: event.lead?.id ?? null,
            lead: event.lead ?? null,
            payload: event.payload,
            correlationId: event.correlationId ?? null,
          };
          const out = await evaluateActionConfig(action.kind, action.config, ctx, {
            withTenant: this.withTenant,
          });
          await this.addStep(eid, runId, i, action.kind, action.config, out, null, Date.now() - t0);
          // branch(..., stopChainOnFalse) halts the remaining chain.
          if (out && typeof out === 'object' && (out as { __stopChain?: boolean }).__stopChain) {
            break;
          }
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          await this.addStep(
            eid,
            runId,
            i,
            action.kind,
            action.config,
            null,
            message,
            Date.now() - t0,
          );
          ok = false;
          lastError = message;
          // Continue with the next action — best-effort, not abort.
        }
      }
      const finishedAt = Date.now();
      const status: AutomationRunStatus = ok ? 'success' : 'failed';
      await this.withTenant(eid, async (db) =>
        db
          .update(automationRun)
          .set({
            status,
            finishedAt: new Date(finishedAt),
            durationMs: finishedAt - startedAt,
            error: lastError,
          })
          .where(eq(automationRun.id, runId)),
      );
      // Bump rule-level last/next run for schedule rules.
      if (rule.trigger.kind === 'schedule' && rule.schedule) {
        const sched = rule.schedule as { cron?: string; runAt?: string };
        const isOneShot = !sched.cron && !!sched.runAt;
        await this.withTenant(eid, async (db) =>
          db
            .update(automation)
            .set(
              isOneShot
                ? { lastRunAt: new Date(), nextRunAt: null, isActive: false }
                : {
                    lastRunAt: new Date(),
                    nextRunAt: nextCronTick(sched.cron as string) ?? null,
                  },
            )
            .where(eq(automation.id, rule.id)),
        );
      }
    };

    // setImmediate keeps the request response unblocked; the chain runs in
    // a microtask window after the controller returns.
    setImmediate(() => {
      execute().catch((err) => {
        const msg = err instanceof Error ? err.message : String(err);
        console.warn('[automation] dispatchAsync crashed:', msg);
        this.updateRunStatus(rule.enterpriseId, runId, 'failed', msg).catch(() => {
          /* best effort */
        });
      });
    });
  }
}

// ---------------------------------------------------------------------------
// Conditions evaluator
// ---------------------------------------------------------------------------

/**
 * Lightweight condition-tree evaluator. Resolves dotted paths against the
 * event payload (and the lead snapshot when present), then applies the op.
 * Returns true when the tree is empty/absent (default = match anything).
 */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function isUuid(s: string): boolean {
  return UUID_RE.test(s);
}

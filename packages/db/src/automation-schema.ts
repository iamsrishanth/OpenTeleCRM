/**
 * OpenTeleCRM — Automation domain schema (P4 in-process rules engine).
 * Backed by PARITY.md §A4 (A4.1 Workflow builder, A4.2 Trigger rules,
 * A4.3 Action automation, A4.4 Scheduled / recurring automations,
 * A4.5 Lead assignment rules). All tables enterprise-scoped; RLS is
 * enabled by the shared rls.ts via AUTOMATION_TENANT_TABLES.
 *
 * Model:
 *   automation       — a workflow (trigger + conditions + ordered actions).
 *   automation_run   — one execution of a workflow, traced to a trigger.
 *   automation_step  — per-action record inside a run (granular audit).
 */
import { boolean, index, integer, jsonb, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { enterprise, lead, user } from './schema.js';

const withTimestamps = {
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
};

/**
 * A workflow rule. One of:
 *   trigger kind: lead_created | lead_updated | lead_stage_changed |
 *                 lead_field_changed | lead_assigned | action_logged |
 *                 schedule (cron, A4.4) | manual (one-shot)
 *   actions:      ordered list executed by the in-process engine
 *                 (A4.3: assign_lead / send_whatsapp / send_email / create_callback
 *                  / update_field / move_stage / notify_user / webhook / branch)
 *   conditions:   jsonb predicate tree evaluated against the trigger payload
 *                 (A4.2 field/stage/action scoping + A4.5 assignment filters)
 *   schedule:     cron + timezone (A4.4) — null for event-driven workflows
 */
export const automation = pgTable(
  'automation',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    enterpriseId: uuid('enterprise_id').notNull(),
    name: varchar('name', { length: 128 }).notNull(),
    /** Optional description shown in the workflow builder UI. */
    description: text('description'),
    /** Workflow category for grouping in the builder. */
    category: varchar('category', { length: 32 }).default('general').notNull(),
    /**
     * Trigger kind:
     *   lead_created | lead_updated | lead_stage_changed | lead_field_changed |
     *   lead_assigned | action_logged | schedule | manual
     */
    triggerKind: varchar('trigger_kind', { length: 32 }).notNull(),
    /** Trigger-specific config (e.g. {fieldApiName} for field-changed, {fromStageId,toStageId} for stage). */
    /** Trigger-specific config (e.g. {fieldApiName} for field-changed, {fromStageId,toStageId} for stage). */
    triggerConfig: jsonb('trigger_config').$type<Record<string, unknown>>().default({}).notNull(),
    /**
     * HMAC signing secret for the public webhook trigger
     * (`trigger_kind = 'webhook_received'`). NULL until the rule is created
     * or rotated. The public webhook endpoint rejects any request that does
     * not carry a valid `X-OT-Signature` over this secret (fail-closed), so
     * webhook_received rules are inert until a secret exists.
     */
    webhookSecret: text('webhook_secret'),
    /** JSON predicate tree (AND/OR/leaves) evaluated against the trigger payload. */
    conditions: jsonb('conditions').$type<Record<string, unknown>>().default({}).notNull(),
    /** Ordered list of action descriptors executed by the engine. */
    actions: jsonb('actions').$type<Record<string, unknown>[]>().default([]).notNull(),
    /**
     * Schedule config (A4.4) — only used when triggerKind = 'schedule'.
     * Shape: { cron: string, timezone: string, startsAt?: string, endsAt?: string }.
     */
    schedule: jsonb('schedule').$type<Record<string, unknown>>(),
    /** Manual workflow: which user kicked it off (null for event or scheduled). */
    ownerUserId: uuid('owner_user_id').references(() => user.id, { onDelete: 'set null' }),
    /** A4.5 — assignment rules: restrict which leads this workflow can act on. */
    assignmentScope: jsonb('assignment_scope').$type<Record<string, unknown>>(),
    isActive: boolean('is_active').default(true).notNull(),
    /** Last evaluation order hint (lower = earlier). */
    priority: integer('priority').default(100).notNull(),
    /** Coalesce duplicate trigger firings within N seconds (0 = no coalesce). */
    coalesceWindowSec: integer('coalesce_window_sec').default(0).notNull(),
    lastRunAt: timestamp('last_run_at', { withTimezone: true }),
    nextRunAt: timestamp('next_run_at', { withTimezone: true }),
    ...withTimestamps,
  },
  (t) => [
    index('auto_ent_idx').on(t.enterpriseId),
    index('auto_ent_active_idx').on(t.enterpriseId, t.isActive),
    index('auto_ent_trigger_idx').on(t.enterpriseId, t.triggerKind),
    index('auto_ent_next_run_idx').on(t.enterpriseId, t.nextRunAt),
    index('auto_ent_created_idx').on(t.enterpriseId, t.createdAt),
  ],
);

/**
 * One execution of a workflow. Written when a trigger fires (or a schedule
 * tick / manual run). Captures the trigger payload snapshot, the resolved
 * target lead, and the final outcome.
 *   status: queued | running | success | failed | skipped | throttled
 */
export const automationRun = pgTable(
  'automation_run',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    enterpriseId: uuid('enterprise_id').notNull(),
    automationId: uuid('automation_id')
      .notNull()
      .references(() => automation.id, { onDelete: 'cascade' }),
    /** Lead the workflow acted on (null for tenant-wide / manual runs). */
    leadId: uuid('lead_id').references(() => lead.id, { onDelete: 'set null' }),
    /** User that triggered a manual run (null for event/scheduled). */
    triggeredByUserId: uuid('triggered_by_user_id').references(() => user.id, { onDelete: 'set null' }),
    /** queued | running | success | failed | skipped | throttled */
    status: varchar('status', { length: 16 }).default('queued').notNull(),
    /** Trigger event id for dedupe (e.g. action id, stage-change event uuid). */
    correlationId: varchar('correlation_id', { length: 128 }),
    /** Snapshot of the trigger payload at fire time. */
    triggerPayload: jsonb('trigger_payload').$type<Record<string, unknown>>().default({}).notNull(),
    /** Resolved inputs handed to the action chain (after conditions). */
    resolvedContext: jsonb('resolved_context').$type<Record<string, unknown>>().default({}).notNull(),
    /** Number of action steps executed (denormalized for quick filtering). */
    stepsExecuted: integer('steps_executed').default(0).notNull(),
    /** True when the predicate tree evaluated false; the run was a no-op. */
    conditionsMatched: boolean('conditions_matched').default(true).notNull(),
    error: text('error'),
    startedAt: timestamp('started_at', { withTimezone: true }).defaultNow().notNull(),
    finishedAt: timestamp('finished_at', { withTimezone: true }),
    durationMs: integer('duration_ms').default(0).notNull(),
    ...withTimestamps,
  },
  (t) => [
    index('autorun_ent_idx').on(t.enterpriseId),
    index('autorun_ent_auto_idx').on(t.enterpriseId, t.automationId),
    index('autorun_ent_lead_idx').on(t.enterpriseId, t.leadId),
    index('autorun_ent_status_idx').on(t.enterpriseId, t.status),
    index('autorun_ent_corr_idx').on(t.enterpriseId, t.correlationId),
    index('autorun_ent_started_idx').on(t.enterpriseId, t.startedAt),
  ],
);

/**
 * Per-action record inside a run. One row per element of the action chain.
 *   status: pending | running | success | failed | skipped
 *   kind:   assign_lead | send_whatsapp | send_email | create_callback |
 *           update_field | move_stage | notify_user | webhook | branch |
 *           delay | http_request
 */
export const automationStep = pgTable(
  'automation_step',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    enterpriseId: uuid('enterprise_id').notNull(),
    runId: uuid('run_id')
      .notNull()
      .references(() => automationRun.id, { onDelete: 'cascade' }),
    /** 0-based position in the action chain. */
    order: integer('order').notNull(),
    /** Action kind (see file header). */
    kind: varchar('kind', { length: 32 }).notNull(),
    /** Resolved action descriptor handed to the executor. */
    config: jsonb('config').$type<Record<string, unknown>>().default({}).notNull(),
    /** pending | running | success | failed | skipped */
    status: varchar('status', { length: 16 }).default('pending').notNull(),
    /** What the executor returned (assigned user id, sent message id, etc). */
    output: jsonb('output').$type<Record<string, unknown>>(),
    error: text('error'),
    startedAt: timestamp('started_at', { withTimezone: true }),
    finishedAt: timestamp('finished_at', { withTimezone: true }),
    durationMs: integer('duration_ms').default(0).notNull(),
    ...withTimestamps,
  },
  (t) => [
    index('autostep_ent_idx').on(t.enterpriseId),
    index('autostep_ent_run_idx').on(t.enterpriseId, t.runId, t.order),
    index('autostep_ent_status_idx').on(t.enterpriseId, t.status),
  ],
);

/**
 * A drip sequence (A2.8) — a time-delayed chain of actions run against one
 * lead. Unlike automations (event-driven rule chains), a sequence is a
 * scheduled drip: each step fires at a delayDays offset from the run start
 * (startedAt + delayDays * 24h), driven by the 60s scheduler tick.
 *   sequence       — the drip definition (name + trigger config).
 *   sequence_step  — ordered steps, each with a delay + action descriptor.
 *   sequence_run   — one lead's execution of a sequence (currentStep cursor).
 */
export const sequence = pgTable(
  'sequence',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    enterpriseId: uuid('enterprise_id').notNull(),
    name: varchar('name', { length: 128 }).notNull(),
    /** Optional description shown in the drip builder UI. */
    description: text('description'),
    isActive: boolean('is_active').default(true).notNull(),
    /** Trigger config (e.g. {kind:'manual'} or {kind:'lead_created'}). */
    triggerConfig: jsonb('trigger_config').$type<Record<string, unknown>>().default({}).notNull(),
    ...withTimestamps,
  },
  (t) => [
    index('seq_ent_idx').on(t.enterpriseId),
    index('seq_ent_active_idx').on(t.enterpriseId, t.isActive),
    index('seq_ent_created_idx').on(t.enterpriseId, t.createdAt),
  ],
);

/**
 * One ordered step in a drip. `delayDays` is relative to the run start:
 * step fires when startedAt + delayDays*24h <= now. `action` is an action
 * descriptor { kind, config } — the same kinds the automation engine's
 * ActionDispatcher executes (A4.3 set + delay/branch/http_request).
 */
export const sequenceStep = pgTable(
  'sequence_step',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    sequenceId: uuid('sequence_id')
      .notNull()
      .references(() => sequence.id, { onDelete: 'cascade' }),
    enterpriseId: uuid('enterprise_id').notNull(),
    /** 0-based position in the drip. */
    stepOrder: integer('step_order').notNull(),
    /** Days after run start before this step fires (0 = immediate). */
    delayDays: integer('delay_days').default(0).notNull(),
    /** Action descriptor handed to the executor: { kind, config }. */
    action: jsonb('action').$type<Record<string, unknown>>().default({}).notNull(),
    ...withTimestamps,
  },
  (t) => [
    index('seqstep_ent_idx').on(t.enterpriseId),
    index('seqstep_ent_seq_idx').on(t.enterpriseId, t.sequenceId, t.stepOrder),
  ],
);

/**
 * One execution of a drip against a lead. `currentStep` is the cursor of
 * the next step to execute (0-based). A run is 'success' once currentStep
 * reaches the sequence's step count; 'failed' when a step's executor threw.
 *   status: queued | running | success | failed
 */
export const sequenceRun = pgTable(
  'sequence_run',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    sequenceId: uuid('sequence_id')
      .notNull()
      .references(() => sequence.id, { onDelete: 'cascade' }),
    enterpriseId: uuid('enterprise_id').notNull(),
    /** Lead the drip acts on (null for tenant-wide / leadless runs). */
    leadId: uuid('lead_id').references(() => lead.id, { onDelete: 'set null' }),
    /** queued | running | success | failed */
    status: varchar('status', { length: 16 }).default('queued').notNull(),
    startedAt: timestamp('started_at', { withTimezone: true }).defaultNow().notNull(),
    finishedAt: timestamp('finished_at', { withTimezone: true }),
    /** Index of the next step to execute (0-based cursor). */
    currentStep: integer('current_step').default(0).notNull(),
    error: text('error'),
    ...withTimestamps,
  },
  (t) => [
    index('seqrun_ent_idx').on(t.enterpriseId),
    index('seqrun_ent_seq_idx').on(t.enterpriseId, t.sequenceId),
    index('seqrun_ent_lead_idx').on(t.enterpriseId, t.leadId),
    index('seqrun_ent_status_idx').on(t.enterpriseId, t.status),
    index('seqrun_ent_started_idx').on(t.enterpriseId, t.startedAt),
  ],
);

export type AutomationRow = typeof automation.$inferSelect;
export type AutomationRunRow = typeof automationRun.$inferSelect;
export type AutomationStepRow = typeof automationStep.$inferSelect;
export type SequenceRow = typeof sequence.$inferSelect;
export type SequenceStepRow = typeof sequenceStep.$inferSelect;
export type SequenceRunRow = typeof sequenceRun.$inferSelect;

/**
 * A4.7 — per-tenant automation quota override (D4 divergence fix).
 * Row exists only when the tenant overrides the env default
 * AUTOMATION_RATE_LIMIT_PER_MINUTE. Community mode ships unlimited
 * automations, but a documented + observable per-tenant rate limiter
 * (runs per minute) prevents runaway activity. Enforcement writes a
 * 'throttled' automation_run row so the throttle is visible in the run log.
 */
export const automationQuota = pgTable('automation_quota', {
  enterpriseId: uuid('enterprise_id')
    .primaryKey()
    .references(() => enterprise.id, { onDelete: 'cascade' }),
  /** Max automation runs per minute for the tenant. */
  rateLimitPerMinute: integer('rate_limit_per_minute').default(60).notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

/** Automation + sequences tenant tables — must be RLS-enforced with the core tables. */
export const AUTOMATION_TENANT_TABLES = [
  automation,
  automationRun,
  automationStep,
  sequence,
  sequenceStep,
  sequenceRun,
  automationQuota,
] as const;

/**
 * OpenTeleCRM — automation rule types (P4, A4.x).
 *
 * Pure data shapes. No I/O, no DB, no provider references. The evaluator
 * (evaluator.ts) consumes these; the persistence layer (a follow-up slice)
 * stores JSONB-shaped rows that look exactly like this.
 *
 * Domain coverage (see PARITY.md — A2.5 chatbot, A2.8 drip/sequences, A4):
 *   - event triggers  (lead/call/whatsapp/manual)
 *   - time triggers   (drip cadence: at/after/every/cron-lite)
 *   - field conditions over a flat fact map
 *   - actions covering tags, fields, callbacks, whatsapp, webhook, stage
 *
 * NB: these types are defined here in the rule-engine because the P4 slice
 * is the first consumer. When the contracts team is ready, the canonical
 * copies move to @opentelecrm/contracts and rule-engine re-exports them.
 */

// ---------------------------------------------------------------------------
// Trigger specs
// ---------------------------------------------------------------------------

/**
 * Closed set of trigger kinds. New kinds must be added here AND in the
 * evaluator's matchTrigger() switch — the rule engine fails closed on
 * unknown kinds so misconfigured rules never silently fire.
 */
export type TriggerKind =
  | 'lead.created'
  | 'lead.updated'
  | 'lead.stage_changed'
  | 'lead.tag_added'
  | 'lead.score_changed'
  | 'call.completed'
  | 'call.no_answer'
  | 'whatsapp.message_received'
  | 'whatsapp.broadcast_completed'
  | 'time.scheduled'
  | 'manual';

/**
 * Event-shape triggers: a single event with a typed `when` predicate. For
 * `lead.updated` / `lead.stage_changed` the predicate is evaluated against
 * the diff so you can express "stage changed to 'qualified'".
 */
export interface EventTriggerSpec {
  kind: Exclude<TriggerKind, 'time.scheduled' | 'manual'>;
  /** Optional narrow — only fire when the event matches this filter. */
  when?: ConditionGroup;
  /** Optional scope guard — restrict to a pipeline / source / user. */
  scope?: RuleScope;
}

/**
 * Time triggers for drip / sequence cadences. Deliberately minimal — the
 * scheduler in the automation service is the source of truth for "is it
 * time to fire", this shape just describes the cadence.
 */
export interface TimeTriggerSpec {
  kind: 'time.scheduled';
  /** ISO timestamp or relative offset key (e.g. "after_call_3d"). */
  at?: string;
  /** Recurrence in hours for recurring drips (null = one-shot). */
  everyHours?: number | null;
  /** Optional narrow — fire only if the lead's facts still match. */
  when?: ConditionGroup;
  scope?: RuleScope;
}

export interface ManualTriggerSpec {
  kind: 'manual';
  /** Human-only trigger — exposed as a "Run now" button in the UI. */
  when?: ConditionGroup;
  scope?: RuleScope;
}

export type TriggerSpec = EventTriggerSpec | TimeTriggerSpec | ManualTriggerSpec;

/** Pipeline / source / team scoping. All optional; absent = no scope. */
export interface RuleScope {
  pipelineId?: string;
  stageId?: string;
  source?: string;
  ownerUserId?: string;
}

// ---------------------------------------------------------------------------
// Conditions
// ---------------------------------------------------------------------------

/** Closed operator set. Kept small on purpose; complex queries are AND/OR. */
export type ConditionOp =
  | 'eq'
  | 'neq'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'in'
  | 'not_in'
  | 'contains'
  | 'not_contains'
  | 'starts_with'
  | 'ends_with'
  | 'exists'
  | 'not_exists'
  | 'matches_regex'
  | 'is_empty'
  | 'is_not_empty';

/**
 * A leaf predicate: `<facts.path> <op> <value>`. Path is dotted; the first
 * segment is the fact root (e.g. "lead.fields.email", "event.to",
 * "now.hour_ist"). `value` is omitted for unary ops.
 */
export interface Condition {
  path: string;
  op: ConditionOp;
  /** Required for all binary ops; ignored for unary. */
  value?: ConditionValue;
}

/** Combinator — all-of or any-of. Empty group = matches anything. */
export interface ConditionGroup {
  combinator: 'all' | 'any';
  /** Leaf conditions. Empty array short-circuits per combinator semantics. */
  conditions: Condition[];
  /** Nested groups for tree-shaped rules. Evaluated left-to-right. */
  groups?: ConditionGroup[];
}

export type ConditionValue = string | number | boolean | null | string[] | number[];

// ---------------------------------------------------------------------------
// Action specs
// ---------------------------------------------------------------------------

/**
 * Closed set of action kinds. New kinds MUST be added to the evaluator's
 * planAction() switch — unknown actions are rejected with an error so
 * misconfigured rules surface immediately rather than silently dropping.
 */
export type ActionKind =
  | 'set_field'
  | 'add_tag'
  | 'remove_tag'
  | 'move_stage'
  | 'assign_to_user'
  | 'create_callback'
  | 'send_whatsapp_template'
  | 'send_whatsapp_text'
  | 'create_task'
  | 'webhook'
  | 'notify_user'
  | 'stop';

/**
 * All actions share a `kind`, an optional `id` (for ordering + de-dup), and
 * an optional `when` (per-action guard so a single rule can branch). The
 * action-specific payload lives in the matching `*`-shaped member of the
 * discriminated union.
 */
export type ActionSpec =
  | SetFieldAction
  | AddTagAction
  | RemoveTagAction
  | MoveStageAction
  | AssignToUserAction
  | CreateCallbackAction
  | SendWhatsappTemplateAction
  | SendWhatsappTextAction
  | CreateTaskAction
  | WebhookAction
  | NotifyUserAction
  | StopAction;

interface ActionBase {
  /** Optional stable id for ordering + idempotency in the planner. */
  id?: string;
  /** Per-action guard — if present, evaluated against the same facts. */
  when?: ConditionGroup;
}

export interface SetFieldAction extends ActionBase {
  kind: 'set_field';
  /** Dotted path under `lead.fields.*` (e.g. "status", "fields.email_opt_in"). */
  path: string;
  value: ConditionValue;
}

export interface AddTagAction extends ActionBase {
  kind: 'add_tag';
  tag: string;
}

export interface RemoveTagAction extends ActionBase {
  kind: 'remove_tag';
  tag: string;
}

export interface MoveStageAction extends ActionBase {
  kind: 'move_stage';
  stageId: string;
}

export interface AssignToUserAction extends ActionBase {
  kind: 'assign_to_user';
  userId: string;
  /** Round-robin pool id; ignored if userId is set. */
  poolId?: string;
}

export interface CreateCallbackAction extends ActionBase {
  kind: 'create_callback';
  /** ISO timestamp, or relative chip key ("1h" / "3h" / "tomorrow_10am"). */
  dueAt: string;
  channel: 'in_app' | 'whatsapp' | 'email' | 'call';
  note?: string;
}

export interface SendWhatsappTemplateAction extends ActionBase {
  kind: 'send_whatsapp_template';
  templateName: string;
  languageCode: string;
  /** List of body param values; each supports {{token}} substitution. */
  params: string[];
}

export interface SendWhatsappTextAction extends ActionBase {
  kind: 'send_whatsapp_text';
  text: string;
}

export interface CreateTaskAction extends ActionBase {
  kind: 'create_task';
  title: string;
  /** ISO timestamp. */
  dueAt?: string;
  assigneeUserId?: string;
}

export interface WebhookAction extends ActionBase {
  kind: 'webhook';
  url: string;
  method?: 'GET' | 'POST' | 'PUT';
  headers?: Record<string, string>;
  body?: Record<string, unknown>;
}

export interface NotifyUserAction extends ActionBase {
  kind: 'notify_user';
  userId: string;
  message: string;
  channel: 'in_app' | 'whatsapp' | 'email' | 'push';
}

export interface StopAction extends ActionBase {
  kind: 'stop';
  /** Optional human-readable reason recorded in the run log. */
  reason?: string;
}

// ---------------------------------------------------------------------------
// Rule + facts + event envelope
// ---------------------------------------------------------------------------

export interface AutomationRule {
  id: string;
  enterpriseId: string;
  name: string;
  /** Disabled rules are kept for audit but never fire. */
  enabled: boolean;
  /** Higher = evaluated first. Stable sort; ties keep insertion order. */
  priority: number;
  trigger: TriggerSpec;
  /**
   * Optional root guard — short-circuits the whole rule before any action
   * is planned. Most rules use `trigger.when` for per-trigger filtering
   * and leave `conditions` empty.
   */
  conditions?: ConditionGroup;
  actions: ActionSpec[];
  /** Audit fields. */
  createdAt: number;
  updatedAt: number;
  createdByUserId?: string;
}

/**
 * A fact is anything a condition or action can reference via a dotted path.
 * Values are intentionally loose (string | number | boolean | null) so
 * comparisons stay type-safe; the evaluator coerces as documented.
 */
export type FactValue = string | number | boolean | null | string[] | number[] | undefined;

export interface FactMap {
  /** Stable root namespaces the evaluator knows about. */
  lead: {
    id: string;
    pipelineId: string | null;
    stageId: string | null;
    source: string | null;
    ownerUserId: string | null;
    score: number;
    tags: string[];
    fields: Record<string, FactValue>;
    createdAt: number;
    updatedAt: number;
  };
  /** Per-trigger event payload. Shape depends on trigger.kind. */
  event: Record<string, FactValue>;
  /** Caller-supplied extras (e.g. tenant config, agent id). */
  context: Record<string, FactValue>;
  /** Convenience facts resolved at evaluation time. */
  now: {
    iso: string;
    epochMs: number;
    hourIst: number;
    /** 0-6, Sun=0 — for "only weekdays" style guards. */
    weekdayIst: number;
  };
}

/**
 * The runtime event envelope. The trigger kind decides which `payload`
 * shape the evaluator pulls facts from. Keeping it narrow here lets the
 * planner enforce the (rule.trigger.kind, event.kind) pairing later.
 */
export interface AutomationEvent {
  kind: TriggerKind;
  enterpriseId: string;
  /** Event id — used for de-dup / idempotency in the planner. */
  id: string;
  occurredAt: number;
  /** Per-kind payload; evaluator reads only the fields it needs. */
  payload: Record<string, FactValue>;
}

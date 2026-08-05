/**
 * P4 automation engine — internal types. Kept narrow: the public contracts
 * live in @opentelecrm/contracts; these are the shapes the engine actually
 * writes to the DB and accepts on the wire.
 *
 * Why a separate file: keeps the dispatcher pure of `automation-schema.ts`
 * imports so the service can be unit-tested without Drizzle.
 */

export type AutomationTriggerKind =
  | 'lead_created'
  | 'lead_updated'
  | 'lead_stage_changed'
  | 'lead_field_changed'
  | 'lead_assigned'
  | 'action_logged'
  | 'call_ended'
  | 'callback_due'
  | 'inbound_message'
  | 'schedule'
  | 'manual'
  | 'webhook_received';

export interface AutomationTriggerSpec {
  kind: AutomationTriggerKind;
  /** Per-trigger config (e.g. {fieldApiName} for lead_field_changed). */
  config?: Record<string, unknown>;
}

export interface AutomationConditionLeaf {
  field: string;
  op:
    | 'eq'
    | 'neq'
    | 'gt'
    | 'gte'
    | 'lt'
    | 'lte'
    | 'in'
    | 'contains'
    | 'exists';
  value?: unknown;
}

export interface AutomationConditionTree {
  combinator: 'and' | 'or';
  children: (AutomationConditionLeaf | AutomationConditionTree)[];
}

export type AutomationActionKind =
  | 'assign_lead'
  | 'create_callback'
  | 'send_whatsapp'
  | 'update_field'
  | 'move_stage'
  | 'notify_user'
  | 'send_email'
  | 'webhook'
  | 'branch'
  | 'delay'
  | 'http_request';

export interface AutomationAction {
  /** Stable id (optional). */
  id?: string;
  kind: AutomationActionKind;
  config: Record<string, unknown>;
}

export interface AutomationRule {
  id: string;
  enterpriseId: string;
  name: string;
  description?: string | null;
  trigger: AutomationTriggerSpec;
  conditions?: AutomationConditionTree | null;
  actions: AutomationAction[];
  schedule?: { cron: string; timezone?: string } | null;
  assignmentScope?: Record<string, unknown> | null;
  category?: string | null;
  isActive: boolean;
  priority: number;
  lastRunAt?: Date | null;
  nextRunAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export type AutomationRunStatus = 'queued' | 'running' | 'success' | 'failed' | 'skipped';

export interface AutomationRun {
  id: string;
  enterpriseId: string;
  automationId: string;
  leadId?: string | null;
  status: AutomationRunStatus;
  correlationId?: string | null;
  triggerPayload: Record<string, unknown>;
  resolvedContext: Record<string, unknown>;
  stepsExecuted: number;
  conditionsMatched: boolean;
  error?: string | null;
  startedAt: Date;
  finishedAt?: Date | null;
  durationMs: number;
}

export type AutomationStepStatus =
  | 'pending'
  | 'running'
  | 'success'
  | 'failed'
  | 'skipped';

export interface AutomationStep {
  id: string;
  runId: string;
  order: number;
  kind: AutomationActionKind;
  config: Record<string, unknown>;
  status: AutomationStepStatus;
  output?: Record<string, unknown> | null;
  error?: string | null;
  startedAt?: Date | null;
  finishedAt?: Date | null;
  durationMs: number;
}

/** Runtime event envelope passed to AutomationService.fire(). */
export interface AutomationEvent {
  kind: AutomationTriggerKind;
  enterpriseId: string;
  /** Correlation key (lead id, call id, action id, etc) — used for dedupe + audit. */
  correlationId?: string | null;
  payload: Record<string, unknown>;
  /** Optional inline lead snapshot — when present, the dispatcher reads this
   *  instead of re-querying the DB. Critical for event ordering: the trigger
   *  snapshot is what the rule's conditions should see, not whatever's there
   *  by the time the setImmediate fire-and-forget dispatch runs. */
  lead?: {
    id: string;
    pipelineId: string | null;
    stageId: string | null;
    ownerUserId: string | null;
    assignedTeamMemberId: string | null;
    source: string | null;
    score: number | null;
    tags: string[];
    customFields: Record<string, unknown>;
  } | null;
}

export interface CreateRuleDto {
  name: string;
  description?: string;
  trigger: AutomationTriggerSpec;
  conditions?: AutomationConditionTree;
  actions: AutomationAction[];
  schedule?: { cron: string; timezone?: string } | null;
  assignmentScope?: Record<string, unknown> | null;
  priority?: number;
  isActive?: boolean;
}

export interface UpdateRuleDto {
  name?: string;
  description?: string;
  conditions?: AutomationConditionTree | null;
  actions?: AutomationAction[];
  schedule?: { cron: string; timezone?: string } | null;
  isActive?: boolean;
  priority?: number;
}

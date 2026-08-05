/**
 * OpenTeleCRM — adapter contracts.
 *
 * Rule: every external system sits behind an interface defined here, with a
 * mock implementation used by tests. No concrete provider leaks upward.
 * This defines the WhatsApp provider surface (P2) and is where telephony/SMS/
 * email adapters will be added in later phases.
 */

// ---------------------------------------------------------------------------
// WhatsApp provider interface — implements TeleCRM's Chat Sync + Cloud API
// ---------------------------------------------------------------------------

export type WhatsAppContactId = string; // normalized JID: <number>@s.whatsapp.net

export interface WhatsAppContact {
  id: WhatsAppContactId;
  name?: string | null;
  pushName?: string | null;
}

export type WhatsAppMessageStatus = 'received' | 'sent' | 'read' | 'delivered' | 'failed';

export type WhatsAppMessageType =
  | 'text'
  | 'image'
  | 'video'
  | 'audio'
  | 'document'
  | 'sticker'
  | 'location'
  | 'contact'
  | 'reaction'
  | 'unknown';

export interface WhatsAppMessage {
  id: string;
  chatId: WhatsAppContactId;
  fromMe: boolean;
  direction: 'inbound' | 'outbound';
  type: WhatsAppMessageType;
  body: string;
  // 0 = received/sent time (epoch ms)
  timestamp: number;
  mediaUrl?: string | null;
  mimeType?: string | null;
  replyToId?: string | null;
  isGroup?: boolean;
}

export interface SendTextOptions {
  /** List interactive buttons (max 3) — Cloud API parity. */
  buttons?: { id: string; title: string }[];
  /** Reply — reduces queries by 90% (business-initiated within window). */
  replyToId?: string;
  /** Template name for cloud-api (ban-safe broadcast). */
  template?: string;
  templateParams?: string[];
}

export interface WhatsAppSessionStatus {
  status: 'connecting' | 'paired' | 'ready' | 'disconnected' | 'dead';
  qrCode?: string | null;
  screenName?: string | null;
  contactsSyncing?: boolean;
}

/**
 * The provider boundary. Every driver (mock, whatsapp-web.js, Meta cloud-api)
 * implements this exactly. Drivers handle their own transport, session
 * persistence and reconnect; the domain layer only sees this surface.
 */
export interface WhatsAppProvider {
  readonly kind: 'mock' | 'wwebjs' | 'baileys' | 'hermes-bridge' | 'cloud-api';
  readonly ownsSession: boolean;

  /** Connect + begin processing this number's session. Resolves a session status. */
  connect(agentSessionId: string): Promise<WhatsAppSessionStatus>;
  /** Poll pairing progress (QR, ready, failed). */
  sessionStatus(agentSessionId: string): Promise<WhatsAppSessionStatus>;

  /** Presence / connection check. */
  isOnline(agentSessionId: string): Promise<boolean>;

  /** Send a plain text message (with optional buttons / reply-to). */
  sendText(
    agentSessionId: string,
    to: WhatsAppContactId,
    text: string,
    options?: SendTextOptions,
  ): Promise<{ messageId: string }>;

  /** Send an interactive template message (cloud-api only; others reject). */
  sendTemplate(
    agentSessionId: string,
    to: WhatsAppContactId,
    templateName: string,
    languageCode: string,
    components: Record<string, unknown>[],
  ): Promise<{ messageId: string }>;

  /** Resolve the display name for a contact JID. */
  resolveContact(agentSessionId: string, jid: WhatsAppContactId): Promise<WhatsAppContact | null>;

  /**
   * Subscribe to events. cb receives a WhatsAppMessage for 'message' events or
   * a session status string for 'status' events (discriminate by the event
   * name). Returns an unsubscribe fn.
   */
  on(
    event: 'message' | 'status',
    cb: (arg: WhatsAppMessage | WhatsAppSessionStatus['status']) => void,
  ): () => void;

  /** Tear down a session cleanly. */
  disconnect(agentSessionId: string): Promise<void>;
}

// ---------------------------------------------------------------------------
// Broadcast / marketing contracts (A2.4)
// ---------------------------------------------------------------------------

export type BroadcastChannel = 'whatsapp';
export type BroadcastStatus =
  | 'draft'
  | 'scheduled'
  | 'sending'
  | 'paused'
  | 'completed'
  | 'cancelled'
  | 'failed';

export interface BroadcastRecipientStatus {
  jid: WhatsAppContactId;
  status: 'queued' | 'sent' | 'delivered' | 'read' | 'failed' | 'opted_out';
  error?: string | null;
  sentAt?: number | null;
}

export interface BroadcastJob {
  id: string;
  enterpriseId: string;
  channel: BroadcastChannel;
  agentSessionId: string;
  templateName?: string | null;
  templateLanguageCode?: string | null;
  text?: string | null;
  recipients: BroadcastRecipientStatus[];
  status: BroadcastStatus;
  /** Outbound send throttle: messages per minute (jitter applied upstream). */
  throttlePerMinute: number;
  useCloudApi: boolean;
  createdAt: number;
  scheduledAt?: number | null;
}

// ---------------------------------------------------------------------------
// Consent / opt-out ledger (DPDP / TRAI DND compliance hooks)
// ---------------------------------------------------------------------------

export interface ConsentRecord {
  jid: WhatsAppContactId;
  optedIn: boolean;
  source: 'agent' | 'widget' | 'broadcast' | 'auto' | 'import';
  channel: 'whatsapp' | 'email' | 'sms' | 'call';
  changedAt: number;
  /** Reason / audit trail (who or what changed it). */
  note?: string | null;
}

// ---------------------------------------------------------------------------
// Telephony provider interface — implements TeleCRM's call management (A1.x)
// ---------------------------------------------------------------------------

export type CallDirection = 'inbound' | 'outbound';

export type CallStatus =
  | 'queued'
  | 'ringing'
  | 'in-progress'
  | 'completed'
  | 'failed'
  | 'no-answer'
  | 'missed'
  | 'rejected'
  | 'busy'
  | 'cancelled';

export type CallDisposition =
  | 'answered'
  | 'no_answer'
  | 'busy'
  | 'not_connected'
  | 'wrong_number'
  | 'not_interested'
  | 'callback'
  | 'dnc'
  | 'converted'
  | 'follow_up'
  | 'other';

export interface CallRecord {
  id: string;
  enterpriseId: string;
  /** Linked lead when the number resolved (auto from caller-id / dialer). */
  leadId: string | null;
  direction: CallDirection;
  status: CallStatus;
  disposition: CallDisposition | null;
  /** E.164-normalized dialed/calling party number. */
  phone: string;
  startedAt: string;
  endedAt: string | null;
  durationSec: number;
  /** Talk time (excludes ring/wrap-up). */
  talkSec: number;
  ringSec: number;
  recordingId: string | null;
  trunk: string | null;
  did: string | null;
  agentUserId: string | null;
  note: string | null;
  createdAt: string;
}

export interface RecordingRef {
  id: string;
  callId: string;
  /** Short-lived signed URL (object storage). */
  url: string;
  mimeType: string;
  sizeBytes: number;
  durationSec: number;
  status: 'recorded' | 'processing' | 'ready' | 'failed';
}

/** Follow-up reminder (A1.5) — quick chips: 1h / 3h / tomorrow 10am / custom. */
export interface CallbackRequest {
  id: string;
  enterpriseId: string;
  leadId: string;
  dueAt: string;
  status: 'pending' | 'done' | 'cancelled' | 'missed';
  source: 'manual' | 'dialer' | 'automation' | 'call_disposition';
  channel: 'in_app' | 'whatsapp' | 'email' | 'push' | 'call';
  note: string | null;
  createdAt: string;
  completedAt: string | null;
}

/** Smart dialer queue candidate (A1.1). Score = priority; higher dials first. */
export interface DialerCandidate {
  leadId: string;
  identifier: string;
  phone: string;
  score: number;
  /** Human-readable priority breakdown, e.g. ["follow-up-due +500", "score +42"]. */
  reasons: string[];
  followUpDueAt: string | null;
  slaBreachRisk: number;
  leadScore: number;
  freshnessHours: number;
  lastDialedAt: string | null;
}

export type DialerMode = 'power' | 'preview' | 'progressive';

/**
 * The provider boundary for telephony. Every driver (mock, Asterisk ARI)
 * implements this exactly. The domain layer (dialer, caller-id, call logging)
 * only ever sees this surface — no PBX details leak upward.
 */
export interface TelephonyProvider {
  readonly kind: 'mock' | 'asterisk-ari';

  /** Place an outbound call; returns the provider-side call id. */
  dial(to: string, from?: string, context?: Record<string, unknown>): Promise<{ callId: string }>;

  /** Hang up an in-progress call. */
  hangup(callId: string): Promise<void>;

  /** Current status + elapsed seconds for a call (polled by the dialer). */
  callState(callId: string): Promise<{ status: CallStatus; durationSec: number }>;

  /** Start recording on a live call; returns a provider-side recording id. */
  startRecording(callId: string): Promise<{ recordingId: string }>;

  /** Stop recording; finalizes the audio object. */
  stopRecording(callId: string): Promise<{ recordingId: string }>;

  /**
   * Subscribe to lifecycle events. cb receives a CallRecord-ish update for
   * 'call' events or a status string for 'status' events (discriminate by the
   * event name). Returns an unsubscribe fn.
   */
  on(event: 'call' | 'status', cb: (arg: unknown) => void): () => void;
}

/** TRAI UCC/DND compliance hook: a number blocked from a channel. */
export interface DndEntry {
  phone: string;
  channel: 'call' | 'whatsapp' | 'sms' | 'all';
  source: 'trai' | 'enterprise' | 'agent';
  reason?: string | null;
  expiresAt?: string | null;
}

// ---------------------------------------------------------------------------
// Automation / rules engine (A6.x — Temporal-backed workflows)
//
// A Rule fires when its Trigger matches an inbound domain event; if its
// Condition tree evaluates truthy against the event payload, each Action in
// order is enqueued as a Temporal activity. A Run records a single firing
// (per event) end-to-end, including per-step outcomes for audit + retry.
// ---------------------------------------------------------------------------

/** Where a rule was authored. Drives UI affordances and editability. */
export type RuleSource =
  | 'system' // seeded by the platform; not editable
  | 'template' // cloned from a system template; editable
  | 'custom'; // enterprise-authored; editable

/** A rule's lifecycle state. Only `active` rules are evaluated against events. */
export type RuleStatus =
  | 'draft' // authoring in progress; never evaluated
  | 'active' // eligible to fire on matching events
  | 'paused' // kept for audit; suspended
  | 'archived'; // soft-deleted; hidden from rule lists

/**
 * What the rule is *listening* for. One trigger per rule (v1); multiple
 * triggers are modeled as multiple rules sharing an action graph.
 */
export type TriggerKind =
  | 'lead.created' // a new lead row appeared (async ingest, manual, import)
  | 'lead.updated' // any lead field changed
  | 'lead.stage_changed' // stage transitioned; payload carries from/to
  | 'lead.assigned' // owner / team-member reassigned
  | 'lead.tag_added' // a tag was added; payload carries the tag
  | 'lead.score_changed' // score crossed a threshold
  | 'action.created' // any action logged (call, note, system)
  | 'action.type' // a specific action type code (TeleCRM parity: "1001")
  | 'call.completed' // dialer / inbound call ended
  | 'call.missed' // inbound missed (or outbound no-answer)
  | 'callback.due' // a scheduled follow-up reached its dueAt
  | 'callback.overdue' // a scheduled follow-up is past dueAt
  | 'whatsapp.inbound' // new inbound WhatsApp message
  | 'whatsapp.keyword' // inbound message matched a configured keyword
  | 'schedule.cron' // time-based; evaluated by the Temporal scheduler
  | 'webhook.received'; // external POST to /hooks/{ruleId}

/** Polymorphic trigger payload. Discriminate on `kind`. */
export type AutomationTrigger =
  | { kind: 'lead.created'; enterpriseId: string; leadId: string }
  | { kind: 'lead.updated'; enterpriseId: string; leadId: string; changedFields: string[] }
  | {
      kind: 'lead.stage_changed';
      enterpriseId: string;
      leadId: string;
      fromStageId: string | null;
      toStageId: string | null;
      pipelineId: string;
    }
  | {
      kind: 'lead.assigned';
      enterpriseId: string;
      leadId: string;
      toUserId: string | null;
      toTeamMemberId: string | null;
    }
  | { kind: 'lead.tag_added'; enterpriseId: string; leadId: string; tag: string }
  | {
      kind: 'lead.score_changed';
      enterpriseId: string;
      leadId: string;
      fromScore: number | null;
      toScore: number | null;
    }
  | {
      kind: 'action.created';
      enterpriseId: string;
      actionId: string;
      leadId: string;
      actionTypeId: string;
      actionTypeCode: string;
    }
  | {
      kind: 'action.type';
      enterpriseId: string;
      actionId: string;
      leadId: string;
      actionTypeId: string;
      actionTypeCode: string;
    }
  | {
      kind: 'call.completed';
      enterpriseId: string;
      callId: string;
      leadId: string | null;
      direction: CallDirection;
      disposition: CallDisposition | null;
      durationSec: number;
    }
  | {
      kind: 'call.missed';
      enterpriseId: string;
      callId: string;
      leadId: string | null;
      direction: CallDirection;
    }
  | {
      kind: 'callback.due';
      enterpriseId: string;
      callbackId: string;
      leadId: string;
      dueAt: string;
    }
  | {
      kind: 'callback.overdue';
      enterpriseId: string;
      callbackId: string;
      leadId: string;
      dueAt: string;
      overdueSec: number;
    }
  | {
      kind: 'whatsapp.inbound';
      enterpriseId: string;
      messageId: string;
      chatId: WhatsAppContactId;
      fromMe: false;
    }
  | {
      kind: 'whatsapp.keyword';
      enterpriseId: string;
      messageId: string;
      chatId: WhatsAppContactId;
      keyword: string;
      body: string;
    }
  | { kind: 'schedule.cron'; enterpriseId: string; firedAt: string; cron: string }
  | {
      kind: 'webhook.received';
      enterpriseId: string;
      hookId: string;
      method: 'POST' | 'PUT' | 'PATCH';
      path: string;
      headers: Record<string, string>;
      body: unknown;
    };

/** Comparison operators available in conditions. */
export type ConditionOp =
  | 'eq' // strict equality
  | 'neq' // strict inequality
  | 'gt' // numeric / lexicographic greater-than
  | 'gte'
  | 'lt'
  | 'lte'
  | 'in' // value ∈ array
  | 'not_in'
  | 'contains' // substring for strings; element-membership for arrays
  | 'not_contains'
  | 'starts_with'
  | 'ends_with'
  | 'is_empty' // null | undefined | '' | []
  | 'is_not_empty'
  | 'between' // numeric/string range; `value` = [min, max]
  | 'regex' // regex match on string value
  | 'changed' // field's value changed in this event (update triggers)
  | 'changed_to' // field's value changed to `value`
  | 'changed_from' // field's value changed from `value`
  | 'has_tag' // lead has tag in `value` (string | string[])
  | 'missing_tag'
  | 'within_days' // date value within N days of now (positive = future)
  | 'older_than_days' // date value older than N days
  | 'in_time_window'; // time-of-day window [HH:mm, HH:mm] in `value`

/** A single atomic condition against a path on the trigger payload / lead. */
export interface Condition {
  /** Dotted path into the evaluation context, e.g. `lead.score` or `event.toStageId`. */
  field: string;
  op: ConditionOp;
  /**
   * Operand. Type depends on op:
   * - eq/neq/gt/... → scalar
   * - in/not_in → array
   * - between → [min, max]
   * - has_tag → string | string[]
   * - within_days / older_than_days → number
   * - is_empty / changed → ignored (pass null)
   */
  value?: unknown;
  /** Optional human-readable note shown in the rule builder. */
  note?: string | null;
}

/** How a condition group's children combine. */
export type ConditionCombinator = 'and' | 'or';

/** A boolean tree of conditions evaluated against the event context. */
export interface ConditionGroup {
  combinator: ConditionCombinator;
  children: ConditionNode[];
}
export type ConditionNode = Condition | ConditionGroup;

/** Top-level condition tree on a rule; defaults to AND-of-all if omitted. */
export interface RuleConditionTree {
  combinator: ConditionCombinator;
  children: ConditionNode[];
}

/** Where a condition field's value is sourced from. */
export type ConditionFieldSource =
  | 'event' // a property of the trigger payload (e.g. event.toStageId)
  | 'lead' // a property of the lead at the time of the event
  | 'lead.custom' // lead.customFields[apiName]
  | 'lead.stage' // stageId / pipelineId convenience
  | 'lead.owner' // ownerUserId / assignedTeamMemberId
  | 'caller' // the actor that produced the event (user/token)
  | 'now'; // the event timestamp (for within_days / in_time_window)

/** What to do if an action fails. */
export type ActionFailurePolicy =
  | 'abort' // stop the run; mark remaining actions skipped
  | 'continue' // log the error; keep going
  | 'retry'; // Temporal-managed retry per action's retry config

/** Side effects a rule can perform when its conditions match. */
export type ActionKind =
  | 'lead.assign' // set ownerUserId / assignedTeamMemberId (round-robin or fixed)
  | 'lead.set_stage' // transition pipeline stage
  | 'lead.add_tag' // add one or more tags
  | 'lead.remove_tag'
  | 'lead.set_field' // update a custom field by apiName
  | 'lead.set_score' // bump / set the integer score
  | 'lead.merge' // merge duplicate into a primary lead
  | 'lead.archive'
  | 'lead.notify_owner' // in-app notification to ownerUserId
  | 'action.log' // create an Action row (any actionTypeCode; "1001" parity OK)
  | 'callback.schedule' // create a CallbackRequest (A1.5)
  | 'call.dial' // enqueue a dialer call (A1.1)
  | 'whatsapp.send_template' // cloud-api template send
  | 'whatsapp.send_text' // session send (respects TRAI window)
  | 'sms.send'
  | 'email.send'
  | 'webhook.post' // outbound HTTP POST to a configured URL
  | 'http.request' // generic signed request (GET/POST/PUT/PATCH/DELETE)
  | 'notifier.in_app'
  | 'notifier.push'
  | 'workflow.start' // start another rule's workflow (composition)
  | 'delay' // Temporal timer; advances after N duration
  | 'branch' // conditional sub-actions by expression
  | 'end'; // terminate the run successfully

/** Templating: `{{lead.identifier}}`, `{{event.toStageId}}`, etc. */
export type TemplateString = string;

/** Action-specific configuration. Discriminate on `kind`. */
export type AutomationAction =
  | {
      kind: 'lead.assign';
      mode: 'fixed' | 'round_robin' | 'least_loaded';
      userId?: string | null;
      teamMemberId?: string | null;
      /** Restrict round-robin to a specific pool (role id or named bucket). */
      poolId?: string | null;
    }
  | {
      kind: 'lead.set_stage';
      pipelineId: string;
      stageId: string;
      lostReasonId?: string | null;
    }
  | { kind: 'lead.add_tag'; tags: string[] }
  | { kind: 'lead.remove_tag'; tags: string[] }
  | {
      kind: 'lead.set_field';
      apiName: string;
      value: unknown;
      /** If true, missing field creates a runtime error. */
      strict?: boolean;
    }
  | { kind: 'lead.set_score'; value: number; mode: 'set' | 'increment' | 'decrement' }
  | {
      kind: 'lead.merge';
      primaryLeadId: string;
      duplicateLeadId: string;
      /** Which side's custom fields win on conflict. */
      conflictPolicy: 'primary' | 'duplicate' | 'newest';
    }
  | { kind: 'lead.archive'; reason?: string | null }
  | {
      kind: 'lead.notify_owner';
      channel: 'in_app' | 'whatsapp' | 'email' | 'push';
      title: TemplateString;
      body: TemplateString;
    }
  | {
      kind: 'action.log';
      actionTypeCode: string;
      payload: Record<string, unknown>;
      note?: TemplateString | null;
    }
  | {
      kind: 'callback.schedule';
      dueInMinutes: number;
      channel: CallbackRequest['channel'];
      note?: TemplateString | null;
      /** Optional: pin to an exact time instead of relative. */
      dueAt?: string | null;
    }
  | { kind: 'call.dial'; agentSessionId?: string | null; preview?: boolean }
  | {
      kind: 'whatsapp.send_template';
      templateName: string;
      languageCode: string;
      components: Record<string, unknown>[];
    }
  | { kind: 'whatsapp.send_text'; body: TemplateString; agentSessionId?: string | null }
  | { kind: 'sms.send'; body: TemplateString; senderId?: string | null }
  | {
      kind: 'email.send';
      to: TemplateString;
      subject: TemplateString;
      body: TemplateString;
      isHtml?: boolean;
    }
  | {
      kind: 'webhook.post';
      url: TemplateString;
      body: Record<string, unknown>;
      headers?: Record<string, string>;
      timeoutMs?: number;
    }
  | {
      kind: 'http.request';
      method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
      url: TemplateString;
      headers?: Record<string, string>;
      body?: unknown;
      timeoutMs?: number;
    }
  | {
      kind: 'notifier.in_app';
      userId: TemplateString;
      title: TemplateString;
      body: TemplateString;
    }
  | { kind: 'notifier.push'; userId: TemplateString; title: TemplateString; body: TemplateString }
  | { kind: 'workflow.start'; ruleId: string; payloadOverride?: Record<string, unknown> }
  | { kind: 'delay'; durationSec: number; until?: string | null }
  | {
      kind: 'branch';
      // Each branch: a condition tree + the actions to run if truthy.
      branches: { when: RuleConditionTree; then: AutomationActionConfig[] }[];
      // Optional fallback actions if no branch matches.
      else?: AutomationActionConfig[];
    }
  | { kind: 'end' };

/** Per-action config: an action paired with retry + failure semantics. */
export interface AutomationActionConfig {
  /** Stable per-rule id; referenced by run steps + UI. */
  id: string;
  action: AutomationAction;
  /** Failure policy for this step (default 'retry'). */
  onFailure?: ActionFailurePolicy;
  /** Max retry attempts (default 3). */
  maxRetries?: number;
  /** Initial backoff in ms (default 1_000). */
  retryBackoffMs?: number;
  /** Backoff multiplier (default 2.0). */
  retryBackoffMultiplier?: number;
  /** Max backoff in ms (default 60_000). */
  retryBackoffMaxMs?: number;
  /** Skip this action if `condition` evaluates falsy. */
  skipWhen?: RuleConditionTree | null;
}

/** Run lifecycle states. */
export type RuleRunStatus =
  | 'queued' // accepted by the workflow runner; not yet started
  | 'running' // trigger matched; actions in flight
  | 'awaiting' // waiting on a `delay` or external signal
  | 'succeeded' // every action completed
  | 'partial' // completed with at least one non-fatal failure
  | 'failed' // aborted (action failure policy = abort, or uncaught error)
  | 'cancelled' // cancelled by a user / system
  | 'timed_out'; // exceeded the run-level timeout

/** Per-step outcome. */
export type RuleRunStepStatus =
  | 'pending'
  | 'skipped'
  | 'running'
  | 'succeeded'
  | 'failed'
  | 'retrying'
  | 'cancelled';

/** What produced the run. */
export type RuleRunOrigin =
  | 'event' // matched a real event
  | 'manual' // human-triggered test / replay
  | 'scheduled' // fired by schedule.cron
  | 'webhook'
  | 'workflow'; // started by another rule

/**
 * The rule definition. `trigger` selects events; `condition` filters them;
 * `actions` run in declared order; runtime data lives on a RuleRun.
 */
export interface Rule {
  id: string;
  enterpriseId: string;
  name: string;
  description?: string | null;
  trigger: TriggerKind;
  /** Optional static filter applied at the event source (e.g. pipeline id). */
  triggerFilter?: Record<string, unknown> | null;
  condition?: RuleConditionTree | null;
  actions: AutomationActionConfig[];
  status: RuleStatus;
  source: RuleSource;
  /** Optional category for rule-list grouping. */
  category?: string | null;
  /** Tags for search / ownership. */
  tags?: string[] | null;
  /** Per-rule run timeout in seconds (default 3600). */
  runTimeoutSec?: number | null;
  /** Per-rule rate limit: max runs per minute (default 60). */
  rateLimitPerMinute?: number | null;
  /** Throttle: minimum gap between runs for the same lead (seconds). */
  perLeadCooldownSec?: number | null;
  /** Authoring user. */
  createdByUserId?: string | null;
  createdAt: string;
  updatedAt: string;
  /** Last time the engine observed the rule in `active` state. */
  activatedAt?: string | null;
  /** Soft-delete timestamp. */
  archivedAt?: string | null;
  /** Monotonic version used for optimistic concurrency. */
  version: number;
}

/** A single firing of a rule, end-to-end. */
export interface RuleRun {
  id: string;
  enterpriseId: string;
  ruleId: string;
  ruleVersion: number;
  /** The trigger payload that fired the rule (snapshot at enqueue time). */
  trigger: AutomationTrigger;
  /** Snapshot of the rule at the moment of firing. */
  ruleSnapshot: Rule;
  status: RuleRunStatus;
  origin: RuleRunOrigin;
  /** The lead this run acts on (when one is in scope). */
  leadId?: string | null;
  /** Lead snapshot captured at run start (custom fields may change mid-run). */
  leadSnapshot?: Record<string, unknown> | null;
  /** User that triggered it, if manual. */
  triggeredByUserId?: string | null;
  /** Temporal workflow id for cross-system observability. */
  workflowId?: string | null;
  /** Monotonic per-run attempt counter (1-based). */
  attempt: number;
  /** Per-step outcomes. */
  steps: RuleRunStep[];
  /** Aggregate timing in ms: from enqueue to terminal state. */
  durationMs: number | null;
  /** Last error message for failed / partial runs. */
  error?: string | null;
  /** Stack trace for failed / partial runs. */
  errorStack?: string | null;
  /** When the run entered its terminal state. */
  finishedAt?: string | null;
  /** When the run was enqueued. */
  queuedAt: string;
  /** When the run actually started executing. */
  startedAt?: string | null;
}

/** A single step (one AutomationActionConfig) inside a RuleRun. */
export interface RuleRunStep {
  /** Mirrors AutomationActionConfig.id for join-back. */
  actionConfigId: string;
  /** Action kind for cheap reads (no full config rehydration needed). */
  kind: ActionKind;
  status: RuleRunStepStatus;
  attempt: number;
  /** Inputs passed to the action (post-template-resolution). */
  input?: unknown;
  /** Outputs returned by the action (e.g. messageId, callbackId). */
  output?: unknown;
  /** Last error message if failed. */
  error?: string | null;
  /** Last error stack if failed. */
  errorStack?: string | null;
  startedAt?: string | null;
  finishedAt?: string | null;
  durationMs?: number | null;
}

/** Telemetry counters; useful for rate-limit + UI display. */
export interface RuleMetrics {
  ruleId: string;
  /** Last 24h, per status. */
  runsLast24h: number;
  runsSucceededLast24h: number;
  runsFailedLast24h: number;
  /** Average duration over the last 24h (ms). */
  avgDurationMs: number | null;
  /** Last time the rule fired (any status). */
  lastFiredAt: string | null;
  /** When the engine last touched the rule. */
  updatedAt: string;
}

/** API-facing: the engine's surface for enqueueing + querying. */
export interface AutomationEngine {
  /** Enqueue a run for `trigger`. Idempotent on (ruleId, triggerIdempotencyKey). */
  enqueue(input: {
    enterpriseId: string;
    ruleId: string;
    trigger: AutomationTrigger;
    /** Caller-supplied key to dedupe rapid duplicate events. */
    idempotencyKey?: string;
  }): Promise<{ runId: string; workflowId: string }>;

  /** Fetch a run + its steps. */
  getRun(input: { enterpriseId: string; runId: string }): Promise<RuleRun | null>;

  /** List runs, newest first. */
  listRuns(input: {
    enterpriseId: string;
    ruleId?: string;
    leadId?: string;
    status?: RuleRunStatus;
    limit?: number;
    cursor?: string;
  }): Promise<{ items: RuleRun[]; nextCursor: string | null }>;

  /** Cancel a queued / running run. */
  cancel(input: { enterpriseId: string; runId: string; reason?: string }): Promise<void>;

  /** Dry-run a rule against a synthetic trigger; useful in the rule builder. */
  preview(input: {
    enterpriseId: string;
    rule: Rule;
    trigger: AutomationTrigger;
  }): Promise<{
    matched: boolean;
    steps: { actionConfigId: string; status: RuleRunStepStatus; reason: string }[];
  }>;
}

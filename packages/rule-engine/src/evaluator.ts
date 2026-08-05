/**
 * OpenTeleCRM — rule evaluator (P4, A4.x).
 *
 * Pure functions. No I/O, no DB, no provider references. Caller (the
 * automation service in services/automation) supplies the fact map; this
 * module returns a plan describing which actions to run and in what order.
 *
 * Why pure: lets us snapshot-test every operator and every action kind
 * without spinning up Postgres / Redis / a provider; lets the same
 * evaluator run in the API process for live events AND in a worker for
 * scheduled drips AND in a CLI for "test this rule on this lead".
 *
 * Pipeline:
 *   event + rules + facts  →  matchesTrigger()      (per rule)
 *                         →  evaluateConditions()   (root guard)
 *                         →  planActions()          (per-action when, order)
 *                         →  RulePlan[]             (caller dispatches)
 *
 * Failure mode: this module never throws on bad data. It returns a plan
 * with `error` set so the caller can log + skip without losing the run.
 */

import type {
  ActionSpec,
  AutomationEvent,
  AutomationRule,
  Condition,
  ConditionGroup,
  ConditionOp,
  ConditionValue,
  FactMap,
  FactValue,
  RuleScope,
  TriggerSpec,
} from './types.js';

// ---------------------------------------------------------------------------
// Public result types
// ---------------------------------------------------------------------------

/**
 * One planned action ready for dispatch. `substituted` is the action with
 * every `{{token}}` replaced; `original` is kept for audit.
 */
export interface PlannedAction {
  /** Order in the rule's action list (0-indexed). */
  index: number;
  /** Stable id from the action if present, else `${ruleId}#${index}`. */
  id: string;
  /** Action with `{{path}}` tokens resolved against facts. */
  substituted: ActionSpec;
  /** Verbatim action for audit / diff. */
  original: ActionSpec;
}

export interface RulePlan {
  ruleId: string;
  enterpriseId: string;
  /** 'skip' = rule matched but root guard failed; 'fire' = actions planned. */
  outcome: 'fire' | 'skip';
  /** When outcome='skip' — short reason for the run log. */
  reason?: string;
  /** When outcome='fire' — ordered actions after per-action `when` gates. */
  actions: PlannedAction[];
  /** Set when an action failed to plan (e.g. unknown kind, bad template). */
  error?: string;
}

export interface EvaluationContext {
  /** Current facts (lead + event + context + now). Required. */
  facts: FactMap;
  /** Event being processed (for trigger matching + event-derived facts). */
  event: AutomationEvent;
}

// ---------------------------------------------------------------------------
// Top-level: evaluate one rule against one event
// ---------------------------------------------------------------------------

/**
 * Evaluate a single rule. Returns a plan describing what to do. Pure:
 * identical inputs → identical output. Never throws.
 */
export function evaluateRule(rule: AutomationRule, context: EvaluationContext): RulePlan {
  // 1. Disabled rules are inert.
  if (!rule.enabled) {
    return {
      ruleId: rule.id,
      enterpriseId: rule.enterpriseId,
      outcome: 'skip',
      reason: 'rule-disabled',
      actions: [],
    };
  }

  // 2. Wrong enterprise — fail closed. The caller may pass rules for many
  //    enterprises; we never want to fire a rule against the wrong tenant.
  if (rule.enterpriseId !== context.event.enterpriseId) {
    return {
      ruleId: rule.id,
      enterpriseId: rule.enterpriseId,
      outcome: 'skip',
      reason: 'enterprise-mismatch',
      actions: [],
    };
  }

  // 3. Trigger must match the event kind.
  if (!matchesTrigger(rule.trigger, context)) {
    return {
      ruleId: rule.id,
      enterpriseId: rule.enterpriseId,
      outcome: 'skip',
      reason: 'trigger-mismatch',
      actions: [],
    };
  }

  // 4. Scope guard.
  if (!scopeMatches(rule.trigger.scope, context.facts)) {
    return {
      ruleId: rule.id,
      enterpriseId: rule.enterpriseId,
      outcome: 'skip',
      reason: 'scope-mismatch',
      actions: [],
    };
  }

  // 5. Root condition guard.
  if (rule.conditions && !evaluateConditionGroup(rule.conditions, context.facts)) {
    return {
      ruleId: rule.id,
      enterpriseId: rule.enterpriseId,
      outcome: 'skip',
      reason: 'root-conditions-failed',
      actions: [],
    };
  }

  // 6. Plan actions.
  return planActions(rule, context);
}

// ---------------------------------------------------------------------------
// Trigger matching
// ---------------------------------------------------------------------------

/**
 * Does the rule's trigger fire on this event? Manual + time triggers
 * never match an event-shaped envelope; the caller (scheduler / "Run now"
 * button) is responsible for synthesizing the right context.
 */
export function matchesTrigger(trigger: TriggerSpec, context: EvaluationContext): boolean {
  if (trigger.kind !== context.event.kind) {
    return false;
  }
  if (trigger.when && !evaluateConditionGroup(trigger.when, context.facts)) {
    return false;
  }
  return true;
}

/**
 * Scope filter: all set fields must equal the corresponding fact. Omitted
 * scope fields are not checked. Lead-only — we don't scope on event.
 */
export function scopeMatches(scope: RuleScope | undefined, facts: FactMap): boolean {
  if (!scope) return true;
  if (scope.pipelineId !== undefined && scope.pipelineId !== facts.lead.pipelineId) {
    return false;
  }
  if (scope.stageId !== undefined && scope.stageId !== facts.lead.stageId) {
    return false;
  }
  if (scope.source !== undefined && scope.source !== facts.lead.source) {
    return false;
  }
  if (scope.ownerUserId !== undefined && scope.ownerUserId !== facts.lead.ownerUserId) {
    return false;
  }
  return true;
}

// ---------------------------------------------------------------------------
// Condition evaluation
// ---------------------------------------------------------------------------

/**
 * Evaluate a combinator tree. Empty `all` = true (vacuously satisfied);
 * empty `any` = false. Nested groups are AND/OR'd with their parent per
 * the parent's combinator (standard short-circuit semantics).
 */
export function evaluateConditionGroup(group: ConditionGroup, facts: FactMap): boolean {
  if (group.conditions.length === 0 && (!group.groups || group.groups.length === 0)) {
    return group.combinator === 'all';
  }
  if (group.combinator === 'all') {
    for (const c of group.conditions) {
      if (!evaluateCondition(c, facts)) return false;
    }
    for (const g of group.groups ?? []) {
      if (!evaluateConditionGroup(g, facts)) return false;
    }
    return true;
  }
  // 'any'
  for (const c of group.conditions) {
    if (evaluateCondition(c, facts)) return true;
  }
  for (const g of group.groups ?? []) {
    if (evaluateConditionGroup(g, facts)) return true;
  }
  return false;
}

/**
 * Evaluate a single leaf. Unknown ops fail closed (return false) so a
 * typo in a stored rule never makes it auto-fire. Value coercion is
 * documented per op; numbers compare as numbers, strings as strings.
 */
export function evaluateCondition(condition: Condition, facts: FactMap): boolean {
  const lhs = resolvePath(condition.path, facts);
  return applyOp(condition.op, lhs, condition.value);
}

/**
 * Pure operator dispatch. Exported so the unit test (or the rule-test
 * endpoint in the API) can probe ops without setting up a whole rule.
 */
export function applyOp(op: ConditionOp, lhs: FactValue, rhs: ConditionValue | undefined): boolean {
  switch (op) {
    case 'eq':
      return looseEq(lhs, rhs as ConditionValue);
    case 'neq':
      return !looseEq(lhs, rhs as ConditionValue);
    case 'gt':
      return cmpNum(lhs, rhs) > 0;
    case 'gte':
      return cmpNum(lhs, rhs) >= 0;
    case 'lt':
      return cmpNum(lhs, rhs) < 0;
    case 'lte':
      return cmpNum(lhs, rhs) <= 0;
    case 'in':
      return Array.isArray(rhs) ? rhs.some((v) => looseEq(lhs, v)) : false;
    case 'not_in':
      return Array.isArray(rhs) ? !rhs.some((v) => looseEq(lhs, v)) : true;
    case 'contains':
      return stringContains(lhs, rhs);
    case 'not_contains':
      return !stringContains(lhs, rhs);
    case 'starts_with':
      return typeof lhs === 'string' && typeof rhs === 'string' && lhs.startsWith(rhs);
    case 'ends_with':
      return typeof lhs === 'string' && typeof rhs === 'string' && lhs.endsWith(rhs);
    case 'exists':
      return lhs !== undefined && lhs !== null;
    case 'not_exists':
      return lhs === undefined || lhs === null;
    case 'is_empty':
      return isEmpty(lhs);
    case 'is_not_empty':
      return !isEmpty(lhs);
    case 'matches_regex':
      return typeof lhs === 'string' && typeof rhs === 'string' && safeTestRegex(rhs, lhs);
    default: {
      // Exhaustiveness check — TS will error here if a new op is added
      // without updating this switch.
      const _exhaustive: never = op;
      void _exhaustive;
      return false;
    }
  }
}

// ---------------------------------------------------------------------------
// Action planning
// ---------------------------------------------------------------------------

/**
 * Plan a rule's actions: evaluate each action's `when` gate, substitute
 * `{{path}}` tokens, and stop walking the list on the first `stop` action.
 * Returns the plan; never throws. The `stop` action itself IS included
 * in the plan (so the dispatcher can record it in the run log).
 */
export function planActions(rule: AutomationRule, context: EvaluationContext): RulePlan {
  const planned: PlannedAction[] = [];
  for (let i = 0; i < rule.actions.length; i++) {
    const action = rule.actions[i];
    if (!action) continue;
    if (action.when && !evaluateConditionGroup(action.when, context.facts)) {
      continue;
    }
    try {
      const { action: substituted, missing: _missing } = substituteAction(action, context.facts);
      void _missing;
      planned.push({
        index: i,
        id: action.id ?? `${rule.id}#${i}`,
        substituted,
        original: action,
      });
    } catch (err) {
      return {
        ruleId: rule.id,
        enterpriseId: rule.enterpriseId,
        outcome: 'fire',
        reason: 'action-plan-error',
        actions: planned,
        error: err instanceof Error ? err.message : String(err),
      };
    }
    if (action.kind === 'stop') {
      break;
    }
  }
  return {
    ruleId: rule.id,
    enterpriseId: rule.enterpriseId,
    outcome: 'fire',
    actions: planned,
  };
}

// ---------------------------------------------------------------------------
// {{token}} substitution
// ---------------------------------------------------------------------------

/** Regex used to find `{{...}}` tokens. Dotted, alphanumeric + underscore. */
const TOKEN_RE = /\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*(?:\.[a-zA-Z_][a-zA-Z0-9_]*)*)\s*\}\}/g;

/**
 * Substitute every `{{path}}` token in `s` against the fact map. Unknown
 * paths are replaced with the empty string AND recorded in `missing` so
 * the planner can log a warning rather than silently dropping data.
 */
export function substituteString(s: string, facts: FactMap): { value: string; missing: string[] } {
  const missing: string[] = [];
  const value = s.replace(TOKEN_RE, (_match, path: string) => {
    const v = resolvePath(path, facts);
    if (v === undefined || v === null) {
      missing.push(path);
      return '';
    }
    if (Array.isArray(v)) {
      return v.map((x) => String(x)).join(',');
    }
    return String(v);
  });
  return { value, missing };
}

/**
 * Walk an action and substitute tokens in every string leaf. Non-string
 * primitives (numbers, booleans) are left alone. Returns a structurally
 * identical action with substituted strings + the aggregate missing list.
 */
export function substituteAction(
  action: ActionSpec,
  facts: FactMap,
): { action: ActionSpec; missing: string[] } {
  const missing: string[] = [];
  const walk = (node: unknown): unknown => {
    if (typeof node === 'string') {
      const r = substituteString(node, facts);
      if (r.missing.length) missing.push(...r.missing);
      return r.value;
    }
    if (Array.isArray(node)) {
      return node.map(walk);
    }
    if (node && typeof node === 'object') {
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(node)) {
        out[k] = walk(v);
      }
      return out;
    }
    return node;
  };
  const result = walk(action) as ActionSpec;
  return { action: result, missing };
}

// ---------------------------------------------------------------------------
// Path resolution
// ---------------------------------------------------------------------------

/**
 * Resolve a dotted path against the fact map. Only walks own enumerable
 * keys; refuses to descend into `__proto__` / `constructor` to keep
 * operator-supplied paths from poking the prototype chain.
 */
export function resolvePath(path: string, facts: FactMap): FactValue {
  if (!path) return undefined;
  const parts = path.split('.');
  let cur: unknown = facts;
  for (const part of parts) {
    if (cur === null || cur === undefined) return undefined;
    if (typeof cur !== 'object') return undefined;
    if (part === '__proto__' || part === 'constructor' || part === 'prototype') {
      return undefined;
    }
    cur = (cur as Record<string, unknown>)[part];
  }
  return cur as FactValue;
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** Loose equality — number 1 == string "1". Mirrors JS `==` for scalars. */
function looseEq(lhs: FactValue, rhs: ConditionValue): boolean {
  if (lhs === rhs) return true;
  if (lhs == null || rhs == null) return lhs === rhs; // null/undefined symmetry
  // Arrays on the LHS (e.g. tags) compared against a scalar rhs: only equal
  // if the array contains the rhs value (TeleCRM behavior for tag fields).
  if (Array.isArray(lhs)) {
    return lhs.some((v) => looseEq(v as FactValue, rhs));
  }
  if (Array.isArray(rhs)) {
    return rhs.some((v) => looseEq(lhs, v as ConditionValue));
  }
  // eslint-disable-next-line eqeqeq
  return lhs === rhs;
}

/** Numeric compare. Non-numeric lhs sorts before/after numbers per JS rules. */
function cmpNum(lhs: FactValue, rhs: ConditionValue | undefined): number {
  const l = toNum(lhs);
  const r = toNum(rhs);
  if (l === null && r === null) return 0;
  if (l === null) return -1;
  if (r === null) return 1;
  return l - r;
}

function toNum(v: unknown): number | null {
  if (typeof v === 'number' && !Number.isNaN(v)) return v;
  if (typeof v === 'string' && v.trim() !== '' && !Number.isNaN(Number(v))) {
    return Number(v);
  }
  if (typeof v === 'boolean') return v ? 1 : 0;
  return null;
}

function stringContains(lhs: FactValue, rhs: ConditionValue | undefined): boolean {
  if (typeof lhs !== 'string' || typeof rhs !== 'string') return false;
  return lhs.includes(rhs);
}

function isEmpty(v: FactValue): boolean {
  if (v === null || v === undefined) return true;
  if (typeof v === 'string') return v.length === 0;
  if (Array.isArray(v)) return v.length === 0;
  if (typeof v === 'object' && v !== null) return Object.keys(v).length === 0;
  return false;
}

/** Safe regex — bad patterns fail to false rather than throw. */
function safeTestRegex(pattern: string, value: string): boolean {
  try {
    return new RegExp(pattern).test(value);
  } catch {
    return false;
  }
}

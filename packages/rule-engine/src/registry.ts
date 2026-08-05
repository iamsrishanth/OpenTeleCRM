/**
 * Rule registry — in-memory shape that the automation service fills from
 * the DB on startup (and refreshes on a short TTL or pubsub tick). Keeps
 * the evaluator decoupled from Postgres: callers do the I/O, the registry
 * owns the lookups.
 *
 * Mirrors services/telephony/registry.ts: tiny surface, no surprises, easy
 * to test, easy to swap for an LRU if rules count grows past ~10k.
 */

import type { AutomationRule, TriggerKind } from './types.js';

export interface RuleRegistry {
  /** All rules for an enterprise, regardless of trigger. */
  forEnterprise(enterpriseId: string): AutomationRule[];
  /** Rules that listen for a given trigger kind for an enterprise. */
  forTrigger(enterpriseId: string, kind: TriggerKind): AutomationRule[];
  /** Single rule by id (or null). */
  byId(id: string): AutomationRule | null;
  /** Replace the full rule set (e.g. after a refresh). */
  replace(rules: AutomationRule[]): void;
  /** Current count — handy for /metrics and tests. */
  size(): number;
}

export function createRuleRegistry(initial: AutomationRule[] = []): RuleRegistry {
  // Three indexes; replaced wholesale on every refresh() so we never have
  // to mutate them incrementally (and never have a window where a rule is
  // half-removed from one index and present in another).
  let rules: AutomationRule[] = [];
  let byIdMap: Map<string, AutomationRule> = new Map();
  let byEnterprise: Map<string, AutomationRule[]> = new Map();
  let byTrigger: Map<string, AutomationRule[]> = new Map();

  const rebuild = (next: AutomationRule[]): void => {
    const nextById = new Map<string, AutomationRule>();
    const nextByEnterprise = new Map<string, AutomationRule[]>();
    const nextByTrigger = new Map<string, AutomationRule[]>();
    for (const r of next) {
      nextById.set(r.id, r);
      const ek = `${r.enterpriseId}`;
      const tk = `${r.enterpriseId}::${r.trigger.kind}`;
      pushInto(nextByEnterprise, ek, r);
      pushInto(nextByTrigger, tk, r);
    }
    rules = next;
    byIdMap = nextById;
    byEnterprise = nextByEnterprise;
    byTrigger = nextByTrigger;
  };

  rebuild(initial);

  return {
    forEnterprise(enterpriseId) {
      return byEnterprise.get(enterpriseId) ?? [];
    },
    forTrigger(enterpriseId, kind) {
      return byTrigger.get(`${enterpriseId}::${kind}`) ?? [];
    },
    byId(id) {
      return byIdMap.get(id) ?? null;
    },
    replace(next) {
      rebuild(next);
    },
    size() {
      return rules.length;
    },
  };
}

function pushInto<K, V>(m: Map<K, V[]>, k: K, v: V): void {
  const existing = m.get(k);
  if (existing) existing.push(v);
  else m.set(k, [v]);
}

/**
 * Pick the rules that should fire for an event: enabled, matching trigger,
 * matching enterprise, ordered by priority (descending). Ties keep
 * insertion order — the registry preserves it, the sort is stable.
 */
export function rankCandidates(
  registry: RuleRegistry,
  enterpriseId: string,
  kind: TriggerKind,
): AutomationRule[] {
  return registry
    .forTrigger(enterpriseId, kind)
    .filter((r) => r.enabled)
    .slice()
    .sort((a, b) => b.priority - a.priority);
}

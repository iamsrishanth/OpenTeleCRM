/**
 * Condition-tree evaluation shared by the rule engine and the dispatcher's
 * `branch` executor. Moved out of automation.service.ts so the dispatcher can
 * import it without a circular dependency (service → dispatcher → service).
 *
 * Tree shape (persisted on automation.conditions):
 *   { combinator: 'and' | 'or', children: (Leaf | Tree)[] }
 * Leaf:  { field: 'lead.fields.score', op: 'gt', value: 50 }
 */
import type { AutomationConditionLeaf, AutomationConditionTree } from './types.js';

export interface ConditionFacts {
  [key: string]: unknown;
  lead?: {
    id?: string | null;
    pipelineId?: string | null;
    stageId?: string | null;
    ownerUserId?: string | null;
    assignedTeamMemberId?: string | null;
    source?: string | null;
    score?: number | null;
    tags?: string[];
    fields?: Record<string, unknown>;
  } | null;
}

export function conditionsMatch(
  tree: AutomationConditionTree | null | undefined,
  facts: ConditionFacts,
): boolean {
  if (!tree || !Array.isArray(tree.children) || tree.children.length === 0) return true;
  return evalGroup(tree, facts);
}

function evalGroup(tree: AutomationConditionTree, facts: ConditionFacts): boolean {
  const results = tree.children.map((child) => {
    if ('combinator' in child && child.combinator) {
      return evalGroup(child as AutomationConditionTree, facts);
    }
    return evalLeaf(child as AutomationConditionLeaf, facts);
  });
  if (tree.combinator === 'or') return results.some(Boolean);
  return results.every(Boolean);
}

function evalLeaf(leaf: AutomationConditionLeaf, facts: ConditionFacts): boolean {
  const value = readPath(facts, leaf.field);
  switch (leaf.op) {
    case 'eq':
      return value === leaf.value;
    case 'neq':
      return value !== leaf.value;
    case 'gt':
      return toNum(value) !== null && toNum(leaf.value) !== null && (toNum(value) as number) > (toNum(leaf.value) as number);
    case 'gte':
      return toNum(value) !== null && toNum(leaf.value) !== null && (toNum(value) as number) >= (toNum(leaf.value) as number);
    case 'lt':
      return toNum(value) !== null && toNum(leaf.value) !== null && (toNum(value) as number) < (toNum(leaf.value) as number);
    case 'lte':
      return toNum(value) !== null && toNum(leaf.value) !== null && (toNum(value) as number) <= (toNum(leaf.value) as number);
    case 'in':
      return Array.isArray(leaf.value) && (leaf.value as unknown[]).includes(value);
    case 'contains':
      if (typeof value === 'string' && typeof leaf.value === 'string')
        return value.includes(leaf.value);
      if (Array.isArray(value)) return value.includes(leaf.value);
      return false;
    case 'exists':
      return value !== undefined && value !== null;
    default:
      return true;
  }
}

function readPath(obj: object, path: string): unknown {
  const parts = path.split('.');
  let cur: unknown = obj;
  for (const p of parts) {
    if (cur === null || cur === undefined) return undefined;
    if (typeof cur !== 'object') return undefined;
    cur = (cur as Record<string, unknown>)[p];
  }
  return cur;
}

function toNum(v: unknown): number | null {
  if (typeof v === 'number') return v;
  if (typeof v === 'string') {
    const n = Number(v);
    return Number.isNaN(n) ? null : n;
  }
  return null;
}

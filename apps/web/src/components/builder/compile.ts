import type { AutomationRule } from '@/lib/types'
import { ACTION_WIRE_ALIASES, actionFields, actionLabel, kindIcon, paletteItem, triggerLabel } from './constants'
import {
  emptyConditionConfig,
  type BuilderFlowNode,
  type ConditionConfig,
  type ConditionRow,
} from './types'

// ---------------------------------------------------------------------------
// Canvas → AutomationRule.
//
// Ordering contract (mirrors the task spec):
//   - the FIRST trigger node (top-most, then left-most) sets rule.trigger
//   - condition nodes build the conditions tree (AND/OR groups, folded
//     top-to-bottom into nested groups when more than one node is present)
//   - action nodes append to actions[] sorted top-to-bottom, left-to-right
// ---------------------------------------------------------------------------

export interface CompiledPayload {
  name: string
  trigger: { kind: string; config?: Record<string, unknown> }
  conditions?: unknown
  actions: Array<{ kind: string; config: Record<string, unknown> }>
  schedule?: { cron: string }
  isActive: boolean
}

function orderedNodes(nodes: BuilderFlowNode[], kind: BuilderFlowNode['data']['kind']): BuilderFlowNode[] {
  return nodes
    .filter((n) => n.data.kind === kind)
    .sort(
      (a, b) =>
        (a.position?.y ?? 0) - (b.position?.y ?? 0) ||
        (a.position?.x ?? 0) - (b.position?.x ?? 0),
    )
}

const str = (v: unknown): string => (typeof v === 'string' ? v : v === null || v === undefined ? '' : String(v))

/** Hours until tomorrow 10:00 IST (Asia/Kolkata, UTC+5:30, no DST). */
export function hoursUntilTomorrow10Am(now = new Date()): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now)
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0)
  const target = Date.UTC(get('year'), get('month') - 1, get('day') + 1, 4, 30, 0)
  return Math.max(0, Math.ceil((target - now.getTime()) / 3_600_000))
}

function parseJsonObject(v: unknown): Record<string, string> | undefined {
  const s = str(v).trim()
  if (!s) return undefined
  try {
    const parsed: unknown = JSON.parse(s)
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, string>
    }
  } catch {
    // fall through — invalid JSON is dropped instead of failing the save
  }
  return undefined
}

function coerceConditionValue(row: ConditionRow): unknown {
  const v = str(row.value)
  if (row.op === 'exists') return undefined
  if (row.op === 'in') {
    return v
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
  }
  if (['gt', 'gte', 'lt', 'lte'].includes(row.op)) {
    const n = Number(v)
    return v.trim() !== '' && !Number.isNaN(n) ? n : v
  }
  return v
}

function rowToLeaf(row: ConditionRow): Record<string, unknown> {
  const leaf: Record<string, unknown> = { field: str(row.field).trim(), op: row.op || 'eq' }
  const value = coerceConditionValue(row)
  if (value !== undefined) leaf.value = value
  return leaf
}

function compileConditionNodes(nodes: BuilderFlowNode[]): unknown {
  const groups = nodes
    .map((n) => {
      const cfg = (n.data.config ?? {}) as Partial<ConditionConfig>
      const rows = (cfg.rows ?? []).filter((r) => str(r.field).trim())
      return { combinator: cfg.combinator === 'or' ? ('or' as const) : ('and' as const), rows }
    })
    .filter((g) => g.rows.length > 0)
  if (groups.length === 0) return null
  if (groups.length === 1) {
    return { combinator: groups[0].combinator, children: groups[0].rows.map(rowToLeaf) }
  }
  // Fold top-to-bottom: the top-most node wraps everything below it as a
  // nested child group — produces a valid nested tree for the engine.
  const fold = (gs: typeof groups): Record<string, unknown> => {
    const [head, ...rest] = gs
    const children: unknown[] = head.rows.map(rowToLeaf)
    if (rest.length > 0) children.push(fold(rest))
    return { combinator: head.combinator, children }
  }
  return fold(groups)
}

function buildActionConfig(kind: string, config: Record<string, unknown>): Record<string, unknown> {
  const t = (k: string) => str(config[k]).trim()
  const aliases = ACTION_WIRE_ALIASES[kind] ?? {}
  const wire = (k: string) => aliases[k] ?? k

  const out: Record<string, unknown> = {}
  for (const field of actionFields(kind)) {
    const raw = str(config[field.key])
    if (raw.trim() === '' && !field.required) continue
    out[wire(field.key)] = raw
  }

  switch (kind) {
    case 'assign_lead': {
      const mode = t('mode') || 'round_robin'
      const skills = t('skills')
        ? t('skills').split(',').map((s) => s.trim()).filter(Boolean)
        : undefined
      return skills && skills.length > 0 ? { mode, skills } : { mode }
    }
    case 'create_callback': {
      const quickChip = t('quickChip') || '1h'
      let dueInHours = 1
      if (quickChip === '3h') dueInHours = 3
      else if (quickChip === 'tomorrow_10am') dueInHours = hoursUntilTomorrow10Am()
      else if (quickChip === 'custom' && t('dueAt')) {
        const ms = new Date(t('dueAt')).getTime() - Date.now()
        dueInHours = Math.max(0, Math.ceil(ms / 3_600_000))
      }
      const note = t('note')
      return note ? { quickChip, dueInHours, note } : { quickChip, dueInHours }
    }
    case 'send_whatsapp': {
      const body = t('text')
      const to = t('contactJid')
      return to ? { to, body } : { body }
    }
    case 'update_field':
      return { apiName: t('apiName'), value: str(config['value'] ?? '') }
    case 'move_stage': {
      const pipelineId = t('pipelineId')
      return pipelineId ? { stageId: t('stageId'), pipelineId } : { stageId: t('stageId') }
    }
    case 'notify_user': {
      const out: Record<string, unknown> = {}
      for (const k of ['userId', 'title', 'body'] as const) {
        const v = t(k)
        if (v) out[k] = v
      }
      return out
    }
    case 'send_email': {
      const out: Record<string, unknown> = {}
      for (const k of ['to', 'subject', 'body'] as const) {
        const v = t(k)
        if (v) out[k] = v
      }
      return out
    }
    case 'webhook': {
      const url = t('url')
      const headers = parseJsonObject(config['headers'])
      const body = t('body')
      return {
        ...(url ? { url } : {}),
        method: t('method') || 'POST',
        ...(headers ? { headers } : {}),
        ...(body ? { body } : {}),
      }
    }
    case 'http_request': {
      const url = t('url')
      const headers = parseJsonObject(config['headers'])
      const body = t('body')
      return {
        ...(url ? { url } : {}),
        method: t('method') || 'GET',
        ...(headers ? { headers } : {}),
        ...(body ? { body } : {}),
      }
    }
    case 'branch':
      return {}
    case 'delay': {
      const hours = Number(t('hours'))
      const minutes = Number(t('minutes'))
      const seconds = Number(t('seconds'))
      if (Number.isFinite(hours) && hours > 0) return { hours }
      if (Number.isFinite(minutes) && minutes > 0) return { minutes }
      if (Number.isFinite(seconds) && seconds > 0) return { seconds }
      return {}
    }
    default:
      return out
  }
}

/** Compile the canvas into a create-rule payload (POST /automations). */
export function compileRule(
  nodes: BuilderFlowNode[],
  meta: { name: string; isActive: boolean; cron?: string },
): CompiledPayload {
  const triggerNodes = orderedNodes(nodes, 'trigger')
  const actionNodes = orderedNodes(nodes, 'action')

  const payload: CompiledPayload = {
    name: meta.name.trim(),
    trigger: { kind: 'manual', config: {} },
    actions: [],
    isActive: meta.isActive,
  }

  if (triggerNodes.length > 0) {
    const first = triggerNodes[0]
    const config: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(first.data.config ?? {})) {
      if (str(v).trim() !== '') config[k] = str(v).trim()
    }
    payload.trigger = Object.keys(config).length > 0 ? { kind: first.data.subkind, config } : { kind: first.data.subkind }
  }

  const conditions = compileConditionNodes(orderedNodes(nodes, 'condition'))
  if (conditions) payload.conditions = conditions

  payload.actions = actionNodes.map((n) => ({
    kind: n.data.subkind,
    config: buildActionConfig(n.data.subkind, n.data.config ?? {}),
  }))

  const cron = (meta.cron ?? '').trim()
  if (cron) payload.schedule = { cron }

  return payload
}

/**
 * Edit-mode payload. The API's UpdateRuleDto has no `trigger` key — the
 * backend ignores it (rules.controller.ts PATCH), so we send the fields it
 * actually applies.
 */
export function patchPayloadFromCompiled(compiled: CompiledPayload): Record<string, unknown> {
  const out: Record<string, unknown> = {
    name: compiled.name,
    isActive: compiled.isActive,
    actions: compiled.actions,
  }
  if (compiled.conditions !== undefined) out.conditions = compiled.conditions
  if (compiled.schedule !== undefined) out.schedule = compiled.schedule
  return out
}

// ---------------------------------------------------------------------------
// AutomationRule → canvas.
// ---------------------------------------------------------------------------

function leafValueToString(v: unknown): string {
  if (v === undefined || v === null) return ''
  if (Array.isArray(v)) return v.map(String).join(', ')
  return String(v)
}

interface FlatGroup {
  combinator: 'and' | 'or'
  rows: ConditionRow[]
}

/** Flatten a condition tree into (combinator, leaf-rows) groups, root first. */
export function flattenConditionTree(tree: unknown): FlatGroup[] {
  if (!tree || typeof tree !== 'object') return []
  const groups: FlatGroup[] = []
  const walk = (node: Record<string, unknown>) => {
    const combinator = node.combinator === 'or' ? ('or' as const) : ('and' as const)
    const children = Array.isArray(node.children) ? (node.children as Record<string, unknown>[]) : []
    const leaves = children.filter((c) => !c.combinator)
    const nested = children.filter((c) => c.combinator)
    if (leaves.length > 0) {
      groups.push({
        combinator,
        rows: leaves.map((l) => ({
          field: str(l.field),
          op: str(l.op) || 'eq',
          value: leafValueToString(l.value),
        })),
      })
    }
    for (const child of nested) walk(child)
  }
  if ('combinator' in tree) walk(tree as Record<string, unknown>)
  return groups
}

/** Stringify a stored config into editor-ready key/value strings. */
function stringifyConfig(config: Record<string, unknown> | undefined | null): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(config ?? {})) {
    out[k] = typeof v === 'object' && v !== null ? JSON.stringify(v) : String(v ?? '')
  }
  return out
}

/** Hydrate the canvas from a saved rule (edit mode, ?id=). */
export function ruleToGraph(rule: AutomationRule): BuilderFlowNode[] {
  const nodes: BuilderFlowNode[] = []

  const triggerKind = rule.trigger?.kind ?? 'manual'
  const triggerItem = paletteItem('triggers', triggerKind)
  nodes.push({
    id: 'trigger-0',
    type: 'trigger',
    position: { x: 40, y: 40 },
    data: {
      kind: 'trigger',
      subkind: triggerKind,
      label: triggerLabel(triggerKind),
      hint: triggerItem?.hint,
      icon: kindIcon(triggerKind, 'Zap'),
      config: stringifyConfig(rule.trigger?.config),
    },
  })

  let y = 40 + 170
  const groups = flattenConditionTree(rule.conditions)
  groups.forEach((g, i) => {
    nodes.push({
      id: `cond-${i}`,
      type: 'condition',
      position: { x: 40, y },
      data: {
        kind: 'condition',
        subkind: 'condition',
        label: 'Condition',
        hint: `${g.rows.length} row${g.rows.length === 1 ? '' : 's'} · ${g.combinator.toUpperCase()}`,
        icon: 'Filter',
        config: { combinator: g.combinator, rows: g.rows },
      },
    })
    y += 150
  })

  ;(rule.actions ?? []).forEach((a, i) => {
    nodes.push({
      id: `act-${i}`,
      type: 'action',
      position: { x: 40, y },
      data: {
        kind: 'action',
        subkind: a.kind,
        label: actionLabel(a.kind),
        hint: paletteItem('actions', a.kind)?.hint,
        icon: kindIcon(a.kind, 'Cable'),
        config: stringifyConfig(a.config),
      },
    })
    y += 150
  })

  return nodes
}

/** Defaults for a freshly dropped node. */
export function defaultNodeData(kind: BuilderFlowNode['data']['kind'], subkind: string): BuilderFlowNode['data'] {
  if (kind === 'condition') {
    return {
      kind,
      subkind: 'condition',
      label: 'Condition',
      hint: '1 row · AND',
      icon: 'Filter',
      config: emptyConditionConfig() as unknown as Record<string, unknown>,
    }
  }
  const item = paletteItem(kind === 'trigger' ? 'triggers' : 'actions', subkind)
  return {
    kind,
    subkind,
    label: item?.label ?? subkind,
    hint: item?.hint,
    icon: item?.icon ?? (kind === 'trigger' ? 'Zap' : 'Cable'),
    config: {},
  }
}

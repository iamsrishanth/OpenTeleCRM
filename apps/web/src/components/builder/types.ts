import type { Node } from '@xyflow/react'

/** Top-level node categories on the canvas. */
export type BuilderNodeKind = 'trigger' | 'condition' | 'action'

/** One row of a condition node: field / op / value. */
export interface ConditionRow {
  field: string
  op: string
  value: string
}

/** Condition node payload: a group of rows joined by a combinator. */
export interface ConditionConfig {
  combinator: 'and' | 'or'
  rows: ConditionRow[]
}

/** Arbitrary key/value config carried by trigger and action nodes. */
export type KeyValueConfig = Record<string, string>

/** Payload stored on every canvas node. */
export type BuilderNodeData = {
  /** Node category — decides how it compiles. */
  kind: BuilderNodeKind
  /** Palette key: trigger/action kind value, or 'condition' for condition nodes. */
  subkind: string
  /** Human label shown on the node. */
  label: string
  /** Short description shown under the label. */
  hint?: string
  /** lucide-react icon key resolved by the node renderer. */
  icon: string
  /** Trigger/action: key/value config. Condition: ConditionConfig. */
  config: Record<string, unknown>
}

export type BuilderFlowNode = Node<BuilderNodeData, BuilderNodeKind>

/** Typed editor field for the properties panel. */
export interface FieldDef {
  key: string
  label: string
  type?: 'text' | 'number' | 'textarea' | 'select' | 'datetime'
  options?: Array<{ value: string; label: string }>
  placeholder?: string
  required?: boolean
  help?: string
}

export interface PaletteItem {
  value: string
  label: string
  hint?: string
  icon: string
}

export interface PaletteGroup {
  id: 'triggers' | 'conditions' | 'actions'
  label: string
  items: PaletteItem[]
}

/** Condition operators accepted by the engine (services/api/src/automation/conditions.ts). */
export const CONDITION_OPS: Array<{ value: string; label: string }> = [
  { value: 'eq', label: 'is equal to' },
  { value: 'neq', label: 'is not equal to' },
  { value: 'gt', label: 'is greater than' },
  { value: 'gte', label: 'is greater than or equal' },
  { value: 'lt', label: 'is less than' },
  { value: 'lte', label: 'is less than or equal' },
  { value: 'in', label: 'is one of (comma separated)' },
  { value: 'contains', label: 'contains' },
  { value: 'exists', label: 'exists' },
]

export const CONDITION_COMBINATORS: Array<{ value: 'and' | 'or'; label: string }> = [
  { value: 'and', label: 'AND — every row must match' },
  { value: 'or', label: 'OR — any row must match' },
]

export function emptyConditionConfig(): ConditionConfig {
  return { combinator: 'and', rows: [{ field: '', op: 'eq', value: '' }] }
}

'use client'

import { useMemo } from 'react'
import { Plus, Settings2, Trash2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { ACTION_FIELDS, TRIGGER_FIELDS, actionLabel, triggerLabel } from './constants'
import {
  CONDITION_COMBINATORS,
  CONDITION_OPS,
  type BuilderFlowNode,
  type ConditionConfig,
  type FieldDef,
} from './types'

const fieldCls =
  'h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50 dark:bg-input/30'
const textareaCls =
  'min-h-20 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 placeholder:text-muted-foreground dark:bg-input/30'

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

function asString(v: unknown): string {
  return v === undefined || v === null ? '' : String(v)
}

/** Datetime-local input wants YYYY-MM-DDTHH:mm; stored values are ISO strings. */
function toLocalInputValue(v: unknown): string {
  const s = asString(v)
  if (!s) return ''
  const d = new Date(s)
  if (Number.isNaN(d.getTime())) return s.slice(0, 16)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function TypedField({
  def,
  value,
  onChange,
}: {
  def: FieldDef
  value: unknown
  onChange: (v: string) => void
}) {
  const v = asString(value)
  switch (def.type) {
    case 'select':
      return (
        <select className={fieldCls} value={v} onChange={(e) => onChange(e.target.value)}>
          <option value="">Select…</option>
          {(def.options ?? []).map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      )
    case 'textarea':
      return (
        <textarea
          className={textareaCls}
          placeholder={def.placeholder}
          value={v}
          onChange={(e) => onChange(e.target.value)}
        />
      )
    case 'datetime':
      return (
        <input
          type="datetime-local"
          className={fieldCls}
          value={toLocalInputValue(v)}
          onChange={(e) => onChange(e.target.value)}
        />
      )
    case 'number':
      return (
        <input
          type="number"
          className={fieldCls}
          placeholder={def.placeholder}
          value={v}
          onChange={(e) => onChange(e.target.value)}
        />
      )
    default:
      return (
        <input
          type="text"
          className={fieldCls}
          placeholder={def.placeholder}
          value={v}
          onChange={(e) => onChange(e.target.value)}
        />
      )
  }
}

function FieldRow({
  def,
  value,
  onChange,
}: {
  def: FieldDef
  value: unknown
  onChange: (v: string) => void
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-muted-foreground">
        {def.label}
        {def.required ? <span className="ml-0.5 text-destructive">*</span> : null}
      </Label>
      <TypedField def={def} value={value} onChange={onChange} />
      {def.help ? <p className="text-[11px] leading-snug text-muted-foreground">{def.help}</p> : null}
    </div>
  )
}

/** Generic key/value editor for config keys without a typed field def. */
export function KeyValueEditor({
  entries,
  onChange,
}: {
  entries: Array<[string, string]>
  onChange: (next: Array<[string, string]>) => void
}) {
  return (
    <div className="space-y-2">
      {entries.map(([k, v], i) => (
        <div key={i} className="flex items-center gap-2">
          <input
            type="text"
            className={cn(fieldCls, 'w-28 shrink-0')}
            placeholder="key"
            value={k}
            onChange={(e) => {
              const next = entries.map((row, j) => (j === i ? [e.target.value, row[1]] as [string, string] : row))
              onChange(next)
            }}
          />
          <input
            type="text"
            className={cn(fieldCls, 'min-w-0 flex-1')}
            placeholder="value"
            value={v}
            onChange={(e) => {
              const next = entries.map((row, j) => (j === i ? [row[0], e.target.value] as [string, string] : row))
              onChange(next)
            }}
          />
          <button
            type="button"
            aria-label="Remove config key"
            onClick={() => onChange(entries.filter((_, j) => j !== i))}
            className="shrink-0 rounded-md p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
          >
            <X className="size-3.5" />
          </button>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-full"
        onClick={() => onChange([...entries, ['', '']])}
      >
        <Plus className="size-3.5" /> Add config key
      </Button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Per-node-kind editors
// ---------------------------------------------------------------------------

function TriggerEditor({
  node,
  onConfig,
}: {
  node: BuilderFlowNode
  onConfig: (config: Record<string, unknown>) => void
}) {
  const fields = TRIGGER_FIELDS[node.data.subkind] ?? []
  const known = new Set(fields.map((f) => f.key))
  const config = node.data.config ?? {}
  const extra = Object.entries(config).filter(([k]) => !known.has(k))

  return (
    <div className="space-y-4">
      {fields.length > 0 ? (
        <div className="space-y-3">
          {fields.map((def) => (
            <FieldRow
              key={def.key}
              def={def}
              value={config[def.key]}
              onChange={(v) => onConfig({ ...config, [def.key]: v })}
            />
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          This trigger fires on the raw event — no extra configuration needed.
        </p>
      )}
      {extra.length > 0 ? (
        <div className="space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            Extra config
          </p>
          <KeyValueEditor
            entries={extra.map(([k, v]) => [k, asString(v)])}
            onChange={(rows) => {
              const next = { ...config }
              const keys = new Set(rows.map(([k]) => k))
              for (const k of Object.keys(config)) {
                if (!keys.has(k) && k !== '') delete next[k]
              }
              for (const [k, v] of rows) {
                if (k.trim()) next[k.trim()] = v
              }
              onConfig(next)
            }}
          />
        </div>
      ) : null}
    </div>
  )
}

function ConditionEditor({
  node,
  onConfig,
}: {
  node: BuilderFlowNode
  onConfig: (config: Record<string, unknown>) => void
}) {
  const cfg = (node.data.config ?? {
    combinator: 'and',
    rows: [{ field: '', op: 'eq', value: '' }],
  }) as unknown as ConditionConfig
  const rows = cfg.rows ?? []
  const setCombinator = (combinator: 'and' | 'or') => onConfig({ ...cfg, combinator })
  const setRow = (i: number, patch: Partial<ConditionConfig['rows'][number]>) =>
    onConfig({ ...cfg, rows: rows.map((r, j) => (j === i ? { ...r, ...patch } : r)) })
  const removeRow = (i: number) => onConfig({ ...cfg, rows: rows.filter((_, j) => j !== i) })
  const addRow = () => onConfig({ ...cfg, rows: [...rows, { field: '', op: 'eq', value: '' }] })

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label className="text-xs font-medium text-muted-foreground">Combinator</Label>
        <select
          className={fieldCls}
          value={cfg.combinator === 'or' ? 'or' : 'and'}
          onChange={(e) => setCombinator(e.target.value === 'or' ? 'or' : 'and')}
        >
          {CONDITION_COMBINATORS.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        <Label className="text-xs font-medium text-muted-foreground">
          Rows ({rows.length})
        </Label>
        {rows.map((row, i) => (
          <div key={i} className="space-y-1.5 rounded-lg border border-border bg-secondary/20 p-2.5">
            <input
              type="text"
              className={fieldCls}
              placeholder="field, e.g. lead.stageId or lead.fields.priority"
              value={row.field}
              onChange={(e) => setRow(i, { field: e.target.value })}
            />
            <select
              className={fieldCls}
              value={row.op}
              onChange={(e) => setRow(i, { op: e.target.value })}
            >
              {CONDITION_OPS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            {row.op !== 'exists' ? (
              <input
                type="text"
                className={fieldCls}
                placeholder={row.op === 'in' ? 'a, b, c' : 'value'}
                value={row.value}
                onChange={(e) => setRow(i, { value: e.target.value })}
              />
            ) : null}
            <div className="flex justify-end">
              <button
                type="button"
                aria-label="Remove row"
                onClick={() => removeRow(i)}
                className="rounded-md p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
              >
                <Trash2 className="size-3.5" />
              </button>
            </div>
          </div>
        ))}
        <Button type="button" variant="outline" size="sm" className="w-full" onClick={addRow}>
          <Plus className="size-3.5" /> Add row
        </Button>
        <p className="text-[11px] leading-snug text-muted-foreground">
          Field paths use dotted notation, e.g. <code className="text-foreground">lead.stageId</code>,{' '}
          <code className="text-foreground">lead.score</code>,{' '}
          <code className="text-foreground">lead.fields.priority</code>, or trigger payload keys.
        </p>
      </div>
    </div>
  )
}

function ActionEditor({
  node,
  onConfig,
}: {
  node: BuilderFlowNode
  onConfig: (config: Record<string, unknown>) => void
}) {
  const fields = ACTION_FIELDS[node.data.subkind] ?? []
  const known = new Set(fields.map((f) => f.key))
  const config = node.data.config ?? {}
  const extra = Object.entries(config).filter(([k]) => !known.has(k))

  return (
    <div className="space-y-4">
      {fields.length > 0 ? (
        <div className="space-y-3">
          {fields.map((def) => (
            <FieldRow
              key={def.key}
              def={def}
              value={config[def.key]}
              onChange={(v) => onConfig({ ...config, [def.key]: v })}
            />
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          This action has no configuration fields.
        </p>
      )}
      {extra.length > 0 ? (
        <div className="space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            Extra config
          </p>
          <KeyValueEditor
            entries={extra.map(([k, v]) => [k, asString(v)])}
            onChange={(rows) => {
              const next = { ...config }
              const keys = new Set(rows.map(([k]) => k))
              for (const k of Object.keys(config)) {
                if (!keys.has(k) && k !== '') delete next[k]
              }
              for (const [k, v] of rows) {
                if (k.trim()) next[k.trim()] = v
              }
              onConfig(next)
            }}
          />
        </div>
      ) : null}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Panel
// ---------------------------------------------------------------------------

export function PropertiesPanel({
  node,
  onConfig,
  onDelete,
}: {
  node: BuilderFlowNode | null
  onConfig: (id: string, config: Record<string, unknown>) => void
  onDelete: (id: string) => void
}) {
  const title = useMemo(() => {
    if (!node) return null
    if (node.data.kind === 'trigger') return triggerLabel(node.data.subkind)
    if (node.data.kind === 'action') return actionLabel(node.data.subkind)
    return 'Condition'
  }, [node])

  const kindTag = useMemo(() => {
    if (!node) return null
    if (node.data.kind === 'trigger') return 'TRIGGER'
    if (node.data.kind === 'action') return 'ACTION'
    return 'CONDITION'
  }, [node])

  if (!node) {
    return (
      <div className="flex w-72 shrink-0 flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border bg-card/40 p-6 text-center">
        <Settings2 className="size-5 text-muted-foreground" />
        <p className="text-xs text-muted-foreground">
          Select a node on the canvas to edit its configuration.
        </p>
      </div>
    )
  }

  return (
    <div className="flex w-72 shrink-0 flex-col gap-4 overflow-y-auto pr-1">
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          {kindTag}
        </p>
        <h3 className="mt-0.5 text-sm font-semibold text-foreground">{title}</h3>
        {node.data.hint ? (
          <p className="mt-1 text-[11px] leading-snug text-muted-foreground">{node.data.hint}</p>
        ) : null}
      </div>

      {node.data.kind === 'trigger' ? (
        <TriggerEditor node={node} onConfig={(c) => onConfig(node.id, c)} />
      ) : node.data.kind === 'condition' ? (
        <ConditionEditor node={node} onConfig={(c) => onConfig(node.id, c)} />
      ) : (
        <ActionEditor node={node} onConfig={(c) => onConfig(node.id, c)} />
      )}

      <Button
        type="button"
        variant="outline"
        size="sm"
        className="mt-auto text-destructive hover:bg-destructive/10 hover:text-destructive"
        onClick={() => onDelete(node.id)}
      >
        <Trash2 className="size-3.5" /> Delete node
      </Button>
    </div>
  )
}

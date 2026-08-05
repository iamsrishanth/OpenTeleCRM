'use client'

import { createContext, useContext, useMemo, type ReactNode } from 'react'
import { NodeProps, useStore } from '@xyflow/react'
import {
  AlarmClock,
  Bell,
  CalendarClock,
  ClipboardList,
  Filter,
  GitBranch,
  GitFork,
  Globe,
  Mail,
  MessageSquare,
  MoveRight,
  PenLine,
  PhoneCall,
  RefreshCw,
  Timer,
  Trash2,
  UserCheck,
  UserPlus,
  Webhook,
  Zap,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { CONDITION_COMBINATORS, type BuilderFlowNode, type ConditionConfig } from './types'

// ---------------------------------------------------------------------------
// Node-level actions provided by the builder page. The custom node component
// reads these through context (nodeTypes are module-level, so props cannot
// be threaded through them).
// ---------------------------------------------------------------------------

export interface BuilderNodeActions {
  onSelect: (id: string) => void
  onDelete: (id: string) => void
}

export const BuilderNodeActionsContext = createContext<BuilderNodeActions | null>(null)

export function useBuilderNodeActions(): BuilderNodeActions {
  const ctx = useContext(BuilderNodeActionsContext)
  if (!ctx) throw new Error('BuilderNodeActionsContext missing')
  return ctx
}

// ---------------------------------------------------------------------------
// Icons
// ---------------------------------------------------------------------------

export const ICONS: Record<string, LucideIcon> = {
  Zap,
  RefreshCw,
  GitBranch,
  PenLine,
  UserPlus,
  PhoneCall,
  ClipboardList,
  AlarmClock,
  MessageSquare,
  Filter,
  UserCheck,
  CalendarClock,
  MoveRight,
  Bell,
  Mail,
  Webhook,
  GitFork,
  Timer,
  Globe,
}

const KIND_STYLES: Record<
  string,
  { border: string; chip: string; tag: string; dot: string }
> = {
  trigger: {
    border: 'border-primary/50',
    chip: 'bg-primary/15 text-primary',
    tag: 'text-primary',
    dot: 'bg-primary',
  },
  condition: {
    border: 'border-amber-500/50',
    chip: 'bg-amber-500/15 text-amber-500',
    tag: 'text-amber-500',
    dot: 'bg-amber-500',
  },
  action: {
    border: 'border-sky-500/50',
    chip: 'bg-sky-500/15 text-sky-500',
    tag: 'text-sky-500',
    dot: 'bg-sky-500',
  },
}

function kindLabel(kind: string): string {
  return kind === 'trigger' ? 'TRIGGER' : kind === 'condition' ? 'CONDITION' : 'ACTION'
}

function configSummary(data: BuilderFlowNode['data']): string {
  if (data.kind === 'condition') {
    const cfg = (data.config ?? {}) as Partial<ConditionConfig>
    const rows = (cfg.rows ?? []).filter((r) => (r.field ?? '').trim())
    const combinator = CONDITION_COMBINATORS.find((c) => c.value === cfg.combinator)?.value ?? 'and'
    if (rows.length === 0) return 'No rows yet'
    return `${rows.length} row${rows.length === 1 ? '' : 's'} · ${combinator.toUpperCase()}`
  }
  const entries = Object.entries(data.config ?? {}).filter(([, v]) => String(v ?? '').trim() !== '')
  if (entries.length === 0) return data.hint ?? 'No config'
  return entries
    .slice(0, 2)
    .map(([k, v]) => `${k}: ${String(v).slice(0, 28)}${String(v).length > 28 ? '…' : ''}`)
    .join(' · ')
}

/**
 * Rank of a node among its siblings of the same kind, ordered
 * top-to-bottom then left-to-right (matches compile order).
 */
function useKindOrder(id: string, kind: string): number | null {
  return useStore((s) => {
    const same = (s.nodes ?? [])
      .filter((n) => n.data?.kind === kind)
      .sort(
        (a, b) =>
          (a.position?.y ?? 0) - (b.position?.y ?? 0) ||
          (a.position?.x ?? 0) - (b.position?.x ?? 0),
      )
    const idx = same.findIndex((n) => n.id === id)
    return idx === -1 ? null : idx + 1
  })
}

export default function CanvasNode({ id, data, selected }: NodeProps<BuilderFlowNode>) {
  const { onSelect, onDelete } = useBuilderNodeActions()
  const order = useKindOrder(id, data.kind)
  const Icon = ICONS[data.icon] ?? Zap
  const styles = KIND_STYLES[data.kind] ?? KIND_STYLES.action
  const summary = useMemo(() => configSummary(data), [data])

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={(e) => {
        e.stopPropagation()
        onSelect(id)
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onSelect(id)
        }
      }}
      className={cn(
        'group relative w-64 cursor-pointer select-none rounded-xl border bg-card shadow-lg shadow-black/20 transition-colors',
        styles.border,
        selected ? 'ring-2 ring-primary' : 'hover:border-border',
      )}
    >
      <div className="flex items-start gap-2.5 p-3">
        <div
          className={cn(
            'flex size-8 shrink-0 items-center justify-center rounded-lg',
            styles.chip,
          )}
        >
          <Icon className="size-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="truncate text-[13px] font-medium text-foreground">{data.label}</span>
            <span className={cn('text-[9px] font-semibold tracking-wider', styles.tag)}>
              {kindLabel(data.kind)}
            </span>
          </div>
          <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-muted-foreground">
            {summary}
          </p>
        </div>
        {order !== null && data.kind !== 'trigger' ? (
          <span
            className={cn(
              'flex size-4 shrink-0 items-center justify-center rounded-full text-[9px] font-bold text-white',
              styles.dot,
            )}
            title={`Execution order: ${order}`}
          >
            {order}
          </span>
        ) : null}
      </div>
      <button
        type="button"
        aria-label={`Delete ${data.label}`}
        onClick={(e) => {
          e.stopPropagation()
          onDelete(id)
        }}
        className="absolute -right-2 -top-2 hidden size-6 items-center justify-center rounded-full border border-border bg-popover text-muted-foreground shadow transition-colors hover:bg-destructive hover:text-white group-hover:flex"
      >
        <Trash2 className="size-3" />
      </button>
    </div>
  )
}

export function NodeActionsProvider({
  actions,
  children,
}: {
  actions: BuilderNodeActions
  children: ReactNode
}) {
  return (
    <BuilderNodeActionsContext.Provider value={actions}>
      {children}
    </BuilderNodeActionsContext.Provider>
  )
}

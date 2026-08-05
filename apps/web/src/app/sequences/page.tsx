'use client'

import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ListOrdered,
  Loader2,
  Pencil,
  Play,
  Plus,
  RotateCw,
  Trash2,
} from 'lucide-react'
import { toast } from 'sonner'
import { AppShell } from '@/components/app-shell'
import { EmptyState, LoadingScreen } from '@/components/loading'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { api } from '@/lib/api'
import { useAuth } from '@/lib/auth-context'
import { asList } from '@/lib/types'
import { cn } from '@/lib/utils'

// ---------------------------------------------------------------------------
// Types (mirror services/api/src/sequences/types.ts)
// ---------------------------------------------------------------------------

interface SequenceStepView {
  id: string
  sequenceId: string
  stepOrder: number
  delayDays: number
  action: Record<string, unknown>
}

interface SequenceView {
  id: string
  enterpriseId: string
  name: string
  description: string | null
  isActive: boolean
  trigger: Record<string, unknown>
  steps: SequenceStepView[]
  createdAt: string
  updatedAt: string
}

type SequenceRunStatus = 'queued' | 'running' | 'success' | 'failed'

interface SequenceRunView {
  id: string
  sequenceId: string
  enterpriseId: string
  leadId: string | null
  status: SequenceRunStatus
  startedAt: string
  finishedAt: string | null
  currentStep: number
  error: string | null
}

/** Draft step row as edited in the dialog (all values string-typed). */
interface StepDraft {
  delayDays: string
  kind: string
  config: Record<string, string>
}

// ---------------------------------------------------------------------------
// Step vocabulary — the five action kinds the sequences engine supports
// (executor config shapes verified against automation/dispatcher.ts)
// ---------------------------------------------------------------------------

const STEP_KINDS: Array<{ value: string; label: string }> = [
  { value: 'update_field', label: 'Update field' },
  { value: 'send_whatsapp', label: 'Send WhatsApp' },
  { value: 'notify_user', label: 'Notify user' },
  { value: 'create_callback', label: 'Create callback' },
  { value: 'assign_lead', label: 'Assign lead' },
]

interface FieldDef {
  key: string
  label: string
  type?: 'text' | 'textarea' | 'select' | 'datetime'
  options?: Array<{ value: string; label: string }>
  placeholder?: string
  required?: boolean
  help?: string
}

const STEP_FIELDS: Record<string, FieldDef[]> = {
  update_field: [
    {
      key: 'apiName',
      label: 'Field API name',
      required: true,
      placeholder: 'e.g. priority',
      help: 'Custom field API name, or “score” for the lead score column.',
    },
    { key: 'value', label: 'Value', required: true },
  ],
  send_whatsapp: [
    {
      key: 'to',
      label: 'To (lead id / phone)',
      placeholder: 'Leave blank to use the lead from context',
    },
    {
      key: 'body',
      label: 'Message body',
      type: 'textarea',
      required: true,
      placeholder: 'Hi {{name}}, checking in…',
    },
  ],
  notify_user: [
    { key: 'userId', label: 'User id', placeholder: 'Leave blank to notify the lead owner' },
    { key: 'title', label: 'Title', placeholder: 'New lead assigned' },
    { key: 'body', label: 'Body', type: 'textarea' },
  ],
  create_callback: [
    {
      key: 'quickChip',
      label: 'Due',
      type: 'select',
      options: [
        { value: '1h', label: 'In 1 hour' },
        { value: '3h', label: 'In 3 hours' },
        { value: 'tomorrow_10am', label: 'Tomorrow 10:00 AM' },
        { value: 'custom', label: 'Custom time' },
      ],
    },
    {
      key: 'customDueAt',
      label: 'Custom due time',
      type: 'datetime',
      help: 'Used when Due is “Custom time”.',
    },
  ],
  assign_lead: [
    {
      key: 'mode',
      label: 'Mode',
      type: 'select',
      options: [
        { value: 'round_robin', label: 'Round robin' },
        { value: 'least_loaded', label: 'Least loaded' },
        { value: 'skill_match', label: 'Skill match' },
      ],
      help: 'How the lead is routed to an available team member.',
    },
  ],
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function kindLabel(kind: string): string {
  return STEP_KINDS.find((k) => k.value === kind)?.label ?? kind
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  return Number.isNaN(d.getTime())
    ? '—'
    : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatDateTime(iso: string): string {
  const d = new Date(iso)
  return Number.isNaN(d.getTime())
    ? '—'
    : d.toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      })
}

/** Hours until tomorrow 10:00 IST (Asia/Kolkata, UTC+5:30, no DST). */
function hoursUntilTomorrow10Am(now = new Date()): number {
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

/** YYYY-MM-DDTHH:mm for <input type="datetime-local">. */
function toLocalInputValue(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** Convert a draft config into the wire config the dispatcher reads. */
function buildStepAction(kind: string, c: Record<string, string>): Record<string, unknown> {
  const t = (v: string | undefined) => (v ?? '').trim()
  switch (kind) {
    case 'update_field':
      return { apiName: t(c.apiName), value: c.value ?? '' }
    case 'send_whatsapp': {
      const to = t(c.to)
      return to ? { to, body: t(c.body) } : { body: t(c.body) }
    }
    case 'notify_user':
      return {
        ...(t(c.userId) ? { userId: t(c.userId) } : {}),
        ...(t(c.title) ? { title: t(c.title) } : {}),
        ...(t(c.body) ? { body: t(c.body) } : {}),
      }
    case 'create_callback': {
      const quickChip = t(c.quickChip) || '1h'
      let dueInHours = 1
      if (quickChip === '3h') dueInHours = 3
      else if (quickChip === 'tomorrow_10am') dueInHours = hoursUntilTomorrow10Am()
      else if (quickChip === 'custom' && c.customDueAt) {
        const ms = new Date(c.customDueAt).getTime() - Date.now()
        dueInHours = Math.max(0, Math.ceil(ms / 3_600_000))
      }
      return { quickChip, dueInHours }
    }
    case 'assign_lead':
      return { mode: t(c.mode) || 'round_robin' }
    default:
      return {}
  }
}

/** Convert a saved step view back into an editable draft. */
function draftFromStep(step: SequenceStepView): StepDraft {
  const kind = String(step.action.kind ?? 'notify_user')
  const cfg = (step.action.config ?? {}) as Record<string, unknown>
  const c: Record<string, string> = {}
  for (const [k, v] of Object.entries(cfg)) {
    if (v === null || v === undefined) continue
    if (k === 'skills' && Array.isArray(v)) {
      c.skills = v.join(', ')
      continue
    }
    c[k] = String(v)
  }
  if (kind === 'create_callback' && !c.quickChip) {
    const hours = Number(c.dueInHours ?? 24)
    if (hours === 1) c.quickChip = '1h'
    else if (hours === 3) c.quickChip = '3h'
    else if (hours >= 13 && hours <= 39) c.quickChip = 'tomorrow_10am'
    else {
      c.quickChip = 'custom'
      c.customDueAt = toLocalInputValue(new Date(Date.now() + hours * 3_600_000))
    }
  }
  return { delayDays: String(step.delayDays ?? 0), kind, config: c }
}

function emptyStep(): StepDraft {
  return { delayDays: '0', kind: 'send_whatsapp', config: {} }
}

const fieldCls =
  'h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50 dark:bg-input/30'
const textareaCls =
  'min-h-20 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 placeholder:text-muted-foreground dark:bg-input/30'

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function SequencesPage() {
  const { isReady, token, enterpriseId } = useAuth()
  const router = useRouter()

  const [sequences, setSequences] = useState<SequenceView[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  // Per-row busy states
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const [startingId, setStartingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  // Create/edit dialog
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<SequenceView | null>(null)
  const [busy, setBusy] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [steps, setSteps] = useState<StepDraft[]>([emptyStep()])

  // Lazy-loaded recent runs (accordion per sequence)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [runsBySeq, setRunsBySeq] = useState<Record<string, SequenceRunView[] | null>>({})
  const [runsError, setRunsError] = useState<Record<string, string>>({})

  const load = useCallback(async () => {
    if (!token || !enterpriseId) return
    setLoadError(null)
    try {
      const data = await api.get<unknown>('/sequences')
      setSequences(asList<SequenceView>(data))
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Failed to load sequences')
      setSequences([])
    }
  }, [token, enterpriseId])

  useEffect(() => {
    if (!isReady) return
    if (!token || !enterpriseId) {
      router.replace('/login')
      return
    }
    load()
  }, [isReady, token, enterpriseId, router, load])

  const activeCount = (sequences ?? []).filter((s) => s.isActive).length

  // -------------------------------------------------------------------------
  // Runs (lazy)
  // -------------------------------------------------------------------------

  const loadRuns = useCallback(
    async (seqId: string, force = false) => {
      if (!force && runsBySeq[seqId] !== undefined) return
      setRunsBySeq((prev) => ({ ...prev, [seqId]: null }))
      try {
        const data = await api.get<unknown>(`/sequences/${seqId}/runs`)
        setRunsBySeq((prev) => ({ ...prev, [seqId]: asList<SequenceRunView>(data) }))
      } catch (err) {
        setRunsBySeq((prev) => ({ ...prev, [seqId]: [] }))
        setRunsError((prev) => ({
          ...prev,
          [seqId]: err instanceof Error ? err.message : 'Failed to load runs',
        }))
      }
    },
    [runsBySeq],
  )

  function toggleRuns(seqId: string) {
    if (expandedId === seqId) {
      setExpandedId(null)
      return
    }
    setExpandedId(seqId)
    loadRuns(seqId)
  }

  // -------------------------------------------------------------------------
  // Row actions
  // -------------------------------------------------------------------------

  async function toggleActive(seq: SequenceView) {
    const next = !seq.isActive
    setTogglingId(seq.id)
    setSequences((prev) => prev?.map((s) => (s.id === seq.id ? { ...s, isActive: next } : s)) ?? prev)
    try {
      await api.patch(`/sequences/${seq.id}`, { isActive: next })
      toast.success(next ? 'Sequence enabled' : 'Sequence paused')
    } catch (err) {
      setSequences((prev) => prev?.map((s) => (s.id === seq.id ? { ...s, isActive: !next } : s)) ?? prev)
      toast.error(err instanceof Error ? err.message : 'Failed to update sequence')
    } finally {
      setTogglingId(null)
    }
  }

  async function onStart(seq: SequenceView) {
    setStartingId(seq.id)
    try {
      const res = await api.post<{ runId: string; data: SequenceRunView }>(
        `/sequences/${seq.id}/start`,
        {},
      )
      const run = res?.data
      if (run?.status === 'failed') {
        toast.error(`“${seq.name}” run failed: ${run.error ?? 'first step threw'}`)
      } else if (run?.status === 'success') {
        toast.success(`“${seq.name}” started — run completed (${run.currentStep} steps)`)
      } else {
        toast.success(
          `“${seq.name}” started — ${run?.currentStep ?? 0} step${
            (run?.currentStep ?? 0) === 1 ? '' : 's'
          } done, remaining steps follow on schedule`,
        )
      }
      if (expandedId === seq.id) await loadRuns(seq.id, true)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to start sequence')
    } finally {
      setStartingId(null)
    }
  }

  async function onDelete(seq: SequenceView) {
    if (confirmDeleteId !== seq.id) {
      setConfirmDeleteId(seq.id)
      window.setTimeout(() => {
        setConfirmDeleteId((c) => (c === seq.id ? null : c))
      }, 3000)
      return
    }
    setDeletingId(seq.id)
    try {
      await api.delete(`/sequences/${seq.id}`)
      setConfirmDeleteId(null)
      toast.success(`“${seq.name}” deleted`)
      await load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete sequence')
    } finally {
      setDeletingId(null)
    }
  }

  // -------------------------------------------------------------------------
  // Dialog
  // -------------------------------------------------------------------------

  function openCreate() {
    setEditing(null)
    setName('')
    setDescription('')
    setSteps([emptyStep()])
    setOpen(true)
  }

  function openEdit(seq: SequenceView) {
    setEditing(seq)
    setName(seq.name)
    setDescription(seq.description ?? '')
    setSteps(seq.steps.length > 0 ? seq.steps.map(draftFromStep) : [emptyStep()])
    setOpen(true)
  }

  function updateStep(index: number, patch: Partial<StepDraft>) {
    setSteps((prev) => prev.map((s, i) => (i === index ? { ...s, ...patch } : s)))
  }

  function updateStepConfig(index: number, key: string, value: string) {
    setSteps((prev) =>
      prev.map((s, i) => (i === index ? { ...s, config: { ...s.config, [key]: value } } : s)),
    )
  }

  function addStep() {
    setSteps((prev) => [...prev, emptyStep()])
  }

  function removeStep(index: number) {
    setSteps((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== index)))
  }

  function moveStep(index: number, dir: -1 | 1) {
    setSteps((prev) => {
      const j = index + dir
      if (j < 0 || j >= prev.length) return prev
      const next = [...prev]
      ;[next[index], next[j]] = [next[j], next[index]]
      return next
    })
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!name.trim()) {
      toast.error('Sequence name is required')
      return
    }
    const trimmed = steps.map((s) => ({
      ...s,
      delayDays: s.delayDays.trim() === '' ? '0' : s.delayDays.trim(),
    }))
    if (trimmed.length === 0) {
      toast.error('Add at least one step')
      return
    }
    for (const [i, s] of trimmed.entries()) {
      const days = Number(s.delayDays)
      if (!Number.isFinite(days) || days < 0) {
        toast.error(`Step ${i + 1}: delay must be 0 or more days`)
        return
      }
      const required = STEP_FIELDS[s.kind]?.filter((f) => f.required) ?? []
      for (const f of required) {
        if (!(s.config[f.key] ?? '').trim()) {
          toast.error(`Step ${i + 1} (${kindLabel(s.kind)}) needs ${f.label.toLowerCase()}`)
          return
        }
      }
    }
    const wireSteps = trimmed.map((s, i) => ({
      stepOrder: i,
      delayDays: Math.floor(Number(s.delayDays) || 0),
      action: { kind: s.kind, config: buildStepAction(s.kind, s.config) },
    }))
    const desc = description.trim()
    setBusy(true)
    try {
      if (editing) {
        await api.patch(`/sequences/${editing.id}`, {
          name: name.trim(),
          description: desc || null,
          steps: wireSteps,
        })
        toast.success('Sequence updated')
      } else {
        await api.post('/sequences', {
          name: name.trim(),
          description: desc || undefined,
          isActive: true,
          steps: wireSteps,
        })
        toast.success('Sequence created')
      }
      setOpen(false)
      setEditing(null)
      await load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : `Failed to ${editing ? 'update' : 'create'} sequence`)
    } finally {
      setBusy(false)
    }
  }

  if (!isReady || !token) return <LoadingScreen label="Checking session…" />

  return (
    <AppShell>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <div>
            <h1 className="text-lg font-semibold tracking-tight">Sequences</h1>
            <p className="text-sm text-muted-foreground">
              {sequences === null
                ? 'Loading sequences…'
                : `${sequences.length} sequence${sequences.length === 1 ? '' : 's'} · ${activeCount} active`}
            </p>
          </div>
          <div className="ml-auto">
            <Button onClick={openCreate}>
              <Plus className="size-4" /> New sequence
            </Button>
          </div>
        </div>

        {sequences === null ? (
          <LoadingScreen label="Loading sequences…" />
        ) : loadError ? (
          <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border px-6 py-12 text-center">
            <p className="text-sm font-medium text-foreground">Failed to load sequences</p>
            <p className="max-w-sm text-xs text-muted-foreground">{loadError}</p>
            <Button variant="outline" size="sm" onClick={load}>
              <RotateCw className="size-3.5" /> Retry
            </Button>
          </div>
        ) : sequences.length === 0 ? (
          <EmptyState
            title="No sequences yet"
            hint="Create a sequence to set up a timed drip of follow-up actions — messages, callbacks, field updates and more."
          />
        ) : (
          <div className="space-y-3">
            {sequences.map((seq) => {
              const expanded = expandedId === seq.id
              const runs = runsBySeq[seq.id]
              const runsLoading = runs === null
              const runsFailed = runsError[seq.id]
              return (
                <div key={seq.id} className="rounded-lg border border-border">
                  <div className="flex flex-wrap items-start gap-3 p-4">
                    <div className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-border bg-muted/50">
                      <ListOrdered className="size-4 text-muted-foreground" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-sm font-semibold">{seq.name}</h2>
                        <Badge variant={seq.isActive ? 'default' : 'secondary'}>
                          {seq.isActive ? 'Active' : 'Paused'}
                        </Badge>
                        <Badge variant="outline">
                          {seq.steps.length} step{seq.steps.length === 1 ? '' : 's'}
                        </Badge>
                      </div>
                      {seq.description ? (
                        <p className="mt-0.5 text-sm text-muted-foreground">{seq.description}</p>
                      ) : null}
                      <p className="mt-1 text-xs text-muted-foreground">
                        Created {formatDate(seq.createdAt)}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        role="switch"
                        aria-checked={seq.isActive}
                        disabled={togglingId === seq.id}
                        onClick={() => toggleActive(seq)}
                        className={cn(
                          'relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors disabled:opacity-50',
                          seq.isActive ? 'bg-primary' : 'bg-input',
                        )}
                        title={seq.isActive ? 'Click to pause' : 'Click to enable'}
                      >
                        <span
                          className={cn(
                            'inline-block size-3.5 rounded-full bg-white shadow transition-transform',
                            seq.isActive ? 'translate-x-[18px]' : 'translate-x-[3px]',
                          )}
                        />
                      </button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={startingId === seq.id}
                        onClick={() => onStart(seq)}
                        title="Start a run of this sequence"
                      >
                        {startingId === seq.id ? (
                          <Loader2 className="size-3.5 animate-spin" />
                        ) : (
                          <Play className="size-3.5" />
                        )}
                        Start
                      </Button>
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        onClick={() => openEdit(seq)}
                        title="Edit sequence"
                      >
                        <Pencil className="size-3.5" />
                      </Button>
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        disabled={deletingId === seq.id}
                        onClick={() => onDelete(seq)}
                        title={
                          confirmDeleteId === seq.id ? 'Click again to confirm' : 'Delete sequence'
                        }
                        className={cn(
                          confirmDeleteId === seq.id &&
                            'text-destructive hover:bg-destructive/10 hover:text-destructive',
                        )}
                      >
                        {deletingId === seq.id ? (
                          <Loader2 className="size-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="size-3.5" />
                        )}
                      </Button>
                    </div>
                  </div>

                  <div className="border-t border-border">
                    <button
                      type="button"
                      onClick={() => toggleRuns(seq.id)}
                      className="flex w-full items-center gap-1.5 px-4 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground"
                    >
                      <ChevronDown
                        className={cn('size-3.5 transition-transform', expanded && 'rotate-180')}
                      />
                      Recent runs
                      {runs && runs.length > 0 ? ` (${runs.length})` : ''}
                    </button>
                    {expanded ? (
                      <div className="border-t border-border px-4 pb-4 pt-3">
                        {runsLoading ? (
                          <div className="flex items-center justify-center gap-2 py-6 text-xs text-muted-foreground">
                            <Loader2 className="size-3.5 animate-spin" /> Loading runs…
                          </div>
                        ) : runsFailed ? (
                          <p className="py-4 text-center text-xs text-destructive">
                            {runsFailed}
                          </p>
                        ) : runs.length === 0 ? (
                          <p className="py-4 text-center text-xs text-muted-foreground">
                            No runs yet — press Start to enroll a lead into this sequence.
                          </p>
                        ) : (
                          <div className="overflow-x-auto rounded-lg border border-border">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Status</TableHead>
                                  <TableHead>Step</TableHead>
                                  <TableHead>Started</TableHead>
                                  <TableHead>Error</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {runs.map((run) => (
                                  <TableRow key={run.id}>
                                    <TableCell>
                                      {run.status === 'running' ? (
                                        <Badge variant="secondary">
                                          <span className="size-1.5 rounded-full bg-current motion-safe:animate-pulse" />
                                          Running
                                        </Badge>
                                      ) : run.status === 'success' ? (
                                        <Badge variant="default">Success</Badge>
                                      ) : run.status === 'failed' ? (
                                        <Badge variant="destructive">Failed</Badge>
                                      ) : (
                                        <Badge variant="outline">Queued</Badge>
                                      )}
                                    </TableCell>
                                    <TableCell className="text-muted-foreground">
                                      {run.currentStep} / {seq.steps.length}
                                    </TableCell>
                                    <TableCell className="text-muted-foreground">
                                      {formatDateTime(run.startedAt)}
                                    </TableCell>
                                    <TableCell
                                      className={cn(
                                        'max-w-72 truncate text-xs',
                                        run.error ? 'text-destructive' : 'text-muted-foreground',
                                      )}
                                      title={run.error ?? undefined}
                                    >
                                      {run.error ?? '—'}
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        )}
                      </div>
                    ) : null}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Create / edit dialog                                               */}
      {/* ------------------------------------------------------------------ */}
      <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setEditing(null) }}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit sequence' : 'New sequence'}</DialogTitle>
            <DialogDescription>
              {editing
                ? 'Update the name, description, and steps. Saving replaces the full step list.'
                : 'A sequence is a timed chain of steps — each step fires delayDays after the run starts.'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={onSubmit} className="space-y-5">
            <div className="space-y-1.5">
              <Label htmlFor="seq-name">Name</Label>
              <Input
                id="seq-name"
                placeholder="e.g. 3-day follow-up sequence"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="seq-desc">Description</Label>
              <textarea
                id="seq-desc"
                className={textareaCls}
                placeholder="What is this sequence for?"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Steps</Label>
                <Button type="button" variant="outline" size="sm" onClick={addStep}>
                  <Plus className="size-3.5" /> Add step
                </Button>
              </div>
              <div className="space-y-3">
                {steps.map((step, i) => (
                  <div key={i} className="space-y-2 rounded-lg border border-border p-3">
                    <div className="flex items-end gap-2">
                      <span className="mb-2 w-4 shrink-0 text-center text-xs font-medium text-muted-foreground">
                        {i + 1}
                      </span>
                      <div className="w-24 shrink-0 space-y-0.5">
                        <span className="block text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                          Delay days
                        </span>
                        <Input
                          type="number"
                          min={0}
                          step={1}
                          className="h-8"
                          placeholder="0"
                          aria-label={`Step ${i + 1} delay in days`}
                          value={step.delayDays}
                          onChange={(e) => updateStep(i, { delayDays: e.target.value })}
                        />
                      </div>
                      <div className="min-w-0 flex-1 space-y-0.5">
                        <span className="block text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                          Action
                        </span>
                        <select
                          className={fieldCls}
                          value={step.kind}
                          onChange={(e) =>
                            updateStep(i, { kind: e.target.value, config: {} })
                          }
                        >
                          {STEP_KINDS.map((k) => (
                            <option key={k.value} value={k.value}>
                              {k.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        disabled={i === 0}
                        onClick={() => moveStep(i, -1)}
                        title="Move up"
                      >
                        <ArrowUp className="size-3.5" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        disabled={i === steps.length - 1}
                        onClick={() => moveStep(i, 1)}
                        title="Move down"
                      >
                        <ArrowDown className="size-3.5" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        disabled={steps.length <= 1}
                        onClick={() => removeStep(i)}
                        title="Remove step"
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>

                    <div className="grid gap-2">
                      {STEP_FIELDS[step.kind]?.map((f) => {
                        if (
                          step.kind === 'create_callback' &&
                          f.key === 'customDueAt' &&
                          step.config.quickChip !== 'custom'
                        ) {
                          return null
                        }
                        return (
                          <div key={f.key} className="space-y-1">
                            <Label className="text-xs" htmlFor={`step${i}-${f.key}`}>
                              {f.label}
                              {f.required ? <span className="text-destructive"> *</span> : null}
                            </Label>
                            {f.type === 'select' ? (
                              <select
                                id={`step${i}-${f.key}`}
                                className={fieldCls}
                                value={step.config[f.key] ?? f.options?.[0]?.value ?? ''}
                                onChange={(e) => updateStepConfig(i, f.key, e.target.value)}
                              >
                                {f.options?.map((o) => (
                                  <option key={o.value} value={o.value}>
                                    {o.label}
                                  </option>
                                ))}
                              </select>
                            ) : f.type === 'textarea' ? (
                              <textarea
                                id={`step${i}-${f.key}`}
                                className={textareaCls}
                                placeholder={f.placeholder}
                                value={step.config[f.key] ?? ''}
                                onChange={(e) => updateStepConfig(i, f.key, e.target.value)}
                              />
                            ) : f.type === 'datetime' ? (
                              <input
                                id={`step${i}-${f.key}`}
                                type="datetime-local"
                                className={fieldCls}
                                value={step.config[f.key] ?? ''}
                                onChange={(e) => updateStepConfig(i, f.key, e.target.value)}
                              />
                            ) : (
                              <Input
                                id={`step${i}-${f.key}`}
                                placeholder={f.placeholder}
                                value={step.config[f.key] ?? ''}
                                onChange={(e) => updateStepConfig(i, f.key, e.target.value)}
                              />
                            )}
                            {f.help ? (
                              <p className="text-xs text-muted-foreground">{f.help}</p>
                            ) : null}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setOpen(false)
                  setEditing(null)
                }}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={busy}>
                {busy && <Loader2 className="size-4 animate-spin" />}
                {editing ? 'Save changes' : 'Create sequence'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </AppShell>
  )
}

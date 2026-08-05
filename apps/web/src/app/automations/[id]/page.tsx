'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, FlaskConical, Loader2, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { AppShell } from '@/components/app-shell'
import { EmptyState, LoadingScreen } from '@/components/loading'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
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
import { asList, type AutomationAction, type AutomationRule, type AutomationRun } from '@/lib/types'
import { cn } from '@/lib/utils'

// ---------------------------------------------------------------------------
// Rule builder vocabulary (mirrors services/api/src/automation/types.ts)
// ---------------------------------------------------------------------------

const TRIGGER_KINDS: Array<{ value: string; label: string }> = [
  { value: 'lead_created', label: 'Lead created' },
  { value: 'lead_updated', label: 'Lead updated' },
  { value: 'lead_stage_changed', label: 'Lead stage changed' },
  { value: 'lead_field_changed', label: 'Lead field changed' },
  { value: 'lead_assigned', label: 'Lead assigned' },
  { value: 'call_ended', label: 'Call ended' },
  { value: 'action_logged', label: 'Action logged' },
  { value: 'callback_due', label: 'Callback due' },
  { value: 'inbound_message', label: 'Inbound message' },
  { value: 'webhook_received', label: 'Webhook received' },
]

const ACTION_KINDS: Array<{ value: string; label: string }> = [
  { value: 'assign_lead', label: 'Assign lead' },
  { value: 'create_callback', label: 'Create callback' },
  { value: 'send_whatsapp', label: 'Send WhatsApp' },
  { value: 'update_field', label: 'Update field' },
  { value: 'move_stage', label: 'Move stage' },
  { value: 'notify_user', label: 'Notify user' },
  { value: 'send_email', label: 'Send email' },
  { value: 'webhook', label: 'Webhook' },
  { value: 'branch', label: 'Branch' },
  { value: 'delay', label: 'Delay' },
  { value: 'http_request', label: 'HTTP request' },
]

interface FieldDef {
  key: string
  label: string
  type?: 'text' | 'number' | 'textarea' | 'select' | 'datetime'
  options?: Array<{ value: string; label: string }>
  placeholder?: string
  required?: boolean
  help?: string
}

const ACTION_FIELDS: Record<string, FieldDef[]> = {
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
    { key: 'skills', label: 'Skills (comma separated)', placeholder: 'english, hindi' },
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
    { key: 'customDueAt', label: 'Custom due time', type: 'datetime' },
    { key: 'note', label: 'Note', placeholder: 'Follow up about the demo' },
  ],
  send_whatsapp: [
    { key: 'to', label: 'To (lead id / phone)', placeholder: 'Leave blank to use the lead from context' },
    { key: 'body', label: 'Message body', type: 'textarea', required: true },
  ],
  update_field: [
    { key: 'apiName', label: 'Field api name', placeholder: 'e.g. priority', required: true },
    { key: 'value', label: 'Value', required: true },
  ],
  move_stage: [
    { key: 'stageId', label: 'Stage id', required: true },
    { key: 'pipelineId', label: 'Pipeline id', placeholder: 'Optional' },
  ],
  notify_user: [
    { key: 'userId', label: 'User id', placeholder: 'Leave blank to notify the lead owner' },
    { key: 'title', label: 'Title' },
    { key: 'body', label: 'Body', type: 'textarea' },
  ],
  send_email: [
    { key: 'to', label: 'To' },
    { key: 'subject', label: 'Subject' },
    { key: 'body', label: 'Body', type: 'textarea' },
  ],
  webhook: [
    { key: 'url', label: 'URL' },
    { key: 'method', label: 'Method', type: 'select', options: [{ value: 'POST', label: 'POST' }, { value: 'GET', label: 'GET' }] },
    { key: 'body', label: 'Body', type: 'textarea' },
  ],
  branch: [],
  delay: [{ key: 'seconds', label: 'Seconds', type: 'number', placeholder: '60' }],
  http_request: [
    { key: 'url', label: 'URL' },
    { key: 'method', label: 'Method', type: 'select', options: [{ value: 'GET', label: 'GET' }, { value: 'POST', label: 'POST' }, { value: 'PUT', label: 'PUT' }] },
    { key: 'body', label: 'Body', type: 'textarea' },
  ],
}

/** Convert draft string config into the wire config the engine reads. */
function buildActionConfig(kind: string, c: Record<string, string>): Record<string, unknown> {
  const t = (v: string | undefined) => (v ?? '').trim()
  switch (kind) {
    case 'assign_lead': {
      const mode = t(c.mode) || 'round_robin'
      const skills = t(c.skills)
        ? t(c.skills).split(',').map((s) => s.trim()).filter(Boolean)
        : undefined
      return skills && skills.length > 0 ? { mode, skills } : { mode }
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
      const note = t(c.note)
      return note ? { quickChip, dueInHours, note } : { quickChip, dueInHours }
    }
    case 'send_whatsapp': {
      const to = t(c.to)
      return to ? { to, body: t(c.body) } : { body: t(c.body) }
    }
    case 'update_field':
      return { apiName: t(c.apiName), value: c.value ?? '' }
    case 'move_stage': {
      const pipelineId = t(c.pipelineId)
      return pipelineId ? { stageId: t(c.stageId), pipelineId } : { stageId: t(c.stageId) }
    }
    case 'notify_user': {
      const userId = t(c.userId)
      return {
        ...(userId ? { userId } : {}),
        ...(t(c.title) ? { title: t(c.title) } : {}),
        ...(t(c.body) ? { body: t(c.body) } : {}),
      }
    }
    case 'send_email': {
      const to = t(c.to)
      return {
        ...(to ? { to } : {}),
        ...(t(c.subject) ? { subject: t(c.subject) } : {}),
        ...(t(c.body) ? { body: t(c.body) } : {}),
      }
    }
    case 'webhook': {
      const url = t(c.url)
      return {
        ...(url ? { url } : {}),
        method: t(c.method) || 'POST',
        ...(t(c.body) ? { body: t(c.body) } : {}),
      }
    }
    case 'branch':
      return {}
    case 'delay': {
      const seconds = Number(t(c.seconds))
      return { seconds: Number.isFinite(seconds) && seconds > 0 ? seconds : 0 }
    }
    case 'http_request': {
      const url = t(c.url)
      return {
        ...(url ? { url } : {}),
        method: t(c.method) || 'GET',
        ...(t(c.body) ? { body: t(c.body) } : {}),
      }
    }
    default:
      return {}
  }
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

function triggerLabel(kind: string): string {
  return TRIGGER_KINDS.find((k) => k.value === kind)?.label ?? kind
}

function actionLabel(kind: string): string {
  return ACTION_KINDS.find((k) => k.value === kind)?.label ?? kind
}

function formatDateTime(iso: string): string {
  const d = new Date(iso)
  return Number.isNaN(d.getTime())
    ? '—'
    : d.toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
}

function RunStatusBadge({ status }: { status: AutomationRun['status'] }) {
  const styles: Record<string, string> = {
    success: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
    failed: 'bg-destructive/10 text-destructive dark:bg-destructive/20',
    running: 'bg-blue-500/15 text-blue-600 dark:text-blue-400',
    queued: 'bg-secondary text-secondary-foreground',
    skipped: 'bg-muted text-muted-foreground',
    throttled: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
  }
  return (
    <Badge className={styles[status] ?? 'bg-muted text-muted-foreground'}>
      {status}
    </Badge>
  )
}

interface ActionDraft {
  kind: string
  config: Record<string, string>
}

const fieldCls =
  'h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50 dark:bg-input/30'
const textareaCls =
  'min-h-20 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 placeholder:text-muted-foreground dark:bg-input/30'

export default function AutomationDetailPage() {
  const params = useParams<{ id: string }>()
  const id = params?.id ?? ''
  const { isReady, token, enterpriseId } = useAuth()
  const router = useRouter()

  const [rule, setRule] = useState<AutomationRule | null>(null)
  const [runs, setRuns] = useState<AutomationRun[] | null>(null)
  const [notFound, setNotFound] = useState(false)

  // Edit-form state
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [isActive, setIsActive] = useState(true)
  const [drafts, setDrafts] = useState<ActionDraft[]>([])
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)

  const loadRuns = useCallback(async () => {
    if (!token || !enterpriseId || !id) return
    try {
      const data = await api.get<unknown>(`/automations/${id}/runs`)
      setRuns(asList<AutomationRun>(data))
    } catch {
      setRuns([])
    }
  }, [token, enterpriseId, id])

  const load = useCallback(async () => {
    if (!token || !enterpriseId || !id) return
    try {
      const data = await api.get<{ data: AutomationRule }>(`/automations/${id}`)
      const r = data?.data
      if (!r) {
        setNotFound(true)
        return
      }
      setRule(r)
      setName(r.name)
      setDescription(r.description ?? '')
      setIsActive(r.isActive)
      setDrafts(
        (r.actions ?? []).map((a: AutomationAction) => ({
          kind: a.kind,
          config: Object.fromEntries(
            Object.entries(a.config ?? {}).map(([k, v]) => [
              k,
              typeof v === 'object' && v !== null ? JSON.stringify(v) : String(v ?? ''),
            ]),
          ),
        })),
      )
    } catch {
      setNotFound(true)
    }
  }, [token, enterpriseId, id])

  useEffect(() => {
    if (!isReady) return
    if (!token || !enterpriseId) {
      router.replace('/login')
      return
    }
    if (!id) return
    load()
    loadRuns()
  }, [isReady, token, enterpriseId, id, router, load, loadRuns])

  const actionSummary = useMemo(
    () => (rule?.actions ?? []).map((a) => actionLabel(a.kind)).join(' → '),
    [rule],
  )

  function updateDraft(index: number, patch: Partial<ActionDraft>) {
    setDrafts((prev) => prev.map((a, i) => (i === index ? { ...a, ...patch } : a)))
  }

  function updateDraftConfig(index: number, key: string, value: string) {
    setDrafts((prev) =>
      prev.map((a, i) => (i === index ? { ...a, config: { ...a.config, [key]: value } } : a)),
    )
  }

  function addAction() {
    setDrafts((prev) => [...prev, { kind: 'assign_lead', config: {} }])
  }

  function removeAction(index: number) {
    setDrafts((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== index)))
  }

  async function onSave(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) {
      toast.error('Rule name is required')
      return
    }
    const trimmed = drafts.filter((a) => a.kind.trim())
    if (trimmed.length === 0) {
      toast.error('Add at least one action')
      return
    }
    for (const a of trimmed) {
      const req = ACTION_FIELDS[a.kind]?.filter((f) => f.required)
      for (const f of req ?? []) {
        if (!a.config[f.key]?.trim()) {
          toast.error(`“${actionLabel(a.kind)}” needs ${f.label.toLowerCase()}`)
          return
        }
      }
    }
    setSaving(true)
    try {
      const updated = await api.patch<{ data: AutomationRule }>(`/automations/${id}`, {
        name: name.trim(),
        description: description.trim() || null,
        isActive,
        actions: trimmed.map((a) => ({
          kind: a.kind,
          config: buildActionConfig(a.kind, a.config),
        })),
      })
      if (updated?.data) setRule(updated.data)
      toast.success('Rule updated')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update rule')
    } finally {
      setSaving(false)
    }
  }

  async function onTest() {
    setTesting(true)
    try {
      const res = await api.post<{ runId?: string; data?: { runId?: string } }>(
        `/automations/${id}/test`,
        {},
      )
      const runId = res?.runId ?? res?.data?.runId
      toast.success(runId ? `Test run started — ${runId}` : 'Test run started')
      await loadRuns()
      // The action chain dispatches asynchronously; refresh once more to
      // catch the terminal status.
      window.setTimeout(() => {
        void loadRuns()
      }, 2000)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Test run failed')
    } finally {
      setTesting(false)
    }
  }

  if (!isReady || !token) return <LoadingScreen label="Checking session…" />

  return (
    <AppShell>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/automations"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-4" /> Automations
          </Link>
          <div className="ml-auto flex items-center gap-2">
            <Button
              variant="outline"
              disabled={testing || !rule}
              onClick={onTest}
            >
              {testing ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <FlaskConical className="size-4" />
              )}
              Test run
            </Button>
          </div>
        </div>

        {notFound ? (
          <EmptyState
            title="Rule not found"
            hint="It may have been deleted. Go back to the automations list."
          />
        ) : rule === null ? (
          <LoadingScreen label="Loading rule…" />
        ) : (
          <>
            <div>
              <h1 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
                {rule.name}
                <Badge variant={rule.isActive ? 'default' : 'secondary'}>
                  {rule.isActive ? 'active' : 'paused'}
                </Badge>
              </h1>
              <p className="mt-0.5 text-sm text-muted-foreground">
                {triggerLabel(rule.trigger.kind)}
                {rule.trigger.config && Object.keys(rule.trigger.config).length > 0
                  ? ` · ${JSON.stringify(rule.trigger.config)}`
                  : ''}
                {rule.schedule?.cron ? ` · cron ${rule.schedule.cron}` : ''}
              </p>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Edit rule</CardTitle>
                <CardDescription>
                  Changes are saved with PATCH /automations/:id and applied to
                  future runs.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={onSave} className="space-y-5">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="edit-name">Name</Label>
                      <Input
                        id="edit-name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="edit-desc">Description</Label>
                      <Input
                        id="edit-desc"
                        placeholder="Optional"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      role="switch"
                      aria-checked={isActive}
                      onClick={() => setIsActive((v) => !v)}
                      className={cn(
                        'relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors',
                        isActive ? 'bg-primary' : 'bg-input',
                      )}
                    >
                      <span
                        className={cn(
                          'inline-block size-3.5 rounded-full bg-white shadow transition-transform',
                          isActive ? 'translate-x-[18px]' : 'translate-x-[3px]',
                        )}
                      />
                    </button>
                    <span className="text-sm">
                      {isActive ? 'Active — fires on matching events' : 'Paused — does not fire'}
                    </span>
                  </div>

                  <Separator />

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label>Actions</Label>
                      <Button type="button" variant="outline" size="sm" onClick={addAction}>
                        <Plus className="size-3.5" /> Add action
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {actionSummary || 'No actions yet'}
                    </p>
                    <div className="space-y-3">
                      {drafts.map((action, index) => (
                        <div key={index} className="space-y-2 rounded-lg border border-border p-3">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-medium text-muted-foreground">
                              {index + 1}.
                            </span>
                            <select
                              className={cn(fieldCls, 'flex-1')}
                              value={action.kind}
                              onChange={(e) =>
                                updateDraft(index, { kind: e.target.value, config: {} })
                              }
                            >
                              {ACTION_KINDS.map((k) => (
                                <option key={k.value} value={k.value}>
                                  {k.label}
                                </option>
                              ))}
                            </select>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-sm"
                              disabled={drafts.length <= 1}
                              onClick={() => removeAction(index)}
                              title="Remove action"
                            >
                              <Trash2 className="size-3.5" />
                            </Button>
                          </div>
                          {action.kind === 'branch' ? (
                            <p className="text-xs text-muted-foreground">
                              Branching is not configurable in this UI yet; the step is
                              recorded and skipped when the rule runs.
                            </p>
                          ) : (
                            <div className="grid gap-2">
                              {ACTION_FIELDS[action.kind]?.map((f) => {
                                if (
                                  action.kind === 'create_callback' &&
                                  f.key === 'customDueAt' &&
                                  action.config.quickChip !== 'custom'
                                ) {
                                  return null
                                }
                                return (
                                <div key={f.key} className="space-y-1">
                                  <Label className="text-xs" htmlFor={`e${index}-${f.key}`}>
                                    {f.label}
                                    {f.required ? (
                                      <span className="text-destructive"> *</span>
                                    ) : null}
                                  </Label>
                                  {f.type === 'select' ? (
                                    <select
                                      id={`e${index}-${f.key}`}
                                      className={fieldCls}
                                      value={action.config[f.key] ?? f.options?.[0]?.value ?? ''}
                                      onChange={(e) =>
                                        updateDraftConfig(index, f.key, e.target.value)
                                      }
                                    >
                                      {f.options?.map((o) => (
                                        <option key={o.value} value={o.value}>
                                          {o.label}
                                        </option>
                                      ))}
                                    </select>
                                  ) : f.type === 'textarea' ? (
                                    <textarea
                                      id={`e${index}-${f.key}`}
                                      className={textareaCls}
                                      placeholder={f.placeholder}
                                      value={action.config[f.key] ?? ''}
                                      onChange={(e) =>
                                        updateDraftConfig(index, f.key, e.target.value)
                                      }
                                    />
                                  ) : f.type === 'datetime' ? (
                                    <input
                                      id={`e${index}-${f.key}`}
                                      type="datetime-local"
                                      className={fieldCls}
                                      value={action.config[f.key] ?? ''}
                                      onChange={(e) =>
                                        updateDraftConfig(index, f.key, e.target.value)
                                      }
                                    />
                                  ) : (
                                    <Input
                                      id={`e${index}-${f.key}`}
                                      type={f.type === 'number' ? 'number' : 'text'}
                                      placeholder={f.placeholder}
                                      value={action.config[f.key] ?? ''}
                                      onChange={(e) =>
                                        updateDraftConfig(index, f.key, e.target.value)
                                      }
                                    />
                                  )}
                                  {f.help ? (
                                    <p className="text-xs text-muted-foreground">{f.help}</p>
                                  ) : null}
                                </div>
                                )
                              })}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <Button type="submit" disabled={saving}>
                      {saving && <Loader2 className="size-4 animate-spin" />}
                      Save changes
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Run history</CardTitle>
                <CardDescription>
                  Recent executions of this rule (GET /automations/:id/runs).
                </CardDescription>
              </CardHeader>
              <CardContent>
                {runs === null ? (
                  <LoadingScreen label="Loading runs…" />
                ) : runs.length === 0 ? (
                  <EmptyState
                    title="No runs yet"
                    hint="Click “Test run” to fire a synthetic run, or wait for a matching event."
                  />
                ) : (
                  <div className="rounded-lg border border-border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Status</TableHead>
                          <TableHead>Started</TableHead>
                          <TableHead className="text-right">Steps</TableHead>
                          <TableHead>Error</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {runs.map((run) => (
                          <TableRow key={run.id}>
                            <TableCell>
                              <RunStatusBadge status={run.status} />
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {formatDateTime(run.startedAt)}
                            </TableCell>
                            <TableCell className="text-right text-muted-foreground">
                              {run.stepsExecuted}
                            </TableCell>
                            <TableCell className="max-w-64">
                              {run.error ? (
                                <span
                                  className="block truncate font-mono text-xs text-destructive"
                                  title={run.error}
                                >
                                  {run.error}
                                </span>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </AppShell>
  )
}

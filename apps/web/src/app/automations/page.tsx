'use client'

import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Clock,
  ExternalLink,
  Loader2,
  MessageSquare,
  Plus,
  Sparkles,
  Trash2,
  Workflow,
  Zap,
} from 'lucide-react'
import { toast } from 'sonner'
import { AppShell } from '@/components/app-shell'
import { EmptyState, LoadingScreen } from '@/components/loading'
import { Badge } from '@/components/ui/badge'
import { Button, buttonVariants } from '@/components/ui/button'
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
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs'
import { api } from '@/lib/api'
import { useAuth } from '@/lib/auth-context'
import { asList, type AutomationAction, type AutomationRule } from '@/lib/types'
import { cn } from '@/lib/utils'

// ---------------------------------------------------------------------------
// Rule builder vocabulary (mirrors services/api/src/automation/types.ts)
// ---------------------------------------------------------------------------

const TRIGGER_KINDS: Array<{ value: string; label: string; hint: string }> = [
  { value: 'lead_created', label: 'Lead created', hint: 'A new lead row is created' },
  { value: 'lead_updated', label: 'Lead updated', hint: 'Any lead field changes' },
  { value: 'lead_stage_changed', label: 'Lead stage changed', hint: 'A lead moves to a different stage' },
  { value: 'lead_field_changed', label: 'Lead field changed', hint: 'A specific custom field changes' },
  { value: 'lead_assigned', label: 'Lead assigned', hint: 'A lead is (re)assigned to a user or team member' },
  { value: 'call_ended', label: 'Call ended', hint: 'A call reaches a terminal state' },
  { value: 'action_logged', label: 'Action logged', hint: 'An action/note is logged on a lead' },
  { value: 'callback_due', label: 'Callback due', hint: 'A scheduled follow-up reaches its due time' },
  { value: 'inbound_message', label: 'Inbound message', hint: 'A new inbound WhatsApp message arrives' },
  { value: 'webhook_received', label: 'Webhook received', hint: 'A public POST to /webhook/:tenantId/:name' },
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
    { key: 'skills', label: 'Skills (comma separated)', placeholder: 'english, hindi', help: 'Required when mode is skill match.' },
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
    { key: 'customDueAt', label: 'Custom due time', type: 'datetime', help: 'Used when Due is “Custom time”.' },
    { key: 'note', label: 'Note', placeholder: 'Follow up about the demo' },
  ],
  send_whatsapp: [
    { key: 'to', label: 'To (lead id / phone)', placeholder: 'Leave blank to use the lead from context' },
    { key: 'body', label: 'Message body', type: 'textarea', placeholder: 'Hi {{name}}, checking in…', required: true },
  ],
  update_field: [
    { key: 'apiName', label: 'Field api name', placeholder: 'e.g. priority', required: true, help: 'Custom field API name, or “score” for the lead score column.' },
    { key: 'value', label: 'Value', required: true },
  ],
  move_stage: [
    { key: 'stageId', label: 'Stage id', required: true },
    { key: 'pipelineId', label: 'Pipeline id', placeholder: 'Optional' },
  ],
  notify_user: [
    { key: 'userId', label: 'User id', placeholder: 'Leave blank to notify the lead owner' },
    { key: 'title', label: 'Title', placeholder: 'New lead assigned' },
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

function formatDate(iso: string): string {
  const d = new Date(iso)
  return Number.isNaN(d.getTime())
    ? '—'
    : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

interface ActionDraft {
  kind: string
  config: Record<string, string>
}

interface DripStep {
  kind: 'message' | 'delay'
  body: string
  hours: string
}

function emptyDripStep(): DripStep {
  return { kind: 'message', body: '', hours: '' }
}

const fieldCls =
  'h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50 dark:bg-input/30'
const textareaCls =
  'min-h-20 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 placeholder:text-muted-foreground dark:bg-input/30'

export default function AutomationsPage() {
  const { isReady, token, enterpriseId } = useAuth()
  const router = useRouter()
  const [rules, setRules] = useState<AutomationRule[] | null>(null)

  // Create-dialog state
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [name, setName] = useState('')
  const [triggerKind, setTriggerKind] = useState('lead_created')
  const [triggerField, setTriggerField] = useState('')
  const [actions, setActions] = useState<ActionDraft[]>([{ kind: 'send_whatsapp', config: {} }])
  const [useSchedule, setUseSchedule] = useState(false)
  const [cron, setCron] = useState('0 9 * * *')
  const [togglingId, setTogglingId] = useState<string | null>(null)

  // Drip-sequence dialog state
  const [dripOpen, setDripOpen] = useState(false)
  const [dripBusy, setDripBusy] = useState(false)
  const [dripName, setDripName] = useState('')
  const [dripSteps, setDripSteps] = useState<DripStep[]>([emptyDripStep()])
  const [activatingId, setActivatingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!token || !enterpriseId) return
    try {
      const data = await api.get<unknown>('/automations')
      setRules(asList<AutomationRule>(data))
    } catch {
      setRules([])
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

  // Rules tab = everything except dormant templates; Templates tab = dormant
  // templates only. An activated template (isActive=true) surfaces as a live
  // rule in the main table.
  const liveRules = useMemo(
    () => (rules ?? []).filter((r) => !(r.category === 'template' && !r.isActive)),
    [rules],
  )

  const templates = useMemo(
    () => (rules ?? []).filter((r) => r.category === 'template' && !r.isActive),
    [rules],
  )

  const activeCount = useMemo(
    () => liveRules.filter((r) => r.isActive).length,
    [liveRules],
  )

  function updateAction(index: number, patch: Partial<ActionDraft>) {
    setActions((prev) => prev.map((a, i) => (i === index ? { ...a, ...patch } : a)))
  }

  function updateActionConfig(index: number, key: string, value: string) {
    setActions((prev) =>
      prev.map((a, i) => (i === index ? { ...a, config: { ...a.config, [key]: value } } : a)),
    )
  }

  function addAction() {
    setActions((prev) => [...prev, { kind: 'assign_lead', config: {} }])
  }

  function removeAction(index: number) {
    setActions((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== index)))
  }

  function resetForm() {
    setName('')
    setTriggerKind('lead_created')
    setTriggerField('')
    setActions([{ kind: 'send_whatsapp', config: {} }])
    setUseSchedule(false)
    setCron('0 9 * * *')
  }

  async function onCreate(e: FormEvent) {
    e.preventDefault()
    if (!name.trim()) {
      toast.error('Rule name is required')
      return
    }
    const trimmed = actions.filter((a) => a.kind.trim())
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
    setBusy(true)
    try {
      const trigger: Record<string, unknown> = { kind: triggerKind }
      if (triggerKind === 'lead_field_changed' && triggerField.trim()) {
        trigger.config = { fieldApiName: triggerField.trim() }
      }
      const payload: Record<string, unknown> = {
        name: name.trim(),
        trigger,
        actions: trimmed.map((a) => ({ kind: a.kind, config: buildActionConfig(a.kind, a.config) })),
        isActive: true,
      }
      if (useSchedule && cron.trim()) {
        payload.schedule = { cron: cron.trim() }
      }
      await api.post('/automations', payload)
      setOpen(false)
      resetForm()
      toast.success('Automation created')
      await load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create automation')
    } finally {
      setBusy(false)
    }
  }

  async function toggleRule(rule: AutomationRule) {
    const next = !rule.isActive
    setTogglingId(rule.id)
    setRules((prev) => prev?.map((r) => (r.id === rule.id ? { ...r, isActive: next } : r)) ?? prev)
    try {
      await api.patch(`/automations/${rule.id}`, { isActive: next })
      toast.success(next ? 'Rule enabled' : 'Rule paused')
    } catch (err) {
      setRules((prev) => prev?.map((r) => (r.id === rule.id ? { ...r, isActive: !next } : r)) ?? prev)
      toast.error(err instanceof Error ? err.message : 'Failed to update rule')
    } finally {
      setTogglingId(null)
    }
  }

  // -------------------------------------------------------------------------
  // Template gallery
  // -------------------------------------------------------------------------

  async function activateTemplate(rule: AutomationRule) {
    setActivatingId(rule.id)
    try {
      await api.patch(`/automations/${rule.id}`, { isActive: true })
      toast.success(`“${rule.name}” activated`)
      await load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to activate template')
    } finally {
      setActivatingId(null)
    }
  }

  // -------------------------------------------------------------------------
  // Drip-sequence builder
  // -------------------------------------------------------------------------

  function addDripStep() {
    setDripSteps((prev) => [...prev, emptyDripStep()])
  }

  function updateDripStep(index: number, patch: Partial<DripStep>) {
    setDripSteps((prev) => prev.map((s, i) => (i === index ? { ...s, ...patch } : s)))
  }

  function removeDripStep(index: number) {
    setDripSteps((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== index)))
  }

  function resetDrip() {
    setDripName('')
    setDripSteps([emptyDripStep()])
  }

  async function onCreateDrip(e: FormEvent) {
    e.preventDefault()
    if (!dripName.trim()) {
      toast.error('Sequence name is required')
      return
    }
    for (const step of dripSteps) {
      if (step.kind === 'message' && !step.body.trim()) {
        toast.error('Every message step needs a message body')
        return
      }
      if (step.kind === 'delay') {
        const hours = Number(step.hours)
        if (!Number.isFinite(hours) || hours <= 0) {
          toast.error('Every wait step needs hours greater than 0')
          return
        }
      }
    }
    const compiled = dripSteps.map((step) =>
      step.kind === 'message'
        ? { kind: 'send_whatsapp', config: { body: step.body.trim() } }
        : { kind: 'delay', config: { hours: Number(step.hours) } },
    )
    setDripBusy(true)
    try {
      await api.post('/automations', {
        name: dripName.trim(),
        trigger: { kind: 'lead_created' },
        actions: compiled,
        isActive: true,
      })
      setDripOpen(false)
      resetDrip()
      toast.success('Drip sequence created')
      await load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create drip sequence')
    } finally {
      setDripBusy(false)
    }
  }

  if (!isReady || !token) return <LoadingScreen label="Checking session…" />

  return (
    <AppShell>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <div>
            <h1 className="text-lg font-semibold tracking-tight">Automations</h1>
            <p className="text-sm text-muted-foreground">
              {rules === null
                ? 'Loading rules…'
                : `${liveRules.length} rule${liveRules.length === 1 ? '' : 's'} · ${activeCount} active`}
            </p>
          </div>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <Link
              href="/automations/builder"
              className={cn(buttonVariants({ variant: 'outline' }))}
            >
              <ExternalLink className="size-4" /> Open builder
            </Link>
            <Button variant="outline" onClick={() => setDripOpen(true)}>
              <Zap className="size-4" /> New drip sequence
            </Button>
            <Button onClick={() => setOpen(true)}>
              <Plus className="size-4" /> New rule
            </Button>
          </div>
        </div>

        {rules === null ? (
          <LoadingScreen label="Loading automations…" />
        ) : (
          <Tabs defaultValue="rules">
            <TabsList>
              <TabsTrigger value="rules">Rules</TabsTrigger>
              <TabsTrigger value="templates">Templates</TabsTrigger>
            </TabsList>
            <TabsContent value="rules" className="space-y-3">
              {liveRules.length === 0 ? (
                <EmptyState
                  title="No automation rules yet"
                  hint="Create a rule, or activate a template to add a ready-made workflow."
                />
              ) : (
                <div className="rounded-lg border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Trigger</TableHead>
                  <TableHead>Actions</TableHead>
                  <TableHead>Active</TableHead>
                  <TableHead className="text-right">Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {liveRules.map((rule) => (
                  <TableRow key={rule.id}>
                    <TableCell className="font-medium">
                      <Link
                        href={`/automations/${rule.id}`}
                        className="flex items-center gap-1.5 hover:text-primary"
                      >
                        <Workflow className="size-3.5 text-muted-foreground" />
                        {rule.name}
                      </Link>
                      {rule.schedule?.cron ? (
                        <span className="block text-xs text-muted-foreground">
                          cron {rule.schedule.cron}
                        </span>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{triggerLabel(rule.trigger.kind)}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex max-w-72 flex-wrap gap-1">
                        {rule.actions.slice(0, 3).map((a: AutomationAction, i: number) => (
                          <Badge key={`${a.kind}-${i}`} variant="outline">
                            {actionLabel(a.kind)}
                          </Badge>
                        ))}
                        {rule.actions.length > 3 ? (
                          <span className="text-xs text-muted-foreground">
                            +{rule.actions.length - 3} more
                          </span>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={rule.isActive}
                        disabled={togglingId === rule.id}
                        onClick={() => toggleRule(rule)}
                        className={cn(
                          'relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors disabled:opacity-50',
                          rule.isActive ? 'bg-primary' : 'bg-input',
                        )}
                        title={rule.isActive ? 'Click to pause' : 'Click to enable'}
                      >
                        <span
                          className={cn(
                            'inline-block size-3.5 rounded-full bg-white shadow transition-transform',
                            rule.isActive ? 'translate-x-[18px]' : 'translate-x-[3px]',
                          )}
                        />
                      </button>
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {formatDate(rule.createdAt)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
                </div>
              )}
            </TabsContent>

            <TabsContent value="templates" className="space-y-3">
              <div>
                <h2 className="text-sm font-semibold">Template gallery</h2>
                <p className="text-xs text-muted-foreground">
                  Ready-made workflows seeded for this workspace. Activate one to
                  add it to your live rules.
                </p>
              </div>
              {templates.length === 0 ? (
                <EmptyState
                  title="No templates yet"
                  hint="Seeded templates will show up here."
                />
              ) : (
                <div className="rounded-lg border border-border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Template</TableHead>
                        <TableHead>Trigger</TableHead>
                        <TableHead>Actions</TableHead>
                        <TableHead className="text-right">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {templates.map((rule) => (
                        <TableRow key={rule.id}>
                          <TableCell className="font-medium">
                            <span className="flex items-center gap-1.5">
                              <Sparkles className="size-3.5 text-muted-foreground" />
                              {rule.name}
                            </span>
                            {rule.description ? (
                              <span className="block max-w-sm text-xs text-muted-foreground">
                                {rule.description}
                              </span>
                            ) : null}
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary">{triggerLabel(rule.trigger.kind)}</Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex max-w-72 flex-wrap gap-1">
                              {rule.actions.slice(0, 3).map((a: AutomationAction, i: number) => (
                                <Badge key={`${a.kind}-${i}`} variant="outline">
                                  {actionLabel(a.kind)}
                                </Badge>
                              ))}
                              {rule.actions.length > 3 ? (
                                <span className="text-xs text-muted-foreground">
                                  +{rule.actions.length - 3} more
                                </span>
                              ) : null}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={activatingId === rule.id}
                              onClick={() => activateTemplate(rule)}
                            >
                              {activatingId === rule.id ? (
                                <Loader2 className="size-3.5 animate-spin" />
                              ) : (
                                <Zap className="size-3.5" />
                              )}
                              Activate
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </TabsContent>
          </Tabs>
        )}
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Create rule dialog (form-based builder)                            */}
      {/* ------------------------------------------------------------------ */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>New automation rule</DialogTitle>
            <DialogDescription>
              Pick a trigger, then chain one or more actions. Rules fire when the
              trigger event happens for this workspace.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={onCreate} className="space-y-5">
            <div className="space-y-1.5">
              <Label htmlFor="rule-name">Name</Label>
              <Input
                id="rule-name"
                placeholder="e.g. Welcome message on new lead"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="rule-trigger">Trigger</Label>
              <select
                id="rule-trigger"
                className={fieldCls}
                value={triggerKind}
                onChange={(e) => setTriggerKind(e.target.value)}
              >
                {TRIGGER_KINDS.map((k) => (
                  <option key={k.value} value={k.value}>
                    {k.label}
                  </option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground">
                {TRIGGER_KINDS.find((k) => k.value === triggerKind)?.hint}
              </p>
            </div>

            {triggerKind === 'lead_field_changed' ? (
              <div className="space-y-1.5">
                <Label htmlFor="trigger-field">Field api name</Label>
                <Input
                  id="trigger-field"
                  placeholder="e.g. priority"
                  value={triggerField}
                  onChange={(e) => setTriggerField(e.target.value)}
                />
              </div>
            ) : null}

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Actions</Label>
                <Button type="button" variant="outline" size="sm" onClick={addAction}>
                  <Plus className="size-3.5" /> Add action
                </Button>
              </div>
              <div className="space-y-3">
                {actions.map((action, index) => (
                  <div
                    key={index}
                    className="space-y-2 rounded-lg border border-border p-3"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-muted-foreground">
                        {index + 1}.
                      </span>
                      <select
                        className={cn(fieldCls, 'flex-1')}
                        value={action.kind}
                        onChange={(e) =>
                          updateAction(index, { kind: e.target.value, config: {} })
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
                        disabled={actions.length <= 1}
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
                            <Label className="text-xs" htmlFor={`a${index}-${f.key}`}>
                              {f.label}
                              {f.required ? <span className="text-destructive"> *</span> : null}
                            </Label>
                            {f.type === 'select' ? (
                              <select
                                id={`a${index}-${f.key}`}
                                className={fieldCls}
                                value={action.config[f.key] ?? f.options?.[0]?.value ?? ''}
                                onChange={(e) => updateActionConfig(index, f.key, e.target.value)}
                              >
                                {f.options?.map((o) => (
                                  <option key={o.value} value={o.value}>
                                    {o.label}
                                  </option>
                                ))}
                              </select>
                            ) : f.type === 'textarea' ? (
                              <textarea
                                id={`a${index}-${f.key}`}
                                className={textareaCls}
                                placeholder={f.placeholder}
                                value={action.config[f.key] ?? ''}
                                onChange={(e) => updateActionConfig(index, f.key, e.target.value)}
                              />
                            ) : f.type === 'datetime' ? (
                              <input
                                id={`a${index}-${f.key}`}
                                type="datetime-local"
                                className={fieldCls}
                                value={action.config[f.key] ?? ''}
                                onChange={(e) => updateActionConfig(index, f.key, e.target.value)}
                              />
                            ) : (
                              <Input
                                id={`a${index}-${f.key}`}
                                type={f.type === 'number' ? 'number' : 'text'}
                                placeholder={f.placeholder}
                                value={action.config[f.key] ?? ''}
                                onChange={(e) => updateActionConfig(index, f.key, e.target.value)}
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

            <div className="space-y-2 rounded-lg border border-border p-3">
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  className="size-4 rounded border-input accent-primary"
                  checked={useSchedule}
                  onChange={(e) => setUseSchedule(e.target.checked)}
                />
                <span className="text-sm font-medium">Schedule this rule (cron)</span>
              </label>
              {useSchedule ? (
                <div className="space-y-1.5">
                  <Label htmlFor="rule-cron">Cron expression</Label>
                  <Input
                    id="rule-cron"
                    placeholder="0 9 * * *"
                    value={cron}
                    list="cron-presets"
                    onChange={(e) => setCron(e.target.value)}
                  />
                  <datalist id="cron-presets">
                    <option value="0 9 * * *" label="Daily 9:00" />
                    <option value="0 */6 * * *" label="Every 6 hours" />
                    <option value="0 0 * * 1" label="Weekly Monday" />
                  </datalist>
                </div>
              ) : null}
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setOpen(false)
                  resetForm()
                }}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={busy}>
                {busy && <Loader2 className="size-4 animate-spin" />}
                Create rule
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ------------------------------------------------------------------ */}
      {/* Drip-sequence dialog (lead_created + send_whatsapp/delay chain)    */}
      {/* ------------------------------------------------------------------ */}
      <Dialog open={dripOpen} onOpenChange={setDripOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>New drip sequence</DialogTitle>
            <DialogDescription>
              Build a timed follow-up chain: when a lead is created they get the
              first message, then each wait step pauses the sequence before the
              next message goes out.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={onCreateDrip} className="space-y-5">
            <div className="space-y-1.5">
              <Label htmlFor="drip-name">Name</Label>
              <Input
                id="drip-name"
                placeholder="e.g. 3-day follow-up sequence"
                value={dripName}
                onChange={(e) => setDripName(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Steps</Label>
                <Button type="button" variant="outline" size="sm" onClick={addDripStep}>
                  <Plus className="size-3.5" /> Add step
                </Button>
              </div>
              <div className="space-y-3">
                {dripSteps.map((step, index) => (
                  <div
                    key={index}
                    className="space-y-2 rounded-lg border border-border p-3"
                  >
                    <div className="flex items-center gap-2">
                      {step.kind === 'message' ? (
                        <MessageSquare className="size-3.5 shrink-0 text-muted-foreground" />
                      ) : (
                        <Clock className="size-3.5 shrink-0 text-muted-foreground" />
                      )}
                      <select
                        className={cn(fieldCls, 'flex-1')}
                        value={step.kind}
                        onChange={(e) =>
                          updateDripStep(index, {
                            kind: e.target.value === 'delay' ? 'delay' : 'message',
                          })
                        }
                      >
                        <option value="message">Send message</option>
                        <option value="delay">Wait</option>
                      </select>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        disabled={dripSteps.length <= 1}
                        onClick={() => removeDripStep(index)}
                        title="Remove step"
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                    {step.kind === 'message' ? (
                      <div className="space-y-1.5">
                        <Label className="text-xs" htmlFor={`drip-msg-${index}`}>
                          Message body
                        </Label>
                        <textarea
                          id={`drip-msg-${index}`}
                          className={textareaCls}
                          placeholder="Hi {{name}}, thanks for reaching out — here's what happens next…"
                          value={step.body}
                          onChange={(e) => updateDripStep(index, { body: e.target.value })}
                        />
                      </div>
                    ) : (
                      <div className="space-y-1.5">
                        <Label className="text-xs" htmlFor={`drip-delay-${index}`}>
                          Wait (hours)
                        </Label>
                        <Input
                          id={`drip-delay-${index}`}
                          type="number"
                          min={1}
                          step={1}
                          placeholder="e.g. 24"
                          value={step.hours}
                          onChange={(e) => updateDripStep(index, { hours: e.target.value })}
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setDripOpen(false)
                  resetDrip()
                }}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={dripBusy}>
                {dripBusy && <Loader2 className="size-4 animate-spin" />}
                Create sequence
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </AppShell>
  )
}

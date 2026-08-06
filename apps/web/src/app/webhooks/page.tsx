'use client'

import { Fragment, useCallback, useEffect, useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Check,
  ChevronDown,
  Copy,
  ExternalLink,
  History,
  Loader2,
  Play,
  RefreshCw,
  Send,
  Webhook,
  Zap,
} from 'lucide-react'
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
import { API_BASE, PUBLIC_BASE } from '@/lib/config'
import { asList, type AutomationRule, type AutomationRun } from '@/lib/types'
import { cn } from '@/lib/utils'

// ---------------------------------------------------------------------------
// Vocabulary (mirrors services/api/src/automation/types.ts)
// ---------------------------------------------------------------------------

const TRIGGER_LABELS: Record<string, string> = {
  inbound_message: 'Inbound message',
  webhook_received: 'Webhook received',
}

/** Action kinds offered by the quick-create form. */
const QUICK_ACTION_KINDS: Array<{ value: string; label: string }> = [
  { value: 'send_whatsapp', label: 'Send WhatsApp' },
  { value: 'update_field', label: 'Update field' },
  { value: 'notify_user', label: 'Notify user' },
  { value: 'create_callback', label: 'Create callback' },
]

function actionLabel(kind: string): string {
  return QUICK_ACTION_KINDS.find((k) => k.value === kind)?.label ?? kind
}

interface FieldDef {
  key: string
  label: string
  type?: 'text' | 'number' | 'textarea' | 'select' | 'datetime'
  options?: Array<{ value: string; label: string }>
  placeholder?: string
  required?: boolean
  help?: string
}

const QUICK_ACTION_FIELDS: Record<string, FieldDef[]> = {
  send_whatsapp: [
    { key: 'to', label: 'To (lead id / phone)', placeholder: 'Leave blank to use the lead from context' },
    { key: 'body', label: 'Message body', type: 'textarea', placeholder: 'Hi {{name}}, checking in…', required: true },
  ],
  update_field: [
    { key: 'apiName', label: 'Field api name', placeholder: 'e.g. priority', required: true, help: 'Custom field API name, or “score” for the lead score column.' },
    { key: 'value', label: 'Value', required: true },
  ],
  notify_user: [
    { key: 'userId', label: 'User id', placeholder: 'Leave blank to notify the lead owner' },
    { key: 'title', label: 'Title', placeholder: 'New inbound message' },
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
    { key: 'customDueAt', label: 'Custom due time', type: 'datetime', help: 'Used when Due is “Custom time”.' },
    { key: 'note', label: 'Note', placeholder: 'Follow up about the demo' },
  ],
}

function buildActionConfig(
  kind: string,
  c: Record<string, string>,
): Record<string, unknown> {
  const t = (v: string | undefined) => (v ?? '').trim()
  switch (kind) {
    case 'send_whatsapp': {
      const to = t(c.to)
      return to ? { to, body: t(c.body) } : { body: t(c.body) }
    }
    case 'update_field':
      return { apiName: t(c.apiName), value: c.value ?? '' }
    case 'notify_user': {
      const userId = t(c.userId)
      return {
        ...(userId ? { userId } : {}),
        ...(t(c.title) ? { title: t(c.title) } : {}),
        ...(t(c.body) ? { body: t(c.body) } : {}),
      }
    }
    case 'create_callback': {
      const quickChip = t(c.quickChip) || '1h'
      const note = t(c.note)
      const customDueAt = t(c.customDueAt)
      const cfg: Record<string, unknown> = { quickChip }
      if (quickChip === 'custom' && customDueAt) cfg.customDueAt = customDueAt
      if (note) cfg.note = note
      return cfg
    }
    default:
      return {}
  }
}

const RUN_STATUS: Record<
  AutomationRun['status'],
  { label: string; cls: string }
> = {
  queued: { label: 'Queued', cls: 'bg-muted text-muted-foreground' },
  running: { label: 'Running', cls: 'bg-blue-500/15 text-blue-600 dark:text-blue-400' },
  success: { label: 'Success', cls: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' },
  failed: { label: 'Failed', cls: 'bg-destructive/10 text-destructive' },
  skipped: { label: 'Skipped', cls: 'bg-muted text-muted-foreground' },
  throttled: { label: 'Throttled', cls: 'bg-amber-500/15 text-amber-600 dark:text-amber-400' },
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString()
}

function formatMs(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return '—'
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

/** Pull an `id` out of an API response, tolerating a { data: … } envelope. */
function extractId(res: unknown): string | null {
  if (!res || typeof res !== 'object') return null
  const obj = res as Record<string, unknown>
  const inner =
    obj.data && typeof obj.data === 'object'
      ? (obj.data as Record<string, unknown>)
      : obj
  return typeof inner.id === 'string' ? inner.id : null
}

const fieldCls =
  'h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50 dark:bg-input/30'
const textareaCls =
  'min-h-20 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 placeholder:text-muted-foreground dark:bg-input/30'

function CopyButton({
  text,
  label = 'Copy',
  className,
}: {
  text: string
  label?: string
  className?: string
}) {
  const [copied, setCopied] = useState(false)
  async function onCopy() {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      toast.success('Copied to clipboard')
      window.setTimeout(() => setCopied(false), 1500)
    } catch {
      toast.error('Copy failed — select the text and copy manually')
    }
  }
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className={className}
      onClick={onCopy}
    >
      {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
      {copied ? 'Copied' : label}
    </Button>
  )
}

// ---------------------------------------------------------------------------
// Run history panel
//   GET  /automations/:id/runs            -> { data: AutomationRun[] }
//   POST /automations/:id/runs/:runId/replay -> { runId }
// ---------------------------------------------------------------------------

function RunsPanel({
  ruleId,
  ruleName,
  refreshTick,
}: {
  ruleId: string
  ruleName: string
  refreshTick?: number
}) {
  const [runs, setRuns] = useState<AutomationRun[] | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [replaying, setReplaying] = useState<string | null>(null)

  const load = useCallback(async () => {
    setErr(null)
    try {
      const data = await api.get<unknown>(`/automations/${ruleId}/runs`)
      setRuns(asList<AutomationRun>(data))
    } catch (e) {
      setRuns([])
      setErr(e instanceof Error ? e.message : 'Failed to load runs')
    }
  }, [ruleId])

  useEffect(() => {
    load()
  }, [load, refreshTick])

  async function onReplay(runId: string) {
    setReplaying(runId)
    try {
      // Body is an explicit empty object: JSON.stringify({}) -> '{}'
      const data = await api.post<{ runId?: string }>(
        `/automations/${ruleId}/runs/${runId}/replay`,
        {},
      )
      toast.success(`Replay queued — new run ${data?.runId ?? runId}`)
      await load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Replay failed')
    } finally {
      setReplaying(null)
    }
  }

  if (runs === null) {
    return <LoadingScreen label="Loading runs…" />
  }
  if (err) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border px-6 py-8 text-center">
        <p className="text-sm text-destructive">Couldn&apos;t load runs: {err}</p>
        <Button type="button" variant="outline" size="sm" onClick={load}>
          <RefreshCw className="size-3.5" /> Retry
        </Button>
      </div>
    )
  }
  if (runs.length === 0) {
    return (
      <EmptyState
        title={`No runs for “${ruleName}” yet`}
        hint="POST to the webhook URL or hit Test to trigger this rule — the run will appear here."
      />
    )
  }
  return (
    <div className="rounded-lg border border-border bg-background/60">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Run</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Started</TableHead>
            <TableHead>Steps</TableHead>
            <TableHead>Duration</TableHead>
            <TableHead className="text-right">Replay</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {runs.map((run) => {
            const st = RUN_STATUS[run.status] ?? {
              label: run.status,
              cls: 'bg-muted text-muted-foreground',
            }
            return (
              <TableRow key={run.id}>
                <TableCell className="font-mono text-xs">{run.id}</TableCell>
                <TableCell>
                  <Badge variant="outline" className={st.cls}>
                    {st.label}
                  </Badge>
                  {run.error ? (
                    <p className="mt-1 max-w-48 text-[10px] leading-tight text-destructive">
                      {run.error}
                    </p>
                  ) : null}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {formatDate(run.startedAt)}
                </TableCell>
                <TableCell className="text-xs">{run.stepsExecuted}</TableCell>
                <TableCell className="text-xs">{formatMs(run.durationMs)}</TableCell>
                <TableCell className="text-right">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={replaying === run.id}
                    onClick={() => onReplay(run.id)}
                    title="Re-fire this run into a new run"
                  >
                    {replaying === run.id ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <Play className="size-3.5" />
                    )}
                    Replay
                  </Button>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Quick-create form
//   POST /automations { name, trigger: { kind: 'inbound_message', config: {} }, actions: [...] }
// ---------------------------------------------------------------------------

function QuickCreateForm({ onCreated }: { onCreated: () => void }) {
  const [name, setName] = useState('')
  const [kind, setKind] = useState('send_whatsapp')
  const [config, setConfig] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)

  function updateConfig(key: string, value: string) {
    setConfig((prev) => ({ ...prev, [key]: value }))
  }

  function changeKind(next: string) {
    setKind(next)
    setConfig({})
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    const trimmedName = name.trim()
    if (!trimmedName) {
      toast.error('Rule name is required')
      return
    }
    for (const f of QUICK_ACTION_FIELDS[kind]?.filter((x) => x.required) ?? []) {
      if (!(config[f.key] ?? '').trim()) {
        toast.error(`“${actionLabel(kind)}” needs ${f.label.toLowerCase()}`)
        return
      }
    }
    setBusy(true)
    try {
      const res = await api.post<unknown>('/automations', {
        name: trimmedName,
        trigger: { kind: 'inbound_message', config: {} },
        actions: [
          { kind, config: buildActionConfig(kind, config) },
        ],
        isActive: true,
      })
      const id = extractId(res)
      toast.success(
        id
          ? `Webhook rule “${trimmedName}” created (${id})`
          : `Webhook rule “${trimmedName}” created`,
      )
      setName('')
      setConfig({})
      onCreated()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create rule')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="rule-name">Rule name</Label>
          <Input
            id="rule-name"
            placeholder="e.g. order-created"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Used to identify the rule. Slug-safe names make the cleanest{' '}
            <code className="font-mono text-[11px]">{'{'}name{'}'}</code>{' '}
            segments for{' '}
            <code className="font-mono text-[11px]">webhook_received</code>{' '}
            rules.
          </p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="rule-action">Action</Label>
          <select
            id="rule-action"
            className={fieldCls}
            value={kind}
            onChange={(e) => changeKind(e.target.value)}
          >
            {QUICK_ACTION_KINDS.map((k) => (
              <option key={k.value} value={k.value}>
                {k.label}
              </option>
            ))}
          </select>
          <p className="text-xs text-muted-foreground">
            New rules listen for inbound WhatsApp messages — trigger{' '}
            <code className="font-mono text-[11px]">inbound_message</code> —
            and run this action when one arrives.
          </p>
        </div>
      </div>

      <div className="grid gap-2 rounded-lg border border-border p-3">
        {QUICK_ACTION_FIELDS[kind]?.map((f) => (
          <div key={f.key} className="space-y-1">
            <Label className="text-xs" htmlFor={`qc-${f.key}`}>
              {f.label}
              {f.required ? <span className="text-destructive"> *</span> : null}
            </Label>
            {f.type === 'select' ? (
              <select
                id={`qc-${f.key}`}
                className={fieldCls}
                value={config[f.key] ?? f.options?.[0]?.value ?? ''}
                onChange={(e) => updateConfig(f.key, e.target.value)}
              >
                {f.options?.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            ) : f.type === 'textarea' ? (
              <textarea
                id={`qc-${f.key}`}
                className={textareaCls}
                placeholder={f.placeholder}
                value={config[f.key] ?? ''}
                onChange={(e) => updateConfig(f.key, e.target.value)}
              />
            ) : f.type === 'datetime' ? (
              <input
                id={`qc-${f.key}`}
                type="datetime-local"
                className={fieldCls}
                value={config[f.key] ?? ''}
                onChange={(e) => updateConfig(f.key, e.target.value)}
              />
            ) : (
              <Input
                id={`qc-${f.key}`}
                type={f.type === 'number' ? 'number' : 'text'}
                placeholder={f.placeholder}
                value={config[f.key] ?? ''}
                onChange={(e) => updateConfig(f.key, e.target.value)}
              />
            )}
            {f.help ? (
              <p className="text-xs text-muted-foreground">{f.help}</p>
            ) : null}
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <Button type="submit" disabled={busy}>
          {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Zap className="size-3.5" />}
          {busy ? 'Creating…' : 'Create webhook rule'}
        </Button>
        <p className="text-xs text-muted-foreground">
          POST{' '}
          <code className="font-mono text-[11px]">/automations</code> — the new
          rule starts active.
        </p>
      </div>
    </form>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function WebhooksPage() {
  const { isReady, token, enterpriseId } = useAuth()
  const router = useRouter()

  // Rules list
  const [rules, setRules] = useState<AutomationRule[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const [testingId, setTestingId] = useState<string | null>(null)
  const [runsTick, setRunsTick] = useState(0)

  const isWebhookRule = (r: AutomationRule) =>
    r.trigger.kind === 'inbound_message' || r.trigger.kind === 'webhook_received'

  const load = useCallback(async () => {
    if (!token || !enterpriseId) return
    setLoadError(null)
    try {
      const data = await api.get<unknown>('/automations')
      setRules(asList<AutomationRule>(data).filter(isWebhookRule))
    } catch (e) {
      setRules([])
      setLoadError(e instanceof Error ? e.message : 'Failed to load rules')
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

  async function toggleRule(rule: AutomationRule) {
    const next = !rule.isActive
    setTogglingId(rule.id)
    // Optimistic update; roll back on failure.
    setRules(
      (prev) =>
        prev?.map((r) => (r.id === rule.id ? { ...r, isActive: next } : r)) ??
        prev,
    )
    try {
      await api.patch(`/automations/${rule.id}`, { isActive: next })
      toast.success(
        next ? `“${rule.name}” activated` : `“${rule.name}” paused`,
      )
    } catch (e) {
      setRules(
        (prev) =>
          prev?.map((r) =>
            r.id === rule.id ? { ...r, isActive: !next } : r,
          ) ?? prev,
      )
      toast.error(e instanceof Error ? e.message : 'Toggle failed')
    } finally {
      setTogglingId(null)
    }
  }

  async function onTest(rule: AutomationRule) {
    setTestingId(rule.id)
    try {
      const res = await api.post<{ runId?: string }>(
        `/automations/${rule.id}/test`,
        { payload: {} },
      )
      const runId = res?.runId ?? rule.id
      toast.success(`Test run queued — run ${runId}`)
      setRunsTick((v) => v + 1)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Test failed')
    } finally {
      setTestingId(null)
    }
  }

  if (!isReady || !token) return <LoadingScreen label="Checking session…" />

  const webhookUrl = `${PUBLIC_BASE}/webhook/${enterpriseId}/<name>`
  const curlExample = `curl -X POST ${webhookUrl} -H 'content-type: application/json' -d '{"hello":"world"}'`

  return (
    <AppShell>
      <div className="mx-auto max-w-5xl space-y-4">
        <div>
          <h1 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
            <Webhook className="size-5 text-muted-foreground" /> Webhooks
          </h1>
          <p className="text-sm text-muted-foreground">
            Fire automation rules from external systems — no API token required.
          </p>
        </div>

        {/* ---------------------------------------------------------------- */}
        {/* Public endpoint                                                    */}
        {/* ---------------------------------------------------------------- */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Your public webhook URL</CardTitle>
            <CardDescription>
              Pattern:{' '}
              <code className="font-mono text-xs">
                POST /webhook/{'{'}enterpriseId{'}'}/{'{'}name{'}'}
              </code>{' '}
              — the name segment is your rule&apos;s name. No authentication
              needed; anyone with the URL can fire it.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <code className="min-w-0 flex-1 rounded-lg border border-border bg-muted/40 px-3 py-2 font-mono text-xs break-all">
                {webhookUrl}
              </code>
              <CopyButton text={webhookUrl} label="Copy URL" />
            </div>
            <div className="rounded-lg border border-border bg-muted/40 p-3">
              <p className="mb-1 text-xs font-medium text-muted-foreground">
                Fire it from any terminal:
              </p>
              <pre className="overflow-x-auto font-mono text-xs leading-relaxed">
                {curlExample}
              </pre>
            </div>
          </CardContent>
        </Card>

        {/* ---------------------------------------------------------------- */}
        {/* Quick create                                                      */}
        {/* ---------------------------------------------------------------- */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Create webhook rule</CardTitle>
            <CardDescription>
              Name a rule, pick an action, and it starts listening for inbound
              messages immediately.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <QuickCreateForm onCreated={load} />
          </CardContent>
        </Card>

        {/* ---------------------------------------------------------------- */}
        {/* Webhook rules                                                     */}
        {/* ---------------------------------------------------------------- */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Webhook rules</CardTitle>
            <CardDescription>
              Rules with trigger{' '}
              <span className="font-mono text-xs">inbound_message</span> or{' '}
              <span className="font-mono text-xs">webhook_received</span>.
              Toggle them on/off, fire a synthetic test run, or expand Runs for
              history + replay.
            </CardDescription>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={load}
                disabled={rules === null}
              >
                <RefreshCw className="size-3.5" /> Refresh
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {rules === null ? (
              <LoadingScreen label="Loading rules…" />
            ) : loadError ? (
              <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border px-6 py-10 text-center">
                <p className="text-sm text-destructive">
                  Couldn&apos;t load rules: {loadError}
                </p>
                <Button type="button" variant="outline" size="sm" onClick={load}>
                  <RefreshCw className="size-3.5" /> Retry
                </Button>
              </div>
            ) : rules.length === 0 ? (
              <EmptyState
                title="No webhook rules yet"
                hint="Use the form above to create your first inbound_message rule."
              />
            ) : (
              <div className="rounded-lg border border-border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Rule</TableHead>
                      <TableHead>Trigger</TableHead>
                      <TableHead>Active</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rules.map((rule) => {
                      const url = `${PUBLIC_BASE}/webhook/${enterpriseId}/${encodeURIComponent(rule.name)}`
                      const expanded = expandedId === rule.id
                      const triggerLabel =
                        TRIGGER_LABELS[rule.trigger.kind] ?? rule.trigger.kind
                      return (
                        <Fragment key={rule.id}>
                          <TableRow>
                            <TableCell className="font-medium">
                              <Link
                                href={`/automations/${rule.id}`}
                                className="inline-flex items-center gap-1.5 hover:text-primary"
                              >
                                {rule.name}
                                <ExternalLink className="size-3 text-muted-foreground" />
                              </Link>
                              {rule.trigger.kind === 'webhook_received' ? (
                                <code
                                  className="mt-0.5 block max-w-64 truncate font-mono text-[10px] text-muted-foreground"
                                  title={url}
                                >
                                  {url}
                                </code>
                              ) : (
                                <span className="mt-0.5 block max-w-64 truncate text-[10px] text-muted-foreground">
                                  Fires on inbound WhatsApp messages
                                </span>
                              )}
                            </TableCell>
                            <TableCell>
                              <Badge variant="secondary" className="font-mono">
                                {rule.trigger.kind}
                              </Badge>
                              <span className="sr-only">{triggerLabel}</span>
                            </TableCell>
                            <TableCell>
                              <button
                                type="button"
                                role="switch"
                                aria-checked={rule.isActive}
                                aria-label={`Toggle ${rule.name}`}
                                disabled={togglingId === rule.id}
                                onClick={() => toggleRule(rule)}
                                className={cn(
                                  'relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors disabled:opacity-50',
                                  rule.isActive ? 'bg-primary' : 'bg-input',
                                )}
                                title={
                                  rule.isActive
                                    ? 'Click to pause'
                                    : 'Click to enable'
                                }
                              >
                                <span
                                  className={cn(
                                    'inline-block size-3.5 rounded-full bg-white shadow transition-transform',
                                    rule.isActive
                                      ? 'translate-x-[18px]'
                                      : 'translate-x-[3px]',
                                  )}
                                />
                              </button>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-2">
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  disabled={testingId === rule.id}
                                  onClick={() => onTest(rule)}
                                  title="Fire a synthetic test run"
                                >
                                  {testingId === rule.id ? (
                                    <Loader2 className="size-3.5 animate-spin" />
                                  ) : (
                                    <Send className="size-3.5" />
                                  )}
                                  Test
                                </Button>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() =>
                                    setExpandedId(expanded ? null : rule.id)
                                  }
                                >
                                  <History className="size-3.5" />
                                  Runs
                                  <ChevronDown
                                    className={cn(
                                      'size-3.5 transition-transform',
                                      expanded && 'rotate-180',
                                    )}
                                  />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                          {expanded ? (
                            <TableRow>
                              <TableCell
                                colSpan={4}
                                className="bg-muted/20 p-3"
                              >
                                <RunsPanel
                                  ruleId={rule.id}
                                  ruleName={rule.name}
                                  refreshTick={runsTick}
                                />
                              </TableCell>
                            </TableRow>
                          ) : null}
                        </Fragment>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  )
}

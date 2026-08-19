'use client'

import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { Eye, Loader2, Plus, Search, Send, UserMinus } from 'lucide-react'
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
import { api, ApiError } from '@/lib/api'
import { useAuth } from '@/lib/auth-context'
import {
  asList,
  type Lead,
  type WaBroadcast,
  type WhatsAppTemplate,
} from '@/lib/types'

interface BroadcastRecipient {
  leadId?: string
  jid: string
  status: string
  error?: string | null
  sentAt?: string | null
}

type BroadcastRow = WaBroadcast & {
  templateId?: string | null
  deliveredCount?: number
  failedCount?: number
  recipients?: BroadcastRecipient[]
}

type TemplateRow = WhatsAppTemplate & {
  id?: string
}

const STATUS_VARIANT: Record<
  string,
  'default' | 'secondary' | 'outline' | 'destructive'
> = {
  draft: 'secondary',
  sending: 'default',
  completed: 'outline',
  failed: 'destructive',
  cancelled: 'outline',
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return Number.isNaN(d.getTime())
    ? '—'
    : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

function errMsg(err: unknown, fallback: string): string {
  if (err instanceof ApiError) {
    const body = err.body as { error?: { message?: string } } | null
    if (body?.error?.message) return body.error.message
  }
  return err instanceof Error ? err.message : fallback
}

function Progress({ sent, total }: { sent: number; total: number }) {
  const pct = total > 0 ? Math.min(100, Math.round((sent / total) * 100)) : 0
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-20 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs text-muted-foreground tabular-nums">
        {sent}/{total}
      </span>
    </div>
  )
}

export default function BroadcastsPage() {
  const { isReady, token, enterpriseId } = useAuth()
  const router = useRouter()
  const [broadcasts, setBroadcasts] = useState<BroadcastRow[] | null>(null)
  const [templates, setTemplates] = useState<TemplateRow[]>([])
  const [leads, setLeads] = useState<Lead[]>([])
  const [createOpen, setCreateOpen] = useState(false)
  const [startTarget, setStartTarget] = useState<BroadcastRow | null>(null)
  const [detail, setDetail] = useState<BroadcastRow | null>(null)
  const [busy, setBusy] = useState(false)
  const [detailBusy, setDetailBusy] = useState(false)
  const [form, setForm] = useState({
    name: '',
    mode: 'template' as 'template' | 'text',
    templateName: '',
    text: '',
    leadQuery: '',
  })
  const [leadIds, setLeadIds] = useState<string[]>([])

  const templateMap = useMemo(() => {
    const m = new Map<string, string>()
    for (const t of templates) {
      if (t.id) m.set(t.id, t.name)
    }
    return m
  }, [templates])

  const load = useCallback(async () => {
    if (!token || !enterpriseId) return
    try {
      const [bcData, tplData, leadData] = await Promise.all([
        api.get<unknown>('/whatsapp/broadcasts'),
        api.get<unknown>('/whatsapp/templates').catch(() => ({ data: [] })),
        api.get<unknown>('/leads?limit=100').catch(() => ({ data: [] })),
      ])
      setBroadcasts(asList<BroadcastRow>(bcData))
      setTemplates(asList<TemplateRow>(tplData))
      setLeads(asList<Lead>(leadData))
    } catch {
      setBroadcasts([])
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

  const filteredLeads = useMemo(() => {
    const q = form.leadQuery.trim().toLowerCase()
    if (!q) return leads
    return leads.filter(
      (l) =>
        (l.name ?? '').toLowerCase().includes(q) ||
        (l.phone ?? '').toLowerCase().includes(q) ||
        (l.email ?? '').toLowerCase().includes(q),
    )
  }, [leads, form.leadQuery])

  function toggleLead(id: string) {
    setLeadIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    )
  }

  async function onCreate(e: FormEvent) {
    e.preventDefault()
    const name = form.name.trim()
    if (!name) {
      toast.error('Name is required')
      return
    }
    if (form.mode === 'template' && !form.templateName) {
      toast.error('Pick a template')
      return
    }
    if (form.mode === 'text' && !form.text.trim()) {
      toast.error('Message text is required')
      return
    }
    if (leadIds.length === 0) {
      toast.error('Select at least one recipient lead')
      return
    }
    setBusy(true)
    try {
      await api.post('/whatsapp/broadcasts', {
        name,
        ...(form.mode === 'template'
          ? { templateName: form.templateName }
          : { text: form.text.trim() }),
        leadIds,
      })
      setCreateOpen(false)
      setForm({ name: '', mode: 'template', templateName: '', text: '', leadQuery: '' })
      setLeadIds([])
      toast.success('Broadcast created')
      await load()
    } catch (err) {
      toast.error(errMsg(err, 'Failed to create broadcast'))
    } finally {
      setBusy(false)
    }
  }

  async function onStart() {
    if (!startTarget) return
    setBusy(true)
    try {
      const res = await api.post<{ delivered?: number; failed?: number }>(
        `/whatsapp/broadcasts/${startTarget.id}/start`,
      )
      toast.success(
        `Broadcast started — ${res?.delivered ?? 0} sent, ${res?.failed ?? 0} failed`,
      )
      setStartTarget(null)
      await load()
    } catch (err) {
      toast.error(errMsg(err, 'Failed to start broadcast'))
    } finally {
      setBusy(false)
    }
  }

  async function openDetail(b: BroadcastRow) {
    setDetail(b)
    setDetailBusy(true)
    try {
      const data = await api.get<{ data?: BroadcastRow }>(
        `/whatsapp/broadcasts/${b.id}`,
      )
      setDetail(data?.data ?? b)
    } catch {
      toast.error('Failed to load broadcast details')
    } finally {
      setDetailBusy(false)
    }
  }

  async function onOptOut(recipient: BroadcastRecipient) {
    if (!detail) return
    try {
      await api.post(`/whatsapp/broadcasts/${detail.id}/optout`, {
        contactJid: recipient.jid,
      })
      toast.success('Recipient opted out')
      const data = await api.get<{ data?: BroadcastRow }>(
        `/whatsapp/broadcasts/${detail.id}`,
      )
      setDetail(data?.data ?? detail)
      await load()
    } catch (err) {
      toast.error(errMsg(err, 'Failed to opt out recipient'))
    }
  }

  if (!isReady || !token) return <LoadingScreen label="Checking session…" />

  return (
    <AppShell>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <div>
            <h2 className="text-base font-semibold tracking-tight">Broadcasts</h2>
            <p className="text-xs text-muted-foreground">
              {broadcasts === null
                ? 'Loading…'
                : `${broadcasts.length} broadcast${broadcasts.length === 1 ? '' : 's'}`}
            </p>
          </div>
          <Button className="ml-auto" onClick={() => setCreateOpen(true)}>
            <Plus className="size-4" /> New Broadcast
          </Button>
        </div>

        {broadcasts === null ? (
          <LoadingScreen label="Loading broadcasts…" />
        ) : broadcasts.length === 0 ? (
          <EmptyState
            title="No broadcasts yet"
            hint="Click “New Broadcast” to create your first campaign."
          />
        ) : (
          <div className="rounded-lg border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Content</TableHead>
                  <TableHead>Progress</TableHead>
                  <TableHead className="text-right">Created</TableHead>
                  <TableHead className="w-24 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {broadcasts.map((b) => {
                  const sent = b.deliveredCount ?? b.sentCount ?? 0
                  const contentName = b.templateName ?? templateMap.get(b.templateId ?? '')
                  return (
                    <TableRow key={b.id}>
                      <TableCell className="font-medium">{b.name}</TableCell>
                      <TableCell>
                        <Badge variant={STATUS_VARIANT[b.status] ?? 'secondary'}>
                          {b.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-56">
                        <p className="truncate text-muted-foreground" title={b.text ?? undefined}>
                          {contentName ? `Template: ${contentName}` : b.text || '—'}
                        </p>
                      </TableCell>
                      <TableCell>
                        <Progress sent={sent} total={b.totalRecipients} />
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {formatDate(b.createdAt)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          {b.status === 'draft' && (
                            <Button
                              size="icon-sm"
                              variant="outline"
                              aria-label={`Start ${b.name}`}
                              onClick={() => setStartTarget(b)}
                            >
                              <Send className="size-3.5" />
                            </Button>
                          )}
                          <Button
                            size="icon-sm"
                            variant="ghost"
                            aria-label={`Details for ${b.name}`}
                            onClick={() => openDetail(b)}
                          >
                            <Eye className="size-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* Create */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New Broadcast</DialogTitle>
            <DialogDescription>
              Pick a template or free text, then choose recipient leads.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={onCreate} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="bc-name">Name</Label>
              <Input
                id="bc-name"
                placeholder="July promotion"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Content</Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={form.mode === 'template' ? 'default' : 'outline'}
                  onClick={() => setForm({ ...form, mode: 'template' })}
                >
                  Template
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={form.mode === 'text' ? 'default' : 'outline'}
                  onClick={() => setForm({ ...form, mode: 'text' })}
                >
                  Plain text
                </Button>
              </div>
              {form.mode === 'template' ? (
                <select
                  value={form.templateName}
                  onChange={(e) => setForm({ ...form, templateName: e.target.value })}
                  className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30 dark:[&>option]:bg-background"
                >
                  <option value="">Select a template…</option>
                  {templates.map((t) => (
                    <option key={t.name} value={t.name}>
                      {t.name}
                    </option>
                  ))}
                </select>
              ) : (
                <textarea
                  rows={4}
                  placeholder="Hi! Check out our latest offers…"
                  className="w-full rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
                  value={form.text}
                  onChange={(e) => setForm({ ...form, text: e.target.value })}
                />
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Recipients ({leadIds.length} selected)</Label>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Filter leads…"
                  className="pl-8"
                  value={form.leadQuery}
                  onChange={(e) => setForm({ ...form, leadQuery: e.target.value })}
                />
              </div>
              <div className="max-h-48 space-y-0.5 overflow-y-auto rounded-lg border border-border p-1.5">
                {filteredLeads.length === 0 ? (
                  <p className="px-2 py-3 text-center text-xs text-muted-foreground">
                    No leads found
                  </p>
                ) : (
                  filteredLeads.map((l) => (
                    <label
                      key={l.id}
                      className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted/50"
                    >
                      <input
                        type="checkbox"
                        checked={leadIds.includes(l.id)}
                        onChange={() => toggleLead(l.id)}
                        className="size-3.5 accent-primary"
                      />
                      <span className="min-w-0 flex-1 truncate">
                        {l.name || 'Unnamed lead'}
                      </span>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {l.phone || l.email || '—'}
                      </span>
                    </label>
                  ))
                )}
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setCreateOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={busy}>
                {busy && <Loader2 className="size-4 animate-spin" />}
                Create broadcast
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Start confirm */}
      <Dialog open={startTarget !== null} onOpenChange={(o) => !o && setStartTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Start broadcast?</DialogTitle>
            <DialogDescription>
              “{startTarget?.name}” will send to {startTarget?.totalRecipients ?? 0}{' '}
              recipient{startTarget?.totalRecipients === 1 ? '' : 's'} via WhatsApp.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setStartTarget(null)}
            >
              Cancel
            </Button>
            <Button type="button" disabled={busy} onClick={onStart}>
              {busy && <Loader2 className="size-4 animate-spin" />}
              Start sending
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Details + opt-out */}
      <Dialog open={detail !== null} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{detail?.name}</DialogTitle>
            <DialogDescription>
              Status: {detail?.status} · {detail?.deliveredCount ?? 0} delivered ·{' '}
              {detail?.failedCount ?? 0} failed · {detail?.totalRecipients ?? 0} total
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {detail?.text ? (
              <p className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs whitespace-pre-wrap text-muted-foreground">
                {detail.text}
              </p>
            ) : null}
            <div className="max-h-64 space-y-1 overflow-y-auto pr-1">
              {detailBusy ? (
                <LoadingScreen label="Loading recipients…" />
              ) : (detail?.recipients ?? []).length === 0 ? (
                <p className="py-3 text-center text-xs text-muted-foreground">
                  No recipients resolved for this broadcast.
                </p>
              ) : (
                (detail?.recipients ?? []).map((r, i) => (
                  <div
                    key={`${r.jid}-${i}`}
                    className="flex items-center gap-2 rounded-md border border-border px-2.5 py-1.5 text-xs"
                  >
                    <span className="min-w-0 flex-1 truncate font-mono">{r.jid}</span>
                    <Badge
                      variant={
                        r.status === 'delivered'
                          ? 'default'
                          : r.status === 'failed' || r.status === 'opted_out'
                            ? 'destructive'
                            : 'secondary'
                      }
                    >
                      {r.status}
                    </Badge>
                    {r.status === 'queued' || r.status === 'delivered' ? (
                      <Button
                        size="icon-xs"
                        variant="ghost"
                        aria-label={`Opt out ${r.jid}`}
                        title="Opt out recipient"
                        onClick={() => onOptOut(r)}
                      >
                        <UserMinus className="size-3" />
                      </Button>
                    ) : null}
                  </div>
                ))
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </AppShell>
  )
}

'use client'

import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle, CalendarClock, Check, Loader2, Plus, X } from 'lucide-react'
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
import { asList, type Callback, type Lead } from '@/lib/types'

type Chip = '1h' | '3h' | 'tomorrow_10am' | 'custom'

const QUICK_CHIPS: Array<{ key: Chip; label: string }> = [
  { key: '1h', label: 'In 1 hour' },
  { key: '3h', label: 'In 3 hours' },
  { key: 'tomorrow_10am', label: 'Tomorrow 10 AM' },
  { key: 'custom', label: 'Custom time' },
]

function formatDue(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function errMsg(err: unknown, fallback: string): string {
  if (err instanceof ApiError) {
    const body = err.body as { error?: { message?: string } } | null
    if (body?.error?.message) return body.error.message
  }
  return err instanceof Error ? err.message : fallback
}

export default function CallbacksPage() {
  const { isReady, token, enterpriseId } = useAuth()
  const router = useRouter()
  const [callbacks, setCallbacks] = useState<Callback[] | null>(null)
  const [leads, setLeads] = useState<Lead[]>([])
  const [dueOnly, setDueOnly] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [form, setForm] = useState({
    leadId: '',
    chip: '1h' as Chip,
    customDueAt: '',
    note: '',
  })

  const leadMap = useMemo(() => {
    const m = new Map<string, Lead>()
    for (const l of leads) m.set(l.id, l)
    return m
  }, [leads])

  const load = useCallback(async () => {
    if (!token || !enterpriseId) return
    try {
      const [cbData, leadData] = await Promise.all([
        api.get<unknown>(`/callbacks${dueOnly ? '?due=true' : ''}`),
        api.get<unknown>('/leads?limit=200').catch(() => ({ data: [] })),
      ])
      setCallbacks(asList<Callback>(cbData))
      setLeads(asList<Lead>(leadData))
    } catch {
      setCallbacks([])
    }
  }, [token, enterpriseId, dueOnly])

  useEffect(() => {
    if (!isReady) return
    if (!token || !enterpriseId) {
      router.replace('/login')
      return
    }
    load()
  }, [isReady, token, enterpriseId, router, load])

  function isOverdue(cb: Callback): boolean {
    if (cb.status !== 'pending') return false
    return new Date(cb.dueAt).getTime() <= Date.now()
  }

  const overdueCount = useMemo(
    () => (callbacks ?? []).filter((c) => isOverdue(c)).length,
    [callbacks],
  )

  async function onCreate(e: FormEvent) {
    e.preventDefault()
    if (!form.leadId) {
      toast.error('Select a lead')
      return
    }
    if (form.chip === 'custom' && !form.customDueAt) {
      toast.error('Pick a custom due time')
      return
    }
    const body: Record<string, string> = {
      leadId: form.leadId,
      quickChip: form.chip,
    }
    if (form.chip === 'custom') {
      body.customDueAt = new Date(form.customDueAt).toISOString()
    }
    if (form.note.trim()) body.note = form.note.trim()
    setBusy(true)
    try {
      await api.post('/callbacks', body)
      setCreateOpen(false)
      setForm({ leadId: '', chip: '1h', customDueAt: '', note: '' })
      toast.success('Callback scheduled')
      await load()
    } catch (err) {
      toast.error(errMsg(err, 'Failed to schedule callback'))
    } finally {
      setBusy(false)
    }
  }

  async function setStatus(cb: Callback, status: 'done' | 'cancelled') {
    try {
      await api.patch(`/callbacks/${cb.id}`, { status })
      toast.success(status === 'done' ? 'Callback marked done' : 'Callback cancelled')
      await load()
    } catch (err) {
      toast.error(errMsg(err, `Failed to ${status} callback`))
    }
  }

  if (!isReady || !token) return <LoadingScreen label="Checking session…" />

  return (
    <AppShell>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <div>
            <h2 className="text-base font-semibold tracking-tight">
              Follow-up Callbacks
            </h2>
            <p className="text-xs text-muted-foreground">
              {callbacks === null
                ? 'Loading…'
                : `${callbacks.length} pending${dueOnly ? ' (overdue)' : ''}`}
            </p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Button
              variant={dueOnly ? 'default' : 'outline'}
              size="sm"
              onClick={() => setDueOnly((v) => !v)}
            >
              <AlertTriangle className="size-3.5" />
              {dueOnly ? 'All pending' : 'Overdue only'}
              {overdueCount > 0 && !dueOnly && (
                <span className="ml-1 rounded-full bg-primary/20 px-1.5 text-[11px] font-semibold">
                  {overdueCount}
                </span>
              )}
            </Button>
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="size-4" /> Schedule
            </Button>
          </div>
        </div>

        {callbacks === null ? (
          <LoadingScreen label="Loading callbacks…" />
        ) : callbacks.length === 0 ? (
          <EmptyState
            title={dueOnly ? 'Nothing overdue' : 'No pending callbacks'}
            hint={
              dueOnly
                ? 'All scheduled callbacks are on time.'
                : 'Click “Schedule” to queue a follow-up for a lead.'
            }
          />
        ) : (
          <div className="rounded-lg border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Due</TableHead>
                  <TableHead>Lead</TableHead>
                  <TableHead>Channel</TableHead>
                  <TableHead>Note</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-24 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {callbacks.map((cb) => {
                  const overdue = isOverdue(cb)
                  const lead = cb.leadId ? leadMap.get(cb.leadId) : undefined
                  return (
                    <TableRow key={cb.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <CalendarClock
                            className={
                              overdue
                                ? 'size-3.5 text-destructive'
                                : 'size-3.5 text-muted-foreground'
                            }
                          />
                          <span
                            className={
                              overdue
                                ? 'font-medium text-destructive'
                                : 'text-foreground'
                            }
                          >
                            {formatDue(cb.dueAt)}
                          </span>
                          {overdue && (
                            <Badge variant="destructive">Overdue</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">
                        {lead?.name || lead?.phone || cb.leadId || '—'}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{cb.channel || 'in_app'}</Badge>
                      </TableCell>
                      <TableCell className="max-w-56">
                        <p
                          className="truncate text-muted-foreground"
                          title={cb.note ?? undefined}
                        >
                          {cb.note || '—'}
                        </p>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{cb.status}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            size="icon-sm"
                            variant="ghost"
                            aria-label="Mark done"
                            title="Mark done"
                            onClick={() => setStatus(cb, 'done')}
                          >
                            <Check className="size-3.5" />
                          </Button>
                          <Button
                            size="icon-sm"
                            variant="ghost"
                            aria-label="Cancel callback"
                            title="Cancel"
                            onClick={() => setStatus(cb, 'cancelled')}
                          >
                            <X className="size-3.5" />
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

      {/* Schedule */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Schedule Callback</DialogTitle>
            <DialogDescription>
              Queue a follow-up reminder for a lead.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={onCreate} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="cb-lead">Lead</Label>
              <select
                id="cb-lead"
                value={form.leadId}
                onChange={(e) => setForm({ ...form, leadId: e.target.value })}
                className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30 dark:[&>option]:bg-background"
              >
                <option value="">Select a lead…</option>
                {leads.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name || l.phone || l.email || l.id}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Due</Label>
              <div className="flex flex-wrap gap-2">
                {QUICK_CHIPS.map(({ key, label }) => (
                  <Button
                    key={key}
                    type="button"
                    size="sm"
                    variant={form.chip === key ? 'default' : 'outline'}
                    onClick={() => setForm({ ...form, chip: key })}
                  >
                    {label}
                  </Button>
                ))}
              </div>
              {form.chip === 'custom' && (
                <Input
                  type="datetime-local"
                  value={form.customDueAt}
                  onChange={(e) => setForm({ ...form, customDueAt: e.target.value })}
                  className="mt-1"
                />
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cb-note">Note</Label>
              <textarea
                id="cb-note"
                rows={3}
                placeholder="Follow up about the pricing quote…"
                className="w-full rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
                value={form.note}
                onChange={(e) => setForm({ ...form, note: e.target.value })}
              />
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
                Schedule
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </AppShell>
  )
}

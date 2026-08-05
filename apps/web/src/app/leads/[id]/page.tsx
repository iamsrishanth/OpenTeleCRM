'use client'

import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  ArrowLeft,
  GitBranch,
  Loader2,
  MessageCircle,
  Pencil,
  PhoneCall,
  StickyNote,
  UserCheck,
} from 'lucide-react'
import { toast } from 'sonner'
import { AppShell } from '@/components/app-shell'
import { EmptyState, LoadingScreen } from '@/components/loading'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
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
import { Separator } from '@/components/ui/separator'
import { api, ApiError } from '@/lib/api'
import { useAuth } from '@/lib/auth-context'
import type { Lead, Metadata } from '@/lib/types'

function formatDateTime(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return Number.isNaN(d.getTime())
    ? '—'
    : d.toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
}

/** Surface the API error message when the envelope carries one. */
function errMsg(err: unknown): string {
  if (err instanceof ApiError) {
    const body = err.body as
      | { error?: { message?: string } }
      | string
      | null
    if (body && typeof body === 'object' && body.error?.message) {
      return body.error.message
    }
    if (typeof body === 'string' && body) return body
  }
  return err instanceof Error ? err.message : 'Something went wrong'
}

function shortId(id: string): string {
  return id.length > 8 ? `${id.slice(0, 8)}…` : id
}

/** Lead's phone, from top-level or custom fields. */
function leadPhone(lead: Lead): string | null {
  if (lead.phone) return lead.phone
  const cf = lead.customFields
  if (cf && typeof cf === 'object') {
    const v = (cf as Record<string, unknown>)['phone']
    if (typeof v === 'string' && v) return v
  }
  return null
}

const PHONE_RE = /^\+?[0-9][0-9\s().-]{6,}$/

/** Build a WhatsApp JID from the lead's phone; fall back to the identifier. */
function buildContactJid(lead: Lead): string | null {
  const phone = leadPhone(lead)
  const identifier = (lead as Lead & { identifier?: string | null })
    .identifier
  const raw = phone ?? identifier ?? null
  if (!raw) return null
  const trimmed = raw.trim()
  if (PHONE_RE.test(trimmed)) {
    const digits = trimmed.replace(/\D/g, '')
    return digits ? `${digits}@s.whatsapp.net` : trimmed
  }
  return trimmed
}

export default function LeadDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { isReady, token, enterpriseId } = useAuth()
  const router = useRouter()
  const [lead, setLead] = useState<Lead | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [meta, setMeta] = useState<Metadata | null>(null)
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [form, setForm] = useState({ name: '', phone: '', email: '' })

  // Action bar state
  const [busyAction, setBusyAction] = useState<string | null>(null)
  const [noteOpen, setNoteOpen] = useState(false)
  const [noteText, setNoteText] = useState('')
  const [waOpen, setWaOpen] = useState(false)
  const [waText, setWaText] = useState('')
  const [callOpen, setCallOpen] = useState(false)
  const [callDuration, setCallDuration] = useState('')
  const [callNote, setCallNote] = useState('')

  const load = useCallback(async () => {
    if (!token || !enterpriseId || !id) return
    try {
      const [leadData, metaData] = await Promise.all([
        api.get<Lead>(`/lead/${id}`),
        api.get<Metadata>('/metadata').catch(() => null),
      ])
      setLead(leadData)
      setMeta(metaData)
      setForm({
        name: leadData.name ?? '',
        phone: leadData.phone ?? '',
        email: leadData.email ?? '',
      })
    } catch (err) {
      if (err instanceof Error && 'status' in err && (err as { status: number }).status === 404) {
        setNotFound(true)
      } else {
        setLead(null)
        setNotFound(true)
      }
    }
  }, [token, enterpriseId, id])

  useEffect(() => {
    if (!isReady) return
    if (!token || !enterpriseId) {
      router.replace('/login')
      return
    }
    load()
  }, [isReady, token, enterpriseId, router, load])

  async function onSave(e: FormEvent) {
    e.preventDefault()
    if (!id) return
    setBusy(true)
    try {
      await api.put<Lead>(`/lead/${id}`, {
        name: form.name.trim() || null,
        phone: form.phone.trim() || null,
        email: form.email.trim() || null,
      })
      setOpen(false)
      toast.success('Lead updated')
      await load()
    } catch (err) {
      toast.error(errMsg(err))
    } finally {
      setBusy(false)
    }
  }

  // --- Action bar handlers -------------------------------------------------

  async function onAddNote() {
    const text = noteText.trim()
    if (!text) {
      toast.error('Note text is required')
      return
    }
    if (!id) return
    setBusyAction('note')
    try {
      const res = await api.post<{
        data: Array<{ actionId: string; status: string; remarks?: string[] }>
      }>(`/lead/${id}/action`, {
        actions: [{ type: 'note', note: text }],
      })
      const item = res.data?.[0]
      if (item?.status === 'CREATED') {
        toast.success('Note added')
        setNoteOpen(false)
        setNoteText('')
      } else {
        toast.warning(
          item?.status === 'IGNORED'
            ? 'Note action was ignored by the server'
            : 'Note action was rejected',
        )
      }
    } catch (err) {
      toast.error(errMsg(err))
    } finally {
      setBusyAction(null)
    }
  }

  async function onChangeStage(stageId: string) {
    if (!id || !stageId || !lead || stageId === lead.stageId) return
    setBusyAction('stage')
    try {
      await api.put<{ status: string }>(`/lead/${id}`, { stageId })
      toast.success('Stage updated')
      await load()
    } catch (err) {
      toast.error(errMsg(err))
    } finally {
      setBusyAction(null)
    }
  }

  async function onAssign() {
    if (!id) return
    setBusyAction('assign')
    try {
      const res = await api.post<{
        assignedTeamMemberId: string | null
        userId: string | null
        reason: string
      }>(`/lead/${id}/distribute`, {})
      if (res.assignedTeamMemberId) {
        toast.success(
          `Lead assigned to member ${shortId(res.assignedTeamMemberId)}`,
        )
        await load()
      } else {
        toast.warning(`No team member available (${res.reason})`)
      }
    } catch (err) {
      toast.error(errMsg(err))
    } finally {
      setBusyAction(null)
    }
  }

  async function onSendWhatsApp() {
    const text = waText.trim()
    if (!text) {
      toast.error('Message text is required')
      return
    }
    if (!lead) return
    const contactJid = buildContactJid(lead)
    if (!contactJid) {
      toast.error('Lead has no phone or identifier to message')
      return
    }
    setBusyAction('whatsapp')
    try {
      await api.post<{ success: boolean; messageId?: string }>(
        '/whatsapp/send',
        { contactJid, text },
      )
      toast.success('Message sent')
      setWaOpen(false)
      setWaText('')
    } catch (err) {
      toast.error(errMsg(err))
    } finally {
      setBusyAction(null)
    }
  }

  async function onLogCall() {
    if (!lead) return
    const phone = leadPhone(lead) ?? ''
    if (!phone.trim()) {
      toast.error('Lead has no phone to log a call against')
      return
    }
    setBusyAction('call')
    const durationSec = Math.max(0, Number(callDuration) || 0)
    try {
      await api.post('/calls', {
        leadId: id,
        phone: phone.trim(),
        direction: 'outbound',
        status: 'completed',
        disposition: 'answered',
        durationSec,
        note: callNote.trim() || null,
      })
      toast.success('Call logged')
      setCallOpen(false)
      setCallDuration('')
      setCallNote('')
    } catch (err) {
      toast.error(errMsg(err))
    } finally {
      setBusyAction(null)
    }
  }

  // --- Derived -------------------------------------------------------------

  const pipeline = meta?.pipelines.find((p) => p.id === lead?.pipelineId)
  const stage = pipeline?.stages.find((s) => s.id === lead?.stageId)
  // Stages from the lead's pipeline, or all pipelines when it has none.
  const stageOptions: Array<{ stageId: string; label: string }> = pipeline
    ? pipeline.stages.map((s) => ({ stageId: s.id, label: s.name }))
    : (meta?.pipelines ?? []).flatMap((p) =>
        p.stages.map((s) => ({
          stageId: s.id,
          label: `${p.name} / ${s.name}`,
        })),
      )
  const waJid = lead ? buildContactJid(lead) : null
  const actionDisabled = busyAction !== null

  if (!isReady || !token) return <LoadingScreen label="Checking session…" />

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl space-y-4">
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.back()}
          >
            <ArrowLeft className="size-4" /> Back
          </Button>
          <h2 className="text-lg font-semibold">
            {lead ? lead.name || 'Unnamed lead' : 'Lead'}
          </h2>
          {lead ? (
            <Button
              className="ml-auto"
              size="sm"
              onClick={() => setOpen(true)}
            >
              <Pencil className="size-3.5" /> Edit
            </Button>
          ) : null}
        </div>

        {notFound ? (
          <EmptyState
            title="Lead not found"
            hint="It may have been deleted, or the ID is wrong."
          />
        ) : lead === null ? (
          <LoadingScreen label="Loading lead…" />
        ) : (
          <>
            {/* Action bar */}
            <Card>
              <CardContent className="flex flex-wrap items-center gap-2 pt-6">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setNoteOpen(true)}
                  disabled={actionDisabled}
                >
                  <StickyNote className="size-3.5" /> Add Note
                </Button>
                <div className="flex items-center gap-1.5">
                  <GitBranch className="size-3.5 text-muted-foreground" />
                  <select
                    value={lead.stageId ?? ''}
                    onChange={(e) => {
                      if (e.target.value) void onChangeStage(e.target.value)
                    }}
                    disabled={actionDisabled}
                    aria-label="Change stage"
                    className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 dark:bg-input/30"
                  >
                    <option value="" disabled>
                      Change stage…
                    </option>
                    {stageOptions.length === 0 ? (
                      <option value="" disabled>
                        No stages configured
                      </option>
                    ) : (
                      stageOptions.map((opt) => (
                        <option key={opt.stageId} value={opt.stageId}>
                          {opt.label}
                        </option>
                      ))
                    )}
                  </select>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onAssign}
                  disabled={actionDisabled}
                >
                  {busyAction === 'assign' ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <UserCheck className="size-3.5" />
                  )}
                  Assign
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setWaOpen(true)}
                  disabled={actionDisabled || !waJid}
                >
                  <MessageCircle className="size-3.5" /> WhatsApp
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCallOpen(true)}
                  disabled={actionDisabled}
                >
                  <PhoneCall className="size-3.5" /> Log Call
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Lead details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Field label="Name" value={lead.name} />
                  <Field label="Phone" value={lead.phone ?? leadPhone(lead)} />
                  <Field label="Email" value={lead.email} />
                  <Field
                    label="Pipeline / Stage"
                    value={
                      pipeline
                        ? stage
                          ? `${pipeline.name} / ${stage.name}`
                          : pipeline.name
                        : null
                    }
                    fallback={
                      lead.pipelineId
                        ? `${lead.pipelineId} / ${lead.stageId ?? '—'}`
                        : '—'
                    }
                  />
                  <Field
                    label="Created"
                    value={formatDateTime(lead.createdAt)}
                  />
                  <Field
                    label="Updated"
                    value={formatDateTime(lead.updatedAt)}
                  />
                </div>

                {lead.customFields &&
                  Object.keys(lead.customFields).length > 0 && (
                    <>
                      <Separator />
                      <div>
                        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          Custom fields
                        </p>
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                          {Object.entries(lead.customFields).map(
                            ([key, value]) => {
                              const def = meta?.customFields.find(
                                (f) => f.apiName === key || f.id === key,
                              )
                              return (
                                <Field
                                  key={key}
                                  label={def?.label ?? key}
                                  value={
                                    value === null || value === undefined
                                      ? null
                                      : String(value)
                                  }
                                />
                              )
                            },
                          )}
                        </div>
                      </div>
                    </>
                  )}

                <Separator />
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <Badge variant="secondary">ID: {lead.id}</Badge>
                  <Badge variant="secondary">
                    Enterprise: {lead.enterpriseId}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Lead</DialogTitle>
            <DialogDescription>Update the lead&apos;s details.</DialogDescription>
          </DialogHeader>
          <form onSubmit={onSave} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="edit-name">Name</Label>
              <Input
                id="edit-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-phone">Phone</Label>
              <Input
                id="edit-phone"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-email">Email</Label>
              <Input
                id="edit-email"
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={busy}>
                {busy && <Loader2 className="size-4 animate-spin" />}
                Save changes
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Add note */}
      <Dialog open={noteOpen} onOpenChange={setNoteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Note</DialogTitle>
            <DialogDescription>
              Attach a note to this lead&apos;s timeline.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="note-text">Note</Label>
              <textarea
                id="note-text"
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                rows={4}
                placeholder="What happened with this lead?"
                className="flex min-h-20 w-full rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setNoteOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={onAddNote}
                disabled={busyAction === 'note' || !noteText.trim()}
              >
                {busyAction === 'note' && (
                  <Loader2 className="size-4 animate-spin" />
                )}
                Save note
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* Send WhatsApp */}
      <Dialog open={waOpen} onOpenChange={setWaOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send WhatsApp</DialogTitle>
            <DialogDescription>
              Send a message to this lead.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-xs text-muted-foreground">
              To: <span className="font-medium text-foreground">{waJid ?? '—'}</span>
            </p>
            <div className="space-y-1.5">
              <Label htmlFor="wa-text">Message</Label>
              <textarea
                id="wa-text"
                value={waText}
                onChange={(e) => setWaText(e.target.value)}
                rows={4}
                placeholder="Type your message…"
                className="flex min-h-20 w-full rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setWaOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={onSendWhatsApp}
                disabled={busyAction === 'whatsapp' || !waText.trim() || !waJid}
              >
                {busyAction === 'whatsapp' && (
                  <Loader2 className="size-4 animate-spin" />
                )}
                Send
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* Log call */}
      <Dialog open={callOpen} onOpenChange={setCallOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Log Call</DialogTitle>
            <DialogDescription>
              Record an outbound call to this lead.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="call-direction">Direction</Label>
                <Input id="call-direction" value="Outbound" disabled readOnly />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="call-status">Status</Label>
                <Input id="call-status" value="Completed" disabled readOnly />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="call-duration">Duration (seconds)</Label>
                <Input
                  id="call-duration"
                  type="number"
                  min={0}
                  placeholder="0"
                  value={callDuration}
                  onChange={(e) => setCallDuration(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="call-note">Note</Label>
              <textarea
                id="call-note"
                value={callNote}
                onChange={(e) => setCallNote(e.target.value)}
                rows={3}
                placeholder="Outcome of the call…"
                className="flex min-h-16 w-full rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setCallOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={onLogCall}
                disabled={busyAction === 'call'}
              >
                {busyAction === 'call' && (
                  <Loader2 className="size-4 animate-spin" />
                )}
                Log call
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </AppShell>
  )
}

function Field({
  label,
  value,
  fallback = '—',
}: {
  label: string
  value: string | null
  fallback?: string
}) {
  return (
    <div className="space-y-0.5">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="break-words text-sm">{value ?? fallback}</p>
    </div>
  )
}

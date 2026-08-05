'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  Clock,
  History,
  Loader2,
  PhoneCall,
  PhoneOff,
  RefreshCw,
  SkipForward,
  TrendingUp,
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
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
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
import { asList, type DialerCandidate } from '@/lib/types'

/** Serialized call row returned by GET /calls and POST /calls. */
interface CallRecord {
  id: string
  leadId: string | null
  direction: string
  status: string
  disposition: string | null
  phone: string | null
  startedAt: string | null
  endedAt: string | null
  durationSec: number
  talkSec: number
  ringSec: number
  trunk: string | null
  did: string | null
  recordingId: string | null
  note: string | null
  createdAt: string
}

type CallPhase = 'idle' | 'dialing' | 'live' | 'ending' | 'wrapped'

/**
 * Extended candidate shape — /dialer/next returns more fields than the
 * shared DialerCandidate type declares. Kept local; do not edit shared types.
 */
interface DialerCandidateEnriched extends DialerCandidate {
  phone?: string | null
  slaBreachRisk?: number
  followUpDueAt?: string | null
  leadScore?: number
  freshnessHours?: number
  lastDialedAt?: string | null
}

const DISPOSITION_LABELS: Record<string, string> = {
  answered: 'Answered',
  no_answer: 'No answer',
  busy: 'Busy',
  not_connected: 'Not connected',
  wrong_number: 'Wrong number',
  not_interested: 'Not interested',
  callback: 'Callback',
  dnc: 'DNC',
  converted: 'Converted',
  follow_up: 'Follow up',
  other: 'Other',
}

const DISPOSITIONS = Object.keys(DISPOSITION_LABELS)

const CALLBACK_OPTIONS = [
  { value: '1h', label: 'In 1 hour' },
  { value: '3h', label: 'In 3 hours' },
  { value: 'tomorrow_10am', label: 'Tomorrow 10 AM' },
  { value: 'custom', label: 'Custom time…' },
] as const

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function formatDateTime(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

function humanize(s: string | null): string {
  if (!s) return '—'
  return s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

function statusVariant(
  status: string,
): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (status === 'completed') return 'default'
  if (['in-progress', 'ringing', 'queued'].includes(status)) return 'secondary'
  if (['failed', 'missed', 'rejected'].includes(status)) return 'destructive'
  return 'outline'
}

export default function DialerPage() {
  const { isReady, token, enterpriseId } = useAuth()
  const router = useRouter()

  const [candidate, setCandidate] = useState<DialerCandidateEnriched | null>(
    null,
  )
  const [loadingNext, setLoadingNext] = useState(false)

  const [phase, setPhase] = useState<CallPhase>('idle')
  const [elapsed, setElapsed] = useState(0)
  const callStartedAtRef = useRef(0)

  const [disposition, setDisposition] = useState<string | null>(null)
  const [callbackIn, setCallbackIn] = useState<string | null>(null)
  const [callbackAt, setCallbackAt] = useState('')
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [skipping, setSkipping] = useState(false)

  const [calls, setCalls] = useState<CallRecord[] | null>(null)

  const resetWrapUp = useCallback(() => {
    setDisposition(null)
    setCallbackIn(null)
    setCallbackAt('')
    setNote('')
    setPhase('idle')
    setElapsed(0)
  }, [])

  const loadCalls = useCallback(async () => {
    if (!token || !enterpriseId) return
    try {
      const data = await api.get<unknown>('/calls?limit=10')
      setCalls(asList<CallRecord>(data))
    } catch {
      setCalls([])
    }
  }, [token, enterpriseId])

  const getNext = useCallback(async () => {
    if (!token || !enterpriseId) return
    setLoadingNext(true)
    try {
      const data = await api.post<unknown>('/dialer/next', {
        mode: 'preview',
        limit: 1,
      })
      const candidates = asList<DialerCandidateEnriched>(data)
      setCandidate(candidates[0] ?? null)
      resetWrapUp()
      if (!candidates[0]) {
        toast.info('Queue empty — no leads to dial right now')
      }
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Failed to fetch next lead',
      )
    } finally {
      setLoadingNext(false)
    }
  }, [token, enterpriseId, resetWrapUp])

  useEffect(() => {
    if (!isReady) return
    if (!token || !enterpriseId) {
      router.replace('/login')
      return
    }
    loadCalls()
  }, [isReady, token, enterpriseId, router, loadCalls])

  // In-call timer.
  useEffect(() => {
    if (phase !== 'live') return
    const t = setInterval(() => {
      setElapsed(Math.floor((Date.now() - callStartedAtRef.current) / 1000))
    }, 1000)
    return () => clearInterval(t)
  }, [phase])

  async function startCall() {
    if (!candidate) return
    setPhase('dialing')
    try {
      // Live media is handled by Asterisk — this logs the outbound leg so the
      // call shows up in history and feeds dialer scoring (callsToday).
      await api.post('/calls', {
        leadId: candidate.leadId,
        phone: candidate.phone || candidate.identifier,
        direction: 'outbound',
        status: 'in-progress',
      })
      callStartedAtRef.current = Date.now()
      setElapsed(0)
      setPhase('live')
      toast.success('Call placed — audio handled by the PBX')
      await loadCalls()
    } catch (err) {
      setPhase('idle')
      toast.error(err instanceof Error ? err.message : 'Failed to place call')
    }
  }

  async function endCall() {
    if (!candidate) return
    setPhase('ending')
    try {
      const durationSec = Math.max(
        1,
        Math.floor((Date.now() - callStartedAtRef.current) / 1000),
      )
      await api.post('/calls', {
        leadId: candidate.leadId,
        phone: candidate.phone || candidate.identifier,
        direction: 'outbound',
        status: 'completed',
        durationSec,
        talkSec: durationSec,
      })
      setPhase('wrapped')
      setElapsed(durationSec)
      toast.success('Call completed — pick a disposition')
      await loadCalls()
    } catch (err) {
      setPhase('live')
      toast.error(
        err instanceof Error ? err.message : 'Failed to complete call',
      )
    }
  }

  async function submitDisposition() {
    if (!candidate || !disposition) return
    if (
      (disposition === 'callback' || disposition === 'follow_up') &&
      callbackIn === 'custom' &&
      !callbackAt
    ) {
      toast.error('Pick a callback time')
      return
    }
    setSubmitting(true)
    try {
      const body: Record<string, unknown> = {
        disposition,
        durationSec: phase === 'wrapped' ? elapsed : 0,
        talkSec: phase === 'wrapped' ? elapsed : 0,
      }
      if (note.trim()) body.note = note.trim()
      if (callbackIn === 'custom') {
        body.callbackAt = new Date(callbackAt).toISOString()
      } else if (callbackIn) {
        body.callbackIn = callbackIn
      }
      const res = await api.post<{ callId?: string; callbackId?: string }>(
        `/dialer/${candidate.leadId}/disposition`,
        body,
      )
      const label = DISPOSITION_LABELS[disposition] ?? disposition
      const parts = [`Disposition saved — ${label}`]
      if (res?.callbackId) parts.push('callback scheduled')
      toast.success(parts.join(' · '))
      setCandidate(null)
      resetWrapUp()
      await loadCalls()
      await getNext()
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Failed to save disposition',
      )
    } finally {
      setSubmitting(false)
    }
  }

  async function skip() {
    if (!candidate) return
    setSkipping(true)
    try {
      await api.post(`/dialer/${candidate.leadId}/skip`)
      toast.success('Lead skipped')
      setCandidate(null)
      resetWrapUp()
      await getNext()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to skip lead')
    } finally {
      setSkipping(false)
    }
  }

  const phone = candidate ? candidate.phone || candidate.identifier : null
  const wrapUpLocked = phase !== 'wrapped'
  const needsCallback =
    disposition === 'callback' || disposition === 'follow_up'

  if (!isReady || !token) return <LoadingScreen label="Checking session…" />

  return (
    <AppShell>
      <div className="space-y-4">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-3">
          <Button
            onClick={getNext}
            disabled={loadingNext || phase === 'live'}
          >
            {loadingNext ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <RefreshCw className="size-4" />
            )}
            Get next lead
          </Button>
          <p className="text-xs text-muted-foreground">
            Smart queue · preview mode · highest score dials first
          </p>
        </div>

        {/* Candidate */}
        {candidate ? (
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="size-4 text-primary" />
                    {candidate.name || 'Unnamed lead'}
                  </CardTitle>
                  <CardDescription className="mt-1 font-mono">
                    {phone}
                  </CardDescription>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge>Score {Math.round(candidate.score)}</Badge>
                  {candidate.slaBreachRisk !== undefined &&
                    candidate.slaBreachRisk > 0 && (
                      <Badge variant="destructive">
                        <AlertTriangle className="size-3" />
                        SLA risk{' '}
                        {Math.round((candidate.slaBreachRisk ?? 0) * 100)}%
                      </Badge>
                    )}
                  {candidate.followUpDueAt && (
                    <Badge variant="secondary">
                      <CalendarClock className="size-3" />
                      Follow-up due {formatDate(candidate.followUpDueAt ?? null)}
                    </Badge>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="mb-2 text-xs font-medium text-muted-foreground">
                  Why this lead
                </p>
                <ul className="space-y-1.5">
                  {candidate.reasons.length === 0 ? (
                    <li className="text-sm text-muted-foreground">
                      No priority signals.
                    </li>
                  ) : (
                    candidate.reasons.map((r) => (
                      <li
                        key={r}
                        className="flex items-center gap-2 text-sm"
                      >
                        <Zap className="size-3.5 shrink-0 text-primary" />
                        {r}
                      </li>
                    ))
                  )}
                </ul>
              </div>
              <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <TrendingUp className="size-3.5" />
                  Lead score {candidate.leadScore ?? 0}
                </span>
                <span className="flex items-center gap-1.5">
                  <Clock className="size-3.5" />
                  {(candidate.freshnessHours ?? 0).toFixed(1)}h old
                </span>
                <span className="flex items-center gap-1.5">
                  <History className="size-3.5" />
                  Last dialed {formatDate(candidate.lastDialedAt ?? null)}
                </span>
              </div>
            </CardContent>
            <CardFooter className="flex flex-wrap items-center justify-between gap-3">
              {phase === 'live' ? (
                <>
                  <span className="flex items-center gap-2 text-sm font-medium">
                    <span className="size-2 animate-pulse rounded-full bg-destructive" />
                    Live · {formatDuration(elapsed)}
                  </span>
                  <Button
                    variant="destructive"
                    onClick={endCall}
                  >
                    <PhoneOff className="size-4" />
                    Complete call
                  </Button>
                </>
              ) : (
                <>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      onClick={startCall}
                      disabled={phase === 'dialing' || phase === 'ending'}
                    >
                      {phase === 'dialing' ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <PhoneCall className="size-4" />
                      )}
                      Call
                    </Button>
                    <Button
                      variant="outline"
                      onClick={skip}
                      disabled={skipping || phase === 'dialing'}
                    >
                      {skipping ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <SkipForward className="size-4" />
                      )}
                      Skip
                    </Button>
                  </div>
                  {phase === 'wrapped' && (
                    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <CheckCircle2 className="size-3.5 text-primary" />
                      Call logged — wrap up below
                    </span>
                  )}
                </>
              )}
            </CardFooter>
          </Card>
        ) : (
          <EmptyState
            title="No lead in queue"
            hint="Click “Get next lead” to pull the top-scoring candidate."
          />
        )}

        {/* Disposition wrap-up */}
        {candidate && (
          <Card size="sm">
            <CardHeader>
              <CardTitle className="text-sm">Disposition</CardTitle>
              <CardDescription>
                {wrapUpLocked
                  ? 'Place and complete a call to unlock wrap-up.'
                  : 'How did the call go? Logging a disposition also records the outcome.'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                {DISPOSITIONS.map((d) => {
                  const active = disposition === d
                  return (
                    <Button
                      key={d}
                      type="button"
                      variant={active ? 'default' : 'outline'}
                      size="sm"
                      disabled={wrapUpLocked}
                      onClick={() => {
                        setDisposition(active ? null : d)
                        if (!active) {
                          setCallbackIn(null)
                          setCallbackAt('')
                        }
                      }}
                      className="justify-start"
                    >
                      {DISPOSITION_LABELS[d]}
                    </Button>
                  )
                })}
              </div>

              {needsCallback && (
                <div className="flex flex-wrap items-end gap-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="dialer-callback">
                      Schedule callback
                    </Label>
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={wrapUpLocked}
                            className="justify-between"
                          >
                            {callbackIn
                              ? (CALLBACK_OPTIONS.find(
                                  (o) => o.value === callbackIn,
                                )?.label ?? callbackIn)
                              : 'Pick a time'}
                            <ChevronDown className="size-3.5" />
                          </Button>
                        }
                      />
                      <DropdownMenuContent align="start">
                        <DropdownMenuLabel>Callback time</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        {CALLBACK_OPTIONS.map((o) => (
                          <DropdownMenuItem
                            key={o.value}
                            onClick={() => setCallbackIn(o.value)}
                          >
                            {o.label}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  {callbackIn === 'custom' && (
                    <div className="space-y-1.5">
                      <Label htmlFor="dialer-callback-at">
                        Custom time
                      </Label>
                      <Input
                        id="dialer-callback-at"
                        type="datetime-local"
                        value={callbackAt}
                        onChange={(e) => setCallbackAt(e.target.value)}
                        disabled={wrapUpLocked}
                        className="w-56"
                      />
                    </div>
                  )}
                </div>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="dialer-note">Note</Label>
                <textarea
                  id="dialer-note"
                  placeholder="Optional note for this interaction…"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  disabled={wrapUpLocked}
                  className="min-h-20 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50"
                />
              </div>
            </CardContent>
            <CardFooter className="justify-end">
              <Button
                onClick={submitDisposition}
                disabled={!disposition || wrapUpLocked || submitting}
              >
                {submitting ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="size-4" />
                )}
                Save disposition
              </Button>
            </CardFooter>
          </Card>
        )}

        {/* Call history */}
        <Card size="sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <History className="size-4 text-muted-foreground" />
              Call history
            </CardTitle>
          </CardHeader>
          <CardContent>
            {calls === null ? (
              <LoadingScreen label="Loading calls…" />
            ) : calls.length === 0 ? (
              <EmptyState
                title="No calls yet"
                hint="Calls placed from the dialer will show up here."
              />
            ) : (
              <div className="rounded-lg border border-border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>When</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Disposition</TableHead>
                      <TableHead className="text-right">Duration</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {calls.map((c) => (
                      <TableRow key={c.id}>
                        <TableCell className="text-muted-foreground">
                          {formatDateTime(c.startedAt ?? c.createdAt)}
                        </TableCell>
                        <TableCell className="font-mono text-muted-foreground">
                          {c.phone || '—'}
                        </TableCell>
                        <TableCell>
                          <Badge variant={statusVariant(c.status)}>
                            {humanize(c.status)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {humanize(c.disposition)}
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {c.durationSec > 0
                            ? formatDuration(c.durationSec)
                            : '—'}
                        </TableCell>
                      </TableRow>
                    ))}
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

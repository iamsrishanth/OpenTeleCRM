'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Clock, Loader2, LogIn, LogOut, Users } from 'lucide-react'
import { toast } from 'sonner'
import { AppShell } from '@/components/app-shell'
import { EmptyState, LoadingScreen } from '@/components/loading'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
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
import { useRole } from '@/lib/roles'
import {
  asList,
  type AttendanceRecord,
  type EodComplianceRow,
} from '@/lib/types'

function todayStr(): string {
  const d = new Date()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${mm}-${dd}`
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function formatTime(iso?: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
}

function errMsg(err: unknown, fallback: string): string {
  if (err instanceof ApiError) {
    const body = err.body as { error?: { message?: string } } | null
    if (body?.error?.message) return body.error.message
  }
  return err instanceof Error ? err.message : fallback
}

function statusVariant(
  status: string,
): 'default' | 'secondary' | 'destructive' | 'outline' {
  const s = status.toLowerCase()
  if (s.includes('absent') || s.includes('miss') || s.includes('late')) {
    return 'destructive'
  }
  if (s.includes('out') || s.includes('complete') || s === 'present') {
    return 'default'
  }
  if (s.includes('in') || s === 'active') {
    return 'secondary'
  }
  return 'outline'
}

export default function AttendancePage() {
  const { isReady, token, enterpriseId } = useAuth()
  const router = useRouter()
  const { isAdmin, ready: roleReady } = useRole()
  const [records, setRecords] = useState<AttendanceRecord[] | null>(null)
  const [team, setTeam] = useState<EodComplianceRow[]>([])
  const [busy, setBusy] = useState<'in' | 'out' | null>(null)

  const load = useCallback(async () => {
    if (!token || !enterpriseId) return
    try {
      const [attData, teamData] = await Promise.all([
        api.get<unknown>('/attendance'),
        isAdmin
          ? api
              .get<unknown>(`/eod/admin?date=${todayStr()}`)
              .catch(() => ({ data: [] }))
          : Promise.resolve({ data: [] }),
      ])
      setRecords(asList<AttendanceRecord>(attData))
      setTeam(asList<EodComplianceRow>(teamData))
    } catch {
      setRecords([])
    }
  }, [token, enterpriseId, isAdmin])

  useEffect(() => {
    if (!isReady) return
    if (!token || !enterpriseId) {
      router.replace('/login')
      return
    }
    load()
  }, [isReady, token, enterpriseId, router, load])

  // Today's record if present, otherwise fall back to the latest record.
  const todayRecord = useMemo(() => {
    if (!records) return undefined
    const t = todayStr()
    return records.find((r) => r.workDate === t) ?? records[0]
  }, [records])

  const isToday = todayRecord?.workDate === todayStr()
  const checkedIn = Boolean(todayRecord?.checkInAt)
  const checkedOut = Boolean(todayRecord?.checkOutAt)

  async function onCheckIn() {
    setBusy('in')
    try {
      const res = await api.post<{ checkInAt?: string }>(
        '/attendance/check-in',
        {},
      )
      toast.success(`Checked in at ${formatTime(res.checkInAt)}`)
      await load()
    } catch (err) {
      toast.error(errMsg(err, 'Check-in failed'))
    } finally {
      setBusy(null)
    }
  }

  async function onCheckOut() {
    setBusy('out')
    try {
      const res = await api.post<{
        checkOutAt?: string
        totalHours?: string | null
      }>('/attendance/check-out', {})
      toast.success(
        res.totalHours
          ? `Checked out — ${res.totalHours}h today`
          : 'Checked out',
      )
      await load()
    } catch (err) {
      toast.error(errMsg(err, 'Check-out failed'))
    } finally {
      setBusy(null)
    }
  }

  const submittedCount = team.filter((r) => r.submitted).length

  if (!isReady || !token) return <LoadingScreen label="Checking session…" />

  return (
    <AppShell>
      <div className="space-y-4">
        <div>
          <h2 className="text-base font-semibold tracking-tight">Attendance</h2>
          <p className="text-xs text-muted-foreground">
            {records === null
              ? 'Loading…'
              : `${records.length} record${records.length === 1 ? '' : 's'} on file`}
          </p>
        </div>

        {/* Today status banner */}
        <div className="flex flex-wrap items-center gap-4 rounded-lg border border-border bg-card p-4">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Clock className="size-5" />
            </div>
            <div>
              <p className="flex items-center gap-2 text-sm font-semibold">
                {checkedOut
                  ? 'Checked out'
                  : checkedIn
                    ? 'Checked in'
                    : 'Not checked in yet'}
                {todayRecord && !isToday && (
                  <span className="text-xs font-normal text-muted-foreground">
                    (last record)
                  </span>
                )}
              </p>
              <p className="text-xs text-muted-foreground">
                {checkedOut
                  ? `In ${formatTime(todayRecord?.checkInAt)} · Out ${formatTime(
                      todayRecord?.checkOutAt,
                    )}${todayRecord?.totalHours ? ` · ${todayRecord.totalHours}h` : ''}`
                  : checkedIn
                    ? `Since ${formatTime(todayRecord?.checkInAt)}`
                    : todayStr()}
              </p>
            </div>
          </div>
          <div className="ml-auto flex items-center gap-2">
            {!checkedIn && (
              <Button disabled={busy !== null} onClick={onCheckIn}>
                {busy === 'in' ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <LogIn className="size-4" />
                )}
                Check in
              </Button>
            )}
            {checkedIn && !checkedOut && (
              <Button
                variant="outline"
                disabled={busy !== null}
                onClick={onCheckOut}
              >
                {busy === 'out' ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <LogOut className="size-4" />
                )}
                Check out
              </Button>
            )}
            {checkedIn && checkedOut && (
              <Badge variant="default">
                <Check className="size-3.5" /> Day complete
              </Badge>
            )}
          </div>
        </div>

        {/* History */}
        <div className="space-y-2">
          <h3 className="text-sm font-semibold tracking-tight">History</h3>
          {records === null ? (
            <LoadingScreen label="Loading attendance…" />
          ) : records.length === 0 ? (
            <EmptyState
              title="No attendance records yet"
              hint="Check in to start your first record."
            />
          ) : (
            <div className="rounded-lg border border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Check-in</TableHead>
                    <TableHead>Check-out</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-24">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {records.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium whitespace-nowrap">
                        {formatDate(r.workDate)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {formatTime(r.checkInAt)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {formatTime(r.checkOutAt)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusVariant(r.status)}>
                          {r.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {r.totalHours ? `${r.totalHours}h` : '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>

        {/* Admin team view */}
        {roleReady && isAdmin && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Users className="size-4 text-muted-foreground" />
              <h3 className="text-sm font-semibold tracking-tight">
                Team today
              </h3>
              <span className="text-xs text-muted-foreground">
                {team.length > 0
                  ? `${submittedCount} submitted · ${
                      team.length - submittedCount
                    } missed`
                  : 'Loading…'}
              </span>
            </div>
            {team.length === 0 ? (
              <EmptyState
                title="No team data yet"
                hint="EOD compliance for today will appear here once members submit."
              />
            ) : (
              <div className="rounded-lg border border-border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Member</TableHead>
                      <TableHead className="w-32">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {team.map((row) => (
                      <TableRow key={row.memberId}>
                        <TableCell className="font-medium">
                          {row.name || row.memberId}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={row.submitted ? 'default' : 'destructive'}
                          >
                            {row.submitted
                              ? 'Submitted'
                              : row.status || 'Missed'}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        )}
      </div>
    </AppShell>
  )
}

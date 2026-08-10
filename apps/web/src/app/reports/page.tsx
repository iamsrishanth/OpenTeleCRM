'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  BarChart3,
  ChevronLeft,
  ChevronRight,
  Download,
  Loader2,
  Users,
} from 'lucide-react'
import { toast } from 'sonner'
import { AppShell } from '@/components/app-shell'
import { EmptyState, LoadingScreen } from '@/components/loading'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
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
import { useRole } from '@/lib/roles'
import { getApiBase } from '@/lib/config'
import { asList, type WeeklyReportItem } from '@/lib/types'

interface AdminWeeklyRow {
  id: string
  memberId: string
  name: string
  weekStart: string
  weekEnd: string
  daysPresent: number
  eodSubmitted: number
  tasksCompleted: number
  metricTotals: Record<string, number>
  employeeNote?: string | null
}

function errMsg(err: unknown, fallback: string): string {
  if (err instanceof ApiError) {
    const body = err.body as { error?: { message?: string } } | null
    if (body?.error?.message) return body.error.message
  }
  return err instanceof Error ? err.message : fallback
}

/** Format a 'YYYY-MM-DD' (or ISO) value using local time so date-only strings don't shift a day. */
function formatDay(d: string | null | undefined): string {
  if (!d) return '—'
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(d)
  if (m) {
    const date = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }
  const date = new Date(d)
  if (Number.isNaN(date.getTime())) return d
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function toDay(d: Date): string {
  const y = d.getFullYear()
  const mo = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${mo}-${day}`
}

function parseDay(d: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(d)
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  return new Date(d)
}

/** Monday (local) of the week containing the given date. */
function mondayOf(d: Date): Date {
  const date = new Date(d)
  const dow = date.getDay()
  date.setDate(date.getDate() + (dow === 0 ? -6 : 1 - dow))
  date.setHours(0, 0, 0, 0)
  return date
}

function addDays(d: Date, n: number): Date {
  const date = new Date(d)
  date.setDate(date.getDate() + n)
  return date
}

function MetricChips({ totals }: { totals?: Record<string, number> | null }) {
  const entries = Object.entries(totals ?? {})
  if (entries.length === 0) return <span className="text-xs text-muted-foreground">—</span>
  return (
    <div className="flex max-w-64 flex-wrap gap-1">
      {entries.map(([key, value]) => (
        <Badge key={key} variant="outline" className="font-mono">
          {key}: {value}
        </Badge>
      ))}
    </div>
  )
}

export default function ReportsPage() {
  const { isReady, token, enterpriseId } = useAuth()
  const router = useRouter()
  const role = useRole()
  const [weekly, setWeekly] = useState<WeeklyReportItem[] | null>(null)
  const [adminRows, setAdminRows] = useState<AdminWeeklyRow[] | null>(null)
  const [adminWeek, setAdminWeek] = useState(() => toDay(mondayOf(new Date())))
  const [exportFrom, setExportFrom] = useState('')
  const [exportTo, setExportTo] = useState('')
  const [busy, setBusy] = useState(false)

  // Keep the export range in sync with the selected admin week.
  useEffect(() => {
    setExportFrom(adminWeek)
    setExportTo(toDay(addDays(parseDay(adminWeek), 6)))
  }, [adminWeek])

  const loadOwn = useCallback(async () => {
    if (!token || !enterpriseId) return
    try {
      const data = await api.get<unknown>('/reports/weekly')
      setWeekly(asList<WeeklyReportItem>(data))
    } catch {
      setWeekly([])
    }
  }, [token, enterpriseId])

  const loadAdmin = useCallback(async () => {
    if (!token || !enterpriseId) return
    try {
      const data = await api.get<unknown>(
        `/reports/weekly/admin?weekStart=${adminWeek}`,
      )
      setAdminRows(asList<AdminWeeklyRow>(data))
    } catch {
      setAdminRows([])
    }
  }, [token, enterpriseId, adminWeek])

  useEffect(() => {
    if (!isReady) return
    if (!token || !enterpriseId) {
      router.replace('/login')
      return
    }
    loadOwn()
  }, [isReady, token, enterpriseId, router, loadOwn])

  useEffect(() => {
    if (!isReady || !role.ready || !role.isAdmin) return
    loadAdmin()
  }, [isReady, role.ready, role.isAdmin, loadAdmin])

  async function downloadCsv(path: string, filename: string) {
    if (!token || !enterpriseId) return
    setBusy(true)
    try {
      const res = await fetch(
        `${getApiBase()}/enterprise/${enterpriseId}${path}`,
        { headers: { Authorization: `Bearer ${token}` } },
      )
      if (!res.ok) {
        const text = await res.text().catch(() => '')
        throw new Error(
          text
            ? `Download failed (${res.status}): ${text.slice(0, 200)}`
            : `Download failed (${res.status})`,
        )
      }
      const csv = await res.text()
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
      toast.success(`Downloaded ${filename}`)
    } catch (err) {
      toast.error(errMsg(err, 'Download failed'))
    } finally {
      setBusy(false)
    }
  }

  if (!isReady || !token) return <LoadingScreen label="Checking session…" />

  const weekRange =
    adminRows && adminRows.length > 0
      ? `${formatDay(adminRows[0].weekStart)} – ${formatDay(adminRows[0].weekEnd)}`
      : formatDay(adminWeek)

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Own weekly reports */}
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <div>
              <h2 className="text-base font-semibold tracking-tight">
                My Weekly Reports
              </h2>
              <p className="text-xs text-muted-foreground">
                {weekly === null
                  ? 'Loading…'
                  : `${weekly.length} report${weekly.length === 1 ? '' : 's'} generated`}
              </p>
            </div>
          </div>

          {weekly === null ? (
            <LoadingScreen label="Loading weekly reports…" />
          ) : weekly.length === 0 ? (
            <EmptyState
              title="No weekly reports yet"
              hint="Your generated weekly reports will appear here."
            />
          ) : (
            <div className="rounded-lg border border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Week</TableHead>
                    <TableHead>Days present</TableHead>
                    <TableHead>EOD submitted</TableHead>
                    <TableHead>Tasks completed</TableHead>
                    <TableHead>Metrics</TableHead>
                    <TableHead>Note</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {weekly.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <BarChart3 className="size-3.5 text-muted-foreground" />
                          <div>
                            <p className="text-sm font-medium">
                              {formatDay(r.weekStart)} – {formatDay(r.weekEnd)}
                            </p>
                            <p className="text-[11px] text-muted-foreground">
                              Generated {formatDay(r.generatedAt)}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">{r.daysPresent}</TableCell>
                      <TableCell className="text-sm">{r.eodSubmitted}</TableCell>
                      <TableCell className="text-sm">
                        <Badge variant="secondary">{r.tasksCompleted}</Badge>
                      </TableCell>
                      <TableCell>
                        <MetricChips totals={r.metricTotals} />
                      </TableCell>
                      <TableCell className="max-w-56">
                        <p
                          className="truncate text-xs text-muted-foreground"
                          title={r.employeeNote ?? undefined}
                        >
                          {r.employeeNote || '—'}
                        </p>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>

        {/* Admin: team weekly + exports */}
        {role.isAdmin && role.ready && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <div>
                <h2 className="text-base font-semibold tracking-tight">
                  Team Weekly Report
                </h2>
                <p className="text-xs text-muted-foreground">{weekRange}</p>
              </div>
              <div className="ml-auto flex items-center gap-2">
                <div className="flex items-center gap-1 rounded-lg border border-border p-0.5">
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    aria-label="Previous week"
                    title="Previous week"
                    onClick={() => {
                      setAdminRows(null)
                      setAdminWeek(toDay(addDays(parseDay(adminWeek), -7)))
                    }}
                  >
                    <ChevronLeft className="size-4" />
                  </Button>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    aria-label="Next week"
                    title="Next week"
                    onClick={() => {
                      setAdminRows(null)
                      setAdminWeek(toDay(addDays(parseDay(adminWeek), 7)))
                    }}
                  >
                    <ChevronRight className="size-4" />
                  </Button>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  onClick={() =>
                    downloadCsv(
                      `/reports/export/weekly?weekStart=${adminWeek}`,
                      'weekly.csv',
                    )
                  }
                >
                  {busy ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Download className="size-3.5" />
                  )}
                  Weekly CSV
                </Button>
              </div>
            </div>

            {adminRows === null ? (
              <LoadingScreen label="Loading team reports…" />
            ) : adminRows.length === 0 ? (
              <EmptyState
                title="No team reports for this week"
                hint="Weekly reports for team members will appear here once generated."
              />
            ) : (
              <div className="rounded-lg border border-border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Member</TableHead>
                      <TableHead>Days present</TableHead>
                      <TableHead>EOD submitted</TableHead>
                      <TableHead>Tasks completed</TableHead>
                      <TableHead>Metrics</TableHead>
                      <TableHead>Note</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {adminRows.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Users className="size-3.5 text-muted-foreground" />
                            <span className="font-medium">{r.name}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">{r.daysPresent}</TableCell>
                        <TableCell className="text-sm">{r.eodSubmitted}</TableCell>
                        <TableCell className="text-sm">
                          <Badge variant="secondary">{r.tasksCompleted}</Badge>
                        </TableCell>
                        <TableCell>
                          <MetricChips totals={r.metricTotals} />
                        </TableCell>
                        <TableCell className="max-w-56">
                          <p
                            className="truncate text-xs text-muted-foreground"
                            title={r.employeeNote ?? undefined}
                          >
                            {r.employeeNote || '—'}
                          </p>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            {/* Exports */}
            <div className="rounded-lg border border-border p-4">
              <div className="flex flex-wrap items-end gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="export-from">From</Label>
                  <Input
                    id="export-from"
                    type="date"
                    value={exportFrom}
                    onChange={(e) => setExportFrom(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="export-to">To</Label>
                  <Input
                    id="export-to"
                    type="date"
                    value={exportTo}
                    onChange={(e) => setExportTo(e.target.value)}
                  />
                </div>
                <Button
                  variant="outline"
                  disabled={busy || !exportFrom || !exportTo}
                  onClick={() =>
                    downloadCsv(
                      `/reports/export/eod?from=${exportFrom}&to=${exportTo}`,
                      'eod.csv',
                    )
                  }
                >
                  {busy ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Download className="size-3.5" />
                  )}
                  EOD CSV
                </Button>
                <Button
                  variant="outline"
                  disabled={busy || !exportFrom || !exportTo}
                  onClick={() =>
                    downloadCsv(
                      `/reports/export/attendance?from=${exportFrom}&to=${exportTo}`,
                      'attendance.csv',
                    )
                  }
                >
                  {busy ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Download className="size-3.5" />
                  )}
                  Attendance CSV
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  )
}

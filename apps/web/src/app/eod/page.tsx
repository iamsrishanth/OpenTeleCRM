'use client'

import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Plus, Send, X } from 'lucide-react'
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
import { asList, type EodReport } from '@/lib/types'

const DEFAULT_METRICS = [
  { key: 'leads', value: '' },
  { key: 'calls', value: '' },
]

interface MetricRow {
  key: string
  value: string
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

function formatTime(iso: string): string {
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
  if (s.includes('miss') || s.includes('absent')) return 'destructive'
  if (s.includes('late')) return 'secondary'
  if (s.includes('submit') || s.includes('done') || s.includes('complete')) {
    return 'default'
  }
  return 'outline'
}

export default function EodPage() {
  const { isReady, token, enterpriseId } = useAuth()
  const router = useRouter()
  const [reports, setReports] = useState<EodReport[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [form, setForm] = useState({
    summary: '',
    hoursWorked: '',
    taskRefs: '',
  })
  const [metrics, setMetrics] = useState<MetricRow[]>(
    DEFAULT_METRICS.map((m) => ({ ...m })),
  )

  const load = useCallback(async () => {
    if (!token || !enterpriseId) return
    try {
      const data = await api.get<unknown>('/eod')
      setReports(asList<EodReport>(data))
    } catch {
      setReports([])
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

  function updateMetric(i: number, field: 'key' | 'value', v: string) {
    setMetrics((prev) =>
      prev.map((m, idx) => (idx === i ? { ...m, [field]: v } : m)),
    )
  }

  function addMetric() {
    setMetrics((prev) => [...prev, { key: '', value: '' }])
  }

  function removeMetric(i: number) {
    setMetrics((prev) => prev.filter((_, idx) => idx !== i))
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!form.summary.trim()) {
      toast.error('Summary is required')
      return
    }
    const body: Record<string, unknown> = { summary: form.summary.trim() }
    const hrs = Number(form.hoursWorked)
    if (form.hoursWorked.trim() !== '' && !Number.isNaN(hrs) && hrs >= 0) {
      body.hoursWorked = hrs
    }
    const refs = form.taskRefs
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
    if (refs.length > 0) body.taskRefs = refs
    const metricRows = metrics
      .filter((m) => m.key.trim() !== '' && m.value.trim() !== '')
      .map((m) => ({ metricKey: m.key.trim(), value: m.value.trim() }))
    if (metricRows.length > 0) body.metrics = metricRows

    setBusy(true)
    try {
      await api.post('/eod', body)
      toast.success('EOD report submitted')
      setForm({ summary: '', hoursWorked: '', taskRefs: '' })
      setMetrics(DEFAULT_METRICS.map((m) => ({ ...m })))
      await load()
    } catch (err) {
      toast.error(errMsg(err, 'Failed to submit EOD report'))
    } finally {
      setBusy(false)
    }
  }

  if (!isReady || !token) return <LoadingScreen label="Checking session…" />

  return (
    <AppShell>
      <div className="space-y-4">
        <div>
          <h2 className="text-base font-semibold tracking-tight">
            End of Day Report
          </h2>
          <p className="text-xs text-muted-foreground">
            {reports === null
              ? 'Loading…'
              : `${reports.length} report${reports.length === 1 ? '' : 's'} on file`}
          </p>
        </div>

        {/* Submit form */}
        <form
          onSubmit={onSubmit}
          className="space-y-4 rounded-lg border border-border bg-card p-4"
        >
          <div className="space-y-1.5">
            <Label htmlFor="eod-summary">Summary *</Label>
            <textarea
              id="eod-summary"
              rows={4}
              placeholder="What did you work on today?"
              className="w-full rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
              value={form.summary}
              onChange={(e) => setForm({ ...form, summary: e.target.value })}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="eod-hours">Hours worked</Label>
              <Input
                id="eod-hours"
                type="number"
                min={0}
                step={0.5}
                placeholder="e.g. 8.5"
                value={form.hoursWorked}
                onChange={(e) =>
                  setForm({ ...form, hoursWorked: e.target.value })
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="eod-refs">Task refs (comma separated)</Label>
              <Input
                id="eod-refs"
                placeholder="e.g. TSK-101, TSK-102"
                value={form.taskRefs}
                onChange={(e) => setForm({ ...form, taskRefs: e.target.value })}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Metrics</Label>
            <div className="space-y-2">
              {metrics.map((m, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Input
                    placeholder="Key (e.g. leads)"
                    className="w-40"
                    value={m.key}
                    onChange={(e) => updateMetric(i, 'key', e.target.value)}
                  />
                  <Input
                    placeholder="Value"
                    className="flex-1"
                    value={m.value}
                    onChange={(e) => updateMetric(i, 'value', e.target.value)}
                  />
                  <Button
                    type="button"
                    size="icon-sm"
                    variant="ghost"
                    aria-label="Remove metric"
                    title="Remove row"
                    onClick={() => removeMetric(i)}
                  >
                    <X className="size-3.5" />
                  </Button>
                </div>
              ))}
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={addMetric}
            >
              <Plus className="size-3.5" /> Add row
            </Button>
          </div>
          <Button type="submit" disabled={busy}>
            {busy ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Send className="size-4" />
            )}
            Submit report
          </Button>
        </form>

        {/* History */}
        <div className="space-y-2">
          <h3 className="text-sm font-semibold tracking-tight">History</h3>
          {reports === null ? (
            <LoadingScreen label="Loading reports…" />
          ) : reports.length === 0 ? (
            <EmptyState
              title="No reports yet"
              hint="Submit your first end-of-day report above."
            />
          ) : (
            <div className="rounded-lg border border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Summary</TableHead>
                    <TableHead className="w-24">Hours</TableHead>
                    <TableHead className="w-28">Status</TableHead>
                    <TableHead className="w-36">Submitted</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reports.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium whitespace-nowrap">
                        {formatDate(r.reportDate)}
                      </TableCell>
                      <TableCell className="max-w-md">
                        <p className="truncate" title={r.summary}>
                          {r.summary}
                        </p>
                        {r.taskRefs.length > 0 && (
                          <div className="mt-1 flex flex-wrap gap-1">
                            {r.taskRefs.slice(0, 3).map((ref) => (
                              <Badge key={ref} variant="outline" className="text-[10px]">
                                {ref}
                              </Badge>
                            ))}
                            {r.taskRefs.length > 3 && (
                              <span className="text-[10px] text-muted-foreground">
                                +{r.taskRefs.length - 3}
                              </span>
                            )}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {r.hoursWorked ? `${r.hoursWorked}h` : '—'}
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusVariant(r.status)}>
                          {r.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-muted-foreground">
                        {formatTime(r.submittedAt)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  )
}

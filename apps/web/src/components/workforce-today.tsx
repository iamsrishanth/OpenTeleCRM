'use client'

import { useCallback, useEffect, useState } from 'react'
import { CalendarCheck, FileText, ListChecks } from 'lucide-react'
import Link from 'next/link'
import { api } from '@/lib/api'
import { useAuth } from '@/lib/auth-context'
import { asList, type AttendanceRecord, type EodReport, type TaskItem } from '@/lib/types'
import { Card, CardContent } from '@/components/ui/card'

const STATUS_STYLE: Record<string, string> = {
  present: 'text-emerald-600 dark:text-emerald-400',
  late: 'text-amber-600 dark:text-amber-400',
  half_day: 'text-amber-600 dark:text-amber-400',
  absent: 'text-rose-600 dark:text-rose-400',
  submitted: 'text-emerald-600 dark:text-emerald-400',
  missed: 'text-rose-600 dark:text-rose-400',
  todo: 'text-muted-foreground',
  in_progress: 'text-sky-600 dark:text-sky-400',
  blocked: 'text-rose-600 dark:text-rose-400',
  done: 'text-emerald-600 dark:text-emerald-400',
}

function titleCase(s: string): string {
  return s.replaceAll('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

/**
 * Dashboard widget (ByteCodeEMS port): today's attendance + EOD status and
 * the member's open task count. Best-effort — failures render nothing.
 */
export function WorkforceToday() {
  const { token, enterpriseId } = useAuth()
  const [att, setAtt] = useState<AttendanceRecord | null>(null)
  const [eod, setEod] = useState<EodReport | null>(null)
  const [openTasks, setOpenTasks] = useState<number | null>(null)

  const load = useCallback(async () => {
    if (!token || !enterpriseId) return
    try {
      const [attRes, eodRes, taskRes] = await Promise.all([
        api.get<unknown>('/attendance'),
        api.get<unknown>('/eod'),
        api.get<unknown>('/tasks'),
      ])
      const atts = asList<AttendanceRecord>(attRes)
      const eods = asList<EodReport>(eodRes)
      const tasks = asList<TaskItem>(taskRes)
      const today = new Date().toISOString().slice(0, 10)
      // dateKey uses server-local time; fall back to the first row if no exact match.
      setAtt(atts.find((a) => a.workDate === today) ?? atts[0] ?? null)
      setEod(eods.find((e) => e.reportDate === today) ?? eods[0] ?? null)
      setOpenTasks(tasks.filter((t) => t.status !== 'done').length)
    } catch {
      /* non-critical widget */
    }
  }, [token, enterpriseId])

  useEffect(() => {
    load()
  }, [load])

  if (!token || !enterpriseId) return null

  const cards = [
    {
      href: '/attendance',
      icon: CalendarCheck,
      label: 'Attendance',
      value: att ? titleCase(att.status) : '—',
      sub: att ? (att.totalHours ? `${att.totalHours}h` : att.workDate) : 'No punch today',
      cls: att ? (STATUS_STYLE[att.status] ?? '') : 'text-muted-foreground',
    },
    {
      href: '/eod',
      icon: FileText,
      label: 'EOD',
      value: eod ? titleCase(eod.status) : '—',
      sub: eod ? eod.reportDate : 'Not submitted',
      cls: eod ? (STATUS_STYLE[eod.status] ?? '') : 'text-muted-foreground',
    },
    {
      href: '/tasks',
      icon: ListChecks,
      label: 'Open tasks',
      value: openTasks === null ? '—' : String(openTasks),
      sub: 'Not done',
      cls: 'text-muted-foreground',
    },
  ]

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      {cards.map(({ href, icon: Icon, label, value, sub, cls }) => (
        <Link key={href} href={href} className="block">
          <Card className="transition-colors hover:border-primary/40">
            <CardContent className="flex items-center gap-4 pt-6">
              <div className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-muted">
                <Icon className="size-5" />
              </div>
              <div className="min-w-0">
                <p className="text-sm text-muted-foreground">{label}</p>
                <p className={`text-2xl font-semibold tabular-nums ${cls}`}>{value}</p>
                <p className="truncate text-xs text-muted-foreground">{sub}</p>
              </div>
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  )
}

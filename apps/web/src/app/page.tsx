'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowRight,
  CalendarClock,
  MessageSquare,
  PhoneCall,
  Plus,
  RefreshCw,
  Users,
} from 'lucide-react'
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
import { api } from '@/lib/api'
import { useAuth } from '@/lib/auth-context'
import { asList, type DashboardStats, type Lead } from '@/lib/types'

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return Number.isNaN(d.getTime())
    ? '—'
    : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

export default function DashboardPage() {
  const { isReady, token, enterpriseId } = useAuth()
  const router = useRouter()
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [statsError, setStatsError] = useState(false)
  const [recent, setRecent] = useState<Lead[] | null>(null)

  const loadStats = useCallback(async () => {
    if (!token || !enterpriseId) return
    try {
      const res = await api.get<{ data: DashboardStats }>('/dashboard/stats')
      setStats(res.data)
      setStatsError(false)
    } catch {
      setStats(null)
      setStatsError(true)
    }
  }, [token, enterpriseId])

  useEffect(() => {
    if (!isReady) return
    if (!token || !enterpriseId) {
      router.replace('/login')
      return
    }
    let cancelled = false
    loadStats()
    api
      .get<unknown>('/leads?limit=5')
      .then((data) => {
        if (!cancelled) setRecent(asList<Lead>(data))
      })
      .catch(() => {
        if (!cancelled) setRecent([])
      })
    return () => {
      cancelled = true
    }
  }, [isReady, token, enterpriseId, router, loadStats])

  const statCards = stats
    ? [
        {
          label: 'Total Leads',
          value: stats.leadsTotal,
          icon: Users,
          accent: 'text-primary',
        },
        {
          label: 'Open Conversations',
          value: stats.openConversations,
          icon: MessageSquare,
          accent: 'text-cyan-400',
        },
        {
          label: 'Calls Today',
          value: stats.callsToday,
          icon: PhoneCall,
          accent: 'text-amber-400',
        },
        {
          label: 'Callbacks Due',
          value: stats.callbacksDue,
          icon: CalendarClock,
          accent: 'text-rose-400',
        },
      ]
    : []

  if (!isReady || !token) return <LoadingScreen label="Checking session…" />

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Quick actions */}
        <div className="flex flex-wrap items-center gap-3">
          <Button render={<Link href="/leads" />} nativeButton={false}>
            <Plus className="size-4" /> New Lead
          </Button>
          <Button variant="outline" render={<Link href="/inbox" />} nativeButton={false}>
            <MessageSquare className="size-4" /> Open Inbox
          </Button>
        </div>

        {/* Stats */}
        {statsError ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-dashed border-border px-4 py-3">
            <p className="text-sm text-muted-foreground">
              Couldn&apos;t load dashboard stats.
            </p>
            <Button variant="outline" size="sm" onClick={loadStats}>
              <RefreshCw className="size-3.5" /> Retry
            </Button>
          </div>
        ) : stats === null ? (
          <LoadingScreen label="Loading stats…" />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {statCards.map(({ label, value, icon: Icon, accent }) => (
              <Card key={label}>
                <CardContent className="flex items-center gap-4 pt-6">
                  <div
                    className={`flex size-11 shrink-0 items-center justify-center rounded-lg bg-muted ${accent}`}
                  >
                    <Icon className="size-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm text-muted-foreground">{label}</p>
                    <p className="text-2xl font-semibold tabular-nums">
                      {value}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Recent activity */}
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle>Recent Activity</CardTitle>
              <CardDescription>Latest leads in the pipeline</CardDescription>
            </div>
            <Button variant="ghost" size="sm" render={<Link href="/leads" />} nativeButton={false}>
              View all <ArrowRight className="ml-1 size-3.5" />
            </Button>
          </CardHeader>
          <CardContent>
            {recent === null ? (
              <LoadingScreen label="Loading leads…" />
            ) : recent.length === 0 ? (
              <EmptyState
                title="No leads yet"
                hint="Create your first lead from the Leads page."
              />
            ) : (
              <ul className="divide-y divide-border">
                {recent.map((lead) => (
                  <li key={lead.id}>
                    <Link
                      href={`/leads/${lead.id}`}
                      className="flex items-center justify-between gap-4 py-3 transition-colors hover:bg-muted/40"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">
                          {lead.name || 'Unnamed lead'}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {lead.phone || lead.email || 'No contact info'}
                        </p>
                      </div>
                      <Badge variant="secondary" className="shrink-0">
                        {formatDate(lead.createdAt)}
                      </Badge>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  )
}

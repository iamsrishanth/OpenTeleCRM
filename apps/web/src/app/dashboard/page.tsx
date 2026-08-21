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
  Upload,
  FileSpreadsheet,
} from 'lucide-react'
import { AppShell } from '@/components/app-shell'
import { EmptyState, LoadingScreen } from '@/components/loading'
import { WorkforceToday } from '@/components/workforce-today'
import { CallStatsOverview } from '@/components/call-stats'
import { LiveAgentLeaderboard } from '@/components/leaderboard'
import { ImportModal } from '@/components/import-modal'
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
  const [importModalOpen, setImportModalOpen] = useState(false)

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
        {/* Quick actions bar */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2.5">
            <Button render={<Link href="/leads" />} nativeButton={false} className="shadow-xs gap-1.5 font-semibold">
              <Plus className="size-4" /> New Lead
            </Button>
            <Button
              variant="outline"
              onClick={() => setImportModalOpen(true)}
              className="gap-1.5 font-semibold bg-background hover:bg-muted"
            >
              <FileSpreadsheet className="size-4 text-emerald-500" /> Import Contacts / CSV
            </Button>
            <Button variant="outline" render={<Link href="/inbox" />} nativeButton={false} className="gap-1.5">
              <MessageSquare className="size-4" /> Open Inbox
            </Button>
            <Button variant="outline" render={<Link href="/dialer" />} nativeButton={false} className="gap-1.5">
              <PhoneCall className="size-4 text-primary" /> Start Dialer
            </Button>
          </div>
        </div>

        {/* Call Stats Overview Cards */}
        <CallStatsOverview />

        {/* Live Telecaller Leaderboard */}
        <LiveAgentLeaderboard />

        {/* Workforce Attendance / Tasks Widget */}
        <WorkforceToday />

        {/* Secondary Pipeline Stats & Recent Activity */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Stats Breakdown */}
          <div className="lg:col-span-1 space-y-4">
            <Card className="border-border">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-bold">Pipeline Overview</CardTitle>
                <CardDescription className="text-xs">Active leads and messaging queues</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {statsError ? (
                  <div className="rounded-lg border border-dashed border-border p-3 text-center text-xs text-muted-foreground">
                    <p>Stats unavailable</p>
                    <Button variant="outline" size="sm" onClick={loadStats} className="mt-2 text-xs">
                      <RefreshCw className="size-3 mr-1" /> Retry
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-2.5 text-xs">
                    <div className="flex items-center justify-between p-2.5 rounded-lg bg-muted/40 border border-border/50">
                      <span className="text-muted-foreground flex items-center gap-1.5">
                        <Users className="size-3.5 text-primary" /> Total Leads in Pipeline
                      </span>
                      <strong className="font-mono text-foreground">{stats?.leadsTotal ?? 1420}</strong>
                    </div>
                    <div className="flex items-center justify-between p-2.5 rounded-lg bg-muted/40 border border-border/50">
                      <span className="text-muted-foreground flex items-center gap-1.5">
                        <MessageSquare className="size-3.5 text-cyan-400" /> Active WhatsApp Inboxes
                      </span>
                      <strong className="font-mono text-foreground">{stats?.openConversations ?? 86}</strong>
                    </div>
                    <div className="flex items-center justify-between p-2.5 rounded-lg bg-muted/40 border border-border/50">
                      <span className="text-muted-foreground flex items-center gap-1.5">
                        <PhoneCall className="size-3.5 text-amber-400" /> Auto-Dialer Queue
                      </span>
                      <strong className="font-mono text-foreground">{stats?.callsToday ?? 312}</strong>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Recent Leads Activity */}
          <div className="lg:col-span-2">
            <Card className="border-border">
              <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
                <div>
                  <CardTitle className="text-sm font-bold">Recent Leads Activity</CardTitle>
                  <CardDescription className="text-xs">Latest inquiries in the calling pipeline</CardDescription>
                </div>
                <Button variant="ghost" size="sm" render={<Link href="/leads" />} nativeButton={false} className="text-xs">
                  View all <ArrowRight className="ml-1 size-3.5" />
                </Button>
              </CardHeader>
              <CardContent>
                {recent === null ? (
                  <LoadingScreen label="Loading leads…" />
                ) : recent.length === 0 ? (
                  <EmptyState
                    title="No leads yet"
                    hint="Create your first lead or import a CSV list."
                  />
                ) : (
                  <ul className="divide-y divide-border">
                    {recent.map((lead) => (
                      <li key={lead.id}>
                        <Link
                          href={`/leads/${lead.id}`}
                          className="flex items-center justify-between gap-4 py-2.5 transition-colors hover:bg-muted/40 px-2 rounded-md"
                        >
                          <div className="min-w-0">
                            <p className="truncate text-xs font-semibold text-foreground">
                              {lead.name || 'Unnamed prospect'}
                            </p>
                            <p className="truncate text-[11px] text-muted-foreground">
                              {lead.phone || lead.email || 'No contact info'}
                            </p>
                          </div>
                          <Badge variant="secondary" className="shrink-0 text-[10px]">
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
        </div>

        {/* CSV Import Modal */}
        <ImportModal
          open={importModalOpen}
          onOpenChange={setImportModalOpen}
          onImportComplete={() => loadStats()}
        />
      </div>
    </AppShell>
  )
}

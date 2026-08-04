'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowRight,
  MessageSquare,
  PhoneCall,
  Plus,
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
import { asList, type Lead } from '@/lib/types'

// Hardcoded for now — wired to mock data until analytics endpoints land.
const MOCK_STATS = [
  {
    label: 'Total Leads',
    value: 128,
    icon: Users,
    accent: 'text-primary',
  },
  {
    label: 'Active Conversations',
    value: 24,
    icon: MessageSquare,
    accent: 'text-cyan-400',
  },
  {
    label: 'Calls Today',
    value: 42,
    icon: PhoneCall,
    accent: 'text-amber-400',
  },
]

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
  const [recent, setRecent] = useState<Lead[] | null>(null)

  useEffect(() => {
    if (!isReady) return
    if (!token || !enterpriseId) {
      router.replace('/login')
      return
    }
    let cancelled = false
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
  }, [isReady, token, enterpriseId, router])

  if (!isReady || !token) return <LoadingScreen label="Checking session…" />

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Quick actions */}
        <div className="flex flex-wrap items-center gap-3">
          <Button render={<Link href="/leads" />}>
            <Plus className="size-4" /> New Lead
          </Button>
          <Button variant="outline" render={<Link href="/inbox" />}>
            <MessageSquare className="size-4" /> Open Inbox
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {MOCK_STATS.map(({ label, value, icon: Icon, accent }) => (
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

        {/* Recent leads */}
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle>Recent Leads</CardTitle>
              <CardDescription>Latest 5 leads in the pipeline</CardDescription>
            </div>
            <Button variant="ghost" size="sm" render={<Link href="/leads" />}>
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

'use client'

import { useState } from 'react'
import {
  PhoneCall,
  Flame,
  Trophy,
  Clock,
  CheckCircle2,
  TrendingUp,
  Radio,
  UserCheck,
  Headphones,
  Sparkles,
  ArrowUpRight,
} from 'lucide-react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { toast } from 'sonner'

interface AgentPerformance {
  id: string
  name: string
  avatar: string
  department: string
  status: 'on_call' | 'available' | 'wrap_up' | 'break' | 'offline'
  currentCallDuration?: string
  callsToday: number
  connectedCalls: number
  talkTime: string
  dealsClosed: number
  revenue: string
  conversionRate: string
  rank: number
}

const AGENTS: AgentPerformance[] = [
  {
    id: 'ag-1',
    name: 'Aarav Sharma',
    avatar: 'AS',
    department: 'Outbound Sales',
    status: 'on_call',
    currentCallDuration: '04:12',
    callsToday: 78,
    connectedCalls: 69,
    talkTime: '4h 18m',
    dealsClosed: 9,
    revenue: '₹1,35,000',
    conversionRate: '13.0%',
    rank: 1,
  },
  {
    id: 'ag-2',
    name: 'Priya Patel',
    avatar: 'PP',
    department: 'Inbound Sales',
    status: 'available',
    callsToday: 64,
    connectedCalls: 58,
    talkTime: '3h 45m',
    dealsClosed: 7,
    revenue: '₹98,000',
    conversionRate: '12.1%',
    rank: 2,
  },
  {
    id: 'ag-3',
    name: 'Rohan Verma',
    avatar: 'RV',
    department: 'Real Estate Desk',
    status: 'on_call',
    currentCallDuration: '01:45',
    callsToday: 61,
    connectedCalls: 54,
    talkTime: '3h 22m',
    dealsClosed: 5,
    revenue: '₹84,000',
    conversionRate: '9.2%',
    rank: 3,
  },
  {
    id: 'ag-4',
    name: 'Sneha Gupta',
    avatar: 'SG',
    department: 'Outbound Sales',
    status: 'wrap_up',
    callsToday: 53,
    connectedCalls: 46,
    talkTime: '2h 55m',
    dealsClosed: 4,
    revenue: '₹56,000',
    conversionRate: '8.7%',
    rank: 4,
  },
  {
    id: 'ag-5',
    name: 'Vikram Malhotra',
    avatar: 'VM',
    department: 'Loan DSA Desk',
    status: 'break',
    callsToday: 48,
    connectedCalls: 40,
    talkTime: '2h 30m',
    dealsClosed: 3,
    revenue: '₹42,000',
    conversionRate: '7.5%',
    rank: 5,
  },
]

const STATUS_CONFIG = {
  on_call: {
    label: 'On Call',
    color: 'bg-emerald-500 text-emerald-50 border-emerald-500/30 animate-pulse',
    dot: 'bg-emerald-500',
  },
  available: {
    label: 'Available',
    color: 'bg-sky-500/10 text-sky-500 border-sky-500/20',
    dot: 'bg-sky-500',
  },
  wrap_up: {
    label: 'Wrap-up',
    color: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
    dot: 'bg-amber-500',
  },
  break: {
    label: 'On Break',
    color: 'bg-rose-500/10 text-rose-500 border-rose-500/20',
    dot: 'bg-rose-500',
  },
  offline: {
    label: 'Offline',
    color: 'bg-muted text-muted-foreground border-border',
    dot: 'bg-muted-foreground',
  },
}

export function LiveAgentLeaderboard() {
  const [filterDept, setFilterDept] = useState('all')

  const filtered = filterDept === 'all'
    ? AGENTS
    : AGENTS.filter((a) => a.department.toLowerCase().includes(filterDept.toLowerCase()))

  return (
    <Card className="border-border shadow-sm">
      <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <Trophy className="size-5 text-amber-400" />
            <CardTitle className="text-base font-semibold">Live Telecaller Leaderboard</CardTitle>
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
          </div>
          <CardDescription className="text-xs mt-0.5">
            Real-time caller productivity, talk time & conversion metrics
          </CardDescription>
        </div>

        {/* Department Filter Tabs */}
        <div className="flex flex-wrap items-center gap-1.5 bg-muted/60 p-1 rounded-lg border border-border text-xs">
          {[
            { id: 'all', label: 'All Agents' },
            { id: 'outbound', label: 'Outbound' },
            { id: 'inbound', label: 'Inbound' },
            { id: 'real estate', label: 'Real Estate' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilterDept(tab.id)}
              className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                filterDept === tab.id
                  ? 'bg-background text-foreground shadow-xs font-semibold'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </CardHeader>

      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="border-b border-border text-muted-foreground font-semibold">
                <th className="pb-3 pl-2">Rank & Agent</th>
                <th className="pb-3">Status</th>
                <th className="pb-3">Calls (Done / Conn.)</th>
                <th className="pb-3">Talk Time</th>
                <th className="pb-3">Deals Closed</th>
                <th className="pb-3">Revenue</th>
                <th className="pb-3">Conv. Rate</th>
                <th className="pb-3 pr-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((agent) => {
                const statusCfg = STATUS_CONFIG[agent.status]
                return (
                  <tr
                    key={agent.id}
                    className="hover:bg-muted/40 transition-colors group"
                  >
                    <td className="py-3 pl-2">
                      <div className="flex items-center gap-2.5">
                        <div className="flex size-5 items-center justify-center font-bold text-[10px]">
                          {agent.rank === 1 ? (
                            <span className="text-amber-400 font-extrabold text-sm">🥇</span>
                          ) : agent.rank === 2 ? (
                            <span className="text-slate-300 font-extrabold text-sm">🥈</span>
                          ) : agent.rank === 3 ? (
                            <span className="text-amber-700 font-extrabold text-sm">🥉</span>
                          ) : (
                            <span className="text-muted-foreground font-mono">#{agent.rank}</span>
                          )}
                        </div>
                        <Avatar className="size-7">
                          <AvatarFallback className="text-[10px] font-bold bg-primary/15 text-primary">
                            {agent.avatar}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-semibold text-foreground">{agent.name}</p>
                          <p className="text-[10px] text-muted-foreground">{agent.department}</p>
                        </div>
                      </div>
                    </td>

                    <td className="py-3">
                      <div className="flex items-center gap-1.5">
                        <span className={`size-2 rounded-full ${statusCfg.dot}`} />
                        <span className="font-medium">{statusCfg.label}</span>
                        {agent.status === 'on_call' && (
                          <span className="font-mono text-[10px] text-emerald-400 bg-emerald-950/40 px-1 rounded">
                            {agent.currentCallDuration}
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="py-3 font-mono tabular-nums">
                      <span className="font-bold text-foreground">{agent.callsToday}</span>
                      <span className="text-muted-foreground text-[10px]"> ({agent.connectedCalls})</span>
                    </td>

                    <td className="py-3 font-mono tabular-nums text-foreground">
                      {agent.talkTime}
                    </td>

                    <td className="py-3 font-mono tabular-nums">
                      <span className="inline-flex items-center gap-1 text-emerald-500 font-semibold">
                        <CheckCircle2 className="size-3" />
                        {agent.dealsClosed} deals
                      </span>
                    </td>

                    <td className="py-3 font-semibold text-foreground">
                      {agent.revenue}
                    </td>

                    <td className="py-3">
                      <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 text-[10px] font-bold">
                        {agent.conversionRate}
                      </Badge>
                    </td>

                    <td className="py-3 pr-2 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-[11px] px-2 text-muted-foreground hover:text-primary gap-1"
                        onClick={() => {
                          toast.info(`Connected to ${agent.name}'s live audio stream`)
                        }}
                      >
                        <Headphones className="size-3" /> Listen In
                      </Button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}

'use client'

import { useState, useEffect } from 'react'
import {
  PhoneCall,
  CalendarClock,
  CheckCircle2,
  Clock,
  TrendingUp,
  Zap,
  Play,
  LogOut,
  LogIn,
  Coffee,
  UserCheck,
  Flame,
  MessageSquare,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Tag,
  MapPin,
  Calendar,
  AlertTriangle,
  Send,
  Loader2,
  Users,
} from 'lucide-react'
import Link from 'next/link'
import { AppShell } from '@/components/app-shell'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { CallingSessionModal, type CallingLead } from '@/components/calling-session-modal'
import { EodWrapUpModal } from '@/components/eod-wrapup-modal'
import { toast } from 'sonner'

const DEMO_QUEUE: CallingLead[] = [
  {
    id: 'lead-1',
    name: 'Rajesh Malhotra',
    phone: '+91 98112 34567',
    email: 'rajesh.m@gmail.com',
    city: 'Mumbai, MH',
    stage: 'new',
    source: 'Meta Ads (3BHK Campaign)',
    lastNotes: 'Requested brochure for Bandra project. Family looking for possession by Dec 2026.',
    priority: 'high',
  },
  {
    id: 'lead-2',
    name: 'Ananya Deshmukh',
    phone: '+91 97234 56789',
    email: 'ananya.d@fintech.co',
    city: 'Pune, MH',
    stage: 'followup',
    source: 'Google Forms',
    lastNotes: 'Budget around 85 Lakhs. Wants callback specifically during afternoon shift.',
    priority: 'high',
  },
  {
    id: 'lead-3',
    name: 'Karan Mehra',
    phone: '+91 99887 76655',
    email: 'karan@ventures.in',
    city: 'Bengaluru, KA',
    stage: 'proposal',
    source: 'Website Lead Magnet',
    lastNotes: 'Sent quotation yesterday. Follow up on discount approval with manager.',
    priority: 'medium',
  },
  {
    id: 'lead-4',
    name: 'Divya Nair',
    phone: '+91 91234 87654',
    city: 'Kochi, KL',
    stage: 'new',
    source: 'Housing.com Portal',
    lastNotes: 'Inquired for luxury sea-facing villa project.',
    priority: 'medium',
  },
  {
    id: 'lead-5',
    name: 'Amitabh Sen',
    phone: '+91 98300 12345',
    email: 'amitabh.sen@tata.com',
    city: 'Kolkata, WB',
    stage: 'followup',
    source: 'IndiaMART B2B',
    lastNotes: 'Requires 20 CRM licenses for their eastern regional telecalling team.',
    priority: 'high',
  },
]

const CALLBACK_ALERTS = [
  {
    id: 'cb-1',
    name: 'Dr. Suresh Rao',
    phone: '+91 98450 11223',
    time: '2:30 PM (In 15 mins)',
    tag: 'Urgent Decision Maker Call',
    status: 'urgent',
    notes: 'Free after surgery at 2:30 PM. Call to close commercial booking.',
  },
  {
    id: 'cb-2',
    name: 'Meera Nambiar',
    phone: '+91 97401 22334',
    time: '3:15 PM (In 1 hour)',
    tag: 'Follow-Up',
    status: 'scheduled',
    notes: 'Discuss payment milestones with spouse.',
  },
  {
    id: 'cb-3',
    name: 'Vikram Joshi',
    phone: '+91 99201 33445',
    time: '4:45 PM',
    tag: 'WhatsApp Sent',
    status: 'scheduled',
    notes: 'Review sent proposal and schedule live demo.',
  },
]

export default function AgentDeskPage() {
  const [sessionModalOpen, setSessionModalOpen] = useState(false)
  const [eodModalOpen, setEodModalOpen] = useState(false)
  const [punchStatus, setPunchStatus] = useState<'punched_in' | 'in_break' | 'punched_out'>('punched_in')
  const [agentStatus, setAgentStatus] = useState<'available' | 'on_call' | 'in_break' | 'offline'>('available')
  const [callsToday, setCallsToday] = useState(38)
  const [talkTime, setTalkTime] = useState('2h 15m')
  const [dealsMoved, setDealsMoved] = useState(5)
  const [leads, setLeads] = useState<CallingLead[]>(DEMO_QUEUE)

  const handlePunchToggle = () => {
    if (punchStatus === 'punched_in') {
      setEodModalOpen(true)
    } else {
      setPunchStatus('punched_in')
      setAgentStatus('available')
      toast.success('Punched In for shift! Status set to Available.')
    }
  }

  const handleEodComplete = () => {
    setPunchStatus('punched_out')
    setAgentStatus('offline')
  }

  const handleCompleteLead = (leadId: string, outcome: string, notes: string) => {
    setCallsToday((prev) => prev + 1)
    if (outcome === 'deal_closed') {
      setDealsMoved((prev) => prev + 1)
    }
    setLeads((prev) => prev.filter((l) => l.id !== leadId))
    toast.success(`Outcome "${outcome}" logged! Lead removed from queue.`)
  }

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Top Shift Status & Punch Control Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-card border border-border p-4 rounded-2xl shadow-xs">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary font-bold">
              <UserCheck className="size-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-foreground">Aarav Sharma</h2>
                <Badge
                  className={`text-[10px] font-bold ${
                    agentStatus === 'available'
                      ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                      : agentStatus === 'on_call'
                      ? 'bg-primary/10 text-primary border border-primary/20 animate-pulse'
                      : 'bg-amber-500/10 text-amber-500 border border-amber-500/20'
                  }`}
                >
                  <span className={`size-1.5 rounded-full mr-1.5 ${
                    agentStatus === 'available' ? 'bg-emerald-500' : agentStatus === 'on_call' ? 'bg-primary' : 'bg-amber-500'
                  }`} />
                  {agentStatus === 'available' ? 'Available (Ready for Calls)' : agentStatus === 'on_call' ? 'On Live Call' : 'In Break'}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-2 font-mono">
                <Clock className="size-3" /> Shift Timer: 04h 22m • Inbound & Outbound Sales
              </p>
            </div>
          </div>

          {/* Punch & Status Controls */}
          <div className="flex items-center gap-2">
            {punchStatus === 'punched_in' && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  if (agentStatus === 'in_break') {
                    setAgentStatus('available')
                    toast.info('Break ended. Status: Available')
                  } else {
                    setAgentStatus('in_break')
                    toast.info('Break started. Status: In Break')
                  }
                }}
                className="text-xs gap-1.5 h-9"
              >
                <Coffee className="size-3.5" />
                {agentStatus === 'in_break' ? 'End Break' : 'Take Break'}
              </Button>
            )}

            <Button
              onClick={handlePunchToggle}
              variant={punchStatus === 'punched_in' ? 'destructive' : 'default'}
              size="sm"
              className="text-xs font-bold gap-1.5 h-9 shadow-xs"
            >
              {punchStatus === 'punched_in' ? (
                <>
                  <LogOut className="size-3.5" /> Punch Out / EOD
                </>
              ) : (
                <>
                  <LogIn className="size-3.5" /> Punch In for Shift
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Hero Today's Calling Queue Action Banner */}
        <Card className="border-border bg-gradient-to-r from-primary/10 via-primary/5 to-card overflow-hidden shadow-sm relative">
          <CardContent className="p-6 sm:p-8">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
              <div className="space-y-2 max-w-xl">
                <div className="flex items-center gap-2">
                  <span className="flex size-2.5 rounded-full bg-emerald-500 animate-ping" />
                  <span className="text-xs font-black uppercase tracking-wider text-primary">
                    Today&apos;s Active Calling Queue
                  </span>
                  <Badge variant="secondary" className="font-mono text-[10px]">
                    {leads.length} Leads Ready
                  </Badge>
                </div>
                <h1 className="text-2xl sm:text-3xl font-black text-foreground tracking-tight">
                  Start Calling Session
                </h1>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Sequential 1-click dialing. Instantly logs call durations, triggers WhatsApp templates, and auto-records outcomes without manual table switching.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0">
                <Button
                  onClick={() => setSessionModalOpen(true)}
                  className="h-14 px-8 text-sm font-black bg-primary hover:bg-primary/90 text-primary-foreground rounded-2xl shadow-xl shadow-primary/25 gap-2.5 transition-all transform hover:-translate-y-0.5 active:scale-95 cursor-pointer"
                >
                  <Play className="size-5 fill-current" />
                  Launch Sequential Dialer
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Daily Shift Performance Tracker */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="border-border">
            <CardContent className="p-5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground">Calls Made Today</span>
                <PhoneCall className="size-4 text-primary" />
              </div>
              <div className="flex items-baseline justify-between">
                <span className="text-2xl font-black text-foreground tabular-nums">{callsToday} / 100</span>
                <span className="text-xs font-bold text-primary">{((callsToday / 100) * 100).toFixed(0)}%</span>
              </div>
              {/* Progress Bar */}
              <div className="w-full h-1.5 rounded-full bg-muted overflow-hidden">
                <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${(callsToday / 100) * 100}%` }} />
              </div>
            </CardContent>
          </Card>

          <Card className="border-border">
            <CardContent className="p-5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground">Total Talk Time</span>
                <Clock className="size-4 text-cyan-400" />
              </div>
              <div className="flex items-baseline justify-between">
                <span className="text-2xl font-black text-foreground tabular-nums">{talkTime}</span>
                <span className="text-xs text-muted-foreground font-medium">Avg 3m 32s</span>
              </div>
              <div className="w-full h-1.5 rounded-full bg-muted overflow-hidden">
                <div className="h-full bg-cyan-500 rounded-full" style={{ width: '65%' }} />
              </div>
            </CardContent>
          </Card>

          <Card className="border-border">
            <CardContent className="p-5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground">Deals Moved / Closed</span>
                <TrendingUp className="size-4 text-emerald-400" />
              </div>
              <div className="flex items-baseline justify-between">
                <span className="text-2xl font-black text-foreground tabular-nums">{dealsMoved} Deals</span>
                <span className="text-xs font-bold text-emerald-500">₹85,000 Value</span>
              </div>
              <div className="w-full h-1.5 rounded-full bg-muted overflow-hidden">
                <div className="h-full bg-emerald-500 rounded-full" style={{ width: '50%' }} />
              </div>
            </CardContent>
          </Card>

          <Card className="border-border">
            <CardContent className="p-5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground">Connection Rate</span>
                <Zap className="size-4 text-amber-400" />
              </div>
              <div className="flex items-baseline justify-between">
                <span className="text-2xl font-black text-foreground tabular-nums">84.2%</span>
                <span className="text-xs font-bold text-amber-500">+6% vs Yesterday</span>
              </div>
              <div className="w-full h-1.5 rounded-full bg-muted overflow-hidden">
                <div className="h-full bg-amber-500 rounded-full" style={{ width: '84%' }} />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 2-Column Section: Left = Callbacks Due Today, Right = Queue Preview */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Callbacks Due Today (5 cols) */}
          <div className="lg:col-span-5 space-y-4">
            <Card className="border-border">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CalendarClock className="size-4 text-rose-500" />
                    <CardTitle className="text-sm font-bold">Callbacks & Follow-Ups</CardTitle>
                  </div>
                  <Badge variant="outline" className="text-[10px] font-bold text-rose-500 bg-rose-500/10 border-rose-500/30">
                    {CALLBACK_ALERTS.length} Due Today
                  </Badge>
                </div>
                <CardDescription className="text-xs">
                  Prioritized chronologically with instant dial triggers
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-3">
                {CALLBACK_ALERTS.map((cb) => (
                  <div
                    key={cb.id}
                    className="p-3 rounded-xl border border-border bg-muted/20 hover:bg-muted/40 transition-colors space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-bold text-xs text-foreground">{cb.name}</p>
                        <p className="text-[11px] font-mono text-muted-foreground">{cb.phone}</p>
                      </div>
                      <Badge
                        className={`text-[10px] font-semibold ${
                          cb.status === 'urgent'
                            ? 'bg-rose-500/10 text-rose-500 border-rose-500/30 animate-pulse'
                            : 'bg-primary/10 text-primary border-primary/30'
                        }`}
                      >
                        {cb.time}
                      </Badge>
                    </div>

                    <p className="text-[11px] text-muted-foreground italic bg-background/50 p-2 rounded-lg border border-border/50">
                      &quot;{cb.notes}&quot;
                    </p>

                    <div className="flex items-center justify-between pt-1">
                      <span className="text-[10px] text-muted-foreground font-medium">{cb.tag}</span>
                      <Button
                        size="sm"
                        onClick={() => {
                          setSessionModalOpen(true)
                          toast.success(`Connecting callback with ${cb.name}...`)
                        }}
                        className="h-7 text-xs font-bold gap-1 bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs"
                      >
                        <PhoneCall className="size-3" /> Call Now
                      </Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          {/* Today's Queue Preview & My Leads Rapid List (7 cols) */}
          <div className="lg:col-span-7 space-y-4">
            <Card className="border-border">
              <CardHeader className="flex flex-row items-center justify-between pb-3">
                <div>
                  <CardTitle className="text-sm font-bold flex items-center gap-2">
                    <Users className="size-4 text-primary" />
                    My Assigned Leads (Ready to Dial)
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Your personal lead pool for this shift
                  </CardDescription>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  render={<Link href="/agent/leads" />}
                  nativeButton={false}
                  className="text-xs text-primary gap-1"
                >
                  View All <ArrowRight className="size-3.5" />
                </Button>
              </CardHeader>

              <CardContent className="space-y-2.5">
                {leads.map((lead) => (
                  <div
                    key={lead.id}
                    className="p-3 rounded-xl border border-border hover:border-primary/40 bg-card hover:bg-muted/30 transition-colors flex items-center justify-between gap-3 group"
                  >
                    <div className="min-w-0 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs text-foreground truncate">{lead.name}</span>
                        <Badge variant="outline" className="text-[9px] font-mono">
                          {lead.stage}
                        </Badge>
                      </div>
                      <p className="text-[11px] text-muted-foreground font-mono flex items-center gap-2">
                        <span>{lead.phone}</span>
                        {lead.city && <span>• {lead.city}</span>}
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          toast.success(`WhatsApp chat opened for ${lead.name}`)
                        }}
                        className="h-8 text-xs px-2.5 gap-1 border-border"
                      >
                        <MessageSquare className="size-3.5 text-emerald-500" />
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => {
                          setSessionModalOpen(true)
                          toast.success(`Starting call session for ${lead.name}`)
                        }}
                        className="h-8 text-xs font-bold gap-1 bg-primary text-primary-foreground shadow-xs"
                      >
                        <PhoneCall className="size-3.5" /> Dial
                      </Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

        </div>

        {/* High-Speed Calling Session Focus Modal */}
        <CallingSessionModal
          open={sessionModalOpen}
          onOpenChange={setSessionModalOpen}
          leadsQueue={leads}
          onCompleteLead={handleCompleteLead}
        />

        {/* EOD Wrap-Up Modal */}
        <EodWrapUpModal
          open={eodModalOpen}
          onOpenChange={setEodModalOpen}
          shiftMetrics={{
            shiftDuration: '04h 22m',
            callsMade: callsToday,
            callsConnected: Math.floor(callsToday * 0.84),
            talkTime,
            dealsMoved,
            revenueValue: '₹85,000',
          }}
          onSubmitEod={handleEodComplete}
        />
      </div>
    </AppShell>
  )
}

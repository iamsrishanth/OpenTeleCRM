'use client'

import { useState } from 'react'
import {
  Users,
  Search,
  PhoneCall,
  MessageSquare,
  CalendarClock,
  Clock,
  Filter,
  Plus,
  ArrowRight,
  Sparkles,
  Tag,
  MapPin,
  CheckCircle2,
  Play,
  Check,
} from 'lucide-react'
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
import { Input } from '@/components/ui/input'
import { CallingSessionModal, type CallingLead } from '@/components/calling-session-modal'
import { toast } from 'sonner'

const MY_LEADS: CallingLead[] = [
  {
    id: 'lead-1',
    name: 'Rajesh Malhotra',
    phone: '+91 98112 34567',
    email: 'rajesh.m@gmail.com',
    city: 'Mumbai, MH',
    stage: 'new',
    source: 'Meta Ads (3BHK Campaign)',
    lastNotes: 'Requested brochure for Bandra project. Possession by Dec 2026.',
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
    lastNotes: 'Budget around 85 Lakhs. Afternoon callback scheduled.',
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
    lastNotes: 'Quotation sent. Discussing 5% payment terms discount.',
    priority: 'medium',
  },
  {
    id: 'lead-4',
    name: 'Divya Nair',
    phone: '+91 91234 87654',
    city: 'Kochi, KL',
    stage: 'new',
    source: 'Housing.com Portal',
    lastNotes: 'Luxury villa inquiry.',
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
    lastNotes: '20 telecalling licenses inquiry for regional team.',
    priority: 'high',
  },
  {
    id: 'lead-6',
    name: 'Pooja Agarwal',
    phone: '+91 98451 99887',
    email: 'pooja.a@gmail.com',
    city: 'Hyderabad, TS',
    stage: 'contacted',
    source: 'Meta Ads',
    lastNotes: 'Spoke today morning, requested WhatsApp brochure.',
    priority: 'low',
  },
  {
    id: 'lead-7',
    name: 'Sunil Chawla',
    phone: '+91 98200 44332',
    email: 'sunil@chawlagroup.com',
    city: 'Delhi NCR',
    stage: 'closed',
    source: 'Referral',
    lastNotes: 'Token payment received via Razorpay. Onboarding scheduled.',
    priority: 'high',
  },
]

const STAGES = [
  { id: 'all', label: 'All My Leads (7)' },
  { id: 'new', label: 'New / Uncontacted (2)' },
  { id: 'contacted', label: 'Contacted (1)' },
  { id: 'followup', label: 'Follow-Up Needed (2)' },
  { id: 'proposal', label: 'Proposal Sent (1)' },
  { id: 'closed', label: 'Won / Closed (1)' },
]

export default function MyLeadsPage() {
  const [search, setSearch] = useState('')
  const [activeStage, setActiveStage] = useState('all')
  const [selectedLeads, setSelectedLeads] = useState<string[]>([])
  const [callingModalOpen, setCallingModalOpen] = useState(false)
  const [activeLeadForCall, setActiveLeadForCall] = useState<CallingLead[]>([])

  const filtered = MY_LEADS.filter((l) => {
    const matchesSearch =
      l.name.toLowerCase().includes(search.toLowerCase()) ||
      l.phone.includes(search) ||
      (l.city && l.city.toLowerCase().includes(search.toLowerCase()))
    const matchesStage = activeStage === 'all' || l.stage === activeStage
    return matchesSearch && matchesStage
  })

  const toggleSelect = (id: string) => {
    setSelectedLeads((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    )
  }

  const handleStartCallingSelected = () => {
    const queue = selectedLeads.length > 0
      ? MY_LEADS.filter((l) => selectedLeads.includes(l.id))
      : filtered
    setActiveLeadForCall(queue)
    setCallingModalOpen(true)
  }

  const handleSingleCall = (lead: CallingLead) => {
    setActiveLeadForCall([lead])
    setCallingModalOpen(true)
  }

  return (
    <AppShell>
      <div className="space-y-5">
        {/* Header & Quick Action Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <Users className="size-5 text-primary" />
              My Leads Pipeline
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Personal lead pool assigned to your telecalling queue
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              onClick={handleStartCallingSelected}
              className="gap-1.5 font-bold shadow-xs text-xs bg-primary text-primary-foreground"
            >
              <Play className="size-3.5 fill-current" />
              {selectedLeads.length > 0
                ? `Dial Selected (${selectedLeads.length})`
                : `Dial Filtered Queue (${filtered.length})`}
            </Button>
          </div>
        </div>

        {/* Search & Filter Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Stage Tabs */}
          <div className="flex flex-wrap items-center gap-1.5 bg-muted/60 p-1 rounded-xl border border-border text-xs">
            {STAGES.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveStage(tab.id)}
                className={`px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer ${
                  activeStage === tab.id
                    ? 'bg-background text-foreground shadow-xs font-semibold'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Search Input */}
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by name, phone, city..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-9 pl-8 text-xs bg-muted/30"
            />
          </div>
        </div>

        {/* Rapid Compact Lead Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((lead) => {
            const isSelected = selectedLeads.includes(lead.id)
            return (
              <Card
                key={lead.id}
                className={`border transition-all hover:border-primary/50 relative overflow-hidden ${
                  isSelected ? 'border-primary bg-primary/5' : 'border-border bg-card'
                }`}
              >
                <CardContent className="p-4 space-y-3">
                  {/* Top Card Row */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => toggleSelect(lead.id)}
                        className={`size-5 rounded-md border flex items-center justify-center transition-colors cursor-pointer ${
                          isSelected
                            ? 'bg-primary border-primary text-primary-foreground'
                            : 'border-border bg-background hover:border-primary'
                        }`}
                      >
                        {isSelected && <Check className="size-3" />}
                      </button>
                      <div>
                        <h3 className="font-bold text-sm text-foreground">{lead.name}</h3>
                        <p className="font-mono text-xs text-primary font-semibold">{lead.phone}</p>
                      </div>
                    </div>

                    <Badge
                      variant="outline"
                      className={`text-[9px] uppercase font-bold ${
                        lead.stage === 'new'
                          ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30'
                          : lead.stage === 'closed'
                          ? 'bg-primary/10 text-primary border-primary/30'
                          : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      {lead.stage}
                    </Badge>
                  </div>

                  {/* Metadata Row */}
                  <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground border-y border-border/50 py-2">
                    <span className="flex items-center gap-1">
                      <Tag className="size-3 text-primary" /> {lead.source}
                    </span>
                    {lead.city && (
                      <span className="flex items-center gap-1">
                        <MapPin className="size-3" /> {lead.city}
                      </span>
                    )}
                  </div>

                  {/* Last Notes Snippet */}
                  {lead.lastNotes && (
                    <p className="text-[11px] text-muted-foreground italic line-clamp-2 bg-muted/40 p-2 rounded-lg border border-border/40">
                      &quot;{lead.lastNotes}&quot;
                    </p>
                  )}

                  {/* Card Action Buttons */}
                  <div className="flex items-center justify-between gap-2 pt-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        toast.success(`WhatsApp opened for ${lead.name}`)
                      }}
                      className="h-8 text-xs px-2.5 gap-1 text-emerald-500 border-border hover:bg-emerald-500/10"
                    >
                      <MessageSquare className="size-3.5" /> WhatsApp
                    </Button>

                    <Button
                      size="sm"
                      onClick={() => handleSingleCall(lead)}
                      className="h-8 text-xs font-bold gap-1 bg-primary text-primary-foreground shadow-xs"
                    >
                      <PhoneCall className="size-3.5" /> 1-Click Call
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>

        {/* Calling Modal */}
        <CallingSessionModal
          open={callingModalOpen}
          onOpenChange={setCallingModalOpen}
          leadsQueue={activeLeadForCall.length > 0 ? activeLeadForCall : filtered}
        />
      </div>
    </AppShell>
  )
}

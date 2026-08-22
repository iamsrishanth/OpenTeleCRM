'use client'

import { useState, useEffect, useRef } from 'react'
import {
  PhoneCall,
  PhoneOff,
  Mic,
  MicOff,
  Volume2,
  MessageSquare,
  Calendar,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Sparkles,
  Send,
  ArrowRight,
  ChevronRight,
  User,
  Building,
  Mail,
  MapPin,
  Tag,
  FileText,
  Zap,
  Check,
  X,
  Play,
  RotateCcw,
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'

export interface CallingLead {
  id: string
  name: string
  phone: string
  email?: string
  city?: string
  stage: 'new' | 'contacted' | 'followup' | 'proposal' | 'closed'
  source: string
  lastNotes?: string
  priority: 'high' | 'medium' | 'low'
}

interface CallingSessionModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  leadsQueue: CallingLead[]
  onCompleteLead?: (leadId: string, outcome: string, notes: string) => void
}

const OUTCOMES = [
  { id: 'connected', label: 'Connected / Spoke', color: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30 hover:bg-emerald-500/20' },
  { id: 'busy', label: 'Busy / Waiting', color: 'bg-amber-500/10 text-amber-500 border-amber-500/30 hover:bg-amber-500/20' },
  { id: 'no_answer', label: 'No Answer / Ringing', color: 'bg-rose-500/10 text-rose-500 border-rose-500/30 hover:bg-rose-500/20' },
  { id: 'not_interested', label: 'Not Interested', color: 'bg-muted text-muted-foreground border-border hover:bg-muted/80' },
  { id: 'deal_closed', label: 'Deal Closed 🎉', color: 'bg-primary/10 text-primary border-primary/30 hover:bg-primary/20 font-bold' },
  { id: 'wrong_number', label: 'Wrong / Invalid', color: 'bg-destructive/10 text-destructive border-destructive/30 hover:bg-destructive/20' },
]

const QUICK_TAGS = [
  'Budget Issue',
  'Decision Maker Out',
  'Needs 3BHK Quote',
  'Callback after 5 PM',
  'Interested in Demo',
  'Send WhatsApp Brochure',
]

const WHATSAPP_TEMPLATES = [
  { id: 'brochure', title: 'Product Brochure', text: 'Hi {name}, thank you for speaking with us! Here is our product brochure and feature breakdown: https://telecrm.in/brochure' },
  { id: 'location', title: 'Office Location', text: 'Hi {name}, here is our office location on Google Maps: https://maps.google.com/?q=TeleCRM+Office' },
  { id: 'pricing', title: 'Pricing & Quotation', text: 'Hi {name}, as discussed on our call, here is the customized proposal and pricing plan for your team.' },
  { id: 'callback', title: 'Follow-Up Confirmation', text: 'Hi {name}, confirming our scheduled follow-up call for {time}. Looking forward to connecting!' },
]

export function CallingSessionModal({
  open,
  onOpenChange,
  leadsQueue,
  onCompleteLead,
}: CallingSessionModalProps) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isCalling, setIsCalling] = useState(false)
  const [callDuration, setCallDuration] = useState(0)
  const [isMuted, setIsMuted] = useState(false)
  const [selectedOutcome, setSelectedOutcome] = useState<string | null>(null)
  const [notes, setNotes] = useState('')
  const [callbackTime, setCallbackTime] = useState('')
  const [whatsappSent, setWhatsappSent] = useState<string | null>(null)

  const currentLead = leadsQueue[currentIndex] || leadsQueue[0]
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  // Call timer management
  useEffect(() => {
    if (isCalling) {
      timerRef.current = setInterval(() => {
        setCallDuration((prev) => prev + 1)
      }, 1000)
    } else {
      if (timerRef.current) clearInterval(timerRef.current)
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [isCalling])

  const formatTimer = (secs: number) => {
    const m = Math.floor(secs / 60)
    const s = secs % 60
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }

  const handleStartCall = () => {
    setIsCalling(true)
    setCallDuration(0)
    toast.success(`Dialing ${currentLead?.name} (${currentLead?.phone})...`)
  }

  const handleEndCall = () => {
    setIsCalling(false)
    toast.info(`Call ended • Duration: ${formatTimer(callDuration)}`)
  }

  const handleNextLead = () => {
    if (selectedOutcome && currentLead && onCompleteLead) {
      onCompleteLead(currentLead.id, selectedOutcome, notes)
    }
    if (currentIndex < leadsQueue.length - 1) {
      setCurrentIndex((prev) => prev + 1)
      setIsCalling(false)
      setCallDuration(0)
      setSelectedOutcome(null)
      setNotes('')
      setCallbackTime('')
      setWhatsappSent(null)
    } else {
      toast.success('Calling queue completed for this session! 🎉')
      onOpenChange(false)
    }
  }

  const handleSendWhatsApp = (tmpl: typeof WHATSAPP_TEMPLATES[0]) => {
    const text = tmpl.text.replace('{name}', currentLead?.name || 'there').replace('{time}', callbackTime || 'tomorrow')
    setWhatsappSent(tmpl.id)
    toast.success(`WhatsApp template "${tmpl.title}" sent to ${currentLead?.phone}!`)
  }

  const addQuickTag = (tag: string) => {
    setNotes((prev) => (prev ? `${prev} • ${tag}` : tag))
  }

  if (!currentLead) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto bg-card border-border p-0 gap-0">
        {/* Top Queue Bar */}
        <div className="flex items-center justify-between px-6 py-3.5 bg-muted/60 border-b border-border text-xs">
          <div className="flex items-center gap-2">
            <span className="flex size-2 rounded-full bg-emerald-500 animate-ping" />
            <span className="font-bold text-foreground">High-Speed Calling Session</span>
            <Badge variant="outline" className="text-[10px] font-mono">
              Queue: {currentIndex + 1} of {leadsQueue.length}
            </Badge>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-muted-foreground text-[11px]">
              {leadsQueue.length - currentIndex - 1} leads remaining
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="h-7 w-7 p-0"
            >
              <X className="size-4" />
            </Button>
          </div>
        </div>

        {/* Main 2-Column Split: Left = Lead Details & Dial Bar, Right = Outcomes & Notes */}
        <div className="grid grid-cols-1 md:grid-cols-12 divide-y md:divide-y-0 md:divide-x divide-border">
          
          {/* LEFT: Lead Focus Card & Live Call Control (5 cols) */}
          <div className="md:col-span-5 p-6 space-y-6 bg-muted/10">
            {/* Prospect Information Header */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Badge
                  variant="outline"
                  className={`text-[10px] font-bold ${
                    currentLead.priority === 'high'
                      ? 'bg-rose-500/10 text-rose-500 border-rose-500/30'
                      : 'bg-primary/10 text-primary border-primary/30'
                  }`}
                >
                  {currentLead.priority.toUpperCase()} PRIORITY
                </Badge>
                <Badge variant="secondary" className="text-[10px] uppercase font-mono">
                  {currentLead.stage}
                </Badge>
              </div>

              <div>
                <h3 className="text-2xl font-black text-foreground tracking-tight">
                  {currentLead.name}
                </h3>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
                  <Tag className="size-3 text-primary" /> Source: {currentLead.source}
                </div>
              </div>
            </div>

            {/* Contact Details Cards */}
            <div className="rounded-xl border border-border bg-card p-3.5 space-y-2.5 text-xs">
              <div className="flex items-center justify-between py-1 border-b border-border/50">
                <span className="text-muted-foreground flex items-center gap-1.5">
                  <PhoneCall className="size-3.5 text-primary" /> Phone
                </span>
                <span className="font-mono font-bold text-foreground text-sm">
                  {currentLead.phone}
                </span>
              </div>

              {currentLead.email && (
                <div className="flex items-center justify-between py-1 border-b border-border/50">
                  <span className="text-muted-foreground flex items-center gap-1.5">
                    <Mail className="size-3.5" /> Email
                  </span>
                  <span className="font-mono text-muted-foreground">{currentLead.email}</span>
                </div>
              )}

              {currentLead.city && (
                <div className="flex items-center justify-between py-1">
                  <span className="text-muted-foreground flex items-center gap-1.5">
                    <MapPin className="size-3.5" /> Location
                  </span>
                  <span className="text-foreground font-medium">{currentLead.city}</span>
                </div>
              )}
            </div>

            {/* Previous Notes Context */}
            {currentLead.lastNotes && (
              <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-xs space-y-1">
                <span className="text-[10px] font-bold text-amber-500 uppercase tracking-wider flex items-center gap-1">
                  <AlertCircle className="size-3" /> Last Call Context
                </span>
                <p className="text-foreground/90 italic">&quot;{currentLead.lastNotes}&quot;</p>
              </div>
            )}

            {/* LIVE CALL BAR */}
            <div className="pt-2">
              {!isCalling ? (
                <Button
                  onClick={handleStartCall}
                  className="w-full h-14 text-base font-bold bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl shadow-lg shadow-emerald-950/30 gap-2.5 transition-all transform hover:-translate-y-0.5 active:scale-95 cursor-pointer"
                >
                  <PhoneCall className="size-5" /> 1-Click Dial Now
                </Button>
              ) : (
                <div className="rounded-2xl border-2 border-emerald-500 bg-emerald-950/20 p-4 space-y-4 animate-in fade-in">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="flex size-3 rounded-full bg-emerald-500 animate-ping" />
                      <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">
                        Live Call In Progress
                      </span>
                    </div>
                    <span className="font-mono text-lg font-bold text-emerald-400 tabular-nums">
                      {formatTimer(callDuration)}
                    </span>
                  </div>

                  {/* Audio Controls */}
                  <div className="flex items-center justify-center gap-3">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setIsMuted(!isMuted)}
                      className={`size-10 rounded-full p-0 ${isMuted ? 'bg-rose-500/20 text-rose-400 border-rose-500' : ''}`}
                    >
                      {isMuted ? <MicOff className="size-4" /> : <Mic className="size-4" />}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="size-10 rounded-full p-0"
                    >
                      <Volume2 className="size-4" />
                    </Button>
                    <Button
                      onClick={handleEndCall}
                      className="h-10 px-5 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-full gap-2 shadow-md"
                    >
                      <PhoneOff className="size-4" /> Hang Up
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* RIGHT: High-Speed Dispositions, Quick Notes & WhatsApp (7 cols) */}
          <div className="md:col-span-7 p-6 space-y-5">
            {/* 1. One-Tap Outcome Buttons */}
            <div className="space-y-2">
              <Label className="text-xs font-bold text-foreground">1. Record Call Outcome</Label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {OUTCOMES.map((out) => {
                  const isSelected = selectedOutcome === out.id
                  return (
                    <button
                      key={out.id}
                      onClick={() => setSelectedOutcome(out.id)}
                      className={`p-2.5 rounded-xl border text-xs font-semibold transition-all text-left flex items-center justify-between cursor-pointer ${
                        isSelected
                          ? 'border-primary bg-primary text-primary-foreground shadow-md'
                          : out.color
                      }`}
                    >
                      <span>{out.label}</span>
                      {isSelected && <Check className="size-3.5 shrink-0" />}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* 2. Inline Quick Notes & Fast Tags */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-bold text-foreground">2. Quick Notes</Label>
                <span className="text-[10px] text-muted-foreground">Click tag to append</span>
              </div>

              {/* Fast Tag Chips */}
              <div className="flex flex-wrap gap-1.5">
                {QUICK_TAGS.map((tag) => (
                  <button
                    key={tag}
                    onClick={() => addQuickTag(tag)}
                    className="px-2 py-0.5 rounded-md bg-muted/60 hover:bg-muted text-[10px] text-muted-foreground hover:text-foreground border border-border/60 transition cursor-pointer"
                  >
                    + {tag}
                  </button>
                ))}
              </div>

              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Type summary of conversation, prospect requirements, next steps..."
                rows={3}
                className="w-full rounded-xl border border-input bg-background p-3 text-xs text-foreground placeholder:text-muted-foreground/60 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            {/* 3. WhatsApp Quick-Send Templates */}
            <div className="space-y-2">
              <Label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <MessageSquare className="size-3.5 text-emerald-400" />
                3. Dispatch Instant WhatsApp Template
              </Label>
              <div className="grid grid-cols-2 gap-2">
                {WHATSAPP_TEMPLATES.map((tmpl) => {
                  const isSent = whatsappSent === tmpl.id
                  return (
                    <Button
                      key={tmpl.id}
                      variant="outline"
                      size="sm"
                      onClick={() => handleSendWhatsApp(tmpl)}
                      className={`h-9 text-xs justify-between font-medium border-border/80 ${
                        isSent ? 'border-emerald-500 bg-emerald-500/10 text-emerald-500' : ''
                      }`}
                    >
                      <span className="truncate">{tmpl.title}</span>
                      {isSent ? <Check className="size-3.5 text-emerald-500" /> : <Send className="size-3 text-muted-foreground" />}
                    </Button>
                  )
                })}
              </div>
            </div>

            {/* 4. Schedule Follow-Up Callback Picker */}
            <div className="space-y-2">
              <Label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <Calendar className="size-3.5 text-primary" />
                4. Next Follow-Up Schedule
              </Label>
              <div className="flex flex-wrap gap-2">
                {['In 30 mins', 'Today 4:00 PM', 'Tomorrow 11:00 AM', 'Next Monday'].map((preset) => (
                  <button
                    key={preset}
                    onClick={() => setCallbackTime(preset)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition cursor-pointer ${
                      callbackTime === preset
                        ? 'bg-primary/15 text-primary border-primary'
                        : 'border-border bg-muted/30 text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>

            {/* Bottom Actions: Next Lead */}
            <div className="pt-3 border-t border-border flex items-center justify-between">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  if (currentIndex > 0) setCurrentIndex((prev) => prev - 1)
                }}
                disabled={currentIndex === 0}
                className="text-xs"
              >
                Previous Lead
              </Button>

              <Button
                onClick={handleNextLead}
                className="gap-1.5 font-bold shadow-md bg-primary text-primary-foreground"
              >
                Save & Next Lead in Queue <ChevronRight className="size-4" />
              </Button>
            </div>
          </div>

        </div>
      </DialogContent>
    </Dialog>
  )
}

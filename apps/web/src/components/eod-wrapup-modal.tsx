'use client'

import { useState } from 'react'
import {
  FileText,
  Clock,
  PhoneCall,
  CheckCircle2,
  TrendingUp,
  LogOut,
  Sparkles,
  Loader2,
  ShieldCheck,
  Send,
  CalendarCheck,
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'

interface EodWrapUpModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  shiftMetrics?: {
    shiftDuration: string
    callsMade: number
    callsConnected: number
    talkTime: string
    dealsMoved: number
    revenueValue: string
  }
  onSubmitEod?: (summaryNotes: string) => void
}

export function EodWrapUpModal({
  open,
  onOpenChange,
  shiftMetrics = {
    shiftDuration: '7h 45m',
    callsMade: 74,
    callsConnected: 62,
    talkTime: '3h 48m',
    dealsMoved: 5,
    revenueValue: '₹85,000',
  },
  onSubmitEod,
}: EodWrapUpModalProps) {
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const handleSubmit = () => {
    setSubmitting(true)
    setTimeout(() => {
      setSubmitting(false)
      setSubmitted(true)
      if (onSubmitEod) {
        onSubmitEod(notes)
      }
      toast.success('Shift EOD report submitted & punched out successfully!')
    }, 1200)
  }

  const handleClose = () => {
    onOpenChange(false)
    setTimeout(() => {
      setSubmitted(false)
      setNotes('')
    }, 300)
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg bg-card border-border">
        <DialogHeader>
          <div className="flex items-center gap-2.5">
            <div className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <CalendarCheck className="size-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold">End of Day (EOD) Wrap-Up</DialogTitle>
              <DialogDescription className="text-xs">
                Auto-calculated shift performance summary and punch-out
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {!submitted ? (
          <div className="space-y-4 py-2 text-xs">
            {/* Auto-Calculated Shift Metrics Grid */}
            <div className="grid grid-cols-3 gap-2.5">
              <div className="rounded-xl border border-border bg-muted/40 p-3 text-center">
                <span className="text-muted-foreground text-[10px] block font-medium">Shift Time</span>
                <span className="font-mono text-base font-bold text-foreground mt-0.5 block">
                  {shiftMetrics.shiftDuration}
                </span>
                <span className="text-[9px] text-emerald-500 font-semibold">Logged In</span>
              </div>

              <div className="rounded-xl border border-border bg-muted/40 p-3 text-center">
                <span className="text-muted-foreground text-[10px] block font-medium">Calls Conn.</span>
                <span className="font-mono text-base font-bold text-foreground mt-0.5 block">
                  {shiftMetrics.callsConnected} / {shiftMetrics.callsMade}
                </span>
                <span className="text-[9px] text-cyan-500 font-semibold">
                  {((shiftMetrics.callsConnected / shiftMetrics.callsMade) * 100).toFixed(0)}% Conn. Rate
                </span>
              </div>

              <div className="rounded-xl border border-border bg-muted/40 p-3 text-center">
                <span className="text-muted-foreground text-[10px] block font-medium">Total Talk Time</span>
                <span className="font-mono text-base font-bold text-foreground mt-0.5 block">
                  {shiftMetrics.talkTime}
                </span>
                <span className="text-[9px] text-amber-500 font-semibold">Live Calling</span>
              </div>
            </div>

            {/* Deals & Conversions Summary */}
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex size-7 items-center justify-center rounded-lg bg-primary/20 text-primary">
                  <TrendingUp className="size-3.5" />
                </div>
                <div>
                  <span className="font-bold text-foreground block">Deals Moved / Closed</span>
                  <span className="text-[10px] text-muted-foreground">Pipeline value generated</span>
                </div>
              </div>
              <div className="text-right">
                <span className="font-mono font-bold text-sm text-foreground block">
                  {shiftMetrics.dealsMoved} Deals
                </span>
                <span className="text-[10px] font-bold text-emerald-500">{shiftMetrics.revenueValue}</span>
              </div>
            </div>

            {/* Agent Summary Notes */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-foreground">
                Agent Shift Notes & Highlights (Optional)
              </Label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="E.g., Closed 2 high-ticket clients for 3BHK project, 5 hot callbacks queued for tomorrow morning..."
                rows={3}
                className="w-full rounded-xl border border-input bg-background p-3 text-xs text-foreground placeholder:text-muted-foreground/60 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>
        ) : (
          <div className="py-6 text-center space-y-3">
            <div className="flex size-14 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-500 mx-auto">
              <CheckCircle2 className="size-8" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-foreground">Punched Out Successfully!</h3>
              <p className="text-xs text-muted-foreground mt-1">
                Your EOD report has been submitted to your sales manager. Great work today!
              </p>
            </div>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          {!submitted ? (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={submitting}
                className="gap-1.5 bg-rose-600 hover:bg-rose-500 text-white font-bold"
              >
                {submitting ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin" /> Submitting...
                  </>
                ) : (
                  <>
                    <LogOut className="size-3.5" /> Submit EOD & Punch Out
                  </>
                )}
              </Button>
            </>
          ) : (
            <Button onClick={handleClose}>Close</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

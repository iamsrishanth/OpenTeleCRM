'use client'

import { useState } from 'react'
import {
  CreditCard,
  Zap,
  CheckCircle2,
  Users,
  MessageSquare,
  PhoneCall,
  HardDrive,
  Download,
  Plus,
  ShieldCheck,
  Sparkles,
  ArrowUpRight,
  TrendingUp,
  Clock,
  Loader2,
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
import { toast } from 'sonner'

export default function BillingPage() {
  const [recharging, setRecharging] = useState<string | null>(null)

  const handleRecharge = (packName: string) => {
    setRecharging(packName)
    setTimeout(() => {
      setRecharging(null)
      toast.success(`${packName} activated successfully!`)
    }, 1200)
  }

  const invoices = [
    { id: 'INV-2026-008', date: 'Aug 01, 2026', plan: 'Enterprise Annual (25 Seats)', amount: '₹1,49,990', status: 'Paid' },
    { id: 'INV-2026-007', date: 'Jul 15, 2026', plan: 'WhatsApp Booster Pack (20,000 msgs)', amount: '₹9,990', status: 'Paid' },
    { id: 'INV-2026-006', date: 'Jun 10, 2026', plan: 'Calling Minutes Addon (10,000 mins)', amount: '₹14,990', status: 'Paid' },
    { id: 'INV-2026-005', date: 'May 01, 2026', plan: 'Enterprise Annual Renewal', amount: '₹1,49,990', status: 'Paid' },
  ]

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <CreditCard className="size-5 text-primary" />
              Billing & Subscription Usage
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Monitor active telecaller seats, WhatsApp broadcast credits, and call minutes
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="text-xs gap-1.5"
              onClick={() => toast.info('Invoices statement downloaded')}
            >
              <Download className="size-3.5" /> Download Tax Statement
            </Button>
          </div>
        </div>

        {/* Current Plan Overview Card */}
        <Card className="border-border bg-gradient-to-r from-card to-primary/5 shadow-xs">
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Badge className="bg-primary text-primary-foreground font-bold text-xs">
                    ACTIVE PLAN
                  </Badge>
                  <span className="text-xs text-muted-foreground">• Renews on Nov 15, 2026</span>
                </div>
                <h2 className="text-2xl font-black text-foreground">
                  Enterprise Telecalling Suite
                </h2>
                <p className="text-xs text-muted-foreground max-w-xl leading-relaxed">
                  Includes 25 full telecaller agent licenses, automatic call recording with cloud sync, unlimited CRM leads, official WhatsApp Cloud API access, and webhook automations.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                <Button
                  onClick={() => toast.success('Redirecting to plan upgrade portal...')}
                  className="gap-1.5 font-bold shadow-md"
                >
                  <Sparkles className="size-4" /> Upgrade Plan
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Resource Usage Progress Trackers */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Agent Seats */}
          <Card className="border-border">
            <CardContent className="p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Users className="size-4" />
                </div>
                <Badge variant="outline" className="text-[10px] font-bold text-primary">
                  18 / 25 Used
                </Badge>
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium">Telecaller Seats</p>
                <div className="flex items-baseline justify-between mt-1">
                  <span className="text-xl font-bold text-foreground">72%</span>
                  <span className="text-xs text-muted-foreground">7 seats available</span>
                </div>
                {/* Progress bar */}
                <div className="w-full h-2 rounded-full bg-muted mt-2 overflow-hidden">
                  <div className="h-full rounded-full bg-primary" style={{ width: '72%' }} />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* WhatsApp Credits */}
          <Card className="border-border">
            <CardContent className="p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex size-9 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-500">
                  <MessageSquare className="size-4" />
                </div>
                <Badge variant="outline" className="text-[10px] font-bold text-emerald-500 bg-emerald-500/5 border-emerald-500/20">
                  4,320 Left
                </Badge>
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium">WhatsApp Broadcast Credits</p>
                <div className="flex items-baseline justify-between mt-1">
                  <span className="text-xl font-bold text-foreground">43%</span>
                  <span className="text-xs text-muted-foreground">of 10,000 pool</span>
                </div>
                {/* Progress bar */}
                <div className="w-full h-2 rounded-full bg-muted mt-2 overflow-hidden">
                  <div className="h-full rounded-full bg-emerald-500" style={{ width: '43%' }} />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Calling Minutes */}
          <Card className="border-border">
            <CardContent className="p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex size-9 items-center justify-center rounded-lg bg-cyan-500/10 text-cyan-500">
                  <PhoneCall className="size-4" />
                </div>
                <Badge variant="outline" className="text-[10px] font-bold text-cyan-500 bg-cyan-500/5 border-cyan-500/20">
                  12,450 Used
                </Badge>
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium">Calling Minutes</p>
                <div className="flex items-baseline justify-between mt-1">
                  <span className="text-xl font-bold text-foreground">62%</span>
                  <span className="text-xs text-muted-foreground">7,550 mins remaining</span>
                </div>
                {/* Progress bar */}
                <div className="w-full h-2 rounded-full bg-muted mt-2 overflow-hidden">
                  <div className="h-full rounded-full bg-cyan-500" style={{ width: '62%' }} />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Cloud Storage */}
          <Card className="border-border">
            <CardContent className="p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex size-9 items-center justify-center rounded-lg bg-amber-500/10 text-amber-500">
                  <HardDrive className="size-4" />
                </div>
                <Badge variant="outline" className="text-[10px] font-bold text-amber-500 bg-amber-500/5 border-amber-500/20">
                  64 GB / 200 GB
                </Badge>
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium">Call Recordings Storage</p>
                <div className="flex items-baseline justify-between mt-1">
                  <span className="text-xl font-bold text-foreground">32%</span>
                  <span className="text-xs text-muted-foreground">136 GB free</span>
                </div>
                {/* Progress bar */}
                <div className="w-full h-2 rounded-full bg-muted mt-2 overflow-hidden">
                  <div className="h-full rounded-full bg-amber-500" style={{ width: '32%' }} />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Top-Up Booster Packs */}
        <div className="space-y-3">
          <h3 className="text-sm font-bold text-foreground">Quick Resource Top-Up Packs</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="border-border hover:border-primary/40 transition-colors">
              <CardContent className="p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-foreground">WhatsApp Broadcast Booster</span>
                  <Badge variant="secondary" className="text-[10px]">Instant</Badge>
                </div>
                <p className="text-xl font-black text-foreground">₹4,990 <span className="text-xs font-normal text-muted-foreground">/ 10,000 msgs</span></p>
                <p className="text-xs text-muted-foreground">
                  Valid with official Meta WhatsApp Cloud API without expiry.
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full text-xs font-semibold"
                  disabled={recharging === 'whatsapp'}
                  onClick={() => handleRecharge('whatsapp')}
                >
                  {recharging === 'whatsapp' ? <Loader2 className="size-3.5 animate-spin" /> : 'Recharge Credits'}
                </Button>
              </CardContent>
            </Card>

            <Card className="border-border hover:border-primary/40 transition-colors">
              <CardContent className="p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-foreground">Calling Minutes Pack</span>
                  <Badge variant="secondary" className="text-[10px]">Instant</Badge>
                </div>
                <p className="text-xl font-black text-foreground">₹6,990 <span className="text-xs font-normal text-muted-foreground">/ 5,000 mins</span></p>
                <p className="text-xs text-muted-foreground">
                  High-fidelity outbound calling channels with automatic recording.
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full text-xs font-semibold"
                  disabled={recharging === 'minutes'}
                  onClick={() => handleRecharge('minutes')}
                >
                  {recharging === 'minutes' ? <Loader2 className="size-3.5 animate-spin" /> : 'Recharge Minutes'}
                </Button>
              </CardContent>
            </Card>

            <Card className="border-border hover:border-primary/40 transition-colors">
              <CardContent className="p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-foreground">Add Telecaller Seats</span>
                  <Badge variant="secondary" className="text-[10px]">Flexible</Badge>
                </div>
                <p className="text-xl font-black text-foreground">₹590 <span className="text-xs font-normal text-muted-foreground">/ seat / month</span></p>
                <p className="text-xs text-muted-foreground">
                  Add more calling agents and mobile licenses immediately.
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full text-xs font-semibold"
                  disabled={recharging === 'seats'}
                  onClick={() => handleRecharge('seats')}
                >
                  {recharging === 'seats' ? <Loader2 className="size-3.5 animate-spin" /> : 'Add 5 Agent Seats'}
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Invoice History Table */}
        <Card className="border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-bold">Billing History & Invoices</CardTitle>
            <CardDescription className="text-xs">
              Download your past GST invoices and transaction history
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="border-b border-border text-muted-foreground font-semibold">
                    <th className="pb-3">Invoice #</th>
                    <th className="pb-3">Billing Date</th>
                    <th className="pb-3">Plan / Description</th>
                    <th className="pb-3">Amount</th>
                    <th className="pb-3">Status</th>
                    <th className="pb-3 text-right">Receipt</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {invoices.map((inv) => (
                    <tr key={inv.id} className="hover:bg-muted/40 transition-colors">
                      <td className="py-3 font-mono font-semibold text-foreground">{inv.id}</td>
                      <td className="py-3 text-muted-foreground">{inv.date}</td>
                      <td className="py-3 text-foreground font-medium">{inv.plan}</td>
                      <td className="py-3 font-semibold text-foreground tabular-nums">{inv.amount}</td>
                      <td className="py-3">
                        <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 text-[10px]">
                          {inv.status}
                        </Badge>
                      </td>
                      <td className="py-3 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-[11px] gap-1 text-primary hover:text-primary"
                          onClick={() => toast.success(`Downloading ${inv.id}.pdf`)}
                        >
                          <Download className="size-3" /> PDF
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  )
}

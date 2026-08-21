'use client'

import {
  PhoneCall,
  PhoneIncoming,
  PhoneMissed,
  Clock,
  TrendingUp,
  IndianRupee,
  CalendarClock,
  Sparkles,
  ArrowUpRight,
  Zap,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

export function CallStatsOverview() {
  const metrics = [
    {
      label: 'Calls Connected vs Missed',
      value: '482 / 520',
      sub: '92.7% Connection Rate',
      trend: '+8.4%',
      icon: PhoneCall,
      accent: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    },
    {
      label: 'Total Talk Time',
      value: '38h 14m',
      sub: 'Avg 3m 48s per call',
      trend: '+12.3%',
      icon: Clock,
      accent: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20',
    },
    {
      label: 'Closed Deals / Revenue',
      value: '₹4,85,000',
      sub: '24 deals closed today',
      trend: '+15.8%',
      icon: TrendingUp,
      accent: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
    },
    {
      label: 'Callbacks & Follow-ups',
      value: '34 Due',
      sub: '12 high-priority scheduled',
      trend: '94% SLA',
      icon: CalendarClock,
      accent: 'text-rose-400 bg-rose-500/10 border-rose-500/20',
    },
  ]

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {metrics.map(({ label, value, sub, trend, icon: Icon, accent }) => (
        <Card key={label} className="border-border shadow-xs hover:border-primary/40 transition-colors">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div className={`flex size-10 items-center justify-center rounded-xl border ${accent}`}>
                <Icon className="size-5" />
              </div>
              <Badge variant="outline" className="text-[10px] font-bold text-emerald-500 bg-emerald-500/5 border-emerald-500/20">
                {trend}
              </Badge>
            </div>
            <div className="mt-3">
              <p className="text-xs text-muted-foreground font-medium">{label}</p>
              <p className="text-2xl font-bold tracking-tight text-foreground tabular-nums mt-0.5">
                {value}
              </p>
              <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                <span>{sub}</span>
              </p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

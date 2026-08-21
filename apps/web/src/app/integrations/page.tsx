'use client'

import { useState } from 'react'
import {
  Blocks,
  Search,
  CheckCircle2,
  Plug,
  ExternalLink,
  Settings2,
  Layers,
  Sparkles,
  ShieldCheck,
  Zap,
  Share2,
  MessageSquare,
  FileSpreadsheet,
  Building2,
  ShoppingBag,
  CreditCard,
  X,
  Copy,
  RefreshCw,
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
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'

interface IntegrationItem {
  id: string
  name: string
  category: 'lead_gen' | 'messaging' | 'automation' | 'portals' | 'ecommerce'
  categoryLabel: string
  description: string
  icon: any
  status: 'connected' | 'available' | 'configured'
  badge?: string
  leadsSynced?: string
  lastSync?: string
}

const INTEGRATIONS: IntegrationItem[] = [
  {
    id: 'meta-ads',
    name: 'Meta / Facebook Lead Ads',
    category: 'lead_gen',
    categoryLabel: 'Lead Generation',
    description: 'Instant zero-latency lead sync from Instagram & Facebook lead generation campaigns.',
    icon: Share2,
    status: 'connected',
    badge: 'POPULAR',
    leadsSynced: '3,842 leads',
    lastSync: '2 mins ago',
  },
  {
    id: 'whatsapp-cloud',
    name: 'WhatsApp Cloud API',
    category: 'messaging',
    categoryLabel: 'Messaging & Chat',
    description: 'Official Meta WhatsApp Business API for bulk broadcasts, interactive chatbots & templates.',
    icon: MessageSquare,
    status: 'connected',
    badge: 'VERIFIED',
    leadsSynced: '14,210 msgs',
    lastSync: 'Just now',
  },
  {
    id: 'google-sheets',
    name: 'Google Sheets & Forms',
    category: 'automation',
    categoryLabel: 'Automation & CRM',
    description: '2-way live synchronization. Export call logs and auto-import new spreadsheet submissions.',
    icon: FileSpreadsheet,
    status: 'connected',
    leadsSynced: '1,290 rows',
    lastSync: '15 mins ago',
  },
  {
    id: 'zapier',
    name: 'Zapier & Make.com',
    category: 'automation',
    categoryLabel: 'Automation & CRM',
    description: 'Connect TeleCRM with 5,000+ business applications, trigger custom pipelines on call end.',
    icon: Zap,
    status: 'available',
  },
  {
    id: 'indiamart',
    name: 'IndiaMART & JustDial',
    category: 'portals',
    categoryLabel: 'Marketplace Portals',
    description: 'Auto-capture buyer inquiries from IndiaMART and JustDial verified seller accounts.',
    icon: Building2,
    status: 'connected',
    badge: 'INDIA B2B',
    leadsSynced: '840 leads',
    lastSync: '1 hour ago',
  },
  {
    id: 'housing-portals',
    name: 'Housing.com & 99acres',
    category: 'portals',
    categoryLabel: 'Real Estate Portals',
    description: 'Direct inquiry ingest from property listing portals with auto-agent round-robin allocation.',
    icon: Building2,
    status: 'available',
    badge: 'REAL ESTATE',
  },
  {
    id: 'shopify',
    name: 'Shopify & WooCommerce',
    category: 'ecommerce',
    categoryLabel: 'E-Commerce',
    description: 'Automated Cash on Delivery (COD) confirmation calls & abandoned checkout recovery.',
    icon: ShoppingBag,
    status: 'available',
  },
  {
    id: 'razorpay',
    name: 'Razorpay & Cashfree',
    category: 'ecommerce',
    categoryLabel: 'Payments',
    description: 'Generate payment links during live calls via WhatsApp and track instant transaction status.',
    icon: CreditCard,
    status: 'available',
  },
]

export default function IntegrationsPage() {
  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState<string>('all')
  const [selectedApp, setSelectedApp] = useState<IntegrationItem | null>(null)
  const [apiKey, setApiKey] = useState('')
  const [connecting, setConnecting] = useState(false)

  const filtered = INTEGRATIONS.filter((item) => {
    const matchesSearch =
      item.name.toLowerCase().includes(search.toLowerCase()) ||
      item.description.toLowerCase().includes(search.toLowerCase())
    const matchesCat = activeCategory === 'all' || item.category === activeCategory
    return matchesSearch && matchesCat
  })

  const handleConnect = () => {
    setConnecting(true)
    setTimeout(() => {
      setConnecting(false)
      toast.success(`${selectedApp?.name} configured & synced successfully!`)
      setSelectedApp(null)
      setApiKey('')
    }, 1200)
  }

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <Blocks className="size-5 text-primary" />
              Integrations & App Store
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Connect external lead sources, messaging gateways, and automation tools
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative w-64">
              <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search integrations..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-9 pl-8 text-xs bg-muted/30"
              />
            </div>
          </div>
        </div>

        {/* Categories Bar */}
        <div className="flex flex-wrap items-center gap-1.5 border-b border-border pb-3">
          {[
            { id: 'all', label: 'All Apps (8)' },
            { id: 'lead_gen', label: 'Lead Generation' },
            { id: 'messaging', label: 'WhatsApp & Messaging' },
            { id: 'automation', label: 'Workflows & Sheets' },
            { id: 'portals', label: 'Real Estate & Portals' },
            { id: 'ecommerce', label: 'E-Commerce & Payments' },
          ].map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                activeCategory === cat.id
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Integrations Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((item) => {
            const Icon = item.icon
            const isConnected = item.status === 'connected'
            return (
              <Card
                key={item.id}
                className={`border transition-all hover:border-primary/50 flex flex-col justify-between ${
                  isConnected ? 'border-border bg-card' : 'border-border/60 bg-card/60'
                }`}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20">
                      <Icon className="size-5" />
                    </div>
                    <div className="flex items-center gap-1.5">
                      {item.badge && (
                        <Badge variant="outline" className="text-[10px] font-bold bg-primary/5 text-primary border-primary/20">
                          {item.badge}
                        </Badge>
                      )}
                      {isConnected ? (
                        <Badge className="bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 text-[10px] font-bold gap-1">
                          <CheckCircle2 className="size-3" /> Connected
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="text-[10px] font-medium">
                          Available
                        </Badge>
                      )}
                    </div>
                  </div>

                  <div className="pt-2">
                    <CardTitle className="text-sm font-bold text-foreground">{item.name}</CardTitle>
                    <CardDescription className="text-xs text-muted-foreground mt-1 line-clamp-2">
                      {item.description}
                    </CardDescription>
                  </div>
                </CardHeader>

                <CardContent className="pt-0 pb-4">
                  {isConnected && item.leadsSynced && (
                    <div className="mb-3 rounded-md bg-muted/40 p-2 text-[11px] flex items-center justify-between text-muted-foreground">
                      <span>Synced: <strong className="text-foreground">{item.leadsSynced}</strong></span>
                      <span>Last: {item.lastSync}</span>
                    </div>
                  )}

                  <div className="flex items-center justify-between gap-2 pt-2 border-t border-border/60">
                    <span className="text-[10px] font-medium text-muted-foreground uppercase">
                      {item.categoryLabel}
                    </span>
                    <Button
                      variant={isConnected ? 'outline' : 'default'}
                      size="sm"
                      onClick={() => setSelectedApp(item)}
                      className="h-8 text-xs font-semibold gap-1.5"
                    >
                      {isConnected ? (
                        <>
                          <Settings2 className="size-3.5" /> Manage
                        </>
                      ) : (
                        <>
                          <Plug className="size-3.5" /> Connect
                        </>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>

        {/* Configuration Modal */}
        {selectedApp && (
          <Dialog open={!!selectedApp} onOpenChange={() => setSelectedApp(null)}>
            <DialogContent className="max-w-lg bg-card border-border">
              <DialogHeader>
                <div className="flex items-center gap-2.5">
                  <div className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <selectedApp.icon className="size-4" />
                  </div>
                  <div>
                    <DialogTitle className="text-base">{selectedApp.name} Configuration</DialogTitle>
                    <DialogDescription className="text-xs">
                      Manage authentication credentials and live webhook syncing
                    </DialogDescription>
                  </div>
                </div>
              </DialogHeader>

              <div className="space-y-4 py-2 text-xs">
                <div className="space-y-1.5">
                  <Label htmlFor="webhookUrl" className="text-xs">Incoming Webhook URL</Label>
                  <div className="flex gap-2">
                    <Input
                      id="webhookUrl"
                      readOnly
                      value={`https://api.telecrm.in/v2/integrations/${selectedApp.id}/webhook`}
                      className="font-mono text-[11px] bg-muted/30"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        toast.success('Webhook URL copied to clipboard!')
                      }}
                    >
                      <Copy className="size-3.5" />
                    </Button>
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    Paste this URL into your {selectedApp.name} developer portal or webhook settings.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="apiKey" className="text-xs">API Key / Access Token</Label>
                  <Input
                    id="apiKey"
                    type="password"
                    placeholder="e.g. eaab_meta_token_..."
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    className="font-mono text-xs"
                  />
                </div>

                <div className="rounded-lg border border-border p-3 space-y-1.5 bg-muted/20">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-foreground">Auto Lead Ingest & Dialer Sync</span>
                    <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 text-[10px]">
                      ACTIVE
                    </Badge>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Automatically trigger WhatsApp welcome message and queue new contacts in active dialer campaigns.
                  </p>
                </div>
              </div>

              <DialogFooter className="gap-2 sm:gap-0">
                <Button variant="outline" onClick={() => setSelectedApp(null)}>
                  Close
                </Button>
                <Button onClick={handleConnect} disabled={connecting} className="gap-1.5">
                  {connecting ? (
                    <>
                      <Loader2 className="size-3.5 animate-spin" /> Verifying...
                    </>
                  ) : (
                    <>Save & Sync Integration</>
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>
    </AppShell>
  )
}

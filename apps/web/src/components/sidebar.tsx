'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import {
  BarChart3,
  BellRing,
  Blocks,
  Building2,
  CalendarCheck,
  CreditCard,
  FileText,
  Headphones,
  LayoutDashboard,
  ListChecks,
  ListOrdered,
  LogOut,
  Megaphone,
  MessageSquare,
  PhoneCall,
  Settings,
  Sparkles,
  UserCheck,
  Users,
  Webhook,
  Workflow,
  ShieldCheck,
  ArrowLeftRight,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { api } from '@/lib/api'
import { useAuth } from '@/lib/auth-context'
import { asList, type WhatsAppConversation } from '@/lib/types'
import { Badge } from '@/components/ui/badge'

const AGENT_NAV = [
  { href: '/agent', label: 'Calling Hub', icon: Headphones },
  { href: '/agent/leads', label: 'My Leads', icon: UserCheck },
  { href: '/agent/inbox', label: 'Agent Inbox', icon: MessageSquare },
  { href: '/dialer', label: 'Auto Dialer', icon: PhoneCall },
]

const ADMIN_CRM_NAV = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/leads', label: 'All Leads', icon: Users },
  { href: '/inbox', label: 'Inbox', icon: MessageSquare },
  { href: '/integrations', label: 'Integrations', icon: Blocks },
  { href: '/automations', label: 'Automations', icon: Workflow },
  { href: '/sequences', label: 'Sequences', icon: ListOrdered },
  { href: '/templates', label: 'Templates', icon: Megaphone },
  { href: '/broadcasts', label: 'Broadcasts', icon: BellRing },
  { href: '/callbacks', label: 'Callbacks', icon: PhoneCall },
  { href: '/webhooks', label: 'Webhooks', icon: Webhook },
]

const WORKFORCE_NAV = [
  { href: '/attendance', label: 'Attendance', icon: CalendarCheck },
  { href: '/eod', label: 'EOD Reports', icon: FileText },
  { href: '/tasks', label: 'Tasks', icon: ListChecks },
  { href: '/reports', label: 'Reports', icon: BarChart3 },
]

const ADMIN_SETTINGS_NAV = [
  { href: '/admin/team', label: 'Team & Roles', icon: Users },
  { href: '/admin/departments', label: 'Departments', icon: Building2 },
  { href: '/billing', label: 'Billing & Usage', icon: CreditCard },
  { href: '/settings', label: 'Settings', icon: Settings },
]

export function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const { token, enterpriseId, userRole, setRole, logout } = useAuth()
  const [unread, setUnread] = useState(0)

  const isAgent = userRole === 'agent'
  const isAdmin = userRole === 'admin'

  useEffect(() => {
    if (!token || !enterpriseId) return
    let cancelled = false
    api
      .get<unknown>('/whatsapp/conversations')
      .then((data) => {
        if (cancelled) return
        const convs = asList<WhatsAppConversation>(data)
        setUnread(convs.reduce((sum, c) => sum + (c.unread ?? 0), 0))
      })
      .catch(() => {
        /* non-critical */
      })
    return () => {
      cancelled = true
    }
  }, [token, enterpriseId])

  const homeHref = isAgent ? '/agent' : '/dashboard'

  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-border bg-sidebar">
      {/* Brand Header */}
      <Link
        href={homeHref}
        className="flex h-14 shrink-0 items-center justify-between border-b border-sidebar-border px-4 hover:bg-sidebar-accent/50 transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <div className="flex size-7 items-center justify-center rounded-md bg-primary text-sm font-bold text-primary-foreground">
            T
          </div>
          <span className="text-sm font-bold tracking-tight">OpenTeleCRM</span>
        </div>
        <Badge
          variant="outline"
          className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 ${
            isAgent
              ? 'bg-cyan-500/10 text-cyan-500 border-cyan-500/30'
              : 'bg-primary/10 text-primary border-primary/30'
          }`}
        >
          {isAgent ? 'AGENT' : 'ADMIN'}
        </Badge>
      </Link>

      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        {/* Telecaller Section */}
        <div>
          <p className="px-3 pb-1.5 text-[10px] font-bold uppercase tracking-wider text-primary">
            {isAgent ? 'Telecaller Workspace' : 'Telecaller Desk'}
          </p>
          {AGENT_NAV.map(({ href, label, icon: Icon }) => {
            const active = pathname === href
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  'flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors font-medium',
                  active
                    ? 'bg-primary/15 font-bold text-primary'
                    : 'text-foreground/90 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                )}
              >
                <Icon className="size-4 text-primary" />
                <span className="flex-1">{label}</span>
              </Link>
            )
          })}
        </div>

        {/* CRM Pipeline Modules (Shown to Admin) */}
        {isAdmin && (
          <div className="pt-3">
            <p className="px-3 pb-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">
              Admin CRM & Pipelines
            </p>
            {ADMIN_CRM_NAV.map(({ href, label, icon: Icon }) => {
              const active = pathname === href
              return (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    'flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors',
                    active
                      ? 'bg-primary/15 font-medium text-primary'
                      : 'text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                  )}
                >
                  <Icon className="size-4" />
                  <span className="flex-1">{label}</span>
                  {href === '/inbox' && unread > 0 && (
                    <span className="flex size-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                      {unread > 99 ? '99+' : unread}
                    </span>
                  )}
                </Link>
              )
            })}
          </div>
        )}

        {/* Workforce Section */}
        <div className="pt-3">
          <p className="px-3 pb-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">
            Workforce & Shifts
          </p>
          {WORKFORCE_NAV.map(({ href, label, icon: Icon }) => {
            const active = pathname.startsWith(href)
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  'flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors',
                  active
                    ? 'bg-primary/15 font-medium text-primary'
                    : 'text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                )}
              >
                <Icon className="size-4" />
                <span className="flex-1">{label}</span>
              </Link>
            )
          })}
        </div>

        {/* Admin Settings & Billing (Admin Only) */}
        {isAdmin && (
          <div className="pt-3">
            <p className="px-3 pb-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">
              Admin & Enterprise
            </p>
            {ADMIN_SETTINGS_NAV.map(({ href, label, icon: Icon }) => {
              const active = pathname.startsWith(href)
              return (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    'flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors',
                    active
                      ? 'bg-primary/15 font-medium text-primary'
                      : 'text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                  )}
                >
                  <Icon className="size-4" />
                  <span className="flex-1">{label}</span>
                </Link>
              )
            })}
          </div>
        )}
      </nav>

      {/* Role Switcher & Sign Out Bar */}
      <div className="border-t border-sidebar-border p-3 space-y-1.5">
        <button
          onClick={() => {
            const nextRole = isAgent ? 'admin' : 'agent'
            setRole(nextRole)
            router.push(nextRole === 'agent' ? '/agent' : '/dashboard')
          }}
          className="flex w-full items-center gap-2.5 rounded-md px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground cursor-pointer"
        >
          <ArrowLeftRight className="size-3.5 text-primary" />
          <span className="truncate">
            Switch to {isAgent ? 'Admin' : 'Agent'} Mode
          </span>
        </button>

        <button
          onClick={() => {
            logout()
            router.replace('/login')
          }}
          className="flex w-full items-center gap-2.5 rounded-md px-3 py-1.5 text-xs text-rose-400/80 transition-colors hover:bg-rose-500/10 hover:text-rose-400 cursor-pointer"
        >
          <LogOut className="size-3.5" />
          Sign out
        </button>
      </div>
    </aside>
  )
}

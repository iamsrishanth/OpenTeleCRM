'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import {
  BellRing,
  LayoutDashboard,
  ListOrdered,
  LogOut,
  Megaphone,
  MessageSquare,
  PhoneCall,
  Settings,
  Users,
  Webhook,
  Workflow,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { api } from '@/lib/api'
import { useAuth } from '@/lib/auth-context'
import { asList, type WhatsAppConversation } from '@/lib/types'

const NAV = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/leads', label: 'Leads', icon: Users },
  { href: '/inbox', label: 'Inbox', icon: MessageSquare },
  { href: '/dialer', label: 'Dialer', icon: PhoneCall },
  { href: '/automations', label: 'Automations', icon: Workflow },
  { href: '/sequences', label: 'Sequences', icon: ListOrdered },
  { href: '/templates', label: 'Templates', icon: Megaphone },
  { href: '/broadcasts', label: 'Broadcasts', icon: BellRing },
  { href: '/callbacks', label: 'Callbacks', icon: PhoneCall },
  { href: '/webhooks', label: 'Webhooks', icon: Webhook },
  { href: '/settings', label: 'Settings', icon: Settings },
]

export function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const { token, enterpriseId, logout } = useAuth()
  const [unread, setUnread] = useState(0)

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
        /* sidebar badge is non-critical */
      })
    return () => {
      cancelled = true
    }
  }, [token, enterpriseId])

  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-border bg-sidebar">
      <div className="flex h-14 shrink-0 items-center gap-2.5 border-b border-sidebar-border px-4">
        <div className="flex size-7 items-center justify-center rounded-md bg-primary text-sm font-bold text-primary-foreground">
          T
        </div>
        <span className="text-sm font-semibold tracking-tight">
          OpenTeleCRM
        </span>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active =
            href === '/' ? pathname === '/' : pathname.startsWith(href)
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
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-semibold text-primary-foreground">
                  {unread}
                </span>
              )}
            </Link>
          )
        })}
      </nav>

      <div className="border-t border-sidebar-border p-3">
        <button
          onClick={() => {
            logout()
            router.replace('/login')
          }}
          className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
        >
          <LogOut className="size-4" />
          Sign out
        </button>
      </div>
    </aside>
  )
}

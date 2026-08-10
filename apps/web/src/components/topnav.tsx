'use client'

import { usePathname } from 'next/navigation'
import { Search } from 'lucide-react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Input } from '@/components/ui/input'
import { ThemeToggle } from '@/components/theme'

const TITLES: Record<string, string> = {
  '/': 'Dashboard',
  '/leads': 'Leads',
  '/inbox': 'Inbox',
  '/settings': 'Settings',
  '/login': 'Sign in',
  '/attendance': 'Attendance',
  '/eod': 'EOD Reports',
  '/tasks': 'Tasks',
  '/reports': 'Reports',
  '/admin/departments': 'Departments',
  '/admin/team': 'Team',
}

export function Topnav() {
  const pathname = usePathname()

  let title = TITLES[pathname] ?? 'OpenTeleCRM'
  if (pathname.startsWith('/leads/')) title = 'Lead Detail'

  return (
    <header className="flex h-14 shrink-0 items-center gap-4 border-b border-border bg-background px-6">
      <h1 className="text-base font-semibold tracking-tight">{title}</h1>
      <div className="relative ml-auto hidden w-64 sm:block">
        <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="Search…" className="h-9 bg-muted/40 pl-8" />
      </div>
      <ThemeToggle />
      <Avatar className="size-8">
        <AvatarFallback className="bg-primary/15 text-xs font-semibold text-primary">
          OP
        </AvatarFallback>
      </Avatar>
    </header>
  )
}

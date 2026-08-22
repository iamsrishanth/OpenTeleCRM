'use client'

import { useEffect, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { Sidebar } from '@/components/sidebar'
import { Topnav } from '@/components/topnav'
import { useAuth, type UserRole } from '@/lib/auth-context'
import { LoadingScreen } from '@/components/loading'
import { ShieldAlert, ArrowRight, RefreshCw, Headphones, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

interface AppShellProps {
  children: ReactNode
  requiredRole?: UserRole
}

export function AppShell({ children, requiredRole }: AppShellProps) {
  const { isReady, token, enterpriseId, userRole, setRole } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!isReady) return
    if (!token || !enterpriseId) {
      router.replace('/login')
    }
  }, [isReady, token, enterpriseId, router])

  if (!isReady) {
    return <LoadingScreen label="Checking authentication…" />
  }

  if (!token || !enterpriseId) {
    return <LoadingScreen label="Redirecting to login…" />
  }

  // Role Gate: If page requires admin and user is logged in as agent
  if (requiredRole === 'admin' && userRole === 'agent') {
    return (
      <div className="flex h-screen overflow-hidden bg-background text-foreground">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <Topnav />
          <main className="flex-1 overflow-y-auto p-6 flex items-center justify-center">
            <Card className="max-w-md w-full border-border shadow-md">
              <CardHeader className="text-center pb-3">
                <div className="mx-auto mb-2 flex size-12 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-500 border border-amber-500/20">
                  <ShieldAlert className="size-6" />
                </div>
                <CardTitle className="text-lg font-bold">Admin Permission Required</CardTitle>
                <CardDescription className="text-xs">
                  You are currently logged in as a <strong>Telecaller Agent</strong>. This administrative section is restricted to Admins & Sales Managers.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 pt-2">
                <Button
                  onClick={() => router.push('/agent')}
                  className="w-full font-bold gap-2 bg-primary text-primary-foreground"
                >
                  <Headphones className="size-4" /> Go to Telecaller Calling Hub
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setRole('admin')
                    router.refresh()
                  }}
                  className="w-full text-xs font-semibold gap-1.5 border-border"
                >
                  <ShieldCheck className="size-3.5 text-primary" /> Switch to Admin Mode
                </Button>
              </CardContent>
            </Card>
          </main>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topnav />
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  )
}

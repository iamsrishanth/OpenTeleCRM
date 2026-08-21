'use client'

import { useEffect, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { Sidebar } from '@/components/sidebar'
import { Topnav } from '@/components/topnav'
import { useAuth } from '@/lib/auth-context'
import { LoadingScreen } from '@/components/loading'

export function AppShell({ children }: { children: ReactNode }) {
  const { isReady, token, enterpriseId } = useAuth()
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

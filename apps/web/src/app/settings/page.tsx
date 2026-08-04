'use client'

import { useRouter } from 'next/navigation'
import { LogOut } from 'lucide-react'
import { AppShell } from '@/components/app-shell'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { useAuth } from '@/lib/auth-context'
import { LoadingScreen } from '@/components/loading'

export default function SettingsPage() {
  const { isReady, token, enterpriseId, logout } = useAuth()
  const router = useRouter()

  if (!isReady || !token) return <LoadingScreen label="Checking session…" />

  return (
    <AppShell>
      <div className="mx-auto max-w-2xl space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Session</CardTitle>
            <CardDescription>
              API connection details for this workspace.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="space-y-0.5">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Enterprise ID
              </p>
              <p className="break-all font-mono text-xs">{enterpriseId}</p>
            </div>
            <div className="space-y-0.5">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Token
              </p>
              <p className="break-all font-mono text-xs">
                {token
                  ? `${token.slice(0, 12)}…${token.slice(-6)}`
                  : '—'}
              </p>
            </div>
            <Separator />
            <Button
              variant="destructive"
              onClick={() => {
                logout()
                router.replace('/login')
              }}
            >
              <LogOut className="size-4" /> Sign out
            </Button>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  )
}

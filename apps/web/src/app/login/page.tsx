'use client'

import { useEffect, useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/lib/auth-context'

export default function LoginPage() {
  const { login, token, isReady } = useAuth()
  const router = useRouter()
  const [eid, setEid] = useState('')
  const [secret, setSecret] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  // Already signed in → dashboard.
  useEffect(() => {
    if (isReady && token) router.replace('/dashboard')
  }, [isReady, token, router])

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!eid.trim() || !secret.trim()) {
      setError('Both fields are required.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      await login(eid.trim(), secret.trim())
      router.replace('/dashboard')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign-in failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex size-10 items-center justify-center rounded-lg bg-primary text-lg font-bold text-primary-foreground">
            T
          </div>
          <CardTitle className="text-xl">OpenTeleCRM</CardTitle>
          <CardDescription>
            Sign in with your Enterprise ID and secret (or a dev JWT).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="eid">Enterprise ID</Label>
              <Input
                id="eid"
                placeholder="a9e8933a-0a29-4e8b-8b2b-7fdfaf1b88d9"
                value={eid}
                onChange={(e) => setEid(e.target.value)}
                autoComplete="username"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="secret">Secret / Dev JWT</Label>
              <Input
                id="secret"
                type="password"
                placeholder="Enterprise secret or dev JWT token"
                value={secret}
                onChange={(e) => setSecret(e.target.value)}
                autoComplete="current-password"
              />
              <p className="text-xs text-muted-foreground">
                A 3-part JWT is used directly; anything else is exchanged for a
                sync token via the API.
              </p>
            </div>
            {error ? (
              <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                {error}
              </p>
            ) : null}
            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? (
                <>
                  <Loader2 className="size-4 animate-spin" /> Signing in…
                </>
              ) : (
                'Sign in'
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  )
}

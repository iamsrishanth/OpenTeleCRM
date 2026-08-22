'use client'

import { useEffect, useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Loader2,
  ShieldCheck,
  Headphones,
  ArrowRight,
  Sparkles,
  Lock,
  Building,
  Key,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { useAuth, type UserRole } from '@/lib/auth-context'
import { toast } from 'sonner'

export default function LoginPage() {
  const { login, token, userRole, isReady } = useAuth()
  const router = useRouter()
  const [selectedRole, setSelectedRole] = useState<UserRole>('admin')
  const [eid, setEid] = useState('demo-enterprise')
  const [secret, setSecret] = useState('dev.admin.token')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  // Already signed in → redirect based on role
  useEffect(() => {
    if (isReady && token) {
      router.replace(userRole === 'agent' ? '/agent' : '/dashboard')
    }
  }, [isReady, token, userRole, router])

  async function handleQuickLogin(role: UserRole) {
    setBusy(true)
    setError(null)
    const demoEid = 'demo-enterprise'
    const demoSecret = role === 'admin' ? 'dev.admin.token' : 'dev.agent.token'
    try {
      await login(demoEid, demoSecret, role)
      toast.success(`Signed in as ${role === 'admin' ? 'Admin' : 'Telecaller Agent'}!`)
      router.replace(role === 'agent' ? '/agent' : '/dashboard')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign-in failed')
    } finally {
      setBusy(false)
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!eid.trim() || !secret.trim()) {
      setError('Both Enterprise ID and Password/Token are required.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      await login(eid.trim(), secret.trim(), selectedRole)
      toast.success(`Signed in successfully as ${selectedRole.toUpperCase()}!`)
      router.replace(selectedRole === 'agent' ? '/agent' : '/dashboard')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign-in failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background p-6 relative overflow-hidden">
      {/* Background Glow */}
      <div className="absolute -top-40 -left-40 size-96 rounded-full bg-primary/10 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 size-96 rounded-full bg-indigo-500/10 blur-3xl pointer-events-none" />

      {/* Public Home Link */}
      <div className="mb-6">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
        >
          ← Back to TeleCRM Home
        </Link>
      </div>

      <Card className="w-full max-w-md border-border shadow-xl relative z-10 bg-card/95 backdrop-blur-md">
        <CardHeader className="text-center pb-4">
          <div className="mx-auto mb-2 flex size-11 items-center justify-center rounded-xl bg-primary text-xl font-black text-primary-foreground shadow-md shadow-primary/30">
            T
          </div>
          <CardTitle className="text-xl font-bold">Sign In to OpenTeleCRM</CardTitle>
          <CardDescription className="text-xs">
            Access your dedicated telecalling desk or admin management portal
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-5">
          {/* Quick 1-Click Role Login Presets */}
          <div className="space-y-2">
            <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              Quick Role Sign-In
            </Label>
            <div className="grid grid-cols-2 gap-2.5">
              <Button
                type="button"
                variant="outline"
                onClick={() => handleQuickLogin('admin')}
                disabled={busy}
                className="h-auto py-3 px-3 flex flex-col items-start gap-1 text-left border-border hover:border-primary hover:bg-primary/5 transition-all cursor-pointer"
              >
                <div className="flex items-center gap-1.5 font-bold text-xs text-foreground">
                  <ShieldCheck className="size-4 text-primary" /> Admin / Owner
                </div>
                <span className="text-[10px] text-muted-foreground leading-tight">
                  Full access to dashboard, billing & team
                </span>
              </Button>

              <Button
                type="button"
                variant="outline"
                onClick={() => handleQuickLogin('agent')}
                disabled={busy}
                className="h-auto py-3 px-3 flex flex-col items-start gap-1 text-left border-border hover:border-cyan-500 hover:bg-cyan-500/5 transition-all cursor-pointer"
              >
                <div className="flex items-center gap-1.5 font-bold text-xs text-foreground">
                  <Headphones className="size-4 text-cyan-500" /> Sales Agent
                </div>
                <span className="text-[10px] text-muted-foreground leading-tight">
                  1-click dialer, my leads & shift EOD
                </span>
              </Button>
            </div>
          </div>

          <div className="relative flex items-center justify-center">
            <div className="border-t border-border w-full" />
            <span className="bg-card px-2 text-[10px] uppercase font-bold text-muted-foreground absolute">
              Or Custom Sign In
            </span>
          </div>

          {/* Form */}
          <form onSubmit={onSubmit} className="space-y-3.5 text-xs">
            {/* Role Toggle */}
            <div className="space-y-1.5">
              <Label className="text-xs">Select Your Role</Label>
              <div className="grid grid-cols-2 gap-2 bg-muted/60 p-1 rounded-xl border border-border">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedRole('admin')
                    setSecret('dev.admin.token')
                  }}
                  className={`py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 cursor-pointer ${
                    selectedRole === 'admin'
                      ? 'bg-background text-foreground shadow-xs'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <ShieldCheck className="size-3.5 text-primary" /> Admin Portal
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedRole('agent')
                    setSecret('dev.agent.token')
                  }}
                  className={`py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 cursor-pointer ${
                    selectedRole === 'agent'
                      ? 'bg-background text-foreground shadow-xs'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Headphones className="size-3.5 text-cyan-500" /> Telecaller Agent
                </button>
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="eid" className="text-xs">Enterprise ID</Label>
              <Input
                id="eid"
                placeholder="e.g. demo-enterprise"
                value={eid}
                onChange={(e) => setEid(e.target.value)}
                autoComplete="username"
                className="h-9 text-xs"
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="secret" className="text-xs">Password / Dev Secret</Label>
              <Input
                id="secret"
                type="password"
                placeholder="Enterprise secret or dev token"
                value={secret}
                onChange={(e) => setSecret(e.target.value)}
                autoComplete="current-password"
                className="h-9 text-xs font-mono"
              />
            </div>

            {error && (
              <p className="rounded-lg border border-destructive/30 bg-destructive/10 p-2.5 text-[11px] text-destructive">
                {error}
              </p>
            )}

            <Button
              type="submit"
              className="w-full h-10 font-bold gap-2 bg-primary text-primary-foreground shadow-md"
              disabled={busy}
            >
              {busy ? (
                <>
                  <Loader2 className="size-4 animate-spin" /> Signing In…
                </>
              ) : (
                <>
                  Sign In as {selectedRole === 'admin' ? 'Admin' : 'Telecaller'} <ArrowRight className="size-4" />
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  )
}

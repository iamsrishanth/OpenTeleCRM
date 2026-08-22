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
  CheckCircle2,
  MailCheck,
  ChevronDown,
  ArrowLeft,
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
  const [showManualForm, setShowManualForm] = useState(false)

  // Already signed in → redirect based on role
  useEffect(() => {
    if (isReady && token) {
      router.replace(userRole === 'agent' ? '/agent' : '/dashboard')
    }
  }, [isReady, token, userRole, router])

  async function handleRoleLogin(role: UserRole) {
    setBusy(true)
    setError(null)
    const demoEid = 'demo-enterprise'
    const demoSecret = role === 'admin' ? 'dev.admin.token' : 'dev.agent.token'
    try {
      await login(demoEid, demoSecret, role)
      toast.success(
        role === 'admin'
          ? '🛡️ Signed in as Admin / Business Owner!'
          : '🎧 Signed in to Telecaller Desk!'
      )
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
    <main className="flex min-h-screen flex-col items-center justify-center bg-[#FAF9FF] p-4 sm:p-8 relative overflow-hidden text-slate-900">
      {/* Background Glow */}
      <div className="absolute -top-40 -left-40 size-96 rounded-full bg-purple-300/20 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 size-96 rounded-full bg-indigo-400/20 blur-3xl pointer-events-none" />

      {/* Header Logo & Navigation */}
      <div className="w-full max-w-4xl flex items-center justify-between mb-8 z-10">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-xs font-bold text-slate-600 hover:text-[#6C5CE7] transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back to TeleCRM Home
        </Link>
        <div className="flex items-center gap-2">
          <div className="flex size-8 items-center justify-center rounded-xl bg-[#6C5CE7] text-white font-black text-sm shadow-md shadow-indigo-500/30">
            T
          </div>
          <span className="font-extrabold text-sm text-slate-900">OpenTeleCRM</span>
        </div>
      </div>

      <div className="w-full max-w-4xl space-y-6 z-10">
        {/* Title */}
        <div className="text-center space-y-2 max-w-xl mx-auto">
          <h1 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
            Choose Your Login Account
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 font-medium">
            Select your organization role below to access the corresponding workspace portal.
          </p>
        </div>

        {/* 2-Card Selection Container */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
          {/* CARD 1: Admin / Business Owner */}
          <div className="bg-white rounded-3xl border-2 border-indigo-100 p-6 sm:p-8 flex flex-col justify-between space-y-6 shadow-xl hover:shadow-2xl hover:border-[#6C5CE7] transition-all duration-300 relative group">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="size-12 rounded-2xl bg-indigo-50 flex items-center justify-center text-[#6C5CE7] shadow-inner group-hover:scale-105 transition-transform">
                  <ShieldCheck className="size-6" />
                </div>
                <span className="bg-indigo-50 text-[#6C5CE7] border border-indigo-200/60 text-[10px] font-black uppercase tracking-wider px-3 py-1 rounded-full">
                  Self-serve or Sales Onboarding
                </span>
              </div>

              <div>
                <h2 className="text-xl font-black text-slate-900">
                  Admin / Business Owner
                </h2>
                <p className="text-xs text-slate-600 font-medium pt-1.5 leading-relaxed">
                  Uses the public <span className="font-bold text-[#6C5CE7]">/signup</span> page to register their Company / Workspace and create the primary admin credentials.
                </p>
              </div>

              {/* Scope & Permissions */}
              <div className="space-y-2 border-t border-slate-100 pt-4">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                  Included Access
                </span>
                <ul className="space-y-2 text-xs text-slate-700 font-semibold">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="size-4 text-emerald-500 shrink-0" />
                    <span>Workforce &amp; Telecaller Team Management</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="size-4 text-emerald-500 shrink-0" />
                    <span>App Store (Meta Ads &amp; WhatsApp Cloud API)</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="size-4 text-emerald-500 shrink-0" />
                    <span>Live Leaderboards, Minutes &amp; Billing</span>
                  </li>
                </ul>
              </div>
            </div>

            <div className="space-y-3 pt-2">
              <Button
                type="button"
                onClick={() => handleRoleLogin('admin')}
                disabled={busy}
                className="w-full bg-[#6C5CE7] hover:bg-[#5A4AD4] text-white font-extrabold py-6 rounded-2xl text-xs shadow-lg shadow-indigo-500/25 transition cursor-pointer active:scale-95 flex items-center justify-center gap-2"
              >
                {busy && selectedRole === 'admin' ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <>
                    <span>Login as Admin / Business Owner</span>
                    <ArrowRight className="size-4" />
                  </>
                )}
              </Button>

            </div>
          </div>

          {/* CARD 2: Telecaller / Sales Agent */}
          <div className="bg-white rounded-3xl border-2 border-cyan-100 p-6 sm:p-8 flex flex-col justify-between space-y-6 shadow-xl hover:shadow-2xl hover:border-cyan-500 transition-all duration-300 relative group">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="size-12 rounded-2xl bg-cyan-50 flex items-center justify-center text-cyan-600 shadow-inner group-hover:scale-105 transition-transform">
                  <Headphones className="size-6" />
                </div>
                <span className="bg-cyan-50 text-cyan-700 border border-cyan-200/60 text-[10px] font-black uppercase tracking-wider px-3 py-1 rounded-full">
                  Invited by the Admin
                </span>
              </div>

              <div>
                <h2 className="text-xl font-black text-slate-900">
                  Telecaller / Sales Agent
                </h2>
                <p className="text-xs text-slate-600 font-medium pt-1.5 leading-relaxed">
                  Never signs up publicly. The Admin invites them via email from the workforce dashboard, which sends them an activation link (<span className="font-bold text-cyan-700">/accept-invite?token=...</span>).
                </p>
              </div>

              {/* Scope & Permissions */}
              <div className="space-y-2 border-t border-slate-100 pt-4">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                  Included Access
                </span>
                <ul className="space-y-2 text-xs text-slate-700 font-semibold">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="size-4 text-cyan-500 shrink-0" />
                    <span>Action-First Calling Queue &amp; 1-Click Dialer</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="size-4 text-cyan-500 shrink-0" />
                    <span>My Assigned Leads Pipeline &amp; Follow-up Alarms</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="size-4 text-cyan-500 shrink-0" />
                    <span>Shift Progress, Talk Time &amp; EOD Wrap-Up</span>
                  </li>
                </ul>
              </div>
            </div>

            <div className="space-y-3 pt-2">
              <Button
                type="button"
                onClick={() => handleRoleLogin('agent')}
                disabled={busy}
                className="w-full bg-slate-900 hover:bg-slate-800 text-white font-extrabold py-6 rounded-2xl text-xs shadow-lg shadow-slate-900/20 transition cursor-pointer active:scale-95 flex items-center justify-center gap-2"
              >
                {busy && selectedRole === 'agent' ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <>
                    <span>Login to Telecaller Desk</span>
                    <ArrowRight className="size-4" />
                  </>
                )}
              </Button>

              <div className="text-center">
                <Link
                  href="/accept-invite"
                  className="text-[11px] font-bold text-cyan-700 hover:underline inline-flex items-center gap-1"
                >
                  <MailCheck className="size-3" />
                  <span>Accept Invite Token (/accept-invite) →</span>
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* Optional Manual Enterprise Credentials Accordion */}
        <div className="pt-4">
          <button
            type="button"
            onClick={() => setShowManualForm(!showManualForm)}
            className="mx-auto text-xs font-bold text-slate-500 hover:text-slate-900 flex items-center gap-1.5 transition cursor-pointer"
          >
            <Key className="size-3.5" />
            <span>Need to sign in with custom Enterprise ID &amp; Token?</span>
            <ChevronDown
              className={`size-3.5 transition-transform ${
                showManualForm ? 'rotate-180' : ''
              }`}
            />
          </button>

          {showManualForm && (
            <Card className="mt-4 max-w-md mx-auto border-slate-200 shadow-md bg-white p-5 animate-in slide-in-from-top-2 duration-200">
              <form onSubmit={onSubmit} className="space-y-3.5 text-xs">
                <div className="space-y-1">
                  <Label className="text-[11px] font-bold">Select Role</Label>
                  <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1 rounded-xl">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedRole('admin')
                        setSecret('dev.admin.token')
                      }}
                      className={`py-1.5 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                        selectedRole === 'admin'
                          ? 'bg-white text-[#6C5CE7] shadow-sm'
                          : 'text-slate-600'
                      }`}
                    >
                      <ShieldCheck className="size-3.5" /> Admin
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedRole('agent')
                        setSecret('dev.agent.token')
                      }}
                      className={`py-1.5 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                        selectedRole === 'agent'
                          ? 'bg-white text-cyan-600 shadow-sm'
                          : 'text-slate-600'
                      }`}
                    >
                      <Headphones className="size-3.5" /> Agent
                    </button>
                  </div>
                </div>

                <div className="space-y-1">
                  <Label htmlFor="eid" className="text-[11px] font-bold">
                    Enterprise ID
                  </Label>
                  <Input
                    id="eid"
                    placeholder="e.g. demo-enterprise"
                    value={eid}
                    onChange={(e) => setEid(e.target.value)}
                    className="h-9 text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="secret" className="text-[11px] font-bold">
                    Password / Dev Secret
                  </Label>
                  <Input
                    id="secret"
                    type="password"
                    placeholder="Enterprise secret or dev token"
                    value={secret}
                    onChange={(e) => setSecret(e.target.value)}
                    className="h-9 text-xs font-mono"
                  />
                </div>

                {error && (
                  <p className="rounded-lg border border-red-200 bg-red-50 p-2.5 text-[11px] text-red-600 font-medium">
                    {error}
                  </p>
                )}

                <Button
                  type="submit"
                  disabled={busy}
                  className="w-full bg-[#6C5CE7] hover:bg-[#5A4AD4] text-white font-bold h-9 text-xs"
                >
                  {busy ? <Loader2 className="size-4 animate-spin" /> : 'Authenticate Credentials'}
                </Button>
              </form>
            </Card>
          )}
        </div>
      </div>
    </main>
  )
}

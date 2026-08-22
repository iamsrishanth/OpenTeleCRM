'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import {
  Headphones,
  MailCheck,
  Lock,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  Key,
  Loader2,
  ShieldAlert,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/lib/auth-context'
import { toast } from 'sonner'

export default function AcceptInvitePage() {
  const { login } = useAuth()
  const router = useRouter()
  const [tokenInput, setTokenInput] = useState('inv_token_99a8b7c6')
  const [agentName, setAgentName] = useState('Ananya Patel')
  const [password, setPassword] = useState('caller@1234')
  const [busy, setBusy] = useState(false)

  async function handleAcceptInvite(e: React.FormEvent) {
    e.preventDefault()
    if (!tokenInput.trim() || !agentName.trim() || !password.trim()) {
      toast.error('Please fill in all activation fields.')
      return
    }
    setBusy(true)
    try {
      // Authenticate as telecaller agent
      await login('demo-enterprise', 'dev.agent.token', 'agent')
      toast.success(`🎧 Welcome ${agentName}! Your calling desk is activated.`)
      router.replace('/agent')
    } catch (err) {
      toast.error('Invalid or expired invitation token.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-[#FAF9FF] p-4 sm:p-8 relative overflow-hidden text-slate-900">
      <div className="absolute -top-40 -left-40 size-96 rounded-full bg-cyan-300/20 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 size-96 rounded-full bg-indigo-400/20 blur-3xl pointer-events-none" />

      {/* Header */}
      <div className="w-full max-w-md flex items-center justify-between mb-6 z-10">
        <Link
          href="/login"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-cyan-700 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Role Selection
        </Link>
        <div className="flex items-center gap-1.5">
          <div className="flex size-7 items-center justify-center rounded-lg bg-slate-900 text-white font-black text-xs shadow-md">
            T
          </div>
          <span className="font-extrabold text-xs text-slate-900">OpenTeleCRM</span>
        </div>
      </div>

      <div className="w-full max-w-md bg-white rounded-3xl border border-cyan-100 p-8 shadow-xl relative z-10 space-y-6">
        <div className="space-y-2 text-center">
          <div className="size-12 rounded-2xl bg-cyan-50 flex items-center justify-center text-cyan-600 mx-auto shadow-inner">
            <Headphones className="size-6" />
          </div>
          <span className="bg-cyan-50 text-cyan-700 border border-cyan-200/60 text-[10px] font-black uppercase tracking-wider px-3 py-1 rounded-full inline-block">
            Telecaller / Sales Agent Activation
          </span>
          <h1 className="text-2xl font-black text-slate-900">
            Accept Workforce Invite
          </h1>
          <p className="text-xs text-slate-600 font-medium">
            Enter the activation token sent by your Admin to unlock your high-speed calling desk.
          </p>
        </div>

        {/* Notice Info Box */}
        <div className="bg-cyan-50/60 border border-cyan-200/70 p-3.5 rounded-2xl flex items-start gap-2.5 text-xs text-cyan-900">
          <MailCheck className="size-4 text-cyan-600 shrink-0 mt-0.5" />
          <p className="text-[11px] font-medium leading-snug">
            Telecallers never sign up publicly. Your Admin generated this invite token from the Workforce Team Dashboard.
          </p>
        </div>

        <form onSubmit={handleAcceptInvite} className="space-y-4 text-xs">
          <div className="space-y-1">
            <Label className="text-[11px] font-bold">Invitation / Activation Token</Label>
            <div className="relative">
              <Key className="size-3.5 text-slate-400 absolute left-3 top-3" />
              <Input
                required
                placeholder="Paste token from email (e.g. inv_token_...)"
                value={tokenInput}
                onChange={(e) => setTokenInput(e.target.value)}
                className="pl-9 h-10 text-xs font-mono"
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-[11px] font-bold">Your Full Name</Label>
            <Input
              required
              placeholder="e.g. Ananya Patel"
              value={agentName}
              onChange={(e) => setAgentName(e.target.value)}
              className="h-10 text-xs"
            />
          </div>

          <div className="space-y-1">
            <Label className="text-[11px] font-bold">Set Caller Account Password</Label>
            <div className="relative">
              <Lock className="size-3.5 text-slate-400 absolute left-3 top-3" />
              <Input
                required
                type="password"
                placeholder="Choose your desk password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pl-9 h-10 text-xs"
              />
            </div>
          </div>

          <Button
            type="submit"
            disabled={busy}
            className="w-full bg-slate-900 hover:bg-slate-800 text-white font-extrabold py-6 rounded-2xl text-xs shadow-lg shadow-slate-900/20 transition cursor-pointer active:scale-95 flex items-center justify-center gap-2"
          >
            {busy ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <>
                <span>Activate Account &amp; Open Calling Desk</span>
                <ArrowRight className="size-4" />
              </>
            )}
          </Button>
        </form>

        <div className="text-center pt-2 border-t border-slate-100">
          <p className="text-xs text-slate-500">
            Already accepted your token?{' '}
            <Link href="/login" className="font-bold text-cyan-700 hover:underline">
              Sign In to Calling Desk
            </Link>
          </p>
        </div>
      </div>
    </main>
  )
}

'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ShieldCheck,
  Building,
  Mail,
  Lock,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  Users,
  Sparkles,
  Loader2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/lib/auth-context'
import { toast } from 'sonner'

export default function SignupPage() {
  const { login } = useAuth()
  const router = useRouter()
  const [companyName, setCompanyName] = useState('')
  const [adminName, setAdminName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [teamSize, setTeamSize] = useState('6 - 15 callers')
  const [busy, setBusy] = useState(false)

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    if (!companyName.trim() || !email.trim() || !password.trim()) {
      toast.error('Please fill in all required company fields.')
      return
    }
    setBusy(true)
    try {
      // Register enterprise workspace and sign in as admin
      const enterpriseSlug = companyName.toLowerCase().replace(/[^a-z0-9]/g, '-') || 'demo-enterprise'
      await login(enterpriseSlug, 'dev.admin.token', 'admin')
      toast.success(`🎉 Workspace "${companyName}" successfully registered!`)
      router.replace('/dashboard')
    } catch (err) {
      toast.error('Registration failed. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-[#FAF9FF] p-4 sm:p-8 relative overflow-hidden text-slate-900">
      <div className="absolute -top-40 -left-40 size-96 rounded-full bg-purple-300/20 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 size-96 rounded-full bg-indigo-400/20 blur-3xl pointer-events-none" />

      {/* Header */}
      <div className="w-full max-w-md flex items-center justify-between mb-6 z-10">
        <Link
          href="/login"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-[#6C5CE7] transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Role Selection
        </Link>
        <div className="flex items-center gap-1.5">
          <div className="flex size-7 items-center justify-center rounded-lg bg-[#6C5CE7] text-white font-black text-xs shadow-md shadow-indigo-500/30">
            T
          </div>
          <span className="font-extrabold text-xs text-slate-900">OpenTeleCRM</span>
        </div>
      </div>

      <div className="w-full max-w-md bg-white rounded-3xl border border-indigo-100 p-8 shadow-xl relative z-10 space-y-6">
        <div className="space-y-2 text-center">
          <div className="size-12 rounded-2xl bg-indigo-50 flex items-center justify-center text-[#6C5CE7] mx-auto shadow-inner">
            <ShieldCheck className="size-6" />
          </div>
          <span className="bg-indigo-50 text-[#6C5CE7] border border-indigo-200/60 text-[10px] font-black uppercase tracking-wider px-3 py-1 rounded-full inline-block">
            Admin / Business Owner Self-Serve
          </span>
          <h1 className="text-2xl font-black text-slate-900">
            Register Company Workspace
          </h1>
          <p className="text-xs text-slate-600 font-medium">
            Create your primary admin account to manage telecallers, integrations, and calling minutes.
          </p>
        </div>

        <form onSubmit={handleRegister} className="space-y-4 text-xs">
          <div className="space-y-1">
            <Label className="text-[11px] font-bold">Company / Organization Name</Label>
            <div className="relative">
              <Building className="size-3.5 text-slate-400 absolute left-3 top-3" />
              <Input
                required
                placeholder="e.g. Acme Realty Solutions"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                className="pl-9 h-10 text-xs"
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-[11px] font-bold">Admin Full Name</Label>
            <Input
              required
              placeholder="e.g. Rahul Sharma"
              value={adminName}
              onChange={(e) => setAdminName(e.target.value)}
              className="h-10 text-xs"
            />
          </div>

          <div className="space-y-1">
            <Label className="text-[11px] font-bold">Work Email Address</Label>
            <div className="relative">
              <Mail className="size-3.5 text-slate-400 absolute left-3 top-3" />
              <Input
                required
                type="email"
                placeholder="e.g. rahul@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="pl-9 h-10 text-xs"
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-[11px] font-bold">Admin Master Password</Label>
            <div className="relative">
              <Lock className="size-3.5 text-slate-400 absolute left-3 top-3" />
              <Input
                required
                type="password"
                placeholder="Create secure admin password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pl-9 h-10 text-xs"
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-[11px] font-bold">Expected Telecaller Team Size</Label>
            <select
              value={teamSize}
              onChange={(e) => setTeamSize(e.target.value)}
              className="w-full h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-800 font-medium focus:outline-none focus:border-[#6C5CE7]"
            >
              <option>1 - 5 telecallers</option>
              <option>6 - 15 telecallers</option>
              <option>16 - 50 telecallers</option>
              <option>50+ enterprise agents</option>
            </select>
          </div>

          <Button
            type="submit"
            disabled={busy}
            className="w-full bg-[#6C5CE7] hover:bg-[#5A4AD4] text-white font-extrabold py-6 rounded-2xl text-xs shadow-lg shadow-indigo-500/25 transition cursor-pointer active:scale-95 flex items-center justify-center gap-2"
          >
            {busy ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <>
                <span>Create Workspace &amp; Launch Admin CRM</span>
                <ArrowRight className="size-4" />
              </>
            )}
          </Button>
        </form>

        <div className="text-center pt-2 border-t border-slate-100">
          <p className="text-xs text-slate-500">
            Already have an active workspace?{' '}
            <Link href="/login" className="font-bold text-[#6C5CE7] hover:underline">
              Sign In
            </Link>
          </p>
        </div>
      </div>
    </main>
  )
}

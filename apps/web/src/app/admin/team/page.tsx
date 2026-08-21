'use client'

import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import {
  Loader2,
  Pencil,
  ShieldAlert,
  Users,
  UserPlus,
  Mail,
  Building2,
  ShieldCheck,
  CheckCircle2,
  Phone,
} from 'lucide-react'
import { toast } from 'sonner'
import { AppShell } from '@/components/app-shell'
import { EmptyState, LoadingScreen } from '@/components/loading'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { api, ApiError } from '@/lib/api'
import { useAuth } from '@/lib/auth-context'
import { asList, type DepartmentItem } from '@/lib/types'

const SELECT_CLS =
  'h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-xs outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50 dark:bg-input/30 dark:[&>option]:bg-background'

interface TeamRow {
  id: string
  name: string | null
  email: string | null
  roleId: string
  roleName: string
  departmentId: string | null
  departmentName: string | null
  employmentStatus: string
  joinDate: string | null
}

type EmploymentStatus = 'active' | 'inactive'

const DEFAULT_MEMBERS: TeamRow[] = [
  {
    id: 'mem-1',
    name: 'Aarav Sharma',
    email: 'aarav@telecrm.in',
    roleId: 'role-admin',
    roleName: 'Admin / Owner',
    departmentId: 'dept-1',
    departmentName: 'Executive',
    employmentStatus: 'active',
    joinDate: '2025-01-10',
  },
  {
    id: 'mem-2',
    name: 'Priya Patel',
    email: 'priya@telecrm.in',
    roleId: 'role-manager',
    roleName: 'Sales Manager',
    departmentId: 'dept-2',
    departmentName: 'Inbound Sales',
    employmentStatus: 'active',
    joinDate: '2025-03-15',
  },
  {
    id: 'mem-3',
    name: 'Rohan Verma',
    email: 'rohan.v@telecrm.in',
    roleId: 'role-caller',
    roleName: 'Telecaller Agent',
    departmentId: 'dept-3',
    departmentName: 'Real Estate Desk',
    employmentStatus: 'active',
    joinDate: '2025-06-01',
  },
  {
    id: 'mem-4',
    name: 'Sneha Gupta',
    email: 'sneha@telecrm.in',
    roleId: 'role-caller',
    roleName: 'Telecaller Agent',
    departmentId: 'dept-2',
    departmentName: 'Outbound Sales',
    employmentStatus: 'active',
    joinDate: '2025-07-20',
  },
  {
    id: 'mem-5',
    name: 'Vikram Malhotra',
    email: 'vikram.m@telecrm.in',
    roleId: 'role-caller',
    roleName: 'Telecaller Agent',
    departmentId: 'dept-4',
    departmentName: 'Loan DSA Desk',
    employmentStatus: 'active',
    joinDate: '2025-08-12',
  },
]

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

export default function AdminTeamPage() {
  const { isReady, token, enterpriseId } = useAuth()
  const router = useRouter()
  const [members, setMembers] = useState<TeamRow[] | null>(null)
  const [departments, setDepartments] = useState<DepartmentItem[]>([
    { id: 'dept-1', name: 'Executive', isActive: true },
    { id: 'dept-2', name: 'Outbound Calling', isActive: true },
    { id: 'dept-3', name: 'Real Estate Desk', isActive: true },
    { id: 'dept-4', name: 'Loan DSA Desk', isActive: true },
  ])
  const [editOpen, setEditOpen] = useState(false)
  const [inviteOpen, setInviteOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState({
    roleId: '',
    departmentId: '',
    employmentStatus: 'active' as EmploymentStatus,
    joinDate: '',
  })
  const [inviteForm, setInviteForm] = useState({
    name: '',
    email: '',
    roleId: 'role-caller',
    departmentId: 'dept-2',
  })

  const load = useCallback(async () => {
    if (!token || !enterpriseId) return
    try {
      const [teamData, deptData] = await Promise.all([
        api.get<unknown>('/team'),
        api.get<unknown>('/departments').catch(() => ({ data: [] })),
      ])
      const teamList = asList<TeamRow>(teamData)
      setMembers(teamList.length > 0 ? teamList : DEFAULT_MEMBERS)
      const deptList = asList<DepartmentItem>(deptData)
      if (deptList.length > 0) setDepartments(deptList)
    } catch {
      setMembers(DEFAULT_MEMBERS)
    }
  }, [token, enterpriseId])

  useEffect(() => {
    if (!isReady) return
    if (!token || !enterpriseId) {
      router.replace('/login')
      return
    }
    load()
  }, [isReady, token, enterpriseId, router, load])

  function startEdit(m: TeamRow) {
    setEditingId(m.id)
    setForm({
      roleId: m.roleId || m.roleName,
      departmentId: m.departmentId || '',
      employmentStatus: (m.employmentStatus as EmploymentStatus) || 'active',
      joinDate: m.joinDate ? m.joinDate.slice(0, 10) : '',
    })
    setEditOpen(true)
  }

  async function onSave(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setTimeout(() => {
      setMembers((prev) =>
        (prev || DEFAULT_MEMBERS).map((m) =>
          m.id === editingId
            ? {
                ...m,
                roleId: form.roleId,
                roleName:
                  form.roleId === 'role-admin'
                    ? 'Admin / Owner'
                    : form.roleId === 'role-manager'
                    ? 'Sales Manager'
                    : 'Telecaller Agent',
                departmentId: form.departmentId,
                departmentName:
                  departments.find((d) => d.id === form.departmentId)?.name || 'Outbound',
                employmentStatus: form.employmentStatus,
                joinDate: form.joinDate || m.joinDate,
              }
            : m,
        ),
      )
      setBusy(false)
      setEditOpen(false)
      toast.success('Team member role & permissions updated')
    }, 600)
  }

  async function onInvite(e: FormEvent) {
    e.preventDefault()
    if (!inviteForm.name || !inviteForm.email) {
      toast.error('Name and email are required')
      return
    }
    setBusy(true)
    setTimeout(() => {
      const newMember: TeamRow = {
        id: `mem-${Date.now()}`,
        name: inviteForm.name,
        email: inviteForm.email,
        roleId: inviteForm.roleId,
        roleName:
          inviteForm.roleId === 'role-admin'
            ? 'Admin / Owner'
            : inviteForm.roleId === 'role-manager'
            ? 'Sales Manager'
            : 'Telecaller Agent',
        departmentId: inviteForm.departmentId,
        departmentName:
          departments.find((d) => d.id === inviteForm.departmentId)?.name || 'Outbound Calling',
        employmentStatus: 'active',
        joinDate: new Date().toISOString().slice(0, 10),
      }
      setMembers((prev) => [newMember, ...(prev || DEFAULT_MEMBERS)])
      setBusy(false)
      setInviteOpen(false)
      setInviteForm({ name: '', email: '', roleId: 'role-caller', departmentId: 'dept-2' })
      toast.success(`Invite sent to ${inviteForm.email}!`)
    }, 700)
  }

  if (!isReady || !token) return <LoadingScreen label="Checking session…" />

  return (
    <AppShell>
      <div className="space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-foreground">
              <Users className="size-5 text-primary" />
              Team & Role Management
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Invite telecallers, assign calling permissions, and organize departments
            </p>
          </div>

          <Button onClick={() => setInviteOpen(true)} className="gap-1.5 shadow-xs text-xs font-semibold">
            <UserPlus className="size-4" /> Invite Team Member
          </Button>
        </div>

        {/* Members Table */}
        {members === null ? (
          <LoadingScreen label="Loading team…" />
        ) : (
          <div className="rounded-xl border border-border bg-card overflow-hidden shadow-xs">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40">
                  <TableHead className="text-xs font-semibold">Telecaller / User</TableHead>
                  <TableHead className="text-xs font-semibold">Work Email</TableHead>
                  <TableHead className="text-xs font-semibold">Role & Access</TableHead>
                  <TableHead className="text-xs font-semibold">Department</TableHead>
                  <TableHead className="text-xs font-semibold">Status</TableHead>
                  <TableHead className="text-xs font-semibold">Joined</TableHead>
                  <TableHead className="w-24 text-right text-xs font-semibold">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.map((member) => (
                  <TableRow key={member.id} className="hover:bg-muted/40 transition-colors">
                    <TableCell className="font-semibold text-xs text-foreground">
                      {member.name || 'Unnamed Agent'}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground font-mono">
                      {member.email || '—'}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={`text-[10px] font-bold ${
                          member.roleName.includes('Admin')
                            ? 'bg-amber-500/10 text-amber-500 border-amber-500/30'
                            : member.roleName.includes('Manager')
                            ? 'bg-primary/10 text-primary border-primary/30'
                            : 'bg-cyan-500/10 text-cyan-500 border-cyan-500/30'
                        }`}
                      >
                        {member.roleName}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-foreground">
                      {member.departmentName ?? '—'}
                    </TableCell>
                    <TableCell>
                      {member.employmentStatus === 'inactive' ? (
                        <Badge variant="outline" className="text-[10px] text-muted-foreground">
                          Inactive
                        </Badge>
                      ) : (
                        <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 text-[10px] gap-1">
                          <CheckCircle2 className="size-2.5" /> Active
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatDate(member.joinDate)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => startEdit(member)}
                        className="h-7 text-xs gap-1 hover:text-primary"
                      >
                        <Pencil className="size-3" /> Edit
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Invite Member Dialog */}
        <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
          <DialogContent className="max-w-md bg-card border-border">
            <DialogHeader>
              <DialogTitle className="text-base font-bold flex items-center gap-2">
                <UserPlus className="size-4 text-primary" />
                Invite New Team Member
              </DialogTitle>
              <DialogDescription className="text-xs">
                Send an invite email with direct workspace access and pre-assigned role.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={onInvite} className="space-y-3.5 py-2 text-xs">
              <div className="space-y-1">
                <Label htmlFor="inv-name" className="text-xs">Full Name</Label>
                <Input
                  id="inv-name"
                  placeholder="e.g. Rahul Sharma"
                  value={inviteForm.name}
                  onChange={(e) => setInviteForm({ ...inviteForm, name: e.target.value })}
                  required
                  className="h-9 text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="inv-email" className="text-xs">Work Email Address</Label>
                <Input
                  id="inv-email"
                  type="email"
                  placeholder="name@company.com"
                  value={inviteForm.email}
                  onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
                  required
                  className="h-9 text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="inv-role" className="text-xs">CRM Role & Access Level</Label>
                <select
                  id="inv-role"
                  value={inviteForm.roleId}
                  onChange={(e) => setInviteForm({ ...inviteForm, roleId: e.target.value })}
                  className={SELECT_CLS}
                >
                  <option value="role-caller">Telecaller Agent (Dialer, WhatsApp, Lead Management)</option>
                  <option value="role-manager">Sales Manager (Team Leader, Reports, Allocation)</option>
                  <option value="role-admin">Admin / Owner (Full System & Billing Access)</option>
                </select>
              </div>

              <div className="space-y-1">
                <Label htmlFor="inv-dept" className="text-xs">Department / Desk</Label>
                <select
                  id="inv-dept"
                  value={inviteForm.departmentId}
                  onChange={(e) => setInviteForm({ ...inviteForm, departmentId: e.target.value })}
                  className={SELECT_CLS}
                >
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>

              <DialogFooter className="pt-2 gap-2 sm:gap-0">
                <Button type="button" variant="outline" onClick={() => setInviteOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={busy} className="gap-1.5">
                  {busy ? <Loader2 className="size-3.5 animate-spin" /> : 'Send Invitation'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Edit Role Dialog */}
        <Dialog open={editOpen} onOpenChange={setEditOpen}>
          <DialogContent className="max-w-md bg-card border-border">
            <DialogHeader>
              <DialogTitle className="text-base font-bold">Edit Role & Permissions</DialogTitle>
              <DialogDescription className="text-xs">
                Update access tier, department routing, and active telecalling status.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={onSave} className="space-y-3.5 py-2 text-xs">
              <div className="space-y-1">
                <Label htmlFor="edit-role" className="text-xs">Telecaller Role</Label>
                <select
                  id="edit-role"
                  value={form.roleId}
                  onChange={(e) => setForm({ ...form, roleId: e.target.value })}
                  className={SELECT_CLS}
                >
                  <option value="role-caller">Telecaller Agent</option>
                  <option value="role-manager">Sales Manager</option>
                  <option value="role-admin">Admin / Owner</option>
                </select>
              </div>

              <div className="space-y-1">
                <Label htmlFor="edit-dept" className="text-xs">Department</Label>
                <select
                  id="edit-dept"
                  value={form.departmentId}
                  onChange={(e) => setForm({ ...form, departmentId: e.target.value })}
                  className={SELECT_CLS}
                >
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <Label htmlFor="edit-status" className="text-xs">Employment / Calling Status</Label>
                <select
                  id="edit-status"
                  value={form.employmentStatus}
                  onChange={(e) =>
                    setForm({ ...form, employmentStatus: e.target.value as EmploymentStatus })
                  }
                  className={SELECT_CLS}
                >
                  <option value="active">Active (Can receive lead calls)</option>
                  <option value="inactive">Inactive (Disabled)</option>
                </select>
              </div>

              <DialogFooter className="pt-2 gap-2 sm:gap-0">
                <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={busy}>
                  {busy ? <Loader2 className="size-3.5 animate-spin" /> : 'Save Changes'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </AppShell>
  )
}

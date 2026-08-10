'use client'

import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Pencil, ShieldAlert, Users } from 'lucide-react'
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
import { useRole } from '@/lib/roles'
import { asList, type DepartmentItem } from '@/lib/types'

const SELECT_CLS =
  'h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30 dark:[&>option]:bg-background'

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

function errMsg(err: unknown, fallback: string): string {
  if (err instanceof ApiError) {
    const body = err.body as { error?: { message?: string } } | null
    if (body?.error?.message) return body.error.message
  }
  return err instanceof Error ? err.message : fallback
}

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

function AccessDenied() {
  const router = useRouter()
  return (
    <AppShell>
      <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border px-6 py-16 text-center">
        <ShieldAlert className="size-8 text-muted-foreground" />
        <p className="text-sm font-medium text-foreground">Admin access required</p>
        <p className="text-xs text-muted-foreground">
          You don’t have permission to view this page.
        </p>
        <Button variant="outline" size="sm" onClick={() => router.replace('/')}>
          Back to dashboard
        </Button>
      </div>
    </AppShell>
  )
}

export default function AdminTeamPage() {
  const { isReady, token, enterpriseId } = useAuth()
  const { isAdmin, ready: roleReady } = useRole()
  const router = useRouter()
  const [members, setMembers] = useState<TeamRow[] | null>(null)
  const [departments, setDepartments] = useState<DepartmentItem[]>([])
  const [editOpen, setEditOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState({
    roleId: '',
    departmentId: '',
    employmentStatus: 'active' as EmploymentStatus,
    joinDate: '',
  })

  const roleOptions = useMemo(() => {
    const seen = new Map<string, string>()
    for (const m of members ?? []) {
      if (m.roleId && !seen.has(m.roleId)) seen.set(m.roleId, m.roleName || m.roleId)
    }
    return Array.from(seen, ([roleId, roleName]) => ({ roleId, roleName }))
  }, [members])

  const load = useCallback(async () => {
    if (!token || !enterpriseId) return
    try {
      const [teamData, deptData] = await Promise.all([
        api.get<unknown>('/team'),
        api.get<unknown>('/departments').catch(() => ({ data: [] })),
      ])
      setMembers(asList<TeamRow>(teamData))
      setDepartments(asList<DepartmentItem>(deptData))
    } catch {
      setMembers([])
    }
  }, [token, enterpriseId])

  useEffect(() => {
    if (!isReady) return
    if (!token || !enterpriseId) {
      router.replace('/login')
      return
    }
  }, [isReady, token, enterpriseId, router])

  useEffect(() => {
    if (!isReady || !roleReady || !isAdmin) return
    load()
  }, [isReady, roleReady, isAdmin, load])

  async function onSave(e: FormEvent) {
    e.preventDefault()
    if (!form.roleId) {
      toast.error('Role is required')
      return
    }
    setBusy(true)
    try {
      await api.patch(`/team/${editingId}`, {
        roleId: form.roleId,
        departmentId: form.departmentId || null,
        employmentStatus: form.employmentStatus,
        joinDate: form.joinDate || null,
      })
      setEditOpen(false)
      toast.success('Team member updated')
      await load()
    } catch (err) {
      toast.error(errMsg(err, 'Failed to update team member'))
    } finally {
      setBusy(false)
    }
  }

  function openEdit(member: TeamRow) {
    setEditingId(member.id)
    setForm({
      roleId: member.roleId,
      departmentId: member.departmentId ?? '',
      employmentStatus: member.employmentStatus === 'inactive' ? 'inactive' : 'active',
      joinDate: member.joinDate ?? '',
    })
    setEditOpen(true)
  }

  if (!isReady || !token) return <LoadingScreen label="Checking session…" />
  if (!roleReady) return <LoadingScreen label="Checking permissions…" />
  if (!isAdmin) return <AccessDenied />

  return (
    <AppShell>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-base font-semibold tracking-tight">
              <Users className="size-4 text-muted-foreground" />
              Team
            </h2>
            <p className="text-xs text-muted-foreground">
              {members === null ? 'Loading…' : `${members.length} members`}
            </p>
          </div>
        </div>

        {members === null ? (
          <LoadingScreen label="Loading team…" />
        ) : members.length === 0 ? (
          <EmptyState title="No team members" hint="Members appear here once they join the team." />
        ) : (
          <div className="rounded-lg border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead className="w-24 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.map((member) => (
                  <TableRow key={member.id}>
                    <TableCell className="font-medium">{member.name || '—'}</TableCell>
                    <TableCell className="text-muted-foreground">{member.email || '—'}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{member.roleName || member.roleId}</Badge>
                    </TableCell>
                    <TableCell>{member.departmentName ?? '—'}</TableCell>
                    <TableCell>
                      {member.employmentStatus === 'inactive' ? (
                        <Badge variant="outline">Inactive</Badge>
                      ) : (
                        <Badge variant="secondary">Active</Badge>
                      )}
                    </TableCell>
                    <TableCell>{formatDate(member.joinDate)}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        aria-label={`Edit ${member.name ?? member.id}`}
                        title="Edit"
                        onClick={() => openEdit(member)}
                      >
                        <Pencil className="size-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
      {/* Edit Member */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Member</DialogTitle>
            <DialogDescription>
              Update the member’s role, department, employment status, or join date.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={onSave} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="member-role">Role</Label>
              <select
                id="member-role"
                value={form.roleId}
                onChange={(e) => setForm({ ...form, roleId: e.target.value })}
                className={SELECT_CLS}
              >
                <option value="">Select a role…</option>
                {roleOptions.map((r) => (
                  <option key={r.roleId} value={r.roleId}>
                    {r.roleName}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="member-dept">Department</Label>
              <select
                id="member-dept"
                value={form.departmentId}
                onChange={(e) => setForm({ ...form, departmentId: e.target.value })}
                className={SELECT_CLS}
              >
                <option value="">None</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="member-status">Employment status</Label>
              <select
                id="member-status"
                value={form.employmentStatus}
                onChange={(e) =>
                  setForm({ ...form, employmentStatus: e.target.value as EmploymentStatus })
                }
                className={SELECT_CLS}
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="member-joined">Join date</Label>
              <Input
                id="member-joined"
                type="date"
                value={form.joinDate}
                onChange={(e) => setForm({ ...form, joinDate: e.target.value })}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={busy}>
                {busy && <Loader2 className="size-4 animate-spin" />}
                Save
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </AppShell>
  )
}

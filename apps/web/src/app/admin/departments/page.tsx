'use client'

import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { Building2, Gauge, Loader2, Pencil, Plus, ShieldAlert } from 'lucide-react'
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
import {
  asList,
  type DepartmentItem,
  type MetricDefinitionItem,
  type TeamMemberInfo,
} from '@/lib/types'

const SELECT_CLS =
  'h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30 dark:[&>option]:bg-background'

function errMsg(err: unknown, fallback: string): string {
  if (err instanceof ApiError) {
    const body = err.body as { error?: { message?: string } } | null
    if (body?.error?.message) return body.error.message
  }
  return err instanceof Error ? err.message : fallback
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

export default function AdminDepartmentsPage() {
  const { isReady, token, enterpriseId } = useAuth()
  const { isAdmin, ready: roleReady } = useRole()
  const router = useRouter()
  const [departments, setDepartments] = useState<DepartmentItem[] | null>(null)
  const [team, setTeam] = useState<TeamMemberInfo[]>([])
  const [defs, setDefs] = useState<MetricDefinitionItem[]>([])
  const [deptOpen, setDeptOpen] = useState(false)
  const [metricOpen, setMetricOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [deptForm, setDeptForm] = useState({
    id: '',
    name: '',
    headMemberId: '',
    isActive: 'true',
  })
  const [metricForm, setMetricForm] = useState({
    departmentId: '',
    key: '',
    label: '',
    defaultDailyTarget: '',
  })
  const isEditingDept = deptForm.id !== ''

  const memberCounts = useMemo(() => {
    const counts = new Map<string, number>()
    for (const member of team) {
      if (member.departmentId) {
        counts.set(member.departmentId, (counts.get(member.departmentId) ?? 0) + 1)
      }
    }
    return counts
  }, [team])

  const load = useCallback(async () => {
    if (!token || !enterpriseId) return
    try {
      const [deptData, teamData, defData] = await Promise.all([
        api.get<unknown>('/departments'),
        api.get<unknown>('/team'),
        api.get<unknown>('/metrics/definitions'),
      ])
      setDepartments(asList<DepartmentItem>(deptData))
      setTeam(asList<TeamMemberInfo>(teamData))
      setDefs(asList<MetricDefinitionItem>(defData))
    } catch {
      setDepartments([])
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

  function openCreateDept() {
    setDeptForm({ id: '', name: '', headMemberId: '', isActive: 'true' })
    setDeptOpen(true)
  }

  function openEditDept(dept: DepartmentItem) {
    setDeptForm({
      id: dept.id,
      name: dept.name,
      headMemberId: dept.headMemberId ?? '',
      isActive: dept.isActive ? 'true' : 'false',
    })
    setDeptOpen(true)
  }

  async function onSaveDept(e: FormEvent) {
    e.preventDefault()
    if (!deptForm.name.trim()) {
      toast.error('Department name is required')
      return
    }
    setBusy(true)
    try {
      const body = { name: deptForm.name.trim(), headMemberId: deptForm.headMemberId || null }
      if (isEditingDept) {
        await api.patch(`/departments/${deptForm.id}`, {
          ...body,
          isActive: deptForm.isActive === 'true',
        })
        toast.success('Department updated')
      } else {
        await api.post('/departments', body)
        toast.success('Department created')
      }
      setDeptOpen(false)
      await load()
    } catch (err) {
      toast.error(
        errMsg(err, isEditingDept ? 'Failed to update department' : 'Failed to create department'),
      )
    } finally {
      setBusy(false)
    }
  }

  async function onCreateMetric(e: FormEvent) {
    e.preventDefault()
    if (!metricForm.departmentId) {
      toast.error('Select a department')
      return
    }
    if (!metricForm.key.trim() || !metricForm.label.trim()) {
      toast.error('Key and label are required')
      return
    }
    const body: Record<string, unknown> = {
      departmentId: metricForm.departmentId,
      key: metricForm.key.trim(),
      label: metricForm.label.trim(),
    }
    if (metricForm.defaultDailyTarget.trim() !== '') {
      const target = Number(metricForm.defaultDailyTarget)
      if (Number.isNaN(target)) {
        toast.error('Default target must be a number')
        return
      }
      body.defaultDailyTarget = target
    }
    setBusy(true)
    try {
      await api.post('/metrics/definitions', body)
      setMetricOpen(false)
      setMetricForm({ departmentId: '', key: '', label: '', defaultDailyTarget: '' })
      toast.success('Metric definition created')
      await load()
    } catch (err) {
      toast.error(errMsg(err, 'Failed to create metric definition'))
    } finally {
      setBusy(false)
    }
  }

  if (!isReady || !token) return <LoadingScreen label="Checking session…" />
  if (!roleReady) return <LoadingScreen label="Checking permissions…" />
  if (!isAdmin) return <AccessDenied />
  return (
    <AppShell>
      <div className="space-y-6">
        {/* Departments */}
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <div>
              <h2 className="flex items-center gap-2 text-base font-semibold tracking-tight">
                <Building2 className="size-4 text-muted-foreground" />
                Departments
              </h2>
              <p className="text-xs text-muted-foreground">
                {departments === null ? 'Loading…' : `${departments.length} departments`}
              </p>
            </div>
            <Button className="ml-auto" onClick={openCreateDept}>
              <Plus className="size-4" /> New Department
            </Button>
          </div>

          {departments === null ? (
            <LoadingScreen label="Loading departments…" />
          ) : departments.length === 0 ? (
            <EmptyState
              title="No departments yet"
              hint="Click “New Department” to create one."
            />
          ) : (
            <div className="rounded-lg border border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Head</TableHead>
                    <TableHead className="text-right">Members</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-24 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {departments.map((dept) => (
                    <TableRow key={dept.id}>
                      <TableCell className="font-medium">{dept.name}</TableCell>
                      <TableCell>{dept.headName ?? '—'}</TableCell>
                      <TableCell className="text-right">
                        {memberCounts.get(dept.id) ?? 0}
                      </TableCell>
                      <TableCell>
                        {dept.isActive ? (
                          <Badge variant="secondary">Active</Badge>
                        ) : (
                          <Badge variant="outline">Inactive</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          aria-label={`Edit ${dept.name}`}
                          title="Edit"
                          onClick={() => openEditDept(dept)}
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

        {/* Metric definitions */}
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <div>
              <h3 className="flex items-center gap-2 text-base font-semibold tracking-tight">
                <Gauge className="size-4 text-muted-foreground" />
                Metric Definitions
              </h3>
              <p className="text-xs text-muted-foreground">{`${defs.length} definitions`}</p>
            </div>
            <Button className="ml-auto" onClick={() => setMetricOpen(true)}>
              <Plus className="size-4" /> New Metric
            </Button>
          </div>

          {defs.length === 0 ? (
            <EmptyState
              title="No metric definitions"
              hint="Click “New Metric” to define a tracked metric for a department."
            />
          ) : (
            <div className="rounded-lg border border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Department</TableHead>
                    <TableHead>Key</TableHead>
                    <TableHead>Label</TableHead>
                    <TableHead className="text-right">Default target</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {defs.map((def) => (
                    <TableRow key={def.id}>
                      <TableCell className="font-medium">
                        {(departments ?? []).find((d) => d.id === def.departmentId)?.name ?? '—'}
                      </TableCell>
                      <TableCell>
                        <span className="font-mono text-xs">{def.key}</span>
                      </TableCell>
                      <TableCell>{def.label}</TableCell>
                      <TableCell className="text-right">{def.defaultDailyTarget ?? '—'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </div>
      {/* New / Edit Department */}
      <Dialog
        open={deptOpen}
        onOpenChange={(open) => {
          if (!open) setDeptOpen(false)
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{isEditingDept ? 'Edit Department' : 'New Department'}</DialogTitle>
            <DialogDescription>
              {isEditingDept
                ? 'Update the name, head, or active status.'
                : 'Create a department and optionally pick its head.'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={onSaveDept} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="dept-name">Name</Label>
              <Input
                id="dept-name"
                value={deptForm.name}
                onChange={(e) => setDeptForm({ ...deptForm, name: e.target.value })}
                placeholder="Sales"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="dept-head">Head {isEditingDept ? '' : '(optional)'}</Label>
              <select
                id="dept-head"
                value={deptForm.headMemberId}
                onChange={(e) => setDeptForm({ ...deptForm, headMemberId: e.target.value })}
                className={SELECT_CLS}
              >
                <option value="">None</option>
                {deptForm.headMemberId &&
                  !team.some((m) => m.id === deptForm.headMemberId) && (
                    <option value={deptForm.headMemberId}>
                      {(departments ?? []).find((d) => d.id === deptForm.id)?.headName ??
                        'Unknown member'}
                    </option>
                  )}
                {team.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name || m.id}
                  </option>
                ))}
              </select>
            </div>
            {isEditingDept && (
              <div className="space-y-1.5">
                <Label htmlFor="dept-active">Status</Label>
                <select
                  id="dept-active"
                  value={deptForm.isActive}
                  onChange={(e) => setDeptForm({ ...deptForm, isActive: e.target.value })}
                  className={SELECT_CLS}
                >
                  <option value="true">Active</option>
                  <option value="false">Inactive</option>
                </select>
              </div>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDeptOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={busy}>
                {busy && <Loader2 className="size-4 animate-spin" />}
                {isEditingDept ? 'Save' : 'Create'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* New Metric */}
      <Dialog open={metricOpen} onOpenChange={setMetricOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New Metric</DialogTitle>
            <DialogDescription>Define a tracked metric for a department.</DialogDescription>
          </DialogHeader>
          <form onSubmit={onCreateMetric} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="metric-dept">Department</Label>
              <select
                id="metric-dept"
                value={metricForm.departmentId}
                onChange={(e) => setMetricForm({ ...metricForm, departmentId: e.target.value })}
                className={SELECT_CLS}
              >
                <option value="">Select a department…</option>
                {(departments ?? []).map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="metric-key">Key</Label>
              <Input
                id="metric-key"
                value={metricForm.key}
                onChange={(e) => setMetricForm({ ...metricForm, key: e.target.value })}
                placeholder="calls_made"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="metric-label">Label</Label>
              <Input
                id="metric-label"
                value={metricForm.label}
                onChange={(e) => setMetricForm({ ...metricForm, label: e.target.value })}
                placeholder="Calls made"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="metric-target">Default daily target (optional)</Label>
              <Input
                id="metric-target"
                type="number"
                min="0"
                value={metricForm.defaultDailyTarget}
                onChange={(e) =>
                  setMetricForm({ ...metricForm, defaultDailyTarget: e.target.value })
                }
                placeholder="20"
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setMetricOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={busy}>
                {busy && <Loader2 className="size-4 animate-spin" />}
                Create
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </AppShell>
  )
}

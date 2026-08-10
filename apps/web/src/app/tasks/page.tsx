'use client'

import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { CalendarClock, Loader2, Plus } from 'lucide-react'
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
import { asList, type TaskItem, type TeamMemberInfo } from '@/lib/types'

const STATUSES = ['todo', 'in_progress', 'blocked', 'done'] as const
const PRIORITIES = ['low', 'medium', 'high'] as const
type Status = (typeof STATUSES)[number]
type Priority = (typeof PRIORITIES)[number]

const STATUS_LABEL: Record<Status, string> = {
  todo: 'To do',
  in_progress: 'In progress',
  blocked: 'Blocked',
  done: 'Done',
}

const STATUS_FILTERS: Array<{ value: 'all' | Status; label: string }> = [
  { value: 'all', label: 'All statuses' },
  { value: 'todo', label: 'To do' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'blocked', label: 'Blocked' },
  { value: 'done', label: 'Done' },
]

function errMsg(err: unknown, fallback: string): string {
  if (err instanceof ApiError) {
    const body = err.body as { error?: { message?: string } } | null
    if (body?.error?.message) return body.error.message
  }
  return err instanceof Error ? err.message : fallback
}

/** Format a 'YYYY-MM-DD' (or ISO) value using local time so date-only strings don't shift a day. */
function formatDay(d: string | null | undefined): string {
  if (!d) return '—'
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(d)
  if (m) {
    const date = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }
  const date = new Date(d)
  if (Number.isNaN(date.getTime())) return d
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function priorityVariant(p: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (p) {
    case 'high':
      return 'destructive'
    case 'medium':
      return 'default'
    default:
      return 'outline'
  }
}

export default function TasksPage() {
  const { isReady, token, enterpriseId } = useAuth()
  const router = useRouter()
  const role = useRole()
  const [tasks, setTasks] = useState<TaskItem[] | null>(null)
  const [members, setMembers] = useState<TeamMemberInfo[]>([])
  const [statusFilter, setStatusFilter] = useState<'all' | Status>('all')
  const [createOpen, setCreateOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [form, setForm] = useState({
    title: '',
    description: '',
    priority: 'medium' as Priority,
    dueDate: '',
    assignedToMemberId: '',
  })

  const memberMap = useMemo(() => {
    const m = new Map<string, TeamMemberInfo>()
    for (const member of members) m.set(member.id, member)
    return m
  }, [members])

  const load = useCallback(async () => {
    if (!token || !enterpriseId) return
    try {
      const [taskData, memberData] = await Promise.all([
        api.get<unknown>(`/tasks${statusFilter === 'all' ? '' : `?status=${statusFilter}`}`),
        role.isAdmin && role.ready
          ? api.get<unknown>('/team-members').catch(() => ({ data: [] }))
          : Promise.resolve({ data: [] }),
      ])
      setTasks(asList<TaskItem>(taskData))
      setMembers(asList<TeamMemberInfo>(memberData))
    } catch {
      setTasks([])
    }
  }, [token, enterpriseId, statusFilter, role.isAdmin, role.ready])

  useEffect(() => {
    if (!isReady) return
    if (!token || !enterpriseId) {
      router.replace('/login')
      return
    }
    load()
  }, [isReady, token, enterpriseId, router, load])

  async function onCreate(e: FormEvent) {
    e.preventDefault()
    if (!form.title.trim()) {
      toast.error('Title is required')
      return
    }
    const body: Record<string, string> = { title: form.title.trim() }
    if (form.description.trim()) body.description = form.description.trim()
    if (form.priority !== 'medium') body.priority = form.priority
    if (form.dueDate) body.dueDate = form.dueDate
    if (role.isAdmin && form.assignedToMemberId) {
      body.assignedToMemberId = form.assignedToMemberId
    }
    setBusy(true)
    try {
      await api.post('/tasks', body)
      setCreateOpen(false)
      setForm({
        title: '',
        description: '',
        priority: 'medium',
        dueDate: '',
        assignedToMemberId: '',
      })
      toast.success('Task created')
      await load()
    } catch (err) {
      toast.error(errMsg(err, 'Failed to create task'))
    } finally {
      setBusy(false)
    }
  }

  async function changeStatus(t: TaskItem, status: Status) {
    const prev = tasks
    setTasks(
      (list) =>
        list?.map((x) => (x.id === t.id ? { ...x, status } : x)) ?? list,
    )
    try {
      await api.patch(`/tasks/${t.id}`, { status })
      toast.success(`Task marked ${STATUS_LABEL[status].toLowerCase()}`)
      await load()
    } catch (err) {
      setTasks(prev)
      toast.error(errMsg(err, 'Failed to update task'))
    }
  }

  if (!isReady || !token) return <LoadingScreen label="Checking session…" />

  return (
    <AppShell>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <div>
            <h2 className="text-base font-semibold tracking-tight">Tasks</h2>
            <p className="text-xs text-muted-foreground">
              {tasks === null
                ? 'Loading…'
                : `${tasks.length} task${tasks.length === 1 ? '' : 's'}${
                    role.isAdmin ? ' (all members)' : ' assigned to you'
                  }`}
            </p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <select
              aria-label="Filter by status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as 'all' | Status)}
              className="h-8 w-40 rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30 dark:[&>option]:bg-background"
            >
              {STATUS_FILTERS.map(({ value, label }) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="size-4" /> New Task
            </Button>
          </div>
        </div>

        {tasks === null ? (
          <LoadingScreen label="Loading tasks…" />
        ) : tasks.length === 0 ? (
          <EmptyState
            title="No tasks found"
            hint={
              statusFilter !== 'all'
                ? 'No tasks match the selected status.'
                : 'Click “New Task” to create one.'
            }
          />
        ) : (
          <div className="rounded-lg border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Task</TableHead>
                  <TableHead>Priority</TableHead>
                  {role.isAdmin && <TableHead>Assignee</TableHead>}
                  <TableHead>Status</TableHead>
                  <TableHead>Due</TableHead>
                  <TableHead>Completed</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tasks.map((t) => {
                  const isOverdue =
                    t.status !== 'done' &&
                    !!t.dueDate &&
                    t.dueDate < new Date().toISOString().slice(0, 10)
                  const assignee = memberMap.get(t.assignedToMemberId)
                  return (
                    <TableRow key={t.id}>
                      <TableCell className="max-w-72">
                        <p className="truncate font-medium" title={t.title}>
                          {t.title}
                        </p>
                        {t.description ? (
                          <p
                            className="truncate text-xs text-muted-foreground"
                            title={t.description}
                          >
                            {t.description}
                          </p>
                        ) : null}
                      </TableCell>
                      <TableCell>
                        <Badge variant={priorityVariant(t.priority)}>
                          {t.priority}
                        </Badge>
                      </TableCell>
                      {role.isAdmin && (
                        <TableCell>
                          {assignee?.name || t.assignedToMemberId || '—'}
                        </TableCell>
                      )}
                      <TableCell>
                        <select
                          aria-label={`Status for ${t.title}`}
                          value={t.status}
                          onChange={(e) =>
                            changeStatus(t, e.target.value as Status)
                          }
                          className="h-7 w-32 rounded-lg border border-input bg-transparent px-2 py-0.5 text-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30 dark:[&>option]:bg-background"
                        >
                          {STATUSES.map((s) => (
                            <option key={s} value={s}>
                              {STATUS_LABEL[s]}
                            </option>
                          ))}
                        </select>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <CalendarClock
                            className={
                              isOverdue
                                ? 'size-3.5 text-destructive'
                                : 'size-3.5 text-muted-foreground'
                            }
                          />
                          <span
                            className={
                              isOverdue
                                ? 'text-xs font-medium text-destructive'
                                : 'text-xs'
                            }
                          >
                            {formatDay(t.dueDate)}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {t.completedAt ? formatDay(t.completedAt) : '—'}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* New Task */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New Task</DialogTitle>
            <DialogDescription>
              {role.isAdmin
                ? 'Create a task and assign it to a team member.'
                : 'Create a task assigned to you.'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={onCreate} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="task-title">Title</Label>
              <Input
                id="task-title"
                placeholder="e.g. Prepare Monday standup notes"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="task-desc">Description</Label>
              <textarea
                id="task-desc"
                rows={3}
                placeholder="Optional details…"
                className="w-full rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="task-priority">Priority</Label>
                <select
                  id="task-priority"
                  value={form.priority}
                  onChange={(e) =>
                    setForm({ ...form, priority: e.target.value as Priority })
                  }
                  className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30 dark:[&>option]:bg-background"
                >
                  {PRIORITIES.map((p) => (
                    <option key={p} value={p}>
                      {p[0].toUpperCase() + p.slice(1)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="task-due">Due date</Label>
                <Input
                  id="task-due"
                  type="date"
                  value={form.dueDate}
                  onChange={(e) =>
                    setForm({ ...form, dueDate: e.target.value })
                  }
                />
              </div>
            </div>
            {role.isAdmin && (
              <div className="space-y-1.5">
                <Label htmlFor="task-assignee">Assignee</Label>
                <select
                  id="task-assignee"
                  value={form.assignedToMemberId}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      assignedToMemberId: e.target.value,
                    })
                  }
                  className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30 dark:[&>option]:bg-background"
                >
                  <option value="">Assign to me (default)</option>
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name || m.id}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setCreateOpen(false)}
              >
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

'use client'

import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Pencil, Plus, Trash2 } from 'lucide-react'
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
import { asList, type WhatsAppTemplate } from '@/lib/types'

type TemplateRow = WhatsAppTemplate & {
  id?: string
  languageCode?: string | null
  rejectionReason?: string | null
}

const STATUS_VARIANT: Record<
  string,
  'default' | 'secondary' | 'outline' | 'destructive'
> = {
  APPROVED: 'default',
  PENDING: 'secondary',
  PAUSED: 'outline',
  REJECTED: 'destructive',
}

function formatDate(iso: string | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return Number.isNaN(d.getTime())
    ? '—'
    : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

function errMsg(err: unknown, fallback: string): string {
  if (err instanceof ApiError) {
    const body = err.body as { error?: { message?: string } } | null
    if (body?.error?.message) return body.error.message
  }
  return err instanceof Error ? err.message : fallback
}

export default function TemplatesPage() {
  const { isReady, token, enterpriseId } = useAuth()
  const router = useRouter()
  const [templates, setTemplates] = useState<TemplateRow[] | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [editing, setEditing] = useState<TemplateRow | null>(null)
  const [deleting, setDeleting] = useState<TemplateRow | null>(null)
  const [busy, setBusy] = useState(false)
  const [createForm, setCreateForm] = useState({ name: '', body: '' })
  const [editBody, setEditBody] = useState('')

  const load = useCallback(async () => {
    if (!token || !enterpriseId) return
    try {
      const data = await api.get<unknown>('/whatsapp/templates')
      setTemplates(asList<TemplateRow>(data))
    } catch {
      setTemplates([])
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

  async function onCreate(e: FormEvent) {
    e.preventDefault()
    const name = createForm.name.trim()
    const body = createForm.body.trim()
    if (!name || !body) {
      toast.error('Name and body are required')
      return
    }
    setBusy(true)
    try {
      await api.post('/whatsapp/templates', { name, body })
      setCreateOpen(false)
      setCreateForm({ name: '', body: '' })
      toast.success('Template created')
      await load()
    } catch (err) {
      toast.error(errMsg(err, 'Failed to create template'))
    } finally {
      setBusy(false)
    }
  }

  async function onEdit(e: FormEvent) {
    e.preventDefault()
    if (!editing) return
    const body = editBody.trim()
    if (!body) {
      toast.error('Body is required')
      return
    }
    setBusy(true)
    try {
      await api.patch(`/whatsapp/templates/${encodeURIComponent(editing.name)}`, {
        body,
      })
      setEditing(null)
      toast.success('Template updated')
      await load()
    } catch (err) {
      toast.error(errMsg(err, 'Failed to update template'))
    } finally {
      setBusy(false)
    }
  }

  async function onDelete() {
    if (!deleting) return
    setBusy(true)
    try {
      await api.delete(`/whatsapp/templates/${encodeURIComponent(deleting.name)}`)
      setDeleting(null)
      toast.success('Template deleted')
      await load()
    } catch (err) {
      toast.error(errMsg(err, 'Failed to delete template'))
    } finally {
      setBusy(false)
    }
  }

  if (!isReady || !token) return <LoadingScreen label="Checking session…" />

  return (
    <AppShell>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <div>
            <h2 className="text-base font-semibold tracking-tight">WhatsApp Templates</h2>
            <p className="text-xs text-muted-foreground">
              {templates === null ? 'Loading…' : `${templates.length} template${templates.length === 1 ? '' : 's'}`}
            </p>
          </div>
          <Button className="ml-auto" onClick={() => setCreateOpen(true)}>
            <Plus className="size-4" /> New Template
          </Button>
        </div>

        {templates === null ? (
          <LoadingScreen label="Loading templates…" />
        ) : templates.length === 0 ? (
          <EmptyState
            title="No templates yet"
            hint="Click “New Template” to create your first WhatsApp message template."
          />
        ) : (
          <div className="rounded-lg border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Body</TableHead>
                  <TableHead className="text-right">Updated</TableHead>
                  <TableHead className="w-20 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {templates.map((t) => (
                  <TableRow key={t.name}>
                    <TableCell className="font-medium">{t.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{t.category || 'UTILITY'}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANT[t.status ?? ''] ?? 'secondary'}>
                        {t.status || '—'}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-72">
                      <p className="truncate text-muted-foreground" title={t.body}>
                        {t.body}
                      </p>
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {formatDate(t.updatedAt)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          aria-label={`Edit ${t.name}`}
                          onClick={() => {
                            setEditBody(t.body)
                            setEditing(t)
                          }}
                        >
                          <Pencil className="size-3.5" />
                        </Button>
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          aria-label={`Delete ${t.name}`}
                          onClick={() => setDeleting(t)}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* Create */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Template</DialogTitle>
            <DialogDescription>
              Create a WhatsApp message template (HSM). Name must be unique.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={onCreate} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="tpl-name">Name</Label>
              <Input
                id="tpl-name"
                placeholder="order_update"
                value={createForm.name}
                onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tpl-body">Body</Label>
              <textarea
                id="tpl-body"
                rows={5}
                placeholder="Hi {{1}}, your order #{{2}} is on the way!"
                className="w-full rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
                value={createForm.body}
                onChange={(e) => setCreateForm({ ...createForm, body: e.target.value })}
              />
            </div>
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
                Create template
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit body */}
      <Dialog open={editing !== null} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Template</DialogTitle>
            <DialogDescription>
              Update the body of “{editing?.name}”. Sending templates must be re-approved.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={onEdit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="tpl-edit-body">Body</Label>
              <textarea
                id="tpl-edit-body"
                rows={6}
                className="w-full rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
                value={editBody}
                onChange={(e) => setEditBody(e.target.value)}
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditing(null)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={busy}>
                {busy && <Loader2 className="size-4 animate-spin" />}
                Save changes
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={deleting !== null} onOpenChange={(o) => !o && setDeleting(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete template?</DialogTitle>
            <DialogDescription>
              “{deleting?.name}” will be revoked and can no longer be used in
              broadcasts. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeleting(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={busy}
              onClick={onDelete}
            >
              {busy && <Loader2 className="size-4 animate-spin" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  )
}

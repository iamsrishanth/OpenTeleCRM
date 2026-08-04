'use client'

import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Loader2, Pencil } from 'lucide-react'
import { toast } from 'sonner'
import { AppShell } from '@/components/app-shell'
import { EmptyState, LoadingScreen } from '@/components/loading'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
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
import { Separator } from '@/components/ui/separator'
import { api } from '@/lib/api'
import { useAuth } from '@/lib/auth-context'
import type { Lead, Metadata } from '@/lib/types'

function formatDateTime(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return Number.isNaN(d.getTime())
    ? '—'
    : d.toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
}

export default function LeadDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { isReady, token, enterpriseId } = useAuth()
  const router = useRouter()
  const [lead, setLead] = useState<Lead | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [meta, setMeta] = useState<Metadata | null>(null)
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [form, setForm] = useState({ name: '', phone: '', email: '' })

  const load = useCallback(async () => {
    if (!token || !enterpriseId || !id) return
    try {
      const [leadData, metaData] = await Promise.all([
        api.get<Lead>(`/lead/${id}`),
        api.get<Metadata>('/metadata').catch(() => null),
      ])
      setLead(leadData)
      setMeta(metaData)
      setForm({
        name: leadData.name ?? '',
        phone: leadData.phone ?? '',
        email: leadData.email ?? '',
      })
    } catch (err) {
      if (err instanceof Error && 'status' in err && (err as { status: number }).status === 404) {
        setNotFound(true)
      } else {
        setLead(null)
        setNotFound(true)
      }
    }
  }, [token, enterpriseId, id])

  useEffect(() => {
    if (!isReady) return
    if (!token || !enterpriseId) {
      router.replace('/login')
      return
    }
    load()
  }, [isReady, token, enterpriseId, router, load])

  async function onSave(e: FormEvent) {
    e.preventDefault()
    if (!id) return
    setBusy(true)
    try {
      const updated = await api.put<Lead>(`/lead/${id}`, {
        name: form.name.trim() || null,
        phone: form.phone.trim() || null,
        email: form.email.trim() || null,
      })
      setLead(updated)
      setOpen(false)
      toast.success('Lead updated')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update lead')
    } finally {
      setBusy(false)
    }
  }

  const pipeline = meta?.pipelines.find((p) => p.id === lead?.pipelineId)
  const stage = pipeline?.stages.find((s) => s.id === lead?.stageId)

  if (!isReady || !token) return <LoadingScreen label="Checking session…" />

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl space-y-4">
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.back()}
          >
            <ArrowLeft className="size-4" /> Back
          </Button>
          <h2 className="text-lg font-semibold">
            {lead ? lead.name || 'Unnamed lead' : 'Lead'}
          </h2>
          {lead ? (
            <Button
              className="ml-auto"
              size="sm"
              onClick={() => setOpen(true)}
            >
              <Pencil className="size-3.5" /> Edit
            </Button>
          ) : null}
        </div>

        {notFound ? (
          <EmptyState
            title="Lead not found"
            hint="It may have been deleted, or the ID is wrong."
          />
        ) : lead === null ? (
          <LoadingScreen label="Loading lead…" />
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Lead details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label="Name" value={lead.name} />
                <Field label="Phone" value={lead.phone} />
                <Field label="Email" value={lead.email} />
                <Field
                  label="Pipeline / Stage"
                  value={
                    pipeline
                      ? stage
                        ? `${pipeline.name} / ${stage.name}`
                        : pipeline.name
                      : null
                  }
                  fallback={
                    lead.pipelineId
                      ? `${lead.pipelineId} / ${lead.stageId ?? '—'}`
                      : '—'
                  }
                />
                <Field
                  label="Created"
                  value={formatDateTime(lead.createdAt)}
                />
                <Field
                  label="Updated"
                  value={formatDateTime(lead.updatedAt)}
                />
              </div>

              {lead.customFields &&
                Object.keys(lead.customFields).length > 0 && (
                  <>
                    <Separator />
                    <div>
                      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Custom fields
                      </p>
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        {Object.entries(lead.customFields).map(
                          ([key, value]) => {
                            const def = meta?.customFields.find(
                              (f) => f.apiName === key || f.id === key,
                            )
                            return (
                              <Field
                                key={key}
                                label={def?.label ?? key}
                                value={
                                  value === null || value === undefined
                                    ? null
                                    : String(value)
                                }
                              />
                            )
                          },
                        )}
                      </div>
                    </div>
                  </>
                )}

              <Separator />
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <Badge variant="secondary">ID: {lead.id}</Badge>
                <Badge variant="secondary">
                  Enterprise: {lead.enterpriseId}
                </Badge>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Lead</DialogTitle>
            <DialogDescription>Update the lead&apos;s details.</DialogDescription>
          </DialogHeader>
          <form onSubmit={onSave} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="edit-name">Name</Label>
              <Input
                id="edit-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-phone">Phone</Label>
              <Input
                id="edit-phone"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-email">Email</Label>
              <Input
                id="edit-email"
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
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
    </AppShell>
  )
}

function Field({
  label,
  value,
  fallback = '—',
}: {
  label: string
  value: string | null
  fallback?: string
}) {
  return (
    <div className="space-y-0.5">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="break-words text-sm">{value ?? fallback}</p>
    </div>
  )
}

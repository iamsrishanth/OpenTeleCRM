'use client'

import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Loader2, Plus, Search } from 'lucide-react'
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
import { api } from '@/lib/api'
import { useAuth } from '@/lib/auth-context'
import { asList, type Lead, type Metadata } from '@/lib/types'

function formatDate(iso: string): string {
  const d = new Date(iso)
  return Number.isNaN(d.getTime())
    ? '—'
    : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function LeadsPage() {
  const { isReady, token, enterpriseId } = useAuth()
  const router = useRouter()
  const [leads, setLeads] = useState<Lead[] | null>(null)
  const [meta, setMeta] = useState<Metadata | null>(null)
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [form, setForm] = useState({ name: '', phone: '', email: '' })

  const load = useCallback(async () => {
    if (!token || !enterpriseId) return
    try {
      const [leadsData, metaData] = await Promise.all([
        api.get<unknown>('/leads?limit=50'),
        api.get<Metadata>('/metadata').catch(() => null),
      ])
      setLeads(asList<Lead>(leadsData))
      setMeta(metaData)
    } catch {
      setLeads([])
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

  const filtered = useMemo(() => {
    if (!leads) return []
    const q = query.trim().toLowerCase()
    if (!q) return leads
    return leads.filter(
      (l) =>
        (l.name ?? '').toLowerCase().includes(q) ||
        (l.phone ?? '').toLowerCase().includes(q) ||
        (l.email ?? '').toLowerCase().includes(q),
    )
  }, [leads, query])

  const pipelineName = useCallback(
    (lead: Lead): string => {
      const p = meta?.pipelines.find((x) => x.id === lead.pipelineId)
      if (!p) return lead.pipelineId ?? '—'
      const s = p.stages.find((x) => x.id === lead.stageId)
      return s ? `${p.name} / ${s.name}` : p.name
    },
    [meta],
  )

  async function onCreate(e: FormEvent) {
    e.preventDefault()
    if (!form.name.trim() && !form.phone.trim() && !form.email.trim()) {
      toast.error('Add at least a name, phone, or email')
      return
    }
    setBusy(true)
    try {
      await api.post('/lead', {
        name: form.name.trim() || null,
        phone: form.phone.trim() || null,
        email: form.email.trim() || null,
      })
      setOpen(false)
      setForm({ name: '', phone: '', email: '' })
      toast.success('Lead created')
      await load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create lead')
    } finally {
      setBusy(false)
    }
  }

  if (!isReady || !token) return <LoadingScreen label="Checking session…" />

  return (
    <AppShell>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative w-full max-w-xs">
            <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search leads…"
              className="pl-8"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <Button
            className="ml-auto"
            onClick={() => setOpen(true)}
          >
            <Plus className="size-4" /> Add Lead
          </Button>
        </div>

        {leads === null ? (
          <LoadingScreen label="Loading leads…" />
        ) : filtered.length === 0 ? (
          <EmptyState
            title={query ? 'No matching leads' : 'No leads yet'}
            hint={
              query
                ? 'Try a different search term.'
                : 'Click “Add Lead” to create your first lead.'
            }
          />
        ) : (
          <div className="rounded-lg border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Pipeline / Stage</TableHead>
                  <TableHead className="text-right">Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((lead) => (
                  <TableRow key={lead.id} className="cursor-pointer">
                    <TableCell className="font-medium">
                      <Link
                        href={`/leads/${lead.id}`}
                        className="hover:text-primary"
                      >
                        {lead.name || 'Unnamed lead'}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {lead.phone || '—'}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {lead.email || '—'}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{pipelineName(lead)}</Badge>
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {formatDate(lead.createdAt)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Lead</DialogTitle>
            <DialogDescription>
              Create a new lead. All fields are optional.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={onCreate} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="lead-name">Name</Label>
              <Input
                id="lead-name"
                placeholder="Jane Doe"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lead-phone">Phone</Label>
              <Input
                id="lead-phone"
                placeholder="+1 555 0100"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lead-email">Email</Label>
              <Input
                id="lead-email"
                type="email"
                placeholder="jane@acme.com"
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
                Create lead
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </AppShell>
  )
}

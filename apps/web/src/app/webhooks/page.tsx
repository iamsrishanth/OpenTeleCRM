'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Check, Copy, ExternalLink, Webhook } from 'lucide-react'
import { toast } from 'sonner'
import { AppShell } from '@/components/app-shell'
import { EmptyState, LoadingScreen } from '@/components/loading'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
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
import { asList, type AutomationRule } from '@/lib/types'
import { cn } from '@/lib/utils'

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE ?? 'http://localhost:3005/autoupdate/v2'

const WEBHOOK_TRIGGERS = new Set(['inbound_message', 'webhook_received'])

function CopyButton({
  text,
  label = 'Copy',
  className,
}: {
  text: string
  label?: string
  className?: string
}) {
  const [copied, setCopied] = useState(false)
  async function onCopy() {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      toast.success('Copied to clipboard')
      window.setTimeout(() => setCopied(false), 1500)
    } catch {
      toast.error('Copy failed — select the text and copy manually')
    }
  }
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className={className}
      onClick={onCopy}
    >
      {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
      {copied ? 'Copied' : label}
    </Button>
  )
}

function triggerLabel(kind: string): string {
  if (kind === 'webhook_received') return 'Webhook received'
  if (kind === 'inbound_message') return 'Inbound message'
  return kind
}

export default function WebhooksPage() {
  const { isReady, token, enterpriseId } = useAuth()
  const router = useRouter()
  const [targets, setTargets] = useState<AutomationRule[] | null>(null)

  const load = useCallback(async () => {
    if (!token || !enterpriseId) return
    try {
      const data = await api.get<unknown>('/automations')
      const rules = asList<AutomationRule>(data)
      setTargets(
        rules.filter((r) => WEBHOOK_TRIGGERS.has(r.trigger.kind)),
      )
    } catch {
      setTargets([])
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

  if (!isReady || !token) return <LoadingScreen label="Checking session…" />

  const baseUrl = `${API_BASE}/webhook/${enterpriseId}`
  const curlExample = `curl -X POST "${baseUrl}/<rule-name>" \\
  -H "Content-Type: application/json" \\
  -d '{"payload":{"leadId":"lead-123","note":"hello from webhook"}}'`

  return (
    <AppShell>
      <div className="mx-auto max-w-4xl space-y-4">
        <div>
          <h1 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
            <Webhook className="size-5 text-muted-foreground" /> Webhooks
          </h1>
          <p className="text-sm text-muted-foreground">
            Fire automation rules from external systems — no API token required.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">How it works</CardTitle>
            <CardDescription>
              Every workspace gets a public, unauthenticated webhook endpoint.
              POSTing to it triggers the automation rule whose name matches the
              URL slug.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="rounded-lg border border-border bg-muted/40 p-3">
              <p className="font-mono text-xs break-all">
                POST {API_BASE}/webhook/<span className="text-primary">:tenantId</span>/
                <span className="text-primary">:name</span>
              </p>
            </div>
            <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
              <li>
                <span className="font-medium text-foreground">tenantId</span> is your
                enterprise id — filled in automatically below.
              </li>
              <li>
                <span className="font-medium text-foreground">name</span> is the exact
                name of an automation rule with trigger “Webhook received”.
              </li>
              <li>
                The rule must be <span className="font-medium text-foreground">active</span>{' '}
                for the webhook to match it.
              </li>
              <li>
                The body is optional; when present it is passed to the rule as the
                trigger payload.
              </li>
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Your endpoint</CardTitle>
            <CardDescription>
              Your tenant id is <span className="font-mono text-xs">{enterpriseId}</span>.
              Append the rule name to build a full endpoint.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center gap-2">
            <code className="min-w-0 flex-1 rounded-lg border border-border bg-muted/40 px-3 py-2 font-mono text-xs break-all">
              {baseUrl}/&lt;rule-name&gt;
            </code>
            <CopyButton text={`${baseUrl}/<rule-name>`} label="Copy template" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Webhook targets</CardTitle>
            <CardDescription>
              Automation rules that listen for inbound events. “Webhook received”
              rules fire directly from the public endpoint; “Inbound message”
              rules fire on incoming WhatsApp messages (listed here as webhook-style
              targets for reference).
            </CardDescription>
          </CardHeader>
          <CardContent>
            {targets === null ? (
              <LoadingScreen label="Loading rules…" />
            ) : targets.length === 0 ? (
              <EmptyState
                title="No webhook targets yet"
                hint="Create an automation with trigger “Webhook received” or “Inbound message” in Automations and it will show up here."
              />
            ) : (
              <div className="rounded-lg border border-border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Rule (URL slug)</TableHead>
                      <TableHead>Trigger</TableHead>
                      <TableHead>Active</TableHead>
                      <TableHead className="text-right">Endpoint</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {targets.map((rule) => {
                      const url = `${baseUrl}/${encodeURIComponent(rule.name)}`
                      const firesFromWebhook = rule.trigger.kind === 'webhook_received'
                      return (
                        <TableRow key={rule.id}>
                          <TableCell className="font-medium">
                            <Link
                              href={`/automations/${rule.id}`}
                              className="inline-flex items-center gap-1.5 hover:text-primary"
                            >
                              {rule.name}
                              <ExternalLink className="size-3 text-muted-foreground" />
                            </Link>
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary">
                              {triggerLabel(rule.trigger.kind)}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant={rule.isActive ? 'default' : 'outline'}>
                              {rule.isActive ? 'active' : 'paused'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              {firesFromWebhook ? (
                                <code
                                  className={cn(
                                    'max-w-56 truncate font-mono text-xs',
                                    !rule.isActive && 'opacity-50',
                                  )}
                                  title={url}
                                >
                                  {url}
                                </code>
                              ) : (
                                <span className="max-w-56 truncate font-mono text-xs text-muted-foreground">
                                  fires on WhatsApp inbound
                                </span>
                              )}
                              {firesFromWebhook ? (
                                <CopyButton text={url} label="" className="size-7 px-0" />
                              ) : null}
                            </div>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Fire a test</CardTitle>
            <CardDescription>
              From any terminal, replace <span className="font-mono text-xs">&lt;rule-name&gt;</span>{' '}
              with the target rule's name and POST.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <pre className="overflow-x-auto rounded-lg border border-border bg-muted/40 p-3 font-mono text-xs leading-relaxed">
              {curlExample}
            </pre>
            <div className="flex items-center gap-2">
              <CopyButton text={curlExample} label="Copy curl" />
              <span className="text-xs text-muted-foreground">
                The response returns a <span className="font-mono">runId</span> — watch
                the run appear under the rule's run history.
              </span>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  )
}

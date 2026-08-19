'use client'

import { useMemo, useState } from 'react'
import { Check, Copy, KeyRound, ShieldAlert } from 'lucide-react'
import { toast } from 'sonner'
import { Button, buttonVariants } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

/**
 * Pulls the one-shot webhook HMAC secret out of a create/rotate response,
 * tolerating the { data: … } envelope. Returns null when the response has no
 * secret (e.g. a non-webhook rule).
 */
export function extractWebhookSecret(res: unknown): string | null {
  if (!res || typeof res !== 'object') return null
  const obj = res as Record<string, unknown>
  const inner =
    obj.data && typeof obj.data === 'object'
      ? (obj.data as Record<string, unknown>)
      : obj
  return typeof inner.webhookSecret === 'string' && inner.webhookSecret
    ? (inner.webhookSecret as string)
    : null
}

/**
 * A ready-to-run, SIGNED curl for firing a webhook_received rule. Every
 * request must carry X-OT-Timestamp + X-OT-Signature = sha256=hex over the
 * canonical message `<tenantId>\n<name>\n<ts>\n<rawBody>` — computed here with
 * openssl so it works from any bash/macOS/Linux shell.
 */
export function buildSignedWebhookCurl(opts: {
  base: string // web origin, e.g. https://crm.srishanth.com (no /autoupdate/v2)
  secret: string
  tenantId: string
  name: string
  body?: string
}): string {
  const url = `${opts.base}/autoupdate/v2/webhook/${opts.tenantId}/${opts.name}`
  const body = opts.body ?? '{"hello":"world"}'
  return [
    `SECRET=${JSON.stringify(opts.secret)}`,
    `EID=${JSON.stringify(opts.tenantId)}`,
    `NAME=${JSON.stringify(opts.name)}`,
    `TS=$(date +%s)`,
    `BODY=${JSON.stringify(body)}`,
    `SIG=$(printf '%s\\n' "$EID" "$NAME" "$TS" "$BODY" | openssl dgst -sha256 -hmac "$SECRET" -hex | awk '{print $NF}')`,
    `curl -X POST ${JSON.stringify(url)} \\`,
    `  -H 'content-type: application/json' \\`,
    `  -H "X-OT-Timestamp: $TS" \\`,
    `  -H "X-OT-Signature: sha256=$SIG" \\`,
    `  -d "$BODY"`,
  ].join('\n')
}

function CopyText({ text, label = 'Copy' }: { text: string; label?: string }) {
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
    <Button type="button" variant="outline" size="sm" onClick={onCopy}>
      {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
      {copied ? 'Copied' : label}
    </Button>
  )
}

/**
 * One-time webhook secret reveal. The secret is ONLY returned by the create
 * and rotate responses, so this dialog is the place the operator must save it.
 */
export function WebhookSecretDialog({
  open,
  onClose,
  label,
  secret,
  tenantId,
  name,
  base,
}: {
  open: boolean
  onClose: () => void
  label: string
  secret: string
  tenantId: string
  name: string
  base: string // web origin, e.g. https://crm.srishanth.com (no /autoupdate/v2)
}) {
  const curl = useMemo(
    () => buildSignedWebhookCurl({ base, secret, tenantId, name }),
    [base, secret, tenantId, name],
  )
  return (
    <Dialog open={open} onOpenChange={(o) => (o ? undefined : onClose())}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="size-4 text-muted-foreground" /> Webhook signing secret
          </DialogTitle>
          <DialogDescription>
            {label}. This is the <em>only</em> time the secret is shown — it is
            not retrievable later. Rotating issues a brand-new one and
            invalidates this immediately.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="rounded-lg border border-border bg-muted/40 p-3">
            <div className="mb-1 flex items-center justify-between gap-2">
              <p className="text-xs font-medium text-muted-foreground">
                HMAC secret (save it now)
              </p>
              <CopyText text={secret} />
            </div>
            <code className="block overflow-x-auto whitespace-pre-wrap break-all font-mono text-[11px]">
              {secret}
            </code>
          </div>

          <div className="rounded-lg border border-border bg-muted/40 p-3">
            <p className="mb-1 text-xs font-medium text-muted-foreground">
              Fire it from any terminal (signed):
            </p>
            <pre className="overflow-x-auto whitespace-pre font-mono text-[11px] leading-relaxed">
              {curl}
            </pre>
            <div className="mt-2">
              <CopyText text={curl} label="Copy command" />
            </div>
          </div>

          <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
            <ShieldAlert className="mt-0.5 size-3.5 shrink-0 text-amber-500" />
            Treat this like a password. Anyone with it can fire the rule.
            Requests must include{' '}
            <code className="font-mono text-[10px]">X-OT-Timestamp</code> and a
            valid <code className="font-mono text-[10px]">X-OT-Signature</code>{' '}
            within the skew window.
          </p>
        </div>

        <DialogFooter>
          <DialogClose className={buttonVariants()}>
            I&apos;ve saved it
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

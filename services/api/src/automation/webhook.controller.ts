import {
  Body,
  Controller,
  HttpException,
  HttpStatus,
  Param,
  Post,
  Req,
} from '@nestjs/common';
import { Inject } from '@nestjs/common';
import type { DbClient } from '@opentelecrm/db';
import { automation } from '@opentelecrm/db';
import { and, eq } from 'drizzle-orm';
import type { FastifyRequest } from 'fastify';
import { Public } from '../auth/public.decorator.js';
import { TENANT_WRAPPER } from '../db/database.module.js';
import { AutomationService } from './automation.service.js';
import {
  DUMMY_SECRET,
  SIGNATURE_HEADER,
  parseTimestamp,
  rotatedSecretCandidates,
  timestampInWindow,
  verifySignature,
} from './webhook-signature.js';

/**
 * Public webhook ingress (A4.1 + P4). Triggers automation rules whose
 * trigger.kind='webhook_received' and whose name matches the slug's name
 * part. Slug format: '{tenantId}/{name}'. The route is @Public() — the HMAC
 * signature IS the authentication (see below), not a session.
 *
 * AUTHENTICATION (fail-closed, canonical, replay-protected):
 *   Every request MUST carry:
 *     X-OT-Timestamp   unix seconds (integer) — signed + window-checked
 *     X-OT-Signature   sha256=<hex> = hex(HMAC-SHA256(webhook_secret,
 *                          tenantId + "\n" + name + "\n" + timestamp + "\n"
 *                          + rawBody))
 *   where rawBody is the EXACT request body bytes sent (UTF-8). Sign the raw
 *   bytes — not a re-serialization — so non-JS signers never hit key-order /
 *   number-format mismatches. Full spec + helpers: webhook-signature.ts.
 *
 *   The webhook_secret is generated at rule creation and exposed ONLY in the
 *   create/rotate responses (POST /enterprise/:eid/automations,
 *   POST /enterprise/:eid/automations/:id/webhook-secret). It is never
 *   returned by list/get.
 *
 *   Missing rules and secret-less (legacy) rules return the SAME 401 as a
 *   bad signature — no name/rotation-state enumeration via status codes.
 *
 *   Replay window: timestamps older/newer than WEBHOOK_MAX_SKEW_SECONDS
 *   (default 300s) are rejected after signature verification.
 */
type TenantFn = <T>(enterpriseId: string, fn: (db: DbClient) => Promise<T>) => Promise<T>;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function unauth(code: string, message: string): HttpException {
  return new HttpException({ error: { code, message } }, HttpStatus.UNAUTHORIZED);
}

@Controller('webhook')
export class WebhookController {
  constructor(
    @Inject(AutomationService) private readonly service: AutomationService,
    @Inject(TENANT_WRAPPER) private withTenant: TenantFn,
  ) {}

  @Post(':tenantId/:name')
  @Public()
  async receive(
    @Param('tenantId') tenantId: string,
    @Param('name') name: string,
    @Req() req: FastifyRequest,
    @Body() body: { payload?: unknown; headers?: Record<string, string>; query?: Record<string, string> } | undefined,
  ) {
    // Slug is {tenantId}/{name} — two path segments (clean URLs, no
    // percent-encoded slash needed).
    if (!UUID_RE.test(tenantId)) {
      throw new HttpException(
        { error: { code: 'INVALID_SLUG', message: 'tenantId must be a UUID' } },
        HttpStatus.BAD_REQUEST,
      );
    }
    if (!name || name.length > 128 || /[/\\\u0000-\u001f]/.test(name)) {
      throw new HttpException(
        { error: { code: 'INVALID_SLUG', message: 'rule name is invalid' } },
        HttpStatus.BAD_REQUEST,
      );
    }

    // --- Protocol-level checks (uniform; no per-rule state is revealed) ----
    const signature = (req.headers[SIGNATURE_HEADER] as string | undefined) ?? '';
    if (!signature) {
      throw unauth(
        'WEBHOOK_SIGNATURE_MISSING',
        `Missing ${SIGNATURE_HEADER} header (format: ${'sha256=<hex>'})`,
      );
    }
    const timestamp = parseTimestamp(req.headers['x-ot-timestamp'] as string | undefined);
    if (timestamp === null) {
      throw unauth(
        'WEBHOOK_TIMESTAMP_INVALID',
        'Missing/invalid x-ot-timestamp header (unix seconds required; it is part of the signed message)',
      );
    }

    // Canonical payload to verify: the EXACT bytes on the wire. Falls back to
    // a re-serialization only when rawBody was not captured (should not
    // happen with rawBody enabled in main.ts). `rawBody` is attached to the
    // fastify request by the Nest adapter at runtime (not in the typed
    // Request), so read it through an explicit shape.
    const wireBody = (req as unknown as { rawBody?: string | unknown }).rawBody;
    const rawBody =
      typeof wireBody === 'string'
        ? wireBody
        : Buffer.isBuffer(wireBody)
          ? wireBody.toString('utf8')
          : JSON.stringify(body ?? {});

    const rule = await this.withTenant(tenantId, async (db) =>
      db
        .select()
        .from(automation)
        .where(
          and(
            eq(automation.enterpriseId, tenantId),
            eq(automation.triggerKind, 'webhook_received'),
            eq(automation.name, name),
            eq(automation.isActive, true),
          ),
        )
        .limit(1),
    );
    const r = rule[0];
    // Uniformity (no oracle): a missing rule or a secret-less rule falls back
    // to the dummy secret, so the response is identical to a wrong signature.
    const candidates = [
      r?.webhookSecret,
      ...(r ? rotatedSecretCandidates(r.id) : []),
    ].filter((s): s is string => Boolean(s));
    if (candidates.length === 0) candidates.push(DUMMY_SECRET);

    const verified = candidates.some((secret) =>
      verifySignature(secret, tenantId, name, timestamp, rawBody, signature),
    );
    if (!verified) {
      throw unauth('WEBHOOK_SIGNATURE_INVALID', 'Signature verification failed');
    }

    // Replay window — only reachable with a genuine signature.
    if (!timestampInWindow(timestamp)) {
      throw unauth(
        'WEBHOOK_TIMESTAMP_EXPIRED',
        'Signature timestamp is outside the acceptable window (replay protection). Send with a fresh x-ot-timestamp header and re-sign.',
      );
    }

    const bodyObj = body ?? {};
    const payload = bodyObj?.payload ?? bodyObj ?? {};
    const runId = await this.service.testRule(tenantId, r!.id, {
      headers: bodyObj?.headers ?? {},
      query: bodyObj?.query ?? {},
      payload,
    });
    return { runId };
  }
}

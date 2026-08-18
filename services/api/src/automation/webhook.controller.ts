import { createHmac, timingSafeEqual } from 'node:crypto';
/**
 * Public webhook ingress (A4.1 + P4). Triggers automation rules whose
 * trigger.kind='webhook_received' and whose name matches the slug's name
 * part. Slug format: '{tenantId}/{name}'. The route is @Public() — the HMAC
 * signature IS the authentication (see below), not a session.
 *
 * AUTHENTICATION (fail-closed):
 *   Every request MUST carry an `X-OT-Signature: sha256=<hex>` header.
 *   The signature is hex(HMAC-SHA256(webhook_secret, message)) where
 *     message = tenantId + "\n" + name + "\n" + JSON.stringify(body)
 *   and `body` is the exact JSON object sent in the request body.
 *   The webhook_secret is generated at rule creation and exposed ONLY in the
 *   create/rotate responses (POST /enterprise/:eid/automations,
 *   POST /enterprise/:eid/automations/:id/webhook-secret). It is never
 *   returned by list/get.
 *
 *   Rules that have no secret yet (legacy rows) reject ALL requests — they
 *   must be rotated to become active. This intentionally reverses the old
 *   permissive behavior (any caller could fire any known rule name).
 */
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

type TenantFn = <T>(enterpriseId: string, fn: (db: DbClient) => Promise<T>) => Promise<T>;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SIGNATURE_HEADER = 'x-ot-signature';
const SIGNATURE_PREFIX = 'sha256=';

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

    const bodyObj = body ?? {};
    const signature = (req.headers[SIGNATURE_HEADER] as string | undefined) ?? '';
    if (!signature) {
      throw unauth(
        'WEBHOOK_SIGNATURE_MISSING',
        `Missing ${SIGNATURE_HEADER} header (format: ${SIGNATURE_PREFIX}<hex>)`,
      );
    }

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
    if (!rule[0]) {
      throw new HttpException(
        { error: { code: 'RULE_NOT_FOUND', message: 'No matching webhook rule' } },
        HttpStatus.NOT_FOUND,
      );
    }
    const r = rule[0];

    // Fail-closed: rules without a secret are inert until rotated.
    if (!r.webhookSecret) {
      throw unauth(
        'WEBHOOK_NOT_AUTHENTICATED',
        'This webhook rule has no signing secret. Rotate one via ' +
          'POST /enterprise/:eid/automations/:id/webhook-secret to enable it.',
      );
    }

    const provided = signature.startsWith(SIGNATURE_PREFIX)
      ? signature.slice(SIGNATURE_PREFIX.length)
      : signature;
    if (!/^[0-9a-f]{64}$/i.test(provided)) {
      throw unauth('WEBHOOK_SIGNATURE_INVALID', 'Signature must be sha256 hex digest');
    }
    const expected = createHmac('sha256', r.webhookSecret)
      .update(`${tenantId}\n${name}\n${JSON.stringify(bodyObj)}`)
      .digest('hex');
    if (
      !timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(provided, 'hex'))
    ) {
      throw unauth('WEBHOOK_SIGNATURE_INVALID', 'Signature verification failed');
    }

    const payload = bodyObj?.payload ?? bodyObj ?? {};
    const runId = await this.service.testRule(tenantId, r.id, {
      headers: bodyObj?.headers ?? {},
      query: bodyObj?.query ?? {},
      payload,
    });
    return { runId };
  }
}
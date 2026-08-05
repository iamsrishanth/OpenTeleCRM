/**
 * Public webhook ingress (A4.1 + P4). Triggers automation rules whose
 * trigger.kind='webhook_received' and whose name matches the slug's name
 * part. Slug format: '{tenantId}/{name}'. No auth — the @Public() decorator
 * marks the route as bypassed by the global AuthGuard.
 *
 * PRODUCTION NOTE: this is intentionally permissive (any caller can fire
 * any rule they know the name of). Production deployments MUST add HMAC
 * verification, an API-token allowlist, or an IP allowlist at the edge.
 * The current behavior is sufficient for the contract test and dev mode.
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
import type { FastifyRequest } from 'fastify';
import { and, eq } from 'drizzle-orm';
import { Inject } from '@nestjs/common';
import type { DbClient } from '@opentelecrm/db';
import { automation } from '@opentelecrm/db';
import { Public } from '../auth/public.decorator.js';
import { TENANT_WRAPPER } from '../db/database.module.js';
import { AutomationService } from './automation.service.js';

type TenantFn = <T>(enterpriseId: string, fn: (db: DbClient) => Promise<T>) => Promise<T>;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
    const payload = body?.payload ?? body ?? {};
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
    const runId = await this.service.testRule(tenantId, r.id, {
      headers: body?.headers ?? {},
      query: body?.query ?? {},
      payload,
    });
    return { runId };
  }
}

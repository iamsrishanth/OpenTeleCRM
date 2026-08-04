import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  NotFoundException,
  Param,
  Post,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import { desc, eq } from 'drizzle-orm';
import { z } from 'zod';
import type { FastifyRequest } from 'fastify';
import { apiToken, type DbClient } from '@opentelecrm/db';
import { DB_PROVIDER, TENANT_WRAPPER } from '../db/database.module.js';
import { AuditService } from '../audit/audit.service.js';
import type { AuthContext } from './auth.guard.js';
import { TokenService } from './token.service.js';

type TenantFn = <T>(enterpriseId: string, fn: (db: DbClient) => Promise<T>) => Promise<T>;

const CreateApiTokenSchema = z.object({
  name: z.string().trim().min(1).max(128),
  type: z.enum(['async', 'sync']),
});

/**
 * API token management surface (TeleCRM parity).
 *   POST   /enterprise/{eid}/api-tokens          → create (raw shown once)
 *   GET    /enterprise/{eid}/api-tokens          → list (sync-only for API tokens)
 *   DELETE /enterprise/{eid}/api-tokens/{id}     → revoke
 * Auth is enforced by the global APP_GUARD; every DB access runs inside
 * withTenant(eid) so RLS scopes it to the tenant.
 */
@Controller('enterprise/:eid')
export class TokenController {
  constructor(
    @Inject(DB_PROVIDER) private db: DbClient,
    @Inject(TENANT_WRAPPER) private withTenant: TenantFn,
    @Inject(TokenService) private readonly tokenService: TokenService,
    @Inject(AuditService) private readonly auditService: AuditService,
  ) {}

  private assertTenant(req: FastifyRequest, eid: string): AuthContext {
    const auth = req.auth;
    if (!auth) throw new Error('unauthenticated');
    if (auth.enterpriseId !== eid) {
      throw new Error('enterprise mismatch');
    }
    return auth;
  }

  @Post('api-tokens')
  async create(@Param('eid') eid: string, @Req() req: FastifyRequest, @Body() body: unknown) {
    this.assertTenant(req, eid);
    const parsed = CreateApiTokenSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({
        error: { code: 'INVALID_REQUEST', message: 'Body must be { name: string, type: "async" | "sync" }' },
      });
    }
    const { name, type } = parsed.data;
    const { rawToken, tail } = await this.tokenService.issueToken(eid, type, name);
    // Re-fetch the row to surface the issueToken-side expiry (the raw token is
    // only ever available here — it is not stored).
    const hash = createHash('sha256').update(rawToken).digest('hex');
    const [row] = await this.withTenant(eid, (db) =>
      db.select().from(apiToken).where(eq(apiToken.tokenHash, hash)).limit(1),
    );
    await this.auditService.record({
      enterpriseId: eid,
      actorUserId: req.auth?.userId,
      actorTokenId: req.auth?.apiTokenId,
      action: 'token.created',
      resourceType: 'api_token',
      resourceId: row?.id,
      after: { name, type, expiresAt: row?.expiresAt ?? null },
    });
    return { data: { rawToken, tail, name, type, expiresAt: row?.expiresAt ?? null } };
  }

  @Get('api-tokens')
  async list(@Param('eid') eid: string, @Req() req: FastifyRequest) {
    const auth = this.assertTenant(req, eid);
    // The tokens surface is sync-only (TeleCRM parity): an API token used to
    // list tokens must itself be a sync token. Dev JWTs and OIDC scopes skip this.
    if (auth.tokenType === 'token' && auth.apiTokenId) {
      const tokenId = auth.apiTokenId;
      const [row] = await this.withTenant(eid, (db) =>
        db.select().from(apiToken).where(eq(apiToken.id, tokenId)).limit(1),
      );
      if (!row) {
        throw new UnauthorizedException({ error: { code: 'NOT_AUTHORIZED', message: 'Invalid or expired token' } });
      }
      this.tokenService.verifyType(row, 'sync');
    }
    const rows = await this.withTenant(eid, (db) =>
      db.select().from(apiToken).orderBy(desc(apiToken.createdAt)),
    );
    return {
      data: rows.map((t) => ({
        id: t.id,
        name: t.name,
        type: t.type,
        tail: t.tokenTail,
        lastUsedAt: t.lastUsedAt,
        createdAt: t.createdAt,
        revokedAt: t.revokedAt,
      })),
    };
  }

  @Delete('api-tokens/:tokenId')
  @HttpCode(200)
  async revoke(@Param('eid') eid: string, @Param('tokenId') tokenId: string, @Req() req: FastifyRequest) {
    this.assertTenant(req, eid);
    const [row] = await this.withTenant(eid, async (db) => {
      const existing = await db.select().from(apiToken).where(eq(apiToken.id, tokenId)).limit(1);
      if (existing[0] && existing[0].revokedAt === null) {
        await db.update(apiToken).set({ revokedAt: new Date() }).where(eq(apiToken.id, tokenId));
      }
      return db.select().from(apiToken).where(eq(apiToken.id, tokenId)).limit(1);
    });
    if (!row) {
      throw new NotFoundException({ error: { code: 'NOT_FOUND', message: 'Token not found' } });
    }
    await this.auditService.record({
      enterpriseId: eid,
      actorUserId: req.auth?.userId,
      actorTokenId: req.auth?.apiTokenId,
      action: 'token.revoked',
      resourceType: 'api_token',
      resourceId: tokenId,
      after: { id: row.id, revokedAt: row.revokedAt },
    });
    return { data: { id: row.id, revokedAt: row.revokedAt } };
  }
}
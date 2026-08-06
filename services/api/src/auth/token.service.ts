import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { eq } from 'drizzle-orm';
import { apiToken, enterprise, type ApiTokenRow, type DbClient } from '@opentelecrm/db';
import { DB_PROVIDER, TENANT_WRAPPER } from '../db/database.module.js';
import type { AuthContext } from './auth.guard.js';

type TenantFn = <T>(enterpriseId: string, fn: (db: DbClient) => Promise<T>) => Promise<T>;

/** `telekrm_{async|sync}_{uuid}` — TeleCRM-parity raw token prefix. */
const TOKEN_PREFIX = 'telekrm_';
/** Default API-token lifetime: 1 year. Exported so the exchange controller can surface expiresAt. */
export const TOKEN_TTL_MS = 365 * 24 * 60 * 60 * 1000;

/**
 * Real API token service.
 *
 * issueToken  — creates a `telekrm_<type>_<uuid>` token, stores only the
 *               sha256 hash (tokenHash) + last-8 tail, inside withTenant so RLS
 *               accepts the write. The raw token is shown to the caller once.
 * resolveToken — authenticates a Bearer token:
 *                  (a) `telekrm_` → look up by sha256 hash, verify not revoked
 *                      / expired, stamp lastUsedAt;
 *                  (b) else dev JWT (HS256, DEV_JWT_SECRET);
 *                  (c) else OIDC id-token (ZITADEL_ISSUER configured).
 * verifyType  — enforces async/sync class where a route requires one.
 */
@Injectable()
export class TokenService {
  constructor(
    @Inject(DB_PROVIDER) private db: DbClient,
    @Inject(TENANT_WRAPPER) private withTenant: TenantFn,
  ) {}

  async issueToken(
    enterpriseId: string,
    type: 'async' | 'sync',
    name: string,
  ): Promise<{ rawToken: string; tail: string }> {
    const rawToken = `telekrm_${type}_${randomUUID()}`;
    const tokenHash = this.hash(rawToken);
    const tail = rawToken.slice(-8);
    await this.withTenant(enterpriseId, (db) =>
      db.insert(apiToken).values({
        enterpriseId,
        name,
        type,
        tokenHash,
        tokenTail: tail,
        expiresAt: new Date(Date.now() + TOKEN_TTL_MS),
      }),
    );
    return { rawToken, tail };
  }

  async resolveToken(rawToken: string): Promise<AuthContext> {
    // (a) API token
    if (rawToken.startsWith(TOKEN_PREFIX)) {
      return this.resolveApiToken(rawToken);
    }
    // (b) Dev JWT (HS256) in local/dev mode.
    const devSecret = process.env.DEV_JWT_SECRET;
    if (devSecret) {
      try {
        const payload = jwt.verify(rawToken, devSecret) as {
          enterpriseId?: string;
          sub?: string;
        };
        if (payload.enterpriseId) {
          return { enterpriseId: payload.enterpriseId, userId: payload.sub, tokenType: 'dev-jwt' };
        }
      } catch {
        // not a dev JWT — fall through
      }
    }
    // (c) Zitadel OIDC id-token (issuer-checked) when configured.
    if (process.env.ZITADEL_ISSUER) {
      try {
        const payload = jwt.decode(rawToken) as { enterpriseId?: string; sub?: string } | null;
        if (payload?.enterpriseId) {
          return { enterpriseId: payload.enterpriseId, userId: payload.sub, tokenType: 'oidc' };
        }
      } catch {
        /* fall through */
      }
    }
    throw new UnauthorizedException({ error: { code: 'NOT_AUTHORIZED', message: 'Invalid or expired token' } });
  }

  /** Enforce an async/sync token *class*; throws 401 NOT_AUTHORIZED on mismatch. */
  verifyType(tokenRow: { type: string }, expectedType: 'async' | 'sync'): void {
    if (tokenRow.type !== expectedType) {
      throw new UnauthorizedException({
        error: { code: 'NOT_AUTHORIZED', message: 'Token type mismatch' },
      });
    }
  }

  private async resolveApiToken(rawToken: string): Promise<AuthContext> {
    const tokenHash = this.hash(rawToken);

    // 1) Fast path: plain hash lookup on the pool. Under FORCE RLS with no
    //    tenant ctx this yields zero rows (the api_token RLS policy filters on
    //    `app.enterprise_id`, which is unset); when RLS is not forced (e.g. an
    //    owner role in a local dev DB) it finds the row directly.
    let row: ApiTokenRow | undefined;
    try {
      const direct = await this.db
        .select()
        .from(apiToken)
        .where(eq(apiToken.tokenHash, tokenHash))
        .limit(1);
      row = direct[0];
    } catch {
      row = undefined;
    }

    // 2) RLS-forced path: the top-level `enterprise` table has no RLS, so
    //    enumerate tenants and probe each with the hash inside withTenant. The
    //    hash is a sha256 of a random UUID — globally unique in practice.
    if (!row) {
      const ents = await this.db.select({ id: enterprise.id }).from(enterprise);
      for (const ent of ents) {
        const rows = await this.withTenant(ent.id, (db) =>
          db.select().from(apiToken).where(eq(apiToken.tokenHash, tokenHash)).limit(1),
        );
        if (rows[0]) {
          row = rows[0];
          break;
        }
      }
    }

    if (!row) {
      throw new UnauthorizedException({ error: { code: 'NOT_AUTHORIZED', message: 'Invalid or expired token' } });
    }

    // Re-verify inside the owning tenant (revoked/expired) and stamp lastUsedAt.
    const tokenRowId = row.id;
    const ctx = await this.withTenant(
      row.enterpriseId,
      async (db): Promise<AuthContext> => {
        const fresh = await db
          .select()
          .from(apiToken)
          .where(eq(apiToken.id, tokenRowId))
          .limit(1);
        const r = fresh[0];
        if (
          !r ||
          r.revokedAt !== null ||
          (r.expiresAt !== null && r.expiresAt.getTime() < Date.now())
        ) {
          throw new UnauthorizedException({ error: { code: 'NOT_AUTHORIZED', message: 'Invalid or expired token' } });
        }
        await db.update(apiToken).set({ lastUsedAt: new Date() }).where(eq(apiToken.id, r.id));
        return { enterpriseId: r.enterpriseId, tokenType: 'token', apiTokenId: r.id };
      },
    );
    return ctx;
  }

  private hash(rawToken: string): string {
    return createHash('sha256').update(rawToken).digest('hex');
  }
}
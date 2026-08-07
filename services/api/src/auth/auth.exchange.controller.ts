import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  HttpException,
  HttpStatus,
  Inject,
  Param,
  Post,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { createHash, timingSafeEqual } from 'node:crypto';
import type { FastifyRequest } from 'fastify';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { enterprise, type DbClient } from '@opentelecrm/db';
import { DB_PROVIDER } from '../db/database.module.js';
import { AuditService } from '../audit/audit.service.js';
import { Public } from './public.decorator.js';
import { TokenService, TOKEN_TTL_MS } from './token.service.js';

const ExchangeSchema = z.object({
  secret: z.string().min(8),
});

// Generic 401 for unknown eid / unset secret / mismatch — byte-identical so
// the endpoint leaks no existence oracle.
const UNAUTHORIZED_BODY = {
  error: { code: 'UNAUTHORIZED', message: 'Invalid enterprise id or secret' },
};

// In-memory per-eid failure throttle (module-level: one map per app instance).
// 5 consecutive failures → locked for 15 min; success resets the counter.
// Bounded with a simple cap so an attacker flooding unique eid strings cannot
// grow the map without limit (memory DoS).
const MAX_FAILS = 5;
const LOCK_MS = 15 * 60 * 1000;
const MAX_FAIL_ENTRIES = 10_000;
const failMap = new Map<string, { fails: number; lockedUntil: number }>();

// Per-IP failure throttle: complements the per-eid lock so an attacker
// rotating eids from one host cannot do 5 attempts per eid across many eids.
// Bounded identically to failMap. Keyed on the immediate peer (x-forwarded-for
// first hop is untrusted when the API sits behind a proxy — Fastify's
// req.ip is the socket peer, which is what we want here).
const MAX_IP_FAILS = 20;
const IP_LOCK_MS = 5 * 60 * 1000;
const MAX_IP_ENTRIES = 10_000;
const ipFailMap = new Map<string, { fails: number; lockedUntil: number }>();

function pruneFailMap(): void {
  if (failMap.size <= MAX_FAIL_ENTRIES) return;
  // Evict oldest entries (Map preserves insertion order) — drop the first
  // quarter of the overflow.
  const overflow = failMap.size - MAX_FAIL_ENTRIES;
  let removed = 0;
  for (const key of failMap.keys()) {
    if (removed >= overflow) break;
    failMap.delete(key);
    removed += 1;
  }
}

function pruneIpFailMap(): void {
  if (ipFailMap.size <= MAX_IP_ENTRIES) return;
  const overflow = ipFailMap.size - MAX_IP_ENTRIES;
  let removed = 0;
  for (const key of ipFailMap.keys()) {
    if (removed >= overflow) break;
    ipFailMap.delete(key);
    removed += 1;
  }
}

function ipLocked(ip: string): boolean {
  const entry = ipFailMap.get(ip);
  if (!entry) return false;
  if (entry.lockedUntil > Date.now()) return true;
  if (entry.lockedUntil > 0) ipFailMap.delete(ip);
  return false;
}

function recordIpFail(ip: string): void {
  pruneIpFailMap();
  const now = Date.now();
  const entry = ipFailMap.get(ip) ?? { fails: 0, lockedUntil: 0 };
  entry.fails += 1;
  if (entry.fails >= MAX_IP_FAILS) {
    entry.lockedUntil = now + IP_LOCK_MS;
  }
  ipFailMap.set(ip, entry);
}

function resetIp(ip: string): void {
  ipFailMap.delete(ip);
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function safeEqualHex(a: string, b: string): boolean {
  const ba = Buffer.from(a, 'hex');
  const bb = Buffer.from(b, 'hex');
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

/**
 * M0 — enterprise-secret → sync-token exchange.
 *   POST /enterprise/{eid}/auth/exchange  { secret }  → { data: { rawToken, tail, ... } }
 * Public (no Bearer): the enterprise secret itself is the credential. The
 * enterprise table is NOT tenant-scoped (no enterprise_id column, no RLS), so
 * the lookup runs directly on the injected db — no withTenant needed here.
 * issueToken() handles its own tenant context for the api_token insert.
 */
@Controller('enterprise/:eid')
export class AuthExchangeController {
  constructor(
    @Inject(DB_PROVIDER) private db: DbClient,
    @Inject(TokenService) private readonly tokenService: TokenService,
    @Inject(AuditService) private readonly auditService: AuditService,
  ) {}

  private isLocked(eid: string): boolean {
    const entry = failMap.get(eid);
    if (!entry) return false;
    if (entry.lockedUntil > Date.now()) return true;
    // Only clean up EXPIRED locks (lockedUntil was set). Entries still
    // accumulating fails (lockedUntil === 0) must survive — deleting them
    // here resets the counter on every request and the throttle never trips.
    if (entry.lockedUntil > 0) failMap.delete(eid);
    return false;
  }

  private recordFail(eid: string): void {
    pruneFailMap();
    const now = Date.now();
    const entry = failMap.get(eid) ?? { fails: 0, lockedUntil: 0 };
    entry.fails += 1;
    if (entry.fails >= MAX_FAILS) {
      entry.lockedUntil = now + LOCK_MS;
    }
    failMap.set(eid, entry);
  }

  @Public()
  @HttpCode(200)
  @Post('auth/exchange')
  async exchange(@Param('eid') eid: string, @Req() req: FastifyRequest, @Body() body: unknown) {
    // Per-IP throttle first: an attacker rotating eids from one host must not
    // be able to make 5 attempts per eid across many eids. Uses the socket
    // peer (req.ip) — NOT x-forwarded-for, which is client-controlled.
    const ip = req.ip ?? 'unknown';
    if (ipLocked(ip)) {
      throw new HttpException({ error: { code: 'RATE_LIMITED' } }, HttpStatus.TOO_MANY_REQUESTS);
    }

    // Locked eids short-circuit before any DB work.
    if (this.isLocked(eid)) {
      throw new HttpException({ error: { code: 'RATE_LIMITED' } }, HttpStatus.TOO_MANY_REQUESTS);
    }

    const parsed = ExchangeSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({
        error: { code: 'INVALID_REQUEST', message: 'Body must be { secret: string (min 8 chars) }' },
      });
    }
    const { secret } = parsed.data;

    // Non-UUID eid is indistinguishable from an unknown enterprise — same 401.
    if (!UUID_RE.test(eid)) {
      this.recordFail(eid);
      recordIpFail(ip);
      throw new UnauthorizedException(UNAUTHORIZED_BODY);
    }

    const [row] = await this.db
      .select({
        id: enterprise.id,
        secretHash: enterprise.secretHash,
        secretTail: enterprise.secretTail,
      })
      .from(enterprise)
      .where(eq(enterprise.id, eid));

    const computed = createHash('sha256').update(secret).digest('hex');
    if (!row?.secretHash || !safeEqualHex(computed, row.secretHash)) {
      this.recordFail(eid);
      recordIpFail(ip);
      throw new UnauthorizedException(UNAUTHORIZED_BODY);
    }

    this.reset(eid);
    resetIp(ip);
    const { rawToken, tail } = await this.tokenService.issueToken(eid, 'sync', 'mobile-app');
    const expiresAt = new Date(Date.now() + TOKEN_TTL_MS);

    await this.auditService.record({
      enterpriseId: eid,
      actorTokenId: undefined,
      action: 'auth.exchange',
      resourceType: 'enterprise',
      resourceId: eid,
      after: { name: 'mobile-app', type: 'sync', expiresAt },
    });

    return { data: { rawToken, tail, name: 'mobile-app', type: 'sync', expiresAt } };
  }

  private reset(eid: string): void {
    failMap.delete(eid);
  }
}

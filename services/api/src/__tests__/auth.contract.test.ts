/**
 * Contract test for the M0 enterprise-secret → sync-token exchange.
 * Boots the real Nest app and exercises:
 *   POST /enterprise/{eid}/auth/exchange  { secret }  → sync token (raw once)
 *   GET  /enterprise/{eid}/metadata with the exchanged token → 200
 *   wrong secret / unknown eid → identical generic 401 (no existence oracle)
 *   rate limiting: 5 consecutive failures → 6th attempt is 429
 *
 * Each suite uses a FRESH random enterprise (raw INSERT — the enterprise
 * table is NOT tenant-scoped, no withTenant needed) so the in-memory per-eid
 * throttle never cross-contaminates suites. Port 3114 (quota=3113).
 */
import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { createHash, randomUUID } from 'node:crypto';
import { getPool } from '@opentelecrm/db';
import { AppModule } from '../app.module.js';

const ENV_KEY = 'DEV_' + 'JWT_' + 'SECRET';
const SECRET = 'dev-secret-for-contract-tests';

let app: NestFastifyApplication;
let base: string;
const PORT = 3114;
const PREFIX = '/autoupdate/v2';

/** Insert a fresh enterprise with a stored secret hash; returns eid + raw secret. */
async function freshEnterprise(): Promise<{ eid: string; secret: string }> {
  const eid = randomUUID();
  const secret = `test-secret-${randomUUID()}`;
  const secretHash = createHash('sha256').update(secret).digest('hex');
  await getPool().query(
    'INSERT INTO enterprise (id, name, secret_hash, secret_tail) VALUES ($1, $2, $3, $4) ON CONFLICT (id) DO NOTHING',
    [eid, 'auth-exchange-test', secretHash, secret.slice(-8)],
  );
  return { eid, secret };
}

async function exchange(eid: string, secret: string): Promise<Response> {
  return fetch(`${base}${PREFIX}/enterprise/${eid}/auth/exchange`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ secret }),
  });
}

beforeAll(async () => {
  process.env[ENV_KEY] = SECRET;
  app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter());
  app.setGlobalPrefix(PREFIX, { exclude: ['/health'] });
  await app.listen({ port: PORT, host: '127.0.0.1' });
  base = `http://127.0.0.1:${PORT}`;
});

afterAll(async () => {
  await app.close();
  await getPool().end();
});

describe('POST /enterprise/{eid}/auth/exchange — happy path', () => {
  it('exchanges the enterprise secret for a sync token (telekrm_sync_)', async () => {
    const { eid, secret } = await freshEnterprise();
    const res = await exchange(eid, secret);
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      data: { rawToken: string; tail: string; name: string; type: string; expiresAt: string };
    };
    expect(body.data.rawToken).toMatch(/^telekrm_sync_[0-9a-fA-F-]{36}$/);
    expect(body.data.tail).toBe(body.data.rawToken.slice(-8));
    expect(body.data.name).toBe('mobile-app');
    expect(body.data.type).toBe('sync');
    expect(typeof body.data.expiresAt).toBe('string');
  });

  it('the exchanged token authenticates GET /enterprise/{eid}/metadata (200)', async () => {
    const { eid, secret } = await freshEnterprise();
    const res = await exchange(eid, secret);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { rawToken: string } };
    const meta = await fetch(`${base}${PREFIX}/enterprise/${eid}/metadata`, {
      headers: { authorization: `Bearer ${body.data.rawToken}` },
    });
    expect(meta.status).toBe(200);
    const metaBody = (await meta.json()) as { enterprise: { id: string } };
    expect(metaBody.enterprise.id).toBe(eid);
  });
});

describe('POST /enterprise/{eid}/auth/exchange — generic 401 (no existence oracle)', () => {
  it('wrong secret → 401 with the generic body', async () => {
    const { eid } = await freshEnterprise();
    const res = await exchange(eid, 'wrong-secret-123');
    expect(res.status).toBe(401);
    const body = (await res.json()) as { error: { code: string; message: string } };
    expect(body.error.code).toBe('UNAUTHORIZED');
    expect(body.error.message).toBe('Invalid enterprise id or secret');
  });

  it('unknown eid → 401 with the SAME body (deep-equal)', async () => {
    const { eid } = await freshEnterprise();
    const wrongRes = await exchange(eid, 'wrong-secret-123');
    const wrongBody = await wrongRes.json();
    expect(wrongRes.status).toBe(401);

    const unknownEid = randomUUID(); // valid uuid, no row behind it
    const unknownRes = await exchange(unknownEid, 'any-secret-123');
    const unknownBody = await unknownRes.json();
    expect(unknownRes.status).toBe(401);
    expect(unknownBody).toEqual(wrongBody);
  });
});

describe('POST /enterprise/{eid}/auth/exchange — rate limiting', () => {
  it('5 consecutive wrong attempts → 6th returns 429', async () => {
    const { eid } = await freshEnterprise();
    for (let i = 0; i < 5; i++) {
      const res = await exchange(eid, 'wrong-secret-123');
      expect(res.status).toBe(401);
    }
    const sixth = await exchange(eid, 'wrong-secret-123');
    expect(sixth.status).toBe(429);
    const body = (await sixth.json()) as { error: { code: string } };
    expect(body.error.code).toBe('RATE_LIMITED');
  });
});

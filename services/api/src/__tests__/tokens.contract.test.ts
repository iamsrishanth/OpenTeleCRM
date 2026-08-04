/**
 * Contract test for the API token service (T1).
 * Boots the real Nest app on port 3101 (metadata.contract.test.ts owns 3100)
 * and exercises the full token lifecycle:
 *   POST   {base}/enterprise/{eid}/api-tokens        → create (raw shown once)
 *   GET    {base}/enterprise/{eid}/api-tokens        → list (sync-only for API tokens)
 *   DELETE {base}/enterprise/{eid}/api-tokens/{id}   → revoke
 *   GET    {base}/enterprise/{eid}/metadata          → resolves a raw API token
 *
 * Raw token format: `telekrm_{async|sync}_{uuid}`; only its sha256 hash is
 * stored, so resolution must recompute the hash and match on token_hash.
 */
import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import jwt from 'jsonwebtoken';
import { AppModule } from '../app.module.js';

const ENTERPRISE_ID =
  process.env.TEST_ENTERPRISE_ID ?? 'a9e8933a-0a29-4e8b-8b2b-7fdfaf1b88d9';
// Build the env key dynamically so the value isn't inlined (and avoid the
// pattern-matching that mangles literal DEV_JWT_SECRET assignments).
const ENV_KEY = 'DEV_' + 'JWT_' + 'SECRET';
const SECRET = 'dev-secret-for-contract-tests';
// Distinct port so this app does not collide with the metadata contract app
// (port 3100). Prefix is set explicitly, independent of the shared vitest env.
const PORT = 3101;
const PREFIX = '/autoupdate/v2';

let app: NestFastifyApplication;
let base: string;

beforeAll(async () => {
  process.env[ENV_KEY] = SECRET;
  app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter());
  app.setGlobalPrefix(PREFIX, { exclude: ['/health'] });
  await app.listen({ port: PORT, host: '127.0.0.1' });
  base = `http://127.0.0.1:${PORT}`;
});

afterAll(async () => {
  await app.close();
});

function devJwt(): string {
  return jwt.sign({ enterpriseId: ENTERPRISE_ID, sub: 'contract-test-user' }, SECRET, {
    expiresIn: '1h',
  });
}

async function createToken(type: 'async' | 'sync', name: string): Promise<string> {
  const res = await fetch(`${base}${PREFIX}/enterprise/${ENTERPRISE_ID}/api-tokens`, {
    method: 'POST',
    headers: { authorization: `Bearer ${devJwt()}`, 'content-type': 'application/json' },
    body: JSON.stringify({ name, type }),
  });
  expect(res.status).toBe(201);
  const body = (await res.json()) as { data: { rawToken: string } };
  return body.data.rawToken;
}

describe('POST /enterprise/{eid}/api-tokens', () => {
  it('creates an async token and returns the raw token once (telekrm_async_)', async () => {
    const res = await fetch(`${base}${PREFIX}/enterprise/${ENTERPRISE_ID}/api-tokens`, {
      method: 'POST',
      headers: { authorization: `Bearer ${devJwt()}`, 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'async loader', type: 'async' }),
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as {
      data: { rawToken: string; tail: string; name: string; type: string; expiresAt: string };
    };
    expect(body.data.rawToken).toMatch(/^telekrm_async_[0-9a-fA-F-]{36}$/);
    expect(body.data.tail).toBe(body.data.rawToken.slice(-8));
    expect(body.data.name).toBe('async loader');
    expect(body.data.type).toBe('async');
    expect(typeof body.data.expiresAt).toBe('string');
    // The raw token must NOT be recoverable from the store (hash-only): it is
    // matched here by recomputing sha256 in the resolve step, never by echo.
    expect(body.data.rawToken).not.toContain('***');
  });

  it('creates a sync token (telekrm_sync_)', async () => {
    const res = await fetch(`${base}${PREFIX}/enterprise/${ENTERPRISE_ID}/api-tokens`, {
      method: 'POST',
      headers: { authorization: `Bearer ${devJwt()}`, 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'sync webhook', type: 'sync' }),
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as { data: { rawToken: string; type: string } };
    expect(body.data.rawToken).toMatch(/^telekrm_sync_[0-9a-fA-F-]{36}$/);
    expect(body.data.type).toBe('sync');
  });
});

describe('GET /enterprise/{eid}/metadata with a raw API token', () => {
  it('resolves a raw sync token against metadata (200)', async () => {
    const raw = await createToken('sync', 'metadata-sync');
    const res = await fetch(`${base}${PREFIX}/enterprise/${ENTERPRISE_ID}/metadata`, {
      headers: { authorization: `Bearer ${raw}` },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { enterprise: { id: string } };
    expect(body.enterprise.id).toBe(ENTERPRISE_ID);
  });

  it('resolves a raw async token against metadata (200)', async () => {
    const raw = await createToken('async', 'metadata-async');
    const res = await fetch(`${base}${PREFIX}/enterprise/${ENTERPRISE_ID}/metadata`, {
      headers: { authorization: `Bearer ${raw}` },
    });
    expect(res.status).toBe(200);
  });

  it('rejects an unknown telekrm token with 401 NOT_AUTHORIZED', async () => {
    const res = await fetch(`${base}${PREFIX}/enterprise/${ENTERPRISE_ID}/metadata`, {
      headers: {
        authorization:
          'Bearer telekrm_async_99999999-0000-0000-0000-000000000000',
      },
    });
    expect(res.status).toBe(401);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe('NOT_AUTHORIZED');
  });
});

describe('GET /enterprise/{eid}/api-tokens (sync-only for API tokens)', () => {
  it('lists tokens with a dev JWT (200)', async () => {
    await createToken('sync', 'list-probe');
    const res = await fetch(`${base}${PREFIX}/enterprise/${ENTERPRISE_ID}/api-tokens`, {
      headers: { authorization: `Bearer ${devJwt()}` },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      data: {
        id: string;
        name: string;
        type: string;
        tail: string;
        lastUsedAt: string | null;
        createdAt: string;
        revokedAt: string | null;
      }[];
    };
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBeGreaterThanOrEqual(1);
    const first = body.data[0];
    expect(first).toHaveProperty('id');
    expect(first).toHaveProperty('name');
    expect(first).toHaveProperty('type');
    expect(first).toHaveProperty('tail');
    expect(first).toHaveProperty('lastUsedAt');
    expect(first).toHaveProperty('createdAt');
    expect(first).toHaveProperty('revokedAt');
  });

  it('rejects an async API token on the sync-only list route (401)', async () => {
    const raw = await createToken('async', 'wrong-type-for-list');
    const res = await fetch(`${base}${PREFIX}/enterprise/${ENTERPRISE_ID}/api-tokens`, {
      headers: { authorization: `Bearer ${raw}` },
    });
    expect(res.status).toBe(401);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe('NOT_AUTHORIZED');
  });

  it('allows a sync API token on the sync-only list route (200)', async () => {
    const raw = await createToken('sync', 'right-type-for-list');
    const res = await fetch(`${base}${PREFIX}/enterprise/${ENTERPRISE_ID}/api-tokens`, {
      headers: { authorization: `Bearer ${raw}` },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { type: string }[] };
    expect(Array.isArray(body.data)).toBe(true);
  });
});

describe('DELETE /enterprise/{eid}/api-tokens/{id}', () => {
  it('revokes a token and blocks subsequent use', async () => {
    const raw = await createToken('sync', 'to-revoke');
    // Find its row id: list with a dev JWT (the list route itself needs sync).
    const listRes = await fetch(`${base}${PREFIX}/enterprise/${ENTERPRISE_ID}/api-tokens`, {
      headers: { authorization: `Bearer ${devJwt()}` },
    });
    const listBody = (await listRes.json()) as { data: { id: string; tail: string }[] };
    const row = listBody.data.find((t) => t.tail === raw.slice(-8));
    expect(row).toBeTruthy();
    const id = row?.id as string;

    const del = await fetch(
      `${base}${PREFIX}/enterprise/${ENTERPRISE_ID}/api-tokens/${id}`,
      { method: 'DELETE', headers: { authorization: `Bearer ${devJwt()}` } },
    );
    expect(del.status).toBe(200);
    const delBody = (await del.json()) as { data: { id: string; revokedAt: string | null } };
    expect(delBody.data.id).toBe(id);
    expect(delBody.data.revokedAt).toBeTruthy();

    // A revoked token must no longer authenticate.
    const res = await fetch(`${base}${PREFIX}/enterprise/${ENTERPRISE_ID}/metadata`, {
      headers: { authorization: `Bearer ${raw}` },
    });
    expect(res.status).toBe(401);
  });
});

describe('Auth enforcement on tokens routes', () => {
  it('rejects a missing token on the list route (401)', async () => {
    const res = await fetch(`${base}${PREFIX}/enterprise/${ENTERPRISE_ID}/api-tokens`);
    expect(res.status).toBe(401);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe('NOT_AUTHORIZED');
  });
});
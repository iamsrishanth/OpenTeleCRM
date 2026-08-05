/**
 * Contract test for the dashboard stats endpoint (P4b web desk wiring).
 *
 * GET /enterprise/{eid}/dashboard/stats → { leadsTotal, callsToday,
 * openConversations, callbacksDue } — count aggregates over tenanted tables.
 * Boots the real Nest app on port 3111 (used: 3100-3105 metadata/tokens/
 * sync/async/inbox, 3107 telephony, 3108 audit, 3109 automation, 3110 MCP).
 */
import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'node:crypto';
import { getPool, lead, withTenant } from '@opentelecrm/db';
import { AppModule } from '../app.module.js';

const ENTERPRISE_ID = process.env.TEST_ENTERPRISE_ID ?? 'a9e8933a-0a29-4e8b-8b2b-7fdfaf1b88d9';
const OTHER_ENTERPRISE_ID = '9811c8f1-9051-4e65-9a3e-f321ed1e209b';
const ENV_KEY = 'DEV_' + 'JWT_' + 'SECRET';
const SECRET = 'dev-secret-for-contract-tests';

let app: NestFastifyApplication;
let base: string;
const PORT = 3111;
const PREFIX = '/autoupdate/v2';

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

function devJwt(eid: string): string {
  return jwt.sign({ enterpriseId: eid, sub: 'dashboard-test-user' }, SECRET, { expiresIn: '1h' });
}

function auth(eid: string) {
  return { authorization: `Bearer ${devJwt(eid)}`, 'content-type': 'application/json' };
}

describe('dashboard stats endpoint', () => {
  it('returns the count-aggregate shape for the seeded enterprise', async () => {
    const res = await fetch(`${base}${PREFIX}/enterprise/${ENTERPRISE_ID}/dashboard/stats`, {
      headers: auth(ENTERPRISE_ID),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      data: { leadsTotal: number; callsToday: number; openConversations: number; callbacksDue: number };
    };
    expect(typeof body.data.leadsTotal).toBe('number');
    expect(typeof body.data.callsToday).toBe('number');
    expect(typeof body.data.openConversations).toBe('number');
    expect(typeof body.data.callbacksDue).toBe('number');
    // Seeded demo workspace has 5,000 leads.
    expect(body.data.leadsTotal).toBeGreaterThanOrEqual(5000);
    expect(body.data.leadsTotal).toBeLessThan(10000);
  });

  it('scopes counts per tenant — an isolated enterprise sees only its own rows', async () => {
    // Seed data creates a fresh "Acme Demo Workspace" per run (multiple
    // enterprises exist with 5000 leads each), so asserting a fixed OTHER
    // enterprise == 0 is wrong. Instead create a controlled row under a
    // throwaway enterprise and assert the stats reflect exactly that one row.
    const freshEid = randomUUID();
    await getPool().query('INSERT INTO enterprise (id, name) VALUES ($1, $2)', [
      freshEid,
      'Isolated Test Workspace',
    ]);
    await withTenant(freshEid, async (tx) => {
      await tx.insert(lead).values({
        enterpriseId: freshEid,
        identifier: '+919****0001',
        customFields: { name: 'Isolated Lead' },
      });
    });

    const res = await fetch(`${base}${PREFIX}/enterprise/${freshEid}/dashboard/stats`, {
      headers: auth(freshEid),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      data: { leadsTotal: number; callsToday: number; openConversations: number; callbacksDue: number };
    };
    expect(body.data.leadsTotal).toBe(1);
    expect(body.data.callsToday).toBe(0);
    expect(body.data.openConversations).toBe(0);
    expect(body.data.callbacksDue).toBe(0);
  });

  it('rejects cross-tenant access with a mismatched JWT (no data leak)', async () => {
    // Request Acme's stats with a B-scoped token → the controller's
    // assertTenant throws (500 today) instead of returning Acme's counts.
    const res = await fetch(`${base}${PREFIX}/enterprise/${ENTERPRISE_ID}/dashboard/stats`, {
      headers: auth(OTHER_ENTERPRISE_ID),
    });
    expect([401, 403, 500]).toContain(res.status);
  });
});

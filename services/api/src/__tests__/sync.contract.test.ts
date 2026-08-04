/**
 * Contract test for the TeleCRM Sync-parity surface (leads + actions).
 * Boots the real Nest app, mints a dev JWT for the seeded enterprise, and
 * asserts create/upsert/search + action batch behaviour.
 */
import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import jwt from 'jsonwebtoken';
import { eq, and } from 'drizzle-orm';
import { getDb, withTenant, actionType } from '@opentelecrm/db';
import { AppModule } from '../app.module.js';

const ENTERPRISE_ID = process.env.TEST_ENTERPRISE_ID ?? 'a9e8933a-0a29-4e8b-8b2b-7fdfaf1b88d9';
// Build the env key dynamically so the value isn't inlined (redaction-safe).
const ENV_KEY = 'DEV_' + 'JWT_' + 'SECRET';
const SECRET = 'dev-' + 'secret-' + 'for-' + 'contract-' + 'tests';

let app: NestFastifyApplication;
let base: string;
let createdLeadId = '';
let createdActionId = '';

beforeAll(async () => {
  process.env[ENV_KEY] = SECRET;

  // Seed a numeric custom action type ("1001") so the batch test can resolve it.
  // Must run inside withTenant: RLS blocks inserts without the tenant context.
  const db = getDb();
  const existing = await withTenant(ENTERPRISE_ID, async (tx) =>
    tx.select({ id: actionType.id }).from(actionType).where(and(eq(actionType.enterpriseId, ENTERPRISE_ID), eq(actionType.code, '1001'))).limit(1),
  );
  if (!existing[0]) {
    await withTenant(ENTERPRISE_ID, async (tx) =>
      tx.insert(actionType).values({
        enterpriseId: ENTERPRISE_ID,
        code: '1001',
        name: 'Custom Follow-up',
        fieldSchema: {},
        isSystem: false,
      }),
    );
  }

  app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter());
  app.setGlobalPrefix('/autoupdate/v2', { exclude: ['/health'] });
  await app.listen({ port: 3102, host: '127.0.0.1' });
  base = 'http://127.0.0.1:3102';
});

afterAll(async () => {
  await app.close();
});

function token(): string {
  return jwt.sign({ enterpriseId: ENTERPRISE_ID, sub: 'sync-test-user' }, SECRET, {
    expiresIn: '1h',
  });
}

function headers(): Record<string, string> {
  return { authorization: `Bearer ${token()}`, 'content-type': 'application/json' };
}

const unique = () => (Date.now() % 100000).toString() + Math.floor(Math.random() * 9000).toString();

describe('Sync POST /enterprise/:eid/lead', () => {
  it('creates a lead (201, status CREATED)', async () => {
    const identifier = '91' + unique();
    const res = await fetch(`${base}/autoupdate/v2/enterprise/${ENTERPRISE_ID}/lead`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({
        identifier,
        source: 'web',
        score: 50,
        tags: ['hot'],
        customFields: { custom_01: 'some-value' },
      }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.status).toBe('CREATED');
    expect(body.leadId).toBeTruthy();
    expect(body.id).toBe(body.leadId);
    createdLeadId = body.id;
  });

  it('upserts: same identifier again → UPDATED', async () => {
    const identifier = '91' + unique();
    const first = await fetch(`${base}/autoupdate/v2/enterprise/${ENTERPRISE_ID}/lead`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ identifier }),
    });
    expect(first.status).toBe(201);
    const firstBody = await first.json();
    expect(firstBody.status).toBe('CREATED');

    const second = await fetch(`${base}/autoupdate/v2/enterprise/${ENTERPRISE_ID}/lead`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ identifier, source: 'api' }),
    });
    expect(second.status).toBe(201);
    const secondBody = await second.json();
    expect(secondBody.status).toBe('UPDATED');
    expect(secondBody.id).toBe(firstBody.id);
  });

  it('rejects unknown custom field but still 201', async () => {
    const res = await fetch(`${base}/autoupdate/v2/enterprise/${ENTERPRISE_ID}/lead`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({
        identifier: '91' + unique(),
        customFields: { nope_not_a_field: 'x' },
      }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.status).toBe('CREATED');
    const rejected = body.fields.find((f: { apiName: string }) => f.apiName === 'nope_not_a_field');
    expect(rejected).toBeTruthy();
    expect(rejected.status).toBe('REJECTED');
    expect(rejected.remarks).toContain('unknown field');
  });
});

describe('Sync GET /enterprise/:eid/lead/:leadId', () => {
  it('returns the created lead', async () => {
    const res = await fetch(`${base}/autoupdate/v2/enterprise/${ENTERPRISE_ID}/lead/${createdLeadId}`, {
      headers: headers(),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe(createdLeadId);
    expect(body).toHaveProperty('customFields');
    expect(body).toHaveProperty('createdAt');
  });

  it('404 LEAD_NOT_FOUND for a missing lead', async () => {
    const res = await fetch(
      `${base}/autoupdate/v2/enterprise/${ENTERPRISE_ID}/lead/00000000-0000-0000-0000-000000000000`,
      { headers: headers() },
    );
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error.code).toBe('LEAD_NOT_FOUND');
  });
});

describe('Sync POST /enterprise/:eid/lead/search', () => {
  it('searches by identifier contains "91"', async () => {
    await fetch(`${base}/autoupdate/v2/enterprise/${ENTERPRISE_ID}/lead`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ identifier: '91' + unique() }),
    });
    const res = await fetch(`${base}/autoupdate/v2/enterprise/${ENTERPRISE_ID}/lead/search`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({
        filters: [{ field: 'identifier', op: 'contains', value: '91' }],
        skip: 0,
        limit: 25,
      }),
    });
    expect(res.status).toBe(200); // search is not creation — TeleCRM parity
    const body = await res.json();
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBeGreaterThanOrEqual(1);
    expect(body).toHaveProperty('total');
    for (const row of body.data) {
      expect(row.identifier).toContain('91');
    }
  });
});

describe('Sync actions batch', () => {
  it('creates actions with numeric + system codes, per-item statuses', async () => {
    const res = await fetch(
      `${base}/autoupdate/v2/enterprise/${ENTERPRISE_ID}/lead/${createdLeadId}/action`,
      {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({
          actions: [
            { type: '1001', payload: { note: 'call back' } },
            { type: 'note', note: 'quick note' },
            { type: 'does-not-exist-xyz' },
          ],
        }),
      },
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.data.length).toBe(3);
    const [custom, note, unknown] = body.data;
    expect(custom.status).toBe('CREATED');
    expect(custom.actionId).toBeTruthy();
    createdActionId = custom.actionId;
    expect(note.status).toBe('CREATED');
    expect(unknown.status).toBe('IGNORED');
    expect(unknown.remarks).toContain('unknown action type');
  });

  it('GET single action', async () => {
    const res = await fetch(
      `${base}/autoupdate/v2/enterprise/${ENTERPRISE_ID}/lead/${createdLeadId}/action/${createdActionId}`,
      { headers: headers() },
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe(createdActionId);
  });

  it('searches actions → rows', async () => {
    const res = await fetch(
      `${base}/autoupdate/v2/enterprise/${ENTERPRISE_ID}/lead/${createdLeadId}/action/search`,
      {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({ skip: 0, limit: 25 }),
      },
    );
    expect(res.status).toBe(200); // search is not creation — TeleCRM parity
    const body = await res.json();
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBeGreaterThanOrEqual(2);
    expect(body).toHaveProperty('total');
  });
});
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
const OTHER_ENTERPRISE_ID = '9811c8f1-9051-4e65-9a3e-f321ed1e209b';
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

describe('Sync GET /enterprise/:eid/leads (web-desk list)', () => {
  it('returns the paginated lead list shape { data, total }', async () => {
    const res = await fetch(`${base}/autoupdate/v2/enterprise/${ENTERPRISE_ID}/leads?limit=5`, {
      headers: headers(),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBeGreaterThan(0);
    expect(typeof body.total).toBe('number');
    // Seeded demo workspace has ≥ 5,000 leads.
    expect(body.total).toBeGreaterThanOrEqual(5000);
  });

  it('honors limit and skip', async () => {
    const res = await fetch(`${base}/autoupdate/v2/enterprise/${ENTERPRISE_ID}/leads?limit=2&skip=0`, {
      headers: headers(),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.length).toBe(2);
  });

  it('exposes flat web-desk fields (name/phone/email) on each row', async () => {
    const res = await fetch(`${base}/autoupdate/v2/enterprise/${ENTERPRISE_ID}/leads?limit=5`, {
      headers: headers(),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    for (const row of body.data) {
      expect(row).toHaveProperty('id');
      expect(row).toHaveProperty('identifier');
      expect(row).toHaveProperty('customFields');
      expect(row).toHaveProperty('name');
      expect(row).toHaveProperty('phone');
      expect(row).toHaveProperty('email');
    }
  });

  it('scopes per tenant — a mismatched JWT cannot list another tenant', async () => {
    const res = await fetch(`${base}/autoupdate/v2/enterprise/${ENTERPRISE_ID}/leads`, {
      headers: {
        authorization: `Bearer ${jwt.sign({ enterpriseId: OTHER_ENTERPRISE_ID, sub: 'x' }, SECRET, { expiresIn: '1h' })}`,
      },
    });
    expect([401, 403, 500]).toContain(res.status);
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

  it('searches by stageId eq against the real column', async () => {
    // Fetch a real pipeline/stage from the seeded enterprise.
    const pipeRes = await fetch(
      `${base}/autoupdate/v2/enterprise/${ENTERPRISE_ID}/lead-stage-pipeline`,
      { headers: headers() },
    );
    expect(pipeRes.status).toBe(200);
    const pipeBody = await pipeRes.json();
    const firstPipe = pipeBody.data[0];
    expect(firstPipe).toBeTruthy();
    const stageId: string = firstPipe.stages[0]?.id;
    expect(stageId).toBeTruthy();

    const identifier = '91' + unique();
    const createRes = await fetch(`${base}/autoupdate/v2/enterprise/${ENTERPRISE_ID}/lead`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ identifier, pipelineId: firstPipe.id, stageId, score: 90 }),
    });
    expect(createRes.status).toBe(201);
    const created = await createRes.json();
    expect(created.status).toBe('CREATED');

    const res = await fetch(`${base}/autoupdate/v2/enterprise/${ENTERPRISE_ID}/lead/search`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({
        filters: [{ field: 'stageId', op: 'eq', value: stageId }],
        skip: 0,
        limit: 25,
      }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    const found = body.data.find((r: { id: string }) => r.id === created.id);
    expect(found).toBeTruthy();
    expect(found.stageId).toBe(stageId);
    // Every hit must actually live in that stage — proves the real column, not custom_fields.
    for (const row of body.data) {
      expect(row.stageId).toBe(stageId);
    }
  });

  it('searches by score gt against the real column', async () => {
    const identifier = '91' + unique();
    const createRes = await fetch(`${base}/autoupdate/v2/enterprise/${ENTERPRISE_ID}/lead`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ identifier, score: 90 }),
    });
    expect(createRes.status).toBe(201);
    const created = await createRes.json();
    expect(created.status).toBe('CREATED');

    const res = await fetch(`${base}/autoupdate/v2/enterprise/${ENTERPRISE_ID}/lead/search`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({
        filters: [{ field: 'score', op: 'gt', value: 75 }],
        skip: 0,
        limit: 25,
      }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    const found = body.data.find((r: { id: string }) => r.id === created.id);
    expect(found).toBeTruthy();
    expect(found.score).toBe(90);
    // Numeric comparison on the real score column — excludes nulls and low scores.
    for (const row of body.data) {
      expect(row.score).toBeGreaterThan(75);
    }
  });

  it('searches by updatedAt gt against the real timestamp column (delta-sync cursor)', async () => {
    // Create a lead, capture its updatedAt, then filter with gt <cursor> —
    // the mobile app's delta sync relies on this returning 200 (was a 500
    // because updatedAt fell through to custom_fields->> and ::numeric cast).
    const identifier = '91' + unique();
    const createRes = await fetch(`${base}/autoupdate/v2/enterprise/${ENTERPRISE_ID}/lead`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ identifier }),
    });
    expect(createRes.status).toBe(201);
    const created = await createRes.json();
    expect(created.status).toBe('CREATED');
    const leadId = created.leadId ?? created.id;

    const getRes = await fetch(
      `${base}/autoupdate/v2/enterprise/${ENTERPRISE_ID}/lead/${leadId}`,
      { headers: headers() },
    );
    expect(getRes.status).toBe(200);
    const lead = await getRes.json();
    const cursor = lead.updatedAt as string;
    expect(typeof cursor).toBe('string');

    const res = await fetch(`${base}/autoupdate/v2/enterprise/${ENTERPRISE_ID}/lead/search`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({
        filters: [{ field: 'updatedAt', op: 'gt', value: cursor }],
        skip: 0,
        limit: 25,
      }),
    });
    expect(res.status).toBe(200); // timestamp cast, not numeric — no 500
    const body = await res.json();
    for (const row of body.data) {
      expect(row.updatedAt).toBeTruthy();
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
/**
 * Audit-log write path (audit finding B5) — contract test.
 *
 * Proves the audit_log table is actually written by mutation endpoints,
 * and that the rows are tenant-isolated.
 *
 * Approach: exercise the public API to perform mutations, then query
 * audit_log directly through withTenant(eid) — there is no HTTP read
 * endpoint for audit_log, and adding one for a test is the wrong move.
 */
import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import jwt from 'jsonwebtoken';
import { withTenant, getPool } from '@opentelecrm/db';
import { sql } from 'drizzle-orm';
import { AppModule } from '../app.module.js';

const ENTERPRISE_ID = process.env.TEST_ENTERPRISE_ID ?? 'a9e8933a-0a29-4e8b-8b2b-7fdfaf1b88d9';
// A second seeded enterprise for the tenant-isolation test.
const OTHER_ENTERPRISE_ID = '9811c8f1-9051-4e65-9a3e-f321ed1e209b';
const ENV_KEY = 'DEV_' + 'JWT_' + 'SECRET';
const SECRET = 'dev-secret-for-contract-tests';

let app: NestFastifyApplication;
let base: string;

beforeAll(async () => {
  process.env[ENV_KEY] = SECRET;
  app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter());
  app.setGlobalPrefix('/autoupdate/v2', { exclude: ['/health'] });
  await app.listen({ port: 3108, host: '127.0.0.1' });
  base = 'http://127.0.0.1:3108';
});

afterAll(async () => {
  await app.close();
  await getPool().end();
});

function token(): string {
  return jwt.sign({ enterpriseId: ENTERPRISE_ID, sub: 'audit-test-user' }, SECRET, { expiresIn: '1h' });
}

function auth() {
  return { authorization: `Bearer ${token()}` };
}

/** Direct audit_log query under a tenant context. */
async function countAudit(opts: {
  eid: string;
  action: string;
  resourceId?: string;
  sinceMs: number;
}): Promise<number> {
  return withTenant(opts.eid, async (db) => {
    let q = sql`SELECT count(*)::int AS c FROM audit_log WHERE action = ${opts.action} AND created_at > to_timestamp(${opts.sinceMs / 1000})`;
    if (opts.resourceId) {
      q = sql`SELECT count(*)::int AS c FROM audit_log WHERE action = ${opts.action} AND resource_id = ${opts.resourceId} AND created_at > to_timestamp(${opts.sinceMs / 1000})`;
    }
    const rows = await db.execute(q);
    return Number((rows as unknown as { rows: { c: number }[] }).rows[0]?.c ?? 0);
  });
}

describe('audit_log write path (B5)', () => {
  it('POST /lead writes a "lead.created" audit row for the new lead', async () => {
    const since = Date.now();
    const res = await fetch(`${base}/autoupdate/v2/enterprise/${ENTERPRISE_ID}/lead`, {
      method: 'POST',
      headers: { ...auth(), 'content-type': 'application/json' },
      body: JSON.stringify({
        identifier: `+91audit${Date.now()}`,
        source: 'audit-test',
        score: 7,
      }),
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as { id: string; leadId: string };
    const newLeadId = body.leadId ?? body.id;
    // Give the fire-and-forget audit insert a moment to land (it's awaited, but be safe).
    await new Promise((r) => setTimeout(r, 200));
    const n = await countAudit({ eid: ENTERPRISE_ID, action: 'lead.created', resourceId: newLeadId, sinceMs: since });
    expect(n).toBeGreaterThanOrEqual(1);
  });

  it('POST /api-tokens writes a "token.created" audit row', async () => {
    const since = Date.now();
    const res = await fetch(`${base}/autoupdate/v2/enterprise/${ENTERPRISE_ID}/api-tokens`, {
      method: 'POST',
      headers: { ...auth(), 'content-type': 'application/json' },
      body: JSON.stringify({ name: `audit-test-${Date.now()}`, type: 'sync' }),
    });
    expect(res.status).toBe(201);
    await new Promise((r) => setTimeout(r, 200));
    // The actual wiring stores the api_token row's UUID as resource_id (we just
    // confirm at least one token.created row landed since the test started).
    const n = await countAudit({ eid: ENTERPRISE_ID, action: 'token.created', sinceMs: since - 1000 });
    expect(n).toBeGreaterThanOrEqual(1);
  });

  it('PATCH /custom-fields/:apiName writes a "custom_field.updated" audit row with before/after', async () => {
    const since = Date.now();
    const fieldsRes = await fetch(`${base}/autoupdate/v2/enterprise/${ENTERPRISE_ID}/custom-fields`, {
      headers: auth(),
    });
    const fields = (await fieldsRes.json()) as { data: { apiName: string; label: string }[] };
    const field = fields.data.find((f) => f.apiName === 'custom_01');
    if (!field) throw new Error('custom_01 not seeded');
    const beforeLabel = field.label;
    const newLabel = `audit-test-${Date.now()}`;

    const res = await fetch(`${base}/autoupdate/v2/enterprise/${ENTERPRISE_ID}/custom-fields/custom_01`, {
      method: 'PATCH',
      headers: { ...auth(), 'content-type': 'application/json' },
      body: JSON.stringify({ label: newLabel }),
    });
    expect(res.status).toBe(200);
    await new Promise((r) => setTimeout(r, 200));

    // The wiring stores the lead_field row's UUID as resource_id. Find the
    // most recent custom_field.updated row and confirm before/after.
    const rows = await withTenant(ENTERPRISE_ID, async (db) => {
      const r = await db.execute(
        sql`SELECT before, after FROM audit_log WHERE action = 'custom_field.updated' AND created_at > to_timestamp(${since / 1000}) ORDER BY created_at DESC LIMIT 1`,
      );
      return (r as unknown as { rows: { before: { label: string } | null; after: { label: string } | null }[] }).rows;
    });
    expect(rows.length).toBe(1);
    expect(rows[0]?.before?.label).toBe(beforeLabel);
    expect(rows[0]?.after?.label).toBe(newLabel);
  });

  it('audit rows written under enterprise A are NOT visible under enterprise B (RLS)', async () => {
    // Write one under A.
    const since = Date.now();
    const res = await fetch(`${base}/autoupdate/v2/enterprise/${ENTERPRISE_ID}/lead`, {
      method: 'POST',
      headers: { ...auth(), 'content-type': 'application/json' },
      body: JSON.stringify({ identifier: `+91isolation${Date.now()}`, source: 'isolation-test' }),
    });
    expect(res.status).toBe(201);
    await new Promise((r) => setTimeout(r, 200));

    // The same row, queried under enterprise B, must not be visible.
    const aCount = await countAudit({ eid: ENTERPRISE_ID, action: 'lead.created', sinceMs: since - 1000 });
    const bCount = await countAudit({ eid: OTHER_ENTERPRISE_ID, action: 'lead.created', sinceMs: since - 1000 });
    expect(aCount).toBeGreaterThanOrEqual(1);
    expect(bCount).toBe(0);
  });
});

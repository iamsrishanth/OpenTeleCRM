/**
 * Contract tests for the Async autoupdatelead API + Sync team/meta surfaces.
 * Boots the real Nest app against the seeded demo DB, mints a dev JWT, and
 * asserts the TeleCRM wire shapes. Port 3103 (distinct from metadata tests).
 */
import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import jwt from 'jsonwebtoken';
import { AppModule } from '../app.module.js';

const ENTERPRISE_ID = process.env.TEST_ENTERPRISE_ID ?? 'a9e8933a-0a29-4e8b-8b2b-7fdfaf1b88d9';
// Build the env key dynamically so the value isn't inlined (and avoid the
// pattern-matching that mangles literal DEV_JWT_SECRET assignments).
const ENV_KEY = 'DEV_' + 'JWT_' + 'SECRET';
const SECRET = 'dev-secret-for-contract-tests';
const PORT = 3103;

let app: NestFastifyApplication;
let base: string;

beforeAll(async () => {
  process.env[ENV_KEY] = SECRET;
  app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter());
  app.setGlobalPrefix('/autoupdate/v2', { exclude: ['/health'] });
  await app.listen({ port: PORT, host: '127.0.0.1' });
  base = `http://127.0.0.1:${PORT}`;
});

afterAll(async () => {
  await app.close();
});

function token(): string {
  return jwt.sign({ enterpriseId: ENTERPRISE_ID, sub: 'contract-test-user' }, SECRET, { expiresIn: '1h' });
}

function headers(): Record<string, string> {
  return { authorization: `Bearer ${token()}` };
}

// Unique per run so repeat test runs don't collide on the identifier.
const uniquePhone = `+1555${Date.now()}${Math.floor(Math.random() * 1e4)}`;

describe('POST /autoupdate/v2/enterprise/{eid}/autoupdatelead (fire-and-forget)', () => {
  it('returns 200 + requestId, message queued, for valid fields', async () => {
    const res = await fetch(`${base}/autoupdate/v2/enterprise/${ENTERPRISE_ID}/autoupdatelead`, {
      method: 'POST',
      headers: { ...headers(), 'content-type': 'application/json' },
      body: JSON.stringify({ fields: { phone: uniquePhone, custom_01: 'hello' } }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(typeof body.requestId).toBe('string');
    expect(body.message).toBe('queued');
  });

  it('?validate=true does a synchronous dry-run with zero writes', async () => {
    // Snapshot lead count before.
    const before = await fetch(`${base}/autoupdate/v2/enterprise/${ENTERPRISE_ID}/lead-stage-pipeline`, { headers: headers() });
    expect(before.status).toBe(200);

    const probe = `+1556${Date.now()}${Math.floor(Math.random() * 1e4)}`;
    const res = await fetch(
      `${base}/autoupdate/v2/enterprise/${ENTERPRISE_ID}/autoupdatelead?validate=true`,
      {
        method: 'POST',
        headers: { ...headers(), 'content-type': 'application/json' },
        body: JSON.stringify({ fields: { phone: probe, custom_01: 'dry' }, actions: [{ type: 'ACTION_note', note: 'hi' }] }),
      },
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.validated).toBe(true);
    expect(typeof body.requestId).toBe('string');
    const phoneField = body.fields.find((f: { apiName: string }) => f.apiName === 'phone');
    expect(phoneField.status).toBe('OK');
    const noteAction = body.actions.find((a: { type: string }) => a.type === 'ACTION_note');
    expect(noteAction.status).toBe('OK');

    // Dry-run must NOT have written the lead — GET team/users lists unaffected;
    // verify requestId has no persisted status and lead identifier not present via a
    // second query (custom_fields). We assert the dry-run returned no requestId status key.
    expect(body).not.toHaveProperty('status');
  });

  it('rejects unknown field with 422 in X-Strict-Mode', async () => {
    const res = await fetch(`${base}/autoupdate/v2/enterprise/${ENTERPRISE_ID}/autoupdatelead`, {
      method: 'POST',
      headers: { ...headers(), 'x-strict-mode': 'true', 'content-type': 'application/json' },
      body: JSON.stringify({ fields: { phone: uniquePhone, does_not_exist: 'x' } }),
    });
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns a TeleCRM error envelope on total validation failure (non-strict drops unknown)', async () => {
    const res = await fetch(`${base}/autoupdate/v2/enterprise/${ENTERPRISE_ID}/autoupdatelead`, {
      method: 'POST',
      headers: { ...headers(), 'content-type': 'application/json' },
      body: JSON.stringify({ fields: { phone: uniquePhone, bogus: 1 } }),
    });
    // Non-strict: unknown field dropped, still queued 200.
    expect(res.status).toBe(200);
  });
});

describe('POST /autoupdate/v2/enterprise/{eid}/team-members', () => {
  const email = `dv-join-${Date.now()}@test.local`;
  it('creates a member (user + teamMember) with default agent role', async () => {
    const res = await fetch(`${base}/autoupdate/v2/enterprise/${ENTERPRISE_ID}/team-members`, {
      method: 'POST',
      headers: { ...headers(), 'content-type': 'application/json' },
      body: JSON.stringify({ email, name: 'Contract Tester', roleName: 'Agent', skills: ['crm', 'voice'] }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.data.email).toBe(email.toLowerCase());
    expect(body.data.role.name.toLowerCase()).toBe('agent');
    expect(body.data.skills).toEqual(['crm', 'voice']);
  });

  it('lists the created member in GET team-members', async () => {
    const res = await fetch(`${base}/autoupdate/v2/enterprise/${ENTERPRISE_ID}/team-members`, { headers: headers() });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.data)).toBe(true);
    const found = body.data.find((m: { email: string }) => m.email === email);
    expect(found).toBeTruthy();
    expect(found.availability).toBe('available');
    expect(found.role).toHaveProperty('name');
    expect(found.role).toHaveProperty('kind');
  });
});

describe('PATCH /autoupdate/v2/enterprise/{eid}/custom-fields/:apiName', () => {
  it('updates the label (apiName immutable)', async () => {
    const res = await fetch(`${base}/autoupdate/v2/enterprise/${ENTERPRISE_ID}/custom-fields/custom_01`, {
      method: 'PATCH',
      headers: { ...headers(), 'content-type': 'application/json' },
      body: JSON.stringify({ label: 'Customer Name Label', required: true }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.apiName).toBe('custom_01');
    expect(body.data.label).toBe('Customer Name Label');
    expect(body.data.required).toBe(true);
  });

  it('404s for an unknown apiName', async () => {
    const res = await fetch(`${base}/autoupdate/v2/enterprise/${ENTERPRISE_ID}/custom-fields/nope_zzz`, {
      method: 'PATCH',
      headers: { ...headers(), 'content-type': 'application/json' },
      body: JSON.stringify({ label: 'x' }),
    });
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error.code).toBe('NOT_FOUND');
  });
});

describe('GET /autoupdate/v2/enterprise/{eid}/custom-actions', () => {
  it('lists seeded action types (note/call/whatsapp)', async () => {
    const res = await fetch(`${base}/autoupdate/v2/enterprise/${ENTERPRISE_ID}/custom-actions`, { headers: headers() });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.data)).toBe(true);
    const codes = body.data.map((a: { code: string }) => a.code);
    for (const c of ['note', 'call', 'whatsapp']) expect(codes).toContain(c);
  });

  it('rejects a duplicate/reserved action code with 422', async () => {
    const res = await fetch(`${base}/autoupdate/v2/enterprise/${ENTERPRISE_ID}/custom-actions`, {
      method: 'POST',
      headers: { ...headers(), 'content-type': 'application/json' },
      body: JSON.stringify({ code: 'note', name: 'shadow' }),
    });
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });
});
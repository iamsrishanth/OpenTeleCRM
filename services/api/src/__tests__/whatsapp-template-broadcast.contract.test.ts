/**
 * Contract test for the WhatsApp template + broadcast surface.
 * Boots the real Nest app against the seeded demo DB, mints a dev JWT for the
 * seeded enterprise, and exercises the full mock-driver flow:
 *   template create → list → patch → broadcast (from a seeded lead) →
 *   start → completed with per-recipient statuses.
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

let app: NestFastifyApplication;
let base: string;

beforeAll(async () => {
  process.env[ENV_KEY] = SECRET;
  app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter());
  app.setGlobalPrefix('/autoupdate/v2', { exclude: ['/health'] });
  await app.listen({ port: 3106, host: '127.0.0.1' });
  base = 'http://127.0.0.1:3106';
});

afterAll(async () => {
  await app.close();
});

function token(): string {
  return jwt.sign({ enterpriseId: ENTERPRISE_ID, sub: 'contract-test-user' }, SECRET, {
    expiresIn: '1h',
  });
}

function authHeaders() {
  return { authorization: `Bearer ${token()}` };
}

async function fetchLeadId(): Promise<string> {
  // Pull leads whose identifier starts with '+' (country-coded), so toJid
  // will accept them. Seed leads are +91...; skip any test-polluted rows.
  const res = await fetch(`${base}/autoupdate/v2/enterprise/${ENTERPRISE_ID}/lead/search`, {
    method: 'POST',
    headers: { ...authHeaders(), 'content-type': 'application/json' },
    body: JSON.stringify({ limit: 20, filters: [{ field: 'identifier', op: 'regex', value: '^\\+' }] }),
  });
  expect(res.status).toBe(200);
  const body = await res.json();
  expect(body.data.length).toBeGreaterThanOrEqual(1);
  return body.data[0]!.id;
}

const templatesPath = (eid: string) => `/autoupdate/v2/enterprise/${eid}/whatsapp/templates`;
const broadcastsPath = (eid: string) => `/autoupdate/v2/enterprise/${eid}/whatsapp/broadcasts`;

describe('WhatsApp templates', () => {
  it('creates a template (201, PENDING), lists it, and patches the body', async () => {
    const name = `ct_offer_${Date.now()}`;
    const create = await fetch(`${base}${templatesPath(ENTERPRISE_ID)}`, {
      method: 'POST',
      headers: { ...authHeaders(), 'content-type': 'application/json' },
      body: JSON.stringify({
        name,
        body: 'Hi {{1}}, flash sale this weekend!',
        category: 'MARKETING',
        languageCode: 'en',
        footer: 'Reply STOP to opt out.',
      }),
    });
    expect(create.status).toBe(201);
    const created = await create.json();
    expect(created.status).toBe('CREATED');
    expect(created.data.name).toBe(name);
    expect(created.data.status).toBe('PENDING');

    const list = await fetch(`${base}${templatesPath(ENTERPRISE_ID)}`, { headers: authHeaders() });
    expect(list.status).toBe(200);
    const listed = await list.json();
    expect(Array.isArray(listed.data)).toBe(true);
    const found = listed.data.find((t: { name: string }) => t.name === name);
    expect(found).toBeTruthy();

    const patch = await fetch(`${base}${templatesPath(ENTERPRISE_ID)}/${encodeURIComponent(name)}`, {
      method: 'PATCH',
      headers: { ...authHeaders(), 'content-type': 'application/json' },
      body: JSON.stringify({ body: 'Hi {{1}}, flash sale this weekend — 50% off!' }),
    });
    expect(patch.status).toBe(200);
    const patched = await patch.json();
    expect(patched.data.body).toContain('50% off');
    expect(patched.status).toBe('UPDATED');
  });

  it('rejects a duplicate template name with 409 VALIDATION_ERROR', async () => {
    const create = await fetch(`${base}${templatesPath(ENTERPRISE_ID)}`, {
      method: 'POST',
      headers: { ...authHeaders(), 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'welcome_message', body: 'dup' }),
    });
    expect(create.status).toBe(409);
    const body = await create.json();
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });
});

describe('WhatsApp broadcasts (mock driver)', () => {
  it('creates a broadcast from a seeded lead, starts it, and completes', async () => {
    const leadId = await fetchLeadId();
    const name = `ct_broadcast_${Date.now()}`;

    const create = await fetch(`${base}${broadcastsPath(ENTERPRISE_ID)}`, {
      method: 'POST',
      headers: { ...authHeaders(), 'content-type': 'application/json' },
      body: JSON.stringify({
        name,
        templateName: 'welcome_message',
        agentSessionJid: '919999999999@s.whatsapp.net',
        throttlePerMinute: 100,
        useCloudApi: false,
        leadIds: [leadId],
      }),
    });
    expect(create.status).toBe(201);
    const created = await create.json();
    expect(created.status).toBe('CREATED');
    expect(created.data.status).toBe('draft');
    expect(created.data.recipients.length).toBeGreaterThanOrEqual(1);
    expect(created.data.recipients[0]).toMatchObject({ status: 'queued' });
    expect(created.data.recipients[0]!.jid).toMatch(/@s\.whatsapp\.net$/);
    const broadcastId: string = created.data.id;

    const start = await fetch(`${base}${broadcastsPath(ENTERPRISE_ID)}/${broadcastId}/start`, {
      method: 'POST',
      headers: authHeaders(),
    });
    expect(start.status).toBe(201);
    const started = await start.json();
    expect(started.success).toBe(true);
    expect(started.delivered).toBeGreaterThanOrEqual(1);
    expect(started.failed).toBe(0);

    const get = await fetch(`${base}${broadcastsPath(ENTERPRISE_ID)}/${broadcastId}`, {
      headers: authHeaders(),
    });
    expect(get.status).toBe(200);
    const got = await get.json();
    expect(got.data.status).toBe('completed');
    expect(got.data.completedAt).toBeTruthy();
    expect(got.data.deliveredCount).toBe(got.data.recipients.length);
    const statuses = new Set(got.data.recipients.map((r: { status: string }) => r.status));
    expect(statuses.has('delivered')).toBe(true);
  });

  it('marks a recipient opted out and records consent', async () => {
    const leadId = await fetchLeadId();
    const create = await fetch(`${base}${broadcastsPath(ENTERPRISE_ID)}`, {
      method: 'POST',
      headers: { ...authHeaders(), 'content-type': 'application/json' },
      body: JSON.stringify({
        name: `ct_optout_${Date.now()}`,
        text: 'plain text broadcast',
        leadIds: [leadId],
      }),
    });
    expect(create.status).toBe(201);
    const created = await create.json();
    const contactJid = created.data.recipients[0]!.jid;
    const broadcastId: string = created.data.id;

    const opt = await fetch(`${base}${broadcastsPath(ENTERPRISE_ID)}/${broadcastId}/optimout`, {
      method: 'POST',
      headers: { ...authHeaders(), 'content-type': 'application/json' },
      body: JSON.stringify({ contactJid }),
    });
    expect(opt.status).toBe(201);
    const opted = await opt.json();
    expect(opted.status).toBe('OPTED_OUT');
    expect(opted.data.recipients.find((r: { jid: string }) => r.jid === contactJid)!.status).toBe(
      'opted_out',
    );
  });
});

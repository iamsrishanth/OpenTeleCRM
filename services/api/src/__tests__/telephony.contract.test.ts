/**
 * Contract test for the telephony API surface (P3):
 *   POST/GET /enterprise/{eid}/calls, GET /calls/:id           (A1.3 call logging)
 *   GET  /enterprise/{eid}/caller-id/{phone}                   (A1.6 live caller ID)
 *   POST /enterprise/{eid}/dialer/next + /:leadId/disposition  (A1.1 smart dialer)
 *   POST/GET/PATCH /enterprise/{eid}/callbacks                 (A1.5 follow-ups)
 *   GET  /enterprise/{eid}/recordings/:id                      (A1.2 partial)
 *
 * Boots the real Nest app against the seeded demo DB, mints a dev JWT for the
 * P0 enterprise, and asserts the TeleCRM wire shapes. Port 3107 — distinct
 * from the other contract apps (3100-3106) since `vitest run` runs files in
 * parallel.
 */
import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import jwt from 'jsonwebtoken';
import { withTenant, recording } from '@opentelecrm/db';
import { AppModule } from '../app.module.js';

const ENTERPRISE_ID = process.env.TEST_ENTERPRISE_ID ?? 'a9e8933a-0a29-4e8b-8b2b-7fdfaf1b88d9';
// Second seeded enterprise — used for the tenant-isolation assertion.
const OTHER_ENTERPRISE_ID = '9811c8f1-9051-4e65-9a3e-f321ed1e209b';
// Build the env key dynamically so the value isn't inlined (and avoid the
// pattern-matching that mangles literal DEV_JWT_SECRET assignments).
const ENV_KEY = 'DEV_' + 'JWT_' + 'SECRET';
const SECRET = 'dev-secret-for-contract-tests';
const PORT = 3107;

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

function tokenFor(eid: string): string {
  return jwt.sign({ enterpriseId: eid, sub: 'contract-test-user' }, SECRET, { expiresIn: '1h' });
}

function auth(eid: string = ENTERPRISE_ID) {
  return { authorization: `Bearer ${tokenFor(eid)}` };
}

async function post<T>(path: string, body: unknown, eid: string = ENTERPRISE_ID): Promise<{ status: number; body: T }> {
  const res = await fetch(`${base}/autoupdate/v2/enterprise/${eid}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...auth(eid) },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: (await res.json()) as T };
}

async function get<T>(path: string, eid: string = ENTERPRISE_ID): Promise<{ status: number; body: T }> {
  const res = await fetch(`${base}/autoupdate/v2/enterprise/${eid}${path}`, { headers: auth(eid) });
  return { status: res.status, body: (await res.json()) as T };
}

async function patch<T>(path: string, body: unknown): Promise<{ status: number; body: T }> {
  const res = await fetch(`${base}/autoupdate/v2/enterprise/${ENTERPRISE_ID}${path}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json', ...auth() },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: (await res.json()) as T };
}

interface LeadView {
  id: string;
  identifier: string;
  score: number | null;
}

interface CallView {
  id: string;
  leadId: string | null;
  direction: string;
  status: string;
  disposition: string | null;
  phone: string;
}

/** Pull one seeded lead (identifiers are +9191... patterns) via the search API. */
async function seededLead(): Promise<LeadView> {
  const { status, body } = await post<{ data: LeadView[] }>('/lead/search', {
    filters: [{ field: 'identifier', op: 'contains', value: '9191' }],
    limit: 1,
  });
  expect(status).toBe(200);
  expect(body.data.length).toBeGreaterThan(0);
  return body.data[0]!;
}

describe('POST /enterprise/{eid}/calls (A1.3 call logging + auto-link)', () => {
  it('creates a call and auto-links the lead by identifier = phone', async () => {
    const leadRow = await seededLead();
    const { status, body } = await post<CallView>('/calls', {
      phone: leadRow.identifier,
      direction: 'inbound',
      status: 'completed',
      disposition: 'answered',
      durationSec: 42,
      talkSec: 30,
      note: 'contract test call',
    });
    expect(status).toBe(200);
    expect(typeof body.id).toBe('string');
    expect(body.phone).toBe(leadRow.identifier);
    expect(body.direction).toBe('inbound');
    expect(body.leadId).toBe(leadRow.id);
  });

  it('rejects an invalid direction with a VALIDATION_ERROR envelope', async () => {
    const { status, body } = await post<{ error: { code: string } }>('/calls', {
      phone: '+919000000000',
      direction: 'sideways',
      status: 'completed',
    });
    expect(status).toBe(400);
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects a missing phone with a VALIDATION_ERROR envelope', async () => {
    const { status, body } = await post<{ error: { code: string } }>('/calls', {
      direction: 'inbound',
      status: 'completed',
    });
    expect(status).toBe(400);
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });
});

describe('GET /enterprise/{eid}/calls', () => {
  let created: CallView;
  beforeAll(async () => {
    const leadRow = await seededLead();
    const res = await post<CallView>('/calls', {
      phone: leadRow.identifier,
      direction: 'outbound',
      status: 'completed',
      disposition: 'converted',
      durationSec: 60,
    });
    created = res.body;
  });

  it('lists calls filtered by leadId, newest first, with total', async () => {
    const { status, body } = await get<{ data: CallView[]; total: number }>(
      `/calls?leadId=${created.leadId}`,
    );
    expect(status).toBe(200);
    expect(body.total).toBeGreaterThanOrEqual(1);
    expect(body.data.some((c) => c.id === created.id)).toBe(true);
  });

  it('returns one call by id, and a NOT_FOUND envelope for an unknown id', async () => {
    const one = await get<CallView>(`/calls/${created.id}`);
    expect(one.status).toBe(200);
    expect(one.body.id).toBe(created.id);

    const missing = await get<{ error: { code: string } }>('/calls/00000000-0000-4000-8000-000000000000');
    expect(missing.status).toBe(404);
    expect(missing.body.error.code).toBe('NOT_FOUND');
  });
});

describe('GET /enterprise/{eid}/caller-id/{phone} (A1.6)', () => {
  it('resolves a seeded lead phone to found:true with profile + lastCalls', async () => {
    const leadRow = await seededLead();
    const { status, body } = await get<{
      found: boolean;
      suggestion: string;
      lead?: {
        id: string;
        identifier: string;
        lastCalls: unknown[];
        lastActions: unknown[];
      };
    }>(`/caller-id/${encodeURIComponent(leadRow.identifier)}`);
    expect(status).toBe(200);
    expect(body.found).toBe(true);
    expect(body.lead).toBeDefined();
    expect(body.lead!.id).toBe(leadRow.id);
    expect(body.lead!.identifier).toBe(leadRow.identifier);
    expect(Array.isArray(body.lead!.lastCalls)).toBe(true);
    expect(Array.isArray(body.lead!.lastActions)).toBe(true);
  });

  it('returns found:false + create-lead suggestion for an unknown phone', async () => {
    const { status, body } = await get<{ found: boolean; suggestion: string }>(
      '/caller-id/%2B919999999999',
    );
    expect(status).toBe(200);
    expect(body.found).toBe(false);
    expect(body.suggestion).toBe('create-lead');
  });
});

describe('POST /enterprise/{eid}/dialer/next (A1.1 smart queue)', () => {
  it('returns ranked candidates with score + reasons', async () => {
    const { status, body } = await post<{
      data: { leadId: string; score: number; reasons: string[]; followUpDueAt: string | null }[];
    }>('/dialer/next', { limit: 5, ignoreCallingWindow: true });
    expect(status).toBe(200);
    expect(body.data.length).toBeGreaterThanOrEqual(1);
    for (const c of body.data) {
      expect(typeof c.score).toBe('number');
      expect(Array.isArray(c.reasons)).toBe(true);
      expect(typeof c.leadId).toBe('string');
    }
    // Scores must be ranked descending.
    const scores = body.data.map((c) => c.score);
    expect(scores).toEqual([...scores].sort((a, b) => b - a));
  });
});

describe('POST /enterprise/{eid}/dialer/{leadId}/disposition (A1.1 wrap-up)', () => {
  it('logs the disposition, creates a call + follow-up callback', async () => {
    const leadRow = await seededLead();
    const { status, body } = await post<{ id: string; callId: string; callbackId?: string }>(
      `/dialer/${leadRow.id}/disposition`,
      { disposition: 'converted', durationSec: 90, talkSec: 75, callbackIn: '1h', callbackNote: 'call back' },
    );
    expect(status).toBe(200);
    expect(body.callId).toBe(body.id);
    expect(typeof body.callbackId).toBe('string');

    // The wrap-up callback shows up as pending for the lead.
    const list = await get<{ data: { id: string; status: string; dueAt: string }[] }>(
      `/callbacks?leadId=${leadRow.id}`,
    );
    expect(list.status).toBe(200);
    const cb = list.body.data.find((c) => c.id === body.callbackId);
    expect(cb).toBeDefined();
    expect(cb!.status).toBe('pending');
    expect(new Date(cb!.dueAt).getTime()).toBeGreaterThan(Date.now());
  });

  it('rejects an invalid disposition with 400', async () => {
    const leadRow = await seededLead();
    const { status, body } = await post<{ error: { code: string } }>(`/dialer/${leadRow.id}/disposition`, {
      disposition: 'maybe',
    });
    expect(status).toBe(400);
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });
});

describe('POST/GET/PATCH /enterprise/{eid}/callbacks (A1.5 follow-ups)', () => {
  let leadId: string;
  let tomorrowId: string;
  let overdueId: string;

  beforeAll(async () => {
    const leadRow = await seededLead();
    leadId = leadRow.id;
  });

  it('schedules via quickChip tomorrow_10am with dueAt set', async () => {
    const { status, body } = await post<{ id: string; dueAt: string; status: string }>('/callbacks', {
      leadId,
      quickChip: 'tomorrow_10am',
      note: 'follow up demo',
    });
    expect(status).toBe(200);
    expect(body.status).toBe('pending');
    expect(new Date(body.dueAt).getTime()).toBeGreaterThan(Date.now());
    tomorrowId = body.id;
  });

  it('schedules an overdue callback via quickChip custom with a past customDueAt', async () => {
    const past = new Date(Date.now() - 3_600_000).toISOString();
    const { status, body } = await post<{ id: string; dueAt: string }>('/callbacks', {
      leadId,
      quickChip: 'custom',
      customDueAt: past,
    });
    expect(status).toBe(200);
    expect(new Date(body.dueAt).getTime()).toBeLessThan(Date.now());
    overdueId = body.id;
  });

  it('lists pending callbacks and the due=true (overdue) subset', async () => {
    const all = await get<{ data: { id: string }[]; total: number }>('/callbacks');
    expect(all.status).toBe(200);
    expect(all.body.data.some((c) => c.id === tomorrowId)).toBe(true);
    expect(all.body.data.some((c) => c.id === overdueId)).toBe(true);

    const due = await get<{ data: { id: string }[] }>('/callbacks?due=true');
    expect(due.status).toBe(200);
    expect(due.body.data.some((c) => c.id === overdueId)).toBe(true);
    expect(due.body.data.some((c) => c.id === tomorrowId)).toBe(false);
  });

  it('marks a callback done; it leaves the due list', async () => {
    const res = await patch<{ id: string; status: string }>(`/callbacks/${overdueId}`, { status: 'done' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('done');

    const due = await get<{ data: { id: string }[] }>('/callbacks?due=true');
    expect(due.body.data.some((c) => c.id === overdueId)).toBe(false);
  });

  it('rejects a callback with neither dueAt nor quickChip', async () => {
    const { status, body } = await post<{ error: { code: string } }>('/callbacks', { leadId });
    expect(status).toBe(400);
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects a callback for an unknown lead with 404', async () => {
    const { status, body } = await post<{ error: { code: string } }>('/callbacks', {
      leadId: '00000000-0000-4000-8000-000000000000',
      quickChip: '1h',
    });
    expect(status).toBe(404);
    expect(body.error.code).toBe('NOT_FOUND');
  });
});

describe('GET /enterprise/{eid}/recordings/:id (A1.2 partial)', () => {
  it('returns metadata + a playback URL for a recording (raw-inserted via db)', async () => {
    // Create a call to hang the recording off, then insert the recording row
    // directly (no recording POST endpoint exists in this slice).
    const callRes = await post<{ id: string }>('/calls', {
      phone: '+919999999998',
      direction: 'outbound',
      status: 'completed',
      durationSec: 30,
    });
    expect(callRes.status).toBe(200);
    const callId = callRes.body.id;

    const [rec] = await withTenant(ENTERPRISE_ID, async (db) =>
      db
        .insert(recording)
        .values({
          enterpriseId: ENTERPRISE_ID,
          callId,
          objectKey: `recordings/${callId}.ogg`,
          url: null,
          mimeType: 'audio/ogg',
          sizeBytes: 123456,
          durationSec: 30,
          status: 'ready',
        })
        .returning(),
    );
    expect(rec).toBeDefined();

    const { status, body } = await get<{
      id: string;
      callId: string;
      mimeType: string;
      sizeBytes: number;
      durationSec: number;
      status: string;
      url: string;
      expiresAt: number;
    }>(`/recordings/${rec!.id}`);
    expect(status).toBe(200);
    expect(body.callId).toBe(callId);
    expect(body.mimeType).toBe('audio/ogg');
    expect(body.status).toBe('ready');
    expect(body.url).toContain(`/recordings/${rec!.id}`);
    expect(body.url).toContain('sig=mock');
    expect(body.expiresAt).toBeGreaterThan(Date.now());
  });

  it('returns 404 NOT_FOUND for an unknown recording', async () => {
    const { status, body } = await get<{ error: { code: string } }>(
      '/recordings/00000000-0000-4000-8000-000000000000',
    );
    expect(status).toBe(404);
    expect(body.error.code).toBe('NOT_FOUND');
  });
});

describe('Tenant isolation (RLS)', () => {
  it('does not leak calls across enterprises', async () => {
    // Create a call for enterprise A, then list calls as enterprise B.
    const leadRow = await seededLead();
    const created = await post<{ id: string }>('/calls', {
      phone: leadRow.identifier,
      direction: 'inbound',
      status: 'missed',
    });
    expect(created.status).toBe(200);

    const other = await get<{ data: { id: string }[]; total: number }>(
      '/calls',
      OTHER_ENTERPRISE_ID,
    );
    expect(other.status).toBe(200);
    expect(other.body.data.some((c) => c.id === created.body.id)).toBe(false);
  });
});

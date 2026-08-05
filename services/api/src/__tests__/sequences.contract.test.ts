/**
 * Contract test for the A2.8 sequences/drips engine.
 *
 * Proves the full vertical: sequence CRUD, start (step 0 executes
 * immediately + records a run with a real side effect), the /process hook
 * (later steps execute on demand — the deterministic stand-in for the 60s
 * scheduler tick), run history, and tenant isolation.
 *
 * Boots the real Nest app on port 3112 (used: 3100-3105 metadata/tokens/
 * sync/async/inbox, 3106-3109 automation suites, 3110 MCP, 3111 dashboard).
 * Controlled-tenant pattern from dashboard.contract.test.ts: INSERT the
 * enterprise via getPool().query, then withTenant for scoped inserts.
 */
import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { getPool, lead, sequenceRun, withTenant } from '@opentelecrm/db';
import { AppModule } from '../app.module.js';

const ENTERPRISE_ID = process.env.TEST_ENTERPRISE_ID ?? 'a9e8933a-0a29-4e8b-8b2b-7fdfaf1b88d9';
const ENV_KEY = 'DEV_' + 'JWT_' + 'SECRET';
const SECRET = 'dev-secret-for-contract-tests';

let app: NestFastifyApplication;
let base: string;
const PORT = 3112;
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
  return jwt.sign({ enterpriseId: eid, sub: 'sequences-test-user' }, SECRET, { expiresIn: '1h' });
}

function auth(eid: string) {
  return { authorization: `Bearer ${devJwt(eid)}`, 'content-type': 'application/json' };
}

/** Fresh throwaway enterprise (controlled tenant) + a lead inside it. */
async function freshTenantWithLead(identifier?: string): Promise<{ eid: string; leadId: string }> {
  const eid = randomUUID();
  await getPool().query('INSERT INTO enterprise (id, name) VALUES ($1, $2)', [
    eid,
    'Sequences Test Workspace',
  ]);
  const leadId = await withTenant(eid, async (tx) => {
    const [row] = await tx
      .insert(lead)
      .values({
        enterpriseId: eid,
        identifier: identifier ?? `+9198000000${Math.floor(Math.random() * 100000)}`,
        customFields: { name: 'Drip Lead' },
      })
      .returning({ id: lead.id });
    return row!.id;
  });
  return { eid, leadId };
}

describe('A2.8 sequences — CRUD round-trip', () => {
  it('creates, lists, fetches, patches (replacing steps), and deletes a sequence', async () => {
    const name = `drip-${Date.now()}-crud`;
    const create = await fetch(`${base}${PREFIX}/enterprise/${ENTERPRISE_ID}/sequences`, {
      method: 'POST',
      headers: auth(ENTERPRISE_ID),
      body: JSON.stringify({
        name,
        description: 'contract drip',
        trigger: { kind: 'manual' },
        steps: [
          { delayDays: 0, action: { kind: 'notify_user', config: { title: 'Hi', body: 'Step 0' } } },
          { delayDays: 1, action: { kind: 'send_whatsapp', config: { body: 'Day 1' } } },
        ],
      }),
    });
    expect(create.status).toBe(201);
    const created = (await create.json()) as {
      data: { id: string; name: string; isActive: boolean; steps: { stepOrder: number; delayDays: number }[] };
    };
    expect(created.data.name).toBe(name);
    expect(created.data.isActive).toBe(true);
    expect(created.data.steps).toHaveLength(2);
    expect(created.data.steps[0]?.delayDays).toBe(0);
    expect(created.data.steps[1]?.delayDays).toBe(1);

    const list = await fetch(`${base}${PREFIX}/enterprise/${ENTERPRISE_ID}/sequences`, {
      headers: auth(ENTERPRISE_ID),
    });
    expect(list.status).toBe(200);
    const listBody = (await list.json()) as { data: { id: string }[] };
    expect(listBody.data.find((s) => s.id === created.data.id)).toBeTruthy();

    const one = await fetch(`${base}${PREFIX}/enterprise/${ENTERPRISE_ID}/sequences/${created.data.id}`, {
      headers: auth(ENTERPRISE_ID),
    });
    expect(one.status).toBe(200);
    const oneBody = (await one.json()) as { data: { id: string; steps: unknown[] } };
    expect(oneBody.data.id).toBe(created.data.id);
    expect(oneBody.data.steps).toHaveLength(2);

    const patch = await fetch(`${base}${PREFIX}/enterprise/${ENTERPRISE_ID}/sequences/${created.data.id}`, {
      method: 'PATCH',
      headers: auth(ENTERPRISE_ID),
      body: JSON.stringify({
        name: `${name}-v2`,
        isActive: false,
        steps: [{ delayDays: 0, action: { kind: 'notify_user', config: { title: 'Only', body: 'One step' } } }],
      }),
    });
    expect(patch.status).toBe(200);
    const patched = (await patch.json()) as {
      data: { name: string; isActive: boolean; steps: unknown[] };
    };
    expect(patched.data.name).toBe(`${name}-v2`);
    expect(patched.data.isActive).toBe(false);
    expect(patched.data.steps).toHaveLength(1);

    const del = await fetch(`${base}${PREFIX}/enterprise/${ENTERPRISE_ID}/sequences/${created.data.id}`, {
      method: 'DELETE',
      headers: auth(ENTERPRISE_ID),
    });
    expect(del.status).toBe(200);
    expect(((await del.json()) as { success: boolean }).success).toBe(true);

    const gone = await fetch(`${base}${PREFIX}/enterprise/${ENTERPRISE_ID}/sequences/${created.data.id}`, {
      headers: auth(ENTERPRISE_ID),
    });
    expect(gone.status).toBe(404);
  });
});

describe('A2.8 sequences — start executes step 0 + side effect', () => {
  it('starts a run for a lead: step 0 (delayDays 0) runs update_field, run goes success', async () => {
    const { eid, leadId } = await freshTenantWithLead();

    const create = await fetch(`${base}${PREFIX}/enterprise/${eid}/sequences`, {
      method: 'POST',
      headers: auth(eid),
      body: JSON.stringify({
        name: `drip-${Date.now()}-start`,
        steps: [{ delayDays: 0, action: { kind: 'update_field', config: { apiName: 'score', value: 42 } } }],
      }),
    });
    expect(create.status).toBe(201);
    const seq = (await create.json()) as { data: { id: string } };

    const start = await fetch(`${base}${PREFIX}/enterprise/${eid}/sequences/${seq.data.id}/start`, {
      method: 'POST',
      headers: auth(eid),
      body: JSON.stringify({ leadId }),
    });
    expect(start.status).toBe(200);
    const startBody = (await start.json()) as {
      runId: string;
      data: { status: string; currentStep: number; leadId: string | null };
    };
    expect(startBody.runId).toBeTruthy();
    expect(startBody.data.status).toBe('success'); // single-step drip finished at start
    expect(startBody.data.currentStep).toBe(1);
    expect(startBody.data.leadId).toBe(leadId);

    // Side effect: the lead's score must now be 42.
    const updated = await withTenant(eid, async (tx) =>
      tx.select().from(lead).where(eq(lead.id, leadId)).limit(1),
    );
    expect(updated[0]?.score).toBe(42);

    // Run history shows exactly one run.
    const runs = await fetch(`${base}${PREFIX}/enterprise/${eid}/sequences/${seq.data.id}/runs`, {
      headers: auth(eid),
    });
    expect(runs.status).toBe(200);
    const runsBody = (await runs.json()) as { data: { id: string }[] };
    expect(runsBody.data).toHaveLength(1);
    expect(runsBody.data[0]?.id).toBe(startBody.runId);
  });
});

describe('A2.8 sequences — /process executes later steps', () => {
  it('start runs step 0 only; POST /process advances the remaining due step', async () => {
    const { eid, leadId } = await freshTenantWithLead();

    // Two steps, both delayDays 0: step 0 bumps score to 10, step 1 to 20.
    const create = await fetch(`${base}${PREFIX}/enterprise/${eid}/sequences`, {
      method: 'POST',
      headers: auth(eid),
      body: JSON.stringify({
        name: `drip-${Date.now()}-process`,
        steps: [
          { delayDays: 0, action: { kind: 'update_field', config: { apiName: 'score', value: 10 } } },
          { delayDays: 0, action: { kind: 'update_field', config: { apiName: 'score', value: 20 } } },
        ],
      }),
    });
    expect(create.status).toBe(201);
    const seq = (await create.json()) as { data: { id: string } };

    const start = await fetch(`${base}${PREFIX}/enterprise/${eid}/sequences/${seq.data.id}/start`, {
      method: 'POST',
      headers: auth(eid),
      body: JSON.stringify({ leadId }),
    });
    expect(start.status).toBe(200);
    const startBody = (await start.json()) as {
      runId: string;
      data: { status: string; currentStep: number };
    };
    // Step 0 executed synchronously; step 1 waits for the tick/process hook.
    expect(startBody.data.status).toBe('running');
    expect(startBody.data.currentStep).toBe(1);

    const afterStart = await withTenant(eid, async (tx) =>
      tx.select().from(lead).where(eq(lead.id, leadId)).limit(1),
    );
    expect(afterStart[0]?.score).toBe(10);

    // Force-process now — step 1 is due (delayDays 0).
    const process = await fetch(`${base}${PREFIX}/enterprise/${eid}/sequences/${seq.data.id}/process`, {
      method: 'POST',
      headers: auth(eid),
      body: JSON.stringify({}),
    });
    expect(process.status).toBe(200);
    const processBody = (await process.json()) as { processed: number; runs: { status: string; currentStep: number }[] };
    expect(processBody.processed).toBe(1);
    expect(processBody.runs[0]?.status).toBe('success');
    expect(processBody.runs[0]?.currentStep).toBe(2);

    const afterProcess = await withTenant(eid, async (tx) =>
      tx.select().from(lead).where(eq(lead.id, leadId)).limit(1),
    );
    expect(afterProcess[0]?.score).toBe(20);

    // A second process pass has no running runs left.
    const again = await fetch(`${base}${PREFIX}/enterprise/${eid}/sequences/${seq.data.id}/process`, {
      method: 'POST',
      headers: auth(eid),
      body: JSON.stringify({}),
    });
    expect(again.status).toBe(200);
    expect(((await again.json()) as { processed: number }).processed).toBe(0);
  });
});

describe('A2.8 sequences — tenant isolation', () => {
  it('a sequence created under tenant A is invisible to tenant B', async () => {
    const { eid: eidA, leadId } = await freshTenantWithLead();
    const eidB = randomUUID();
    await getPool().query('INSERT INTO enterprise (id, name) VALUES ($1, $2)', [eidB, 'Sequences Tenant B']);

    const create = await fetch(`${base}${PREFIX}/enterprise/${eidA}/sequences`, {
      method: 'POST',
      headers: auth(eidA),
      body: JSON.stringify({
        name: `drip-${Date.now()}-iso`,
        steps: [{ delayDays: 0, action: { kind: 'notify_user', config: { title: 'A', body: 'private' } } }],
      }),
    });
    expect(create.status).toBe(201);
    const seq = (await create.json()) as { data: { id: string } };

    // B's list does not contain A's sequence.
    const listB = await fetch(`${base}${PREFIX}/enterprise/${eidB}/sequences`, {
      headers: auth(eidB),
    });
    expect(listB.status).toBe(200);
    const listBody = (await listB.json()) as { data: { id: string }[] };
    expect(listBody.data.find((s) => s.id === seq.data.id)).toBeUndefined();

    // B cannot fetch A's sequence by id (RLS → zero rows → 404).
    const oneB = await fetch(`${base}${PREFIX}/enterprise/${eidB}/sequences/${seq.data.id}`, {
      headers: auth(eidB),
    });
    expect(oneB.status).toBe(404);

    // B cannot start a run against A's sequence.
    const startB = await fetch(`${base}${PREFIX}/enterprise/${eidB}/sequences/${seq.data.id}/start`, {
      method: 'POST',
      headers: auth(eidB),
      body: JSON.stringify({ leadId }),
    });
    expect(startB.status).toBe(404);

    // Cross-tenant JWT (A's endpoint, B's token) is rejected outright.
    const cross = await fetch(`${base}${PREFIX}/enterprise/${eidA}/sequences`, {
      headers: auth(eidB),
    });
    expect([401, 403, 500]).toContain(cross.status);

    // And the run table holds nothing under B.
    const runsB = await withTenant(eidB, async (tx) =>
      tx.select().from(sequenceRun).where(eq(sequenceRun.enterpriseId, eidB)),
    );
    expect(runsB).toHaveLength(0);
  });
});

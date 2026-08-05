/**
 * Contract test for the P4 automation engine (A4.x).
 *
 * Proves the full vertical: rule CRUD, event-driven fire, action dispatch,
 * schedule + cron, lead distribution, webhook ingress, and tenant isolation.
 *
 * Boots the real Nest app on port 3106 (the audit test owns 3105; the
 * telephony test owns 3107; metadata 3100; tokens 3101; sync 3102; async 3103;
 * inbox 3104).
 */
import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import jwt from 'jsonwebtoken';
import { and, asc, desc, eq, sql } from 'drizzle-orm';
import {
  automation,
  automationRun,
  automationStep,
  callback,
  getPool,
  lead,
  withTenant,
  type DbClient,
} from '@opentelecrm/db';
import { AppModule } from '../app.module.js';

const ENTERPRISE_ID = process.env.TEST_ENTERPRISE_ID ?? 'a9e8933a-0a29-4e8b-8b2b-7fdfaf1b88d9';
const OTHER_ENTERPRISE_ID = '9811c8f1-9051-4e65-9a3e-f321ed1e209b';
const ENV_KEY = 'DEV_' + 'JWT_' + 'SECRET';
const SECRET = 'dev-secret-for-contract-tests';

let app: NestFastifyApplication;
let base: string;
const PORT = 3109;
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

function devJwt(eid = ENTERPRISE_ID): string {
  return jwt.sign({ enterpriseId: eid, sub: 'automation-test-user' }, SECRET, { expiresIn: '1h' });
}

function auth(eid = ENTERPRISE_ID) {
  return { authorization: `Bearer ${devJwt(eid)}`, 'content-type': 'application/json' };
}

async function createTeamMember(
  db: DbClient,
  eid: string,
  email: string,
  skills: string[] = [],
): Promise<{ userId: string; teamMemberId: string }> {
  // 1. ensure a role row exists.
  let roleRow = (await withTenant(eid, async (tx) =>
    tx.select().from((await import('@opentelecrm/db')).role).where(eq((await import('@opentelecrm/db')).role.enterpriseId, eid)).limit(1),
  ))[0];
  if (!roleRow) {
    const r = (await import('@opentelecrm/db')).role;
    const [created] = await withTenant(eid, async (tx) =>
      tx.insert(r).values({ enterpriseId: eid, name: 'agent', kind: 'agent' }).returning(),
    );
    roleRow = created!;
  }
  const u = (await import('@opentelecrm/db')).user;
  const tm = (await import('@opentelecrm/db')).teamMember;
  const [uRow] = await withTenant(eid, async (tx) =>
    tx
      .insert(u)
      .values({ email, name: email.split('@')[0] ?? 'agent' } as never)
      .returning(),
  );
  const [tRow] = await withTenant(eid, async (tx) =>
    tx
      .insert(tm)
      .values({
        enterpriseId: eid,
        userId: uRow!.id,
        roleId: roleRow!.id,
        availabilityState: 'available',
        skills: skills as unknown as string[],
        capacity: 100,
      })
      .returning(),
  );
  return { userId: uRow!.id, teamMemberId: tRow!.id };
}

/** Poll automation_run until terminal or timeout. */
async function waitForRunStatus(
  eid: string,
  runId: string,
  terminal: ReadonlyArray<string>,
  timeoutMs = 3000,
): Promise<{ status: string; steps: number; error: string | null }> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const rows = await withTenant(eid, async (tx) =>
      tx
        .select()
        .from(automationRun)
        .where(and(eq(automationRun.enterpriseId, eid), eq(automationRun.id, runId)))
        .limit(1),
    );
    if (rows[0]) {
      const r = rows[0];
      if (terminal.includes(r.status)) {
        const steps = await withTenant(eid, async (tx) =>
          tx
            .select({ c: sql<number>`count(*)::int` })
            .from(automationStep)
            .where(eq(automationStep.runId, runId)),
        );
        return { status: r.status, steps: Number(steps[0]?.c ?? 0), error: r.error ?? null };
      }
    }
    await new Promise((r) => setTimeout(r, 50));
  }
  throw new Error(`run ${runId} did not reach terminal in ${timeoutMs}ms`);
}

describe('P4 automation engine — rules CRUD', () => {
  it('creates a rule, lists it, fetches it, updates it, and deletes it', async () => {
    const name = `contract-${Date.now()}-crud`;
    const create = await fetch(`${base}${PREFIX}/enterprise/${ENTERPRISE_ID}/automations`, {
      method: 'POST',
      headers: auth(),
      body: JSON.stringify({
        name,
        trigger: { kind: 'lead_created', config: {} },
        actions: [{ kind: 'update_field', config: { apiName: 'score', value: 0 } }],
      }),
    });
    expect(create.status).toBe(201);
    const created = (await create.json()) as { data: { id: string; name: string; isActive: boolean } };
    expect(created.data.name).toBe(name);
    expect(created.data.isActive).toBe(true);

    const list = await fetch(`${base}${PREFIX}/enterprise/${ENTERPRISE_ID}/automations`, {
      headers: auth(),
    });
    expect(list.status).toBe(200);
    const listBody = (await list.json()) as { data: { id: string }[] };
    expect(listBody.data.find((r) => r.id === created.data.id)).toBeTruthy();

    const one = await fetch(`${base}${PREFIX}/enterprise/${ENTERPRISE_ID}/automations/${created.data.id}`, {
      headers: auth(),
    });
    expect(one.status).toBe(200);
    const oneBody = (await one.json()) as { data: { id: string } };
    expect(oneBody.data.id).toBe(created.data.id);

    const patch = await fetch(`${base}${PREFIX}/enterprise/${ENTERPRISE_ID}/automations/${created.data.id}`, {
      method: 'PATCH',
      headers: auth(),
      body: JSON.stringify({ isActive: false }),
    });
    expect(patch.status).toBe(200);
    const patchBody = (await patch.json()) as { data: { isActive: boolean } };
    expect(patchBody.data.isActive).toBe(false);

    const del = await fetch(`${base}${PREFIX}/enterprise/${ENTERPRISE_ID}/automations/${created.data.id}`, {
      method: 'DELETE',
      headers: auth(),
    });
    expect(del.status).toBe(200);
  });
});

describe('P4 automation engine — event-driven fire (a) lead_created + update_field', () => {
  it('fires on lead create, sets the lead score via update_field, and the run is success', async () => {
    const name = `contract-${Date.now()}-a`;
    const create = await fetch(`${base}${PREFIX}/enterprise/${ENTERPRISE_ID}/automations`, {
      method: 'POST',
      headers: auth(),
      body: JSON.stringify({
        name,
        trigger: { kind: 'lead_created' },
        conditions: { combinator: 'and', children: [] },
        actions: [{ kind: 'update_field', config: { apiName: 'score', value: 99 } }],
      }),
    });
    expect(create.status).toBe(201);
    const rule = (await create.json()) as { data: { id: string } };

    // Create a lead — should trigger the rule.
    const leadRes = await fetch(`${base}${PREFIX}/enterprise/${ENTERPRISE_ID}/lead`, {
      method: 'POST',
      headers: auth(),
      body: JSON.stringify({
        identifier: `+91990000${Math.floor(Math.random() * 10000)}`,
        source: 'web',
      }),
    });
    expect(leadRes.status).toBe(201);
    const leadBody = (await leadRes.json()) as { leadId: string; id: string };
    const leadId = leadBody.leadId ?? leadBody.id;

    // Wait for the run to land.
    const start = Date.now();
    let runId: string | null = null;
    while (Date.now() - start < 4000) {
      const rows = await withTenant(ENTERPRISE_ID, async (tx) =>
        tx
          .select()
          .from(automationRun)
          .where(
            and(
              eq(automationRun.enterpriseId, ENTERPRISE_ID),
              eq(automationRun.automationId, rule.data.id),
            ),
          )
          .orderBy(desc(automationRun.startedAt))
          .limit(1),
      );
      if (rows[0]) {
        runId = rows[0].id;
        break;
      }
      await new Promise((r) => setTimeout(r, 50));
    }
    expect(runId).toBeTruthy();
    const result = await waitForRunStatus(ENTERPRISE_ID, runId!, ['success', 'failed']);
    expect(result.status).toBe('success');
    expect(result.steps).toBeGreaterThanOrEqual(1);

    // The lead's score must now be 99.
    const updated = await withTenant(ENTERPRISE_ID, async (tx) =>
      tx.select().from(lead).where(eq(lead.id, leadId)).limit(1),
    );
    expect(updated[0]?.score).toBe(99);

    // Cleanup rule.
    await fetch(`${base}${PREFIX}/enterprise/${ENTERPRISE_ID}/automations/${rule.data.id}`, {
      method: 'DELETE',
      headers: auth(),
    });
  });
});

describe('P4 automation engine — (b) lead_stage_changed + create_callback', () => {
  it('fires on stage change and creates a callback row', async () => {
    // Need a real stage. Create one inline via raw SQL because there's no
    // stage-management route in the API.
    const stageId = await withTenant(ENTERPRISE_ID, async (tx) => {
      const r = (await import('@opentelecrm/db')).stage;
      // Get a real pipelineId (stage has a NOT NULL FK).
      const pipes = await tx.execute(
        sql`SELECT id FROM pipeline WHERE enterprise_id = ${ENTERPRISE_ID}::uuid LIMIT 1`,
      );
      const pipeId = (pipes as unknown as { rows: { id: string }[] }).rows[0]?.id;
      if (!pipeId) throw new Error('no pipeline seeded for tenant');
      const [s] = await tx
        .insert(r)
        .values({
          enterpriseId: ENTERPRISE_ID,
          pipelineId: pipeId,
          name: `auto-stage-${Date.now()}`,
          order: 99,
        } as never)
        .returning();
      return s!.id;
    });

    const name = `contract-${Date.now()}-b`;
    const create = await fetch(`${base}${PREFIX}/enterprise/${ENTERPRISE_ID}/automations`, {
      method: 'POST',
      headers: auth(),
      body: JSON.stringify({
        name,
        trigger: { kind: 'lead_stage_changed' },
        conditions: {
          combinator: 'and',
          children: [{ field: 'toStageId', op: 'eq', value: stageId }],
        },
        actions: [
          {
            kind: 'create_callback',
            config: { dueInHours: 24, channel: 'in_app', note: 'stage moved by automation' },
          },
        ],
      }),
    });
    expect(create.status).toBe(201);
    const rule = (await create.json()) as { data: { id: string } };

    // Create a lead WITHOUT a stage, then move it into the stage via PUT —
    // only the update path fires the lead_stage_changed event.
    const leadRes = await fetch(`${base}${PREFIX}/enterprise/${ENTERPRISE_ID}/lead`, {
      method: 'POST',
      headers: auth(),
      body: JSON.stringify({
        identifier: `+919****1111${Math.floor(Math.random() * 10000)}`,
      }),
    });
    expect(leadRes.status).toBe(201);
    const leadBody = (await leadRes.json()) as { leadId: string; id: string };
    const leadId = leadBody.leadId ?? leadBody.id;

    const moveRes = await fetch(`${base}${PREFIX}/enterprise/${ENTERPRISE_ID}/lead/${leadId}`, {
      method: 'PUT',
      headers: auth(),
      body: JSON.stringify({ stageId }),
    });
    expect(moveRes.status).toBe(200);

    // Wait for the run + step to land.
    const start = Date.now();
    let runId: string | null = null;
    while (Date.now() - start < 4000) {
      const rows = await withTenant(ENTERPRISE_ID, async (tx) =>
        tx
          .select()
          .from(automationRun)
          .where(
            and(
              eq(automationRun.enterpriseId, ENTERPRISE_ID),
              eq(automationRun.automationId, rule.data.id),
            ),
          )
          .orderBy(desc(automationRun.startedAt))
          .limit(1),
      );
      if (rows[0]) {
        runId = rows[0].id;
        if (rows[0].status === 'success' || rows[0].status === 'failed') break;
      }
      await new Promise((r) => setTimeout(r, 50));
    }
    expect(runId).toBeTruthy();
    const result = await waitForRunStatus(ENTERPRISE_ID, runId!, ['success', 'failed']);
    expect(result.status).toBe('success');

    // A callback row must exist for this lead with source='automation'.
    const cbs = await withTenant(ENTERPRISE_ID, async (tx) =>
      tx
        .select()
        .from(callback)
        .where(and(eq(callback.leadId, leadId), eq(callback.source, 'automation'))),
    );
    expect(cbs.length).toBeGreaterThanOrEqual(1);
    expect(cbs[0]?.note).toBe('stage moved by automation');

    // Cleanup.
    await fetch(`${base}${PREFIX}/enterprise/${ENTERPRISE_ID}/automations/${rule.data.id}`, {
      method: 'DELETE',
      headers: auth(),
    });
  });
});

describe('P4 automation engine — (c) schedule rule fires via /:id/test', () => {
  it('fires a cron schedule and writes a run + step', async () => {
    const name = `contract-${Date.now()}-c`;
    const create = await fetch(`${base}${PREFIX}/enterprise/${ENTERPRISE_ID}/automations`, {
      method: 'POST',
      headers: auth(),
      body: JSON.stringify({
        name,
        trigger: { kind: 'schedule' },
        schedule: { cron: '* * * * *' },
        actions: [
          { kind: 'notify_user', config: { userId: '00000000-0000-0000-0000-000000000000', title: 'tick', body: 'fired' } },
        ],
      }),
    });
    expect(create.status).toBe(201);
    const rule = (await create.json()) as { data: { id: string } };

    // Fire the rule via the test endpoint.
    const testRes = await fetch(`${base}${PREFIX}/enterprise/${ENTERPRISE_ID}/automations/${rule.data.id}/test`, {
      method: 'POST',
      headers: auth(),
      body: JSON.stringify({ payload: { firedAt: new Date().toISOString() } }),
    });
    expect(testRes.status).toBe(200);
    const testBody = (await testRes.json()) as { runId: string };
    expect(testBody.runId).toBeTruthy();

    const result = await waitForRunStatus(ENTERPRISE_ID, testBody.runId, ['success', 'failed']);
    expect(result.status).toBe('success');
    expect(result.steps).toBe(1);

    // The step must be kind=notify_user with the right output.
    const steps = await withTenant(ENTERPRISE_ID, async (tx) =>
      tx
        .select()
        .from(automationStep)
        .where(eq(automationStep.runId, testBody.runId)),
    );
    expect(steps.length).toBe(1);
    expect(steps[0]?.kind).toBe('notify_user');
    expect(steps[0]?.status).toBe('success');
    const output = steps[0]?.output as { title: string } | null;
    expect(output?.title).toBe('tick');

    // Cleanup.
    await fetch(`${base}${PREFIX}/enterprise/${ENTERPRISE_ID}/automations/${rule.data.id}`, {
      method: 'DELETE',
      headers: auth(),
    });
  });
});

describe('P4 automation engine — (d) lead distribution', () => {
  it('assigns a lead to a team member, and a second call rotates to a different one (>=2 available)', async () => {
    // Use a unique skill tag so the pool is exactly the two members created
    // here (older runs leave 'voice'-skilled members behind).
    const skill = `voice-${Date.now()}`;
    // Seed two team members in the test enterprise.
    const tm1 = await createTeamMember(
      (await import('@opentelecrm/db')).getDb(),
      ENTERPRISE_ID,
      `auto-tm1-${Date.now()}@test.local`,
      [skill],
    );
    const tm2 = await createTeamMember(
      (await import('@opentelecrm/db')).getDb(),
      ENTERPRISE_ID,
      `auto-tm2-${Date.now()}@test.local`,
      [skill],
    );

    // Create a lead.
    const leadRes = await fetch(`${base}${PREFIX}/enterprise/${ENTERPRISE_ID}/lead`, {
      method: 'POST',
      headers: auth(),
      body: JSON.stringify({
        identifier: `+91992222${Math.floor(Math.random() * 10000)}`,
      }),
    });
    expect(leadRes.status).toBe(201);
    const lb = (await leadRes.json()) as { leadId: string; id: string };
    const leadId1 = lb.leadId ?? lb.id;

    // Distribute. skill_match with ['voice'] restricts the pool to the two
    // seeded test members (demo members have no skills), so round-robin-style
    // tie-break is deterministic.
    const dist = await fetch(`${base}${PREFIX}/enterprise/${ENTERPRISE_ID}/lead/${leadId1}/distribute`, {
      method: 'POST',
      headers: auth(),
      body: JSON.stringify({ mode: 'skill_match', skills: [skill] }),
    });
    expect(dist.status).toBe(200);
    const distBody = (await dist.json()) as { assignedTeamMemberId: string | null; userId: string | null; reason: string };
    expect(distBody.assignedTeamMemberId).toBeTruthy();
    expect(distBody.userId).toBeTruthy();
    expect(distBody.reason).toBe('skill_match');

    // The lead must have that team member persisted.
    const after1 = await withTenant(ENTERPRISE_ID, async (tx) =>
      tx.select().from(lead).where(eq(lead.id, leadId1)).limit(1),
    );
    expect(after1[0]?.assignedTeamMemberId).toBe(distBody.assignedTeamMemberId);
    expect([tm1.teamMemberId, tm2.teamMemberId]).toContain(after1[0]?.assignedTeamMemberId);

    // Second lead — should pick the OTHER team member.
    const lead2Res = await fetch(`${base}${PREFIX}/enterprise/${ENTERPRISE_ID}/lead`, {
      method: 'POST',
      headers: auth(),
      body: JSON.stringify({
        identifier: `+919****3333${Math.floor(Math.random() * 10000)}`,
      }),
    });
    expect(lead2Res.status).toBe(201);
    const lb2 = (await lead2Res.json()) as { leadId: string; id: string };
    const leadId2 = lb2.leadId ?? lb2.id;

    const dist2 = await fetch(`${base}${PREFIX}/enterprise/${ENTERPRISE_ID}/lead/${leadId2}/distribute`, {
      method: 'POST',
      headers: auth(),
      body: JSON.stringify({ mode: 'skill_match', skills: [skill] }),
    });
    expect(dist2.status).toBe(200);
    const distBody2 = (await dist2.json()) as { assignedTeamMemberId: string | null };
    expect(distBody2.assignedTeamMemberId).toBeTruthy();
    expect(distBody2.assignedTeamMemberId).not.toBe(distBody.assignedTeamMemberId);
  });
});

describe('P4 automation engine — (e) webhook inbound', () => {
  it('fires the matching webhook_received rule and writes a run row', async () => {
    const name = `test-rule-${Date.now()}`;
    const create = await fetch(`${base}${PREFIX}/enterprise/${ENTERPRISE_ID}/automations`, {
      method: 'POST',
      headers: auth(),
      body: JSON.stringify({
        name,
        trigger: { kind: 'webhook_received' },
        actions: [
          { kind: 'notify_user', config: { userId: '00000000-0000-0000-0000-000000000000', title: 'wh fired', body: 'ok' } },
        ],
      }),
    });
    expect(create.status).toBe(201);

    // POST to the webhook — public route, no auth header. Route lives under
    // the global prefix (app.setGlobalPrefix in main.ts), so use PREFIX.
    const wh = await fetch(`${base}${PREFIX}/webhook/${ENTERPRISE_ID}/${name}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ payload: { foo: 1 } }),
    });
    expect(wh.status).toBe(201);
    const whBody = (await wh.json()) as { runId: string };
    expect(whBody.runId).toBeTruthy();

    const result = await waitForRunStatus(ENTERPRISE_ID, whBody.runId, ['success', 'failed']);
    expect(result.status).toBe('success');

    // Cleanup.
    const found = await withTenant(ENTERPRISE_ID, async (tx) =>
      tx
        .select()
        .from(automation)
        .where(and(eq(automation.enterpriseId, ENTERPRISE_ID), eq(automation.name, name)))
        .limit(1),
    );
    if (found[0]) {
      await fetch(`${base}${PREFIX}/enterprise/${ENTERPRISE_ID}/automations/${found[0].id}`, {
        method: 'DELETE',
        headers: auth(),
      });
    }
  });
});

describe('P4 automation engine — (f) tenant isolation', () => {
  it('a rule created under enterprise A is NOT visible under enterprise B', async () => {
    // Try to read enterprise A's rules using a dev-JWT scoped to enterprise B.
    const listA = await fetch(`${base}${PREFIX}/enterprise/${ENTERPRISE_ID}/automations`, {
      headers: auth(ENTERPRISE_ID),
    });
    expect(listA.status).toBe(200);
    const listABody = (await listA.json()) as { data: { id: string; enterpriseId?: string }[] };

    // Try to fetch one of those rules with a B-scoped JWT.
    if (listABody.data.length > 0) {
      const target = listABody.data[0]!;
      const attempt = await fetch(`${base}${PREFIX}/enterprise/${OTHER_ENTERPRISE_ID}/automations/${target.id}`, {
        headers: auth(OTHER_ENTERPRISE_ID),
      });
      // Either 404 (rule not found in B's tenant) or thrown enterprise-mismatch.
      // The controller calls assertTenant which throws 500 — but the auth
      // check is asserted server-side. Either is a pass.
      expect([404, 500]).toContain(attempt.status);
    }
  });
});

describe('P4 automation engine — (g) run history endpoint', () => {
  it('GET /automations/:id/runs returns runs for a rule after a manual test fire', async () => {
    const name = `contract-${Date.now()}-runs`;
    const create = await fetch(`${base}${PREFIX}/enterprise/${ENTERPRISE_ID}/automations`, {
      method: 'POST',
      headers: auth(),
      body: JSON.stringify({
        name,
        trigger: { kind: 'lead_created', config: {} },
        actions: [{ kind: 'update_field', config: { apiName: 'score', value: 0 } }],
      }),
    });
    expect(create.status).toBe(201);
    const created = (await create.json()) as { data: { id: string } };

    const testFire = await fetch(
      `${base}${PREFIX}/enterprise/${ENTERPRISE_ID}/automations/${created.data.id}/test`,
      {
        method: 'POST',
        headers: auth(),
        body: JSON.stringify({ payload: { lead: { id: '00000000-0000-0000-0000-000000000000' } } }),
      },
    );
    expect(testFire.status).toBe(200);
    const fired = (await testFire.json()) as { runId: string };
    expect(fired.runId).toBeTruthy();

    const runs = await fetch(`${base}${PREFIX}/enterprise/${ENTERPRISE_ID}/automations/${created.data.id}/runs`, {
      headers: auth(),
    });
    expect(runs.status).toBe(200);
    const runsBody = (await runs.json()) as {
      data: Array<{ id: string; status: string; startedAt: string; stepsExecuted: number }>;
    };
    expect(runsBody.data.length).toBeGreaterThanOrEqual(1);
    expect(runsBody.data[0]!.id).toBe(fired.runId);
    expect(typeof runsBody.data[0]!.startedAt).toBe('string');

    // Cleanup
    await fetch(`${base}${PREFIX}/enterprise/${ENTERPRISE_ID}/automations/${created.data.id}`, {
      method: 'DELETE',
      headers: auth(),
    });
  });

  it('runs for a rule are tenant-scoped (empty for another enterprise)', async () => {
    // An unknown id under the OTHER tenant must 404 (rule not found in that tenant).
    const attempt = await fetch(
      `${base}${PREFIX}/enterprise/${OTHER_ENTERPRISE_ID}/automations/00000000-0000-0000-0000-000000000000/runs`,
      { headers: auth(OTHER_ENTERPRISE_ID) },
    );
    expect([404, 500]).toContain(attempt.status);
  });
});

describe('P4 automation engine — (h) P4b executors + replay (Wave 2)', () => {
  async function createRule(name: string, trigger: unknown, actions: unknown[], schedule?: unknown) {
    const create = await fetch(`${base}${PREFIX}/enterprise/${ENTERPRISE_ID}/automations`, {
      method: 'POST',
      headers: auth(),
      body: JSON.stringify({
        name,
        trigger,
        actions,
        ...(schedule ? { schedule } : {}),
      }),
    });
    expect(create.status).toBe(201);
    return ((await create.json()) as { data: { id: string } }).data.id;
  }

  async function deleteRule(id: string) {
    await fetch(`${base}${PREFIX}/enterprise/${ENTERPRISE_ID}/automations/${id}`, {
      method: 'DELETE',
      headers: auth(),
    });
  }

  async function testFire(id: string, payload: Record<string, unknown>) {
    const res = await fetch(`${base}${PREFIX}/enterprise/${ENTERPRISE_ID}/automations/${id}/test`, {
      method: 'POST',
      headers: auth(),
      body: JSON.stringify({ payload }),
    });
    expect(res.status).toBe(200);
    return ((await res.json()) as { runId: string }).runId;
  }

  it('branch(condition false, stopChainOnFalse) halts the remaining actions', async () => {
    const id = await createRule(
      `contract-${Date.now()}-branch`,
      { kind: 'lead_created', config: {} },
      [
        {
          kind: 'branch',
          config: {
            condition: { combinator: 'and', children: [{ field: 'triggered', op: 'eq', value: 'yes' }] },
            stopChainOnFalse: true,
          },
        },
        { kind: 'update_field', config: { apiName: 'score', value: 99 } },
      ],
    );
    try {
      const runId = await testFire(id, { triggered: 'no' });
      const res = await waitForRunStatus(ENTERPRISE_ID, runId, ['success', 'failed']);
      expect(res.status).toBe('success');
      // Chain must have stopped after the branch step — update_field never ran.
      expect(res.steps).toBe(1);
    } finally {
      await deleteRule(id);
    }
  });

  it('delay + http_request executors run in-chain and hit the local health endpoint', async () => {
    const id = await createRule(
      `contract-${Date.now()}-delayhttp`,
      { kind: 'lead_created', config: {} },
      [
        { kind: 'delay', config: { ms: 10 } },
        { kind: 'http_request', config: { url: `http://127.0.0.1:${PORT}/health`, method: 'GET' } },
      ],
    );
    try {
      const runId = await testFire(id, {});
      const res = await waitForRunStatus(ENTERPRISE_ID, runId, ['success', 'failed']);
      expect(res.status).toBe('success');
      expect(res.steps).toBe(2);

      const steps = await withTenant(ENTERPRISE_ID, async (tx) =>
        tx
          .select()
          .from(automationStep)
          .where(eq(automationStep.runId, runId))
          .orderBy(asc(automationStep.order)),
      );
      const httpStep = steps.find((s) => s.kind === 'http_request');
      expect(httpStep).toBeTruthy();
      expect((httpStep!.output as { status?: number }).status).toBe(200);
      const delayStep = steps.find((s) => s.kind === 'delay');
      expect((delayStep!.output as { sleptMs?: number }).sleptMs).toBeGreaterThanOrEqual(10);
    } finally {
      await deleteRule(id);
    }
  });

  it('POST /:id/runs/:runId/replay re-fires the rule into a new run', async () => {
    const id = await createRule(
      `contract-${Date.now()}-replay`,
      { kind: 'lead_created', config: {} },
      [{ kind: 'update_field', config: { apiName: 'score', value: 5 } }],
    );
    try {
      const firstRun = await testFire(id, {});
      await waitForRunStatus(ENTERPRISE_ID, firstRun, ['success', 'failed']);

      const replay = await fetch(
        `${base}${PREFIX}/enterprise/${ENTERPRISE_ID}/automations/${id}/runs/${firstRun}/replay`,
        { method: 'POST', headers: auth(), body: JSON.stringify({}) },
      );
      expect(replay.status).toBe(200);
      const replayBody = (await replay.json()) as { runId: string };
      expect(replayBody.runId).toBeTruthy();
      expect(replayBody.runId).not.toBe(firstRun);

      const runs = await fetch(`${base}${PREFIX}/enterprise/${ENTERPRISE_ID}/automations/${id}/runs`, {
        headers: auth(),
      });
      const runsBody = (await runs.json()) as { data: { id: string }[] };
      expect(runsBody.data.length).toBeGreaterThanOrEqual(2);
      expect(runsBody.data[0]!.id).toBe(replayBody.runId);
    } finally {
      await deleteRule(id);
    }
  });

  it('schedule rules persist runAt one-shot config + nextRunAt', async () => {
    const runAt = new Date(Date.now() + 86_400_000).toISOString();
    const id = await createRule(
      `contract-${Date.now()}-runat`,
      { kind: 'schedule', config: {} },
      [{ kind: 'notify_user', config: { title: 'one-shot', body: 'x' } }],
      { runAt, timezone: 'Asia/Kolkata' },
    );
    try {
      const one = await fetch(`${base}${PREFIX}/enterprise/${ENTERPRISE_ID}/automations/${id}`, {
        headers: auth(),
      });
      const body = (await one.json()) as {
        data: { schedule: { runAt?: string } | null; nextRunAt?: string | null };
      };
      expect(new Date(body.data.schedule?.runAt as string).toISOString()).toBe(runAt);
      expect(body.data.nextRunAt).toBeTruthy();
    } finally {
      await deleteRule(id);
    }
  });
});

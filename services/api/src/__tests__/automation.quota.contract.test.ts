/**
 * Contract test for A4.7 automation quota metering (D4 divergence fix).
 *
 * Proves: per-tenant rate limiting (throttled runs visible in the run log),
 * the observable usage endpoint, per-tenant limit overrides, RLS isolation,
 * and validation.
 *
 * Uses FRESH enterprises (random uuids) so the meter window starts at zero —
 * the demo tenant accumulates runs from the other suites sharing this DB.
 * Firing is sequential with a poll after each lead create, so each fire()
 * (which awaits createRun) commits before the next one starts; this makes
 * the sliding-window meter deterministic.
 *
 * Port 3113 (automation=3109, dashboard=3111, sequences=3112).
 */
import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import {
  automationRun,
  getPool,
  withTenant,
} from '@opentelecrm/db';
import { AppModule } from '../app.module.js';

const ENV_KEY = 'DEV_' + 'JWT_' + 'SECRET';
const SECRET = 'dev-secret-for-contract-tests';

let app: NestFastifyApplication;
let base: string;
const PORT = 3113;
const PREFIX = '/autoupdate/v2';

/** Fresh tenant per suite — meter window starts empty. */
const EID_A = randomUUID();
const EID_B = randomUUID();

beforeAll(async () => {
  process.env[ENV_KEY] = SECRET;
  process.env.AUTOMATION_RATE_LIMIT_PER_MINUTE = '2';
  app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter());
  app.setGlobalPrefix(PREFIX, { exclude: ['/health'] });
  await app.listen({ port: PORT, host: '127.0.0.1' });
  base = `http://127.0.0.1:${PORT}`;

  // enterprise is NOT tenant-scoped — insert directly (no withTenant).
  await getPool().query(
    'INSERT INTO enterprise (id, name) VALUES ($1, $2), ($3, $4) ON CONFLICT (id) DO NOTHING',
    [EID_A, 'quota-a', EID_B, 'quota-b'],
  );
});

afterAll(async () => {
  await app.close();
  await getPool().end();
});

function devJwt(eid: string): string {
  return jwt.sign({ enterpriseId: eid, sub: 'quota-test-user' }, SECRET, { expiresIn: '1h' });
}

function auth(eid: string) {
  return { authorization: `Bearer ${devJwt(eid)}`, 'content-type': 'application/json' };
}

async function createRule(eid: string, name: string): Promise<string> {
  const res = await fetch(`${base}${PREFIX}/enterprise/${eid}/automations`, {
    method: 'POST',
    headers: auth(eid),
    body: JSON.stringify({
      name,
      trigger: { kind: 'lead_created', config: {} },
      actions: [{ kind: 'update_field', config: { apiName: 'score', value: 1 } }],
    }),
  });
  expect(res.status).toBe(201);
  const body = (await res.json()) as { data: { id: string } };
  return body.data.id;
}

async function createLead(eid: string): Promise<void> {
  const res = await fetch(`${base}${PREFIX}/enterprise/${eid}/lead`, {
    method: 'POST',
    headers: auth(eid),
    body: JSON.stringify({
      identifier: `+9198${Math.floor(Math.random() * 1_000_000_000)}`,
      source: 'web',
    }),
  });
  expect(res.status).toBe(201);
}

/** Count runs for a rule by status. */
async function runsForRule(eid: string, ruleId: string): Promise<Record<string, number>> {
  const rows = await withTenant(eid, async (tx) =>
    tx
      .select({ status: automationRun.status })
      .from(automationRun)
      .where(
        and(
          eq(automationRun.enterpriseId, eid),
          eq(automationRun.automationId, ruleId),
        ),
      ),
  );
  const counts: Record<string, number> = {};
  for (const r of rows) counts[r.status] = (counts[r.status] ?? 0) + 1;
  return counts;
}

/** Wait until the rule has exactly n runs (fire() commits the run row). */
async function waitForRunCount(eid: string, ruleId: string, n: number): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < 8000) {
    const counts = await runsForRule(eid, ruleId);
    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    if (total >= n) return;
    await new Promise((r) => setTimeout(r, 50));
  }
  throw new Error(`run count did not reach ${n} for rule ${ruleId}`);
}

describe('A4.7 automation quota metering — per-tenant rate limiter (D4)', () => {
  it('throttles runs beyond the runs/minute ceiling and writes visible throttled rows', async () => {
    const ruleId = await createRule(EID_A, `quota-enforce-${Date.now()}`);

    // Limit is 2/min. Create 5 leads sequentially; each fire() commits its
    // run row before the next POST, so the window count is deterministic.
    for (let i = 0; i < 5; i++) {
      await createLead(EID_A);
      await waitForRunCount(EID_A, ruleId, i + 1);
    }

    const counts = await runsForRule(EID_A, ruleId);
    // Executed runs (queued/running/success/failed) are capped at 2; the
    // remaining 3 firings are recorded as 'throttled' — visible, not dropped.
    const executed = (counts.queued ?? 0) + (counts.running ?? 0) + (counts.success ?? 0) + (counts.failed ?? 0);
    expect(executed).toBe(2);
    expect(counts.throttled).toBe(3);

    // The throttled rows carry the reason.
    const throttled = await withTenant(EID_A, async (tx) =>
      tx
        .select({ error: automationRun.error })
        .from(automationRun)
        .where(
          and(
            eq(automationRun.enterpriseId, EID_A),
            eq(automationRun.automationId, ruleId),
            eq(automationRun.status, 'throttled'),
          ),
        )
        .limit(1),
    );
    expect(throttled[0]?.error).toContain('rate limit exceeded');
  });

  it('exposes usage via GET /automations/usage', async () => {
    const res = await fetch(`${base}${PREFIX}/enterprise/${EID_A}/automations/usage`, {
      headers: auth(EID_A),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      data: {
        rateLimitPerMinute: number;
        used: number;
        windowSeconds: number;
        remaining: number;
        resetAt: string;
      };
    };
    expect(body.data.rateLimitPerMinute).toBe(2);
    expect(body.data.used).toBe(2); // throttled rows don't count
    expect(body.data.remaining).toBe(0);
    expect(body.data.windowSeconds).toBe(60);
    expect(new Date(body.data.resetAt).getTime()).toBeGreaterThan(Date.now());
  });

  it('per-tenant override via PUT /automations/quota raises the limit and unthrottles', async () => {
    const ruleId = await createRule(EID_A, `quota-override-${Date.now()}`);

    const put = await fetch(`${base}${PREFIX}/enterprise/${EID_A}/automations/quota`, {
      method: 'PUT',
      headers: auth(EID_A),
      body: JSON.stringify({ rateLimitPerMinute: 10 }),
    });
    expect(put.status).toBe(200);
    expect(((await put.json()) as { data: { rateLimitPerMinute: number } }).data.rateLimitPerMinute).toBe(10);

    const get = await fetch(`${base}${PREFIX}/enterprise/${EID_A}/automations/quota`, {
      headers: auth(EID_A),
    });
    expect(((await get.json()) as { data: { rateLimitPerMinute: number } }).data.rateLimitPerMinute).toBe(10);

    // Below the new ceiling: this fire dispatches (not throttled).
    await createLead(EID_A);
    await waitForRunCount(EID_A, ruleId, 1);
    const counts = await runsForRule(EID_A, ruleId);
    expect(counts.throttled ?? 0).toBe(0);
    expect((counts.queued ?? 0) + (counts.running ?? 0) + (counts.success ?? 0)).toBeGreaterThanOrEqual(1);

    const usage = (await (
      await fetch(`${base}${PREFIX}/enterprise/${EID_A}/automations/usage`, { headers: auth(EID_A) })
    ).json()) as { data: { rateLimitPerMinute: number; used: number } };
    expect(usage.data.rateLimitPerMinute).toBe(10);
    // used = 2 (case 1 executed runs) + 2 (this lead fires BOTH active
    // lead_created rules: case-1 rule + this case's rule).
    expect(usage.data.used).toBe(4);
  });

  it('isolates quotas and usage per tenant (RLS)', async () => {
    // Tenant B has no runs and no override — it sees the env default, empty.
    const res = await fetch(`${base}${PREFIX}/enterprise/${EID_B}/automations/usage`, {
      headers: auth(EID_B),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { rateLimitPerMinute: number; used: number } };
    expect(body.data.rateLimitPerMinute).toBe(2);
    expect(body.data.used).toBe(0);

    // B's override must not leak into A.
    await fetch(`${base}${PREFIX}/enterprise/${EID_B}/automations/quota`, {
      method: 'PUT',
      headers: auth(EID_B),
      body: JSON.stringify({ rateLimitPerMinute: 99 }),
    });
    const a = (await (
      await fetch(`${base}${PREFIX}/enterprise/${EID_A}/automations/quota`, { headers: auth(EID_A) })
    ).json()) as { data: { rateLimitPerMinute: number } };
    expect(a.data.rateLimitPerMinute).toBe(10);
  });

  it('rejects invalid quota values', async () => {
    for (const bad of [{ rateLimitPerMinute: 0 }, { rateLimitPerMinute: -3 }, { rateLimitPerMinute: 'abc' }, {}]) {
      const res = await fetch(`${base}${PREFIX}/enterprise/${EID_A}/automations/quota`, {
        method: 'PUT',
        headers: auth(EID_A),
        body: JSON.stringify(bad),
      });
      expect(res.status).toBe(400);
    }
  });
});

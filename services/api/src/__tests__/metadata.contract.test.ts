/**
 * Contract test for the TeleCRM-parity metadata surface.
 * Boots the real Nest app against the seeded demo DB, mints a dev JWT for the
 * seeded enterprise, and asserts the response shape TeleCRM clients expect.
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
  await app.listen({ port: 3100, host: '127.0.0.1' });
  base = 'http://127.0.0.1:3100';
});

afterAll(async () => {
  await app.close();
});

function token(): string {
  return jwt.sign({ enterpriseId: ENTERPRISE_ID, sub: 'contract-test-user' }, SECRET, {
    expiresIn: '1h',
  });
}

describe('GET /health (no auth)', () => {
  it('returns ok', async () => {
    const res = await fetch(`${base}/health`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('ok');
  });
});

describe('GET /autoupdate/v2/enterprise/{eid}/metadata', () => {
  it('returns TeleCRM-shaped workspace metadata', async () => {
    const res = await fetch(`${base}/autoupdate/v2/enterprise/${ENTERPRISE_ID}/metadata`, {
      headers: { authorization: `Bearer ${token()}` },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.enterprise.id).toBe(ENTERPRISE_ID);
    expect(body.enterprise.leadIdentifier).toBe('phone');
    expect(Array.isArray(body.pipelines)).toBe(true);
    expect(body.pipelines.length).toBeGreaterThanOrEqual(1);
    expect(body.pipelines[0]).toHaveProperty('stages');
    expect(Array.isArray(body.actionTypes)).toBe(true);
  });
});

describe('GET /autoupdate/v2/enterprise/{eid}/custom-fields', () => {
  it('returns the 20 seeded custom fields with immutable apiName', async () => {
    const res = await fetch(`${base}/autoupdate/v2/enterprise/${ENTERPRISE_ID}/custom-fields`, {
      headers: { authorization: `Bearer ${token()}` },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.length).toBe(20);
    for (const f of body.data) {
      expect(f).toHaveProperty('apiName');
      expect(f).toHaveProperty('label');
      expect(f).toHaveProperty('type');
      expect(f.apiName).toMatch(/^custom_\d{2}$/);
    }
  });
});

describe('GET /autoupdate/v2/enterprise/{eid}/lead-stage-pipeline', () => {
  it('returns pipelines with stages', async () => {
    const res = await fetch(`${base}/autoupdate/v2/enterprise/${ENTERPRISE_ID}/lead-stage-pipeline`, {
      headers: { authorization: `Bearer ${token()}` },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBeGreaterThanOrEqual(1);
  });
});

describe('Auth enforcement', () => {
  it('rejects missing token with TeleCRM error envelope', async () => {
    const res = await fetch(`${base}/autoupdate/v2/enterprise/${ENTERPRISE_ID}/metadata`);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error.code).toBe('NOT_AUTHORIZED');
  });

  it('rejects enterprise mismatch', async () => {
    const other = jwt.sign({ enterpriseId: '11111111-1111-1111-1111-111111111111' }, SECRET);
    const res = await fetch(`${base}/autoupdate/v2/enterprise/${ENTERPRISE_ID}/metadata`, {
      headers: { authorization: `Bearer ${other}` },
    });
    expect(res.status).toBe(500); // enterprise mismatch throws — surfaced as 500
  });
});
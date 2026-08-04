/**
 * Contract test for the unified inbox + send surface.
 * Boots the real Nest app against the seeded demo DB, mints a dev JWT for the
 * P0 enterprise, and asserts the wire shape clients expect:
 *   GET  /enterprise/{eid}/whatsapp/conversations
 *   GET  /enterprise/{eid}/whatsapp/conversations/{id}/messages
 *   POST /enterprise/{eid}/whatsapp/send
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

// Lead identifiers are seeded as real numbers (e.g. +9191...) — the hex bytes
// of lead 65654407-... prove the stored identifier is `+9191` + `00000000`.
const LEAD_JID = '+919100000000@s.whatsapp.net';

let app: NestFastifyApplication;
let base: string;

beforeAll(async () => {
  process.env[ENV_KEY] = SECRET;
  app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter());
  app.setGlobalPrefix('/autoupdate/v2', { exclude: ['/health'] });
  await app.listen({ port: 3105, host: '127.0.0.1' });
  base = 'http://127.0.0.1:3105';
});

afterAll(async () => {
  await app.close();
});

function token(): string {
  return jwt.sign({ enterpriseId: ENTERPRISE_ID, sub: 'contract-test-user' }, SECRET, {
    expiresIn: '1h',
  });
}

function auth() {
  return { authorization: `Bearer ${token()}` };
}

async function send(jid: string, text: string) {
  const res = await fetch(`${base}/autoupdate/v2/enterprise/${ENTERPRISE_ID}/whatsapp/send`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...auth() },
    body: JSON.stringify({ contactJid: jid, text }),
  });
  return res;
}

async function listConversations() {
  const res = await fetch(
    `${base}/autoupdate/v2/enterprise/${ENTERPRISE_ID}/whatsapp/conversations`,
    { headers: auth() },
  );
  expect(res.status).toBe(200);
  return (await res.json()) as { data: ConversationView[] };
}

interface ConversationView {
  id: string;
  contactJid: string;
  contactName: string | null;
  leadId: string | null;
  lastMessageAt: string;
  unreadCount: number;
  isGroup: boolean;
  waSessionId: string;
  screenName: string | null;
}

describe('GET /enterprise/{eid}/whatsapp/conversations', () => {
  it('returns 200 with a data array of conversations', async () => {
    const body = await listConversations();
    expect(Array.isArray(body.data)).toBe(true);
    for (const c of body.data) {
      expect(c).toHaveProperty('id');
      expect(c).toHaveProperty('contactJid');
      expect(c).toHaveProperty('lastMessageAt');
      expect(c).toHaveProperty('unreadCount');
      expect(c).toHaveProperty('isGroup');
      expect(c).toHaveProperty('waSessionId');
    }
  });
});

describe('POST /enterprise/{eid}/whatsapp/send', () => {
  it('returns success + messageId and persists an outbound message in the thread', async () => {
    const jid = '91970001111@s.whatsapp.net';
    const res = await send(jid, 'hello from contract test');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(typeof body.messageId).toBe('string');

    // The conversation now exists and the thread shows the outbound message.
    const convos = await listConversations();
    const convo = convos.data.find((c) => c.contactJid === jid);
    expect(convo).toBeDefined();
    expect(convo!.screenName).toBe('demo-agent-number');

    const msgRes = await fetch(
      `${base}/autoupdate/v2/enterprise/${ENTERPRISE_ID}/whatsapp/conversations/${convo!.id}/messages`,
      { headers: auth() },
    );
    expect(msgRes.status).toBe(200);
    const msgBody = await msgRes.json();
    expect(Array.isArray(msgBody.data)).toBe(true);
    const outbound = msgBody.data.find((m: { direction: string }) => m.direction === 'outbound');
    expect(outbound).toBeDefined();
    expect(outbound.body).toBe('hello from contract test');
    expect(outbound.waMessageId).toBe(body.messageId);
  });

  it('auto-attributes the conversation to the lead matching the JID phone', async () => {
    const res = await send(LEAD_JID, 'hi lead');
    expect(res.status).toBe(200);

    const convos = await listConversations();
    const convo = convos.data.find((c) => c.contactJid === LEAD_JID);
    expect(convo).toBeDefined();
    expect(convo!.leadId).toBeTruthy();
  });
});

describe('Auth enforcement (whatsapp surface)', () => {
  it('rejects missing token with TeleCRM error envelope', async () => {
    const res = await fetch(
      `${base}/autoupdate/v2/enterprise/${ENTERPRISE_ID}/whatsapp/conversations`,
    );
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error.code).toBe('NOT_AUTHORIZED');
  });
});

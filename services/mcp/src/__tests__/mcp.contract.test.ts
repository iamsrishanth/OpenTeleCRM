import http from 'node:http';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { getPool } from '@opentelecrm/db';
/**
 * Contract test for the OpenTeleCRM MCP server (audit finding B8).
 *
 * Boots the real Streamable HTTP transport on a test port and drives it with
 * raw JSON-RPC 2.0 over fetch: initialize handshake, then tools/call for all
 * 13 registered tools, asserting against the seeded demo DB.
 *
 * The transport runs in stateless mode (sessionIdGenerator: undefined), so
 * every request gets a fresh transport — the same wiring as src/index.ts.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { server } from '../index.js';

const PORT = Number(process.env.MCP_TEST_PORT ?? 3110);
const BASE_URL = `http://127.0.0.1:${PORT}/mcp`;
const PROTOCOL_VERSION = '2024-11-05';
const ENTERPRISE_ID = process.env.MCP_ENTERPRISE_ID ?? 'a9e8933a-0a29-4e8b-8b2b-7fdfaf1b88d9';

const TOOL_NAMES = [
  'get_workspace_identity',
  'list_lead_fields',
  'get_lead_field_schema',
  'list_actions',
  'get_action_schema',
  'get_lead_stages_and_lost_reasons',
  'list_team_members',
  'fetch_lead',
  'query_leads',
  'fetch_lead_action',
  'query_lead_actions',
  'get_current_date',
  'get_workspace_context',
];

let httpServer: http.Server;
let nextId = 1;

// ---- helpers -------------------------------------------------------------

/** Parse the SSE frames the transport streams back (`event: message` / `data: {...}`). */
function parseSse(body: string): unknown[] {
  const messages: unknown[] = [];
  for (const frame of body.split(/\r?\n\r?\n/)) {
    let data = '';
    for (const line of frame.split(/\r?\n/)) {
      if (line.startsWith('data:')) data += line.slice(5).trim();
    }
    if (data) messages.push(JSON.parse(data));
  }
  return messages;
}

/** POST a raw JSON-RPC message; returns parsed responses ([] for 202 notification-only replies). */
async function post(body: unknown): Promise<unknown[]> {
  const res = await fetch(BASE_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
      'Mcp-Protocol-Version': PROTOCOL_VERSION,
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (res.status === 202 || text === '') return [];
  return parseSse(text);
}

/** Send a request and return the response message whose id matches (asserts one exists). */
async function rpc(method: string, params: unknown): Promise<any> {
  const id = nextId++;
  const responses = await post({ jsonrpc: '2.0', id, method, params });
  const msg = responses.find((m) => (m as any)?.id === id);
  expect(msg, `no JSON-RPC response for ${method} (id ${id}): ${JSON.stringify(responses)}`).toBeTruthy();
  return msg;
}

/** Full initialize handshake on a fresh stateless connection. */
async function initialize(): Promise<void> {
  const msg = await rpc('initialize', {
    protocolVersion: PROTOCOL_VERSION,
    capabilities: {},
    clientInfo: { name: 'contract-test', version: '1.0' },
  });
  expect(msg.result?.protocolVersion).toBe(PROTOCOL_VERSION);
  expect(msg.result?.serverInfo?.name).toBe('opentelecrm');
  // notifications/initialized — notification-only POST, expected 202 with no body.
  expect(await post({ jsonrpc: '2.0', method: 'notifications/initialized' })).toEqual([]);
}

/** Handshake + tools/call; returns the call result (throws on JSON-RPC error). */
async function callTool(name: string, args: Record<string, unknown>): Promise<any> {
  await initialize();
  const msg = await rpc('tools/call', { name, arguments: args });
  if (msg.error) {
    throw new Error(`tools/call ${name} returned JSON-RPC error: ${JSON.stringify(msg.error)}`);
  }
  return msg.result;
}

/** Unwrap a tool result's text content (every tool returns JSON.stringify'd text). */
function parseText(result: any): any {
  const content = result?.content ?? [];
  const text = content.find((c: any) => c?.type === 'text')?.text;
  return JSON.parse(text);
}

// ---- server boot ---------------------------------------------------------

beforeAll(async () => {
  httpServer = http.createServer(async (req, res) => {
    // Same wiring as src/index.ts: one stateless transport per request.
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    await server.connect(transport);
    await transport.handleRequest(req, res);
    if (!transport.sessionId) {
      await server.close();
    }
  });
  await new Promise<void>((resolve, reject) => {
    httpServer.once('error', reject);
    httpServer.listen(PORT, '127.0.0.1', resolve);
  });
});

afterAll(async () => {
  await server.close().catch(() => {});
  await new Promise<void>((resolve) => httpServer.close(() => resolve()));
  // Release the pg pool so vitest can exit.
  await getPool()
    .end()
    .catch(() => {});
});

// ---- tests ---------------------------------------------------------------

describe('MCP server contract (Streamable HTTP over JSON-RPC)', () => {
  it('tools/list exposes all 13 tools', async () => {
    await initialize();
    const msg = await rpc('tools/list', {});
    const tools: { name: string }[] = msg.result?.tools ?? [];
    expect(tools.map((t) => t.name).sort()).toEqual([...TOOL_NAMES].sort());
  });

  it('get_workspace_identity returns the seeded demo workspace', async () => {
    const identity = parseText(await callTool('get_workspace_identity', {}));
    expect(identity.id).toBe(ENTERPRISE_ID);
    expect(identity.name).toBe('Acme Demo Workspace');
    expect(identity.leadIdentifier).toBe('phone');
  });

  it('list_lead_fields returns exactly the 20 seeded custom fields', async () => {
    const fields = parseText(await callTool('list_lead_fields', {}));
    expect(fields).toHaveLength(20);
    for (const f of fields) {
      expect(f.apiName).toMatch(/^custom_\d{2}$/);
    }
  });

  it('get_lead_field_schema returns a field for custom_01', async () => {
    const field = parseText(await callTool('get_lead_field_schema', { apiName: 'custom_01' }));
    expect(field.apiName).toBe('custom_01');
    expect(typeof field.type).toBe('string');
    expect(field.config).toBeTruthy();
  });

  it('query_leads with limit=3 returns exactly 3 leads', async () => {
    const leads = parseText(await callTool('query_leads', { limit: 3 }));
    expect(leads).toHaveLength(3);
    for (const lead of leads) {
      expect(typeof lead.id).toBe('string');
      expect(lead.identifier).toBeTruthy();
    }
  });

  it('fetch_lead returns a real lead queried from the DB', async () => {
    const leads = parseText(await callTool('query_leads', { limit: 1 }));
    const leadId = leads[0].id;
    const lead = parseText(await callTool('fetch_lead', { leadId }));
    expect(lead.id).toBe(leadId);
    expect(lead.identifier).toBe(leads[0].identifier);
  });

  it('list_actions includes note, call and whatsapp', async () => {
    const actions = parseText(await callTool('list_actions', {}));
    const codes = actions.map((a: { code: string }) => a.code);
    expect(codes).toEqual(expect.arrayContaining(['note', 'call', 'whatsapp']));
  });

  it('get_action_schema returns the note action type', async () => {
    const actionType = parseText(await callTool('get_action_schema', { code: 'note' }));
    expect(actionType.code).toBe('note');
    expect(actionType.fieldSchema).toBeTruthy();
  });

  it('get_current_date returns an ISO date', async () => {
    const { date } = parseText(await callTool('get_current_date', {}));
    expect(typeof date).toBe('string');
    expect(date).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(Number.isNaN(Date.parse(date))).toBe(false);
  });

  it('list_team_members returns the seeded demo members', async () => {
    const members = parseText(await callTool('list_team_members', {}));
    // Demo DB has been re-seeded (21 rows); assert the canonical seed members are present.
    expect(members.length).toBeGreaterThanOrEqual(3);
    const emails = members.map((m: { email?: string }) => m.email);
    expect(emails).toEqual(
      expect.arrayContaining(['owner@demo.local', 'admin@demo.local', 'agent@demo.local']),
    );
    for (const m of members) {
      expect(typeof m.id).toBe('string');
    }
  });

  it('get_lead_stages_and_lost_reasons returns the 2 seeded pipelines', async () => {
    const { pipelines, lostReasons } = parseText(await callTool('get_lead_stages_and_lost_reasons', {}));
    expect(pipelines).toHaveLength(2);
    for (const p of pipelines) {
      expect(Array.isArray(p.stages)).toBe(true);
      expect(p.stages.length).toBeGreaterThan(0);
    }
    expect(Array.isArray(lostReasons)).toBe(true);
  });

  it('get_workspace_context returns pipelines and custom fields', async () => {
    const ctx = parseText(await callTool('get_workspace_context', {}));
    expect(ctx.pipelines).toHaveLength(2);
    expect(ctx.fields).toHaveLength(20);
    expect(ctx.fields).toContain('custom_01');
  });

  it('query_lead_actions returns an array (empty in demo seed)', async () => {
    const leads = parseText(await callTool('query_leads', { limit: 1 }));
    const actions = parseText(await callTool('query_lead_actions', { leadId: leads[0].id }));
    expect(Array.isArray(actions)).toBe(true);
  });

  it('fetch_lead_action returns a clean not-found error for unknown ids', async () => {
    const result = parseText(
      await callTool('fetch_lead_action', { actionId: '00000000-0000-0000-0000-000000000000' }),
    );
    expect(result.error).toBe('action_not_found');
  });

  it('rejects an unknown tool with an id-matched error response', async () => {
    await initialize();
    const id = nextId++;
    const responses = await post({
      jsonrpc: '2.0',
      id,
      method: 'tools/call',
      params: { name: 'definitely_not_a_tool', arguments: {} },
    });
    const msg = responses.find((m) => (m as any)?.id === id);
    expect(msg).toBeTruthy();
    const hasError =
      (msg as any)?.error !== undefined ||
      (msg as any)?.result?.isError === true ||
      (msg as any)?.result?.error !== undefined;
    expect(hasError).toBe(true);
  });
});

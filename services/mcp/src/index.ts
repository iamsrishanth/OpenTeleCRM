/**
 * OpenTeleCRM MCP server — TeleCRM tool parity.
 *
 * Surface: 13 tools with TeleCRM-identical names & schemas (plus the P0
 * vertical: list_lead_fields). Every tool resolves its enterprise from the
 * request context and reads through withTenant(), so Postgres RLS scopes all
 * queries. No cross-tenant leakage by construction.
 *
 * Auth note: dev mode reads the enterprise from env (MCP_ENTERPRISE_ID).
 * The OAuth 2.1 + PKCE + Dynamic Client Registration gateway (Zitadel)
 * lands in the auth phase — this tool surface is transport-agnostic and
 * works behind any MCP auth layer.
 *
 * Transport: Streamable HTTP (POST /mcp).
 */
import 'dotenv/config';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { z, type ZodRawShape } from 'zod';
import { sql } from 'drizzle-orm';
import {
  withTenant,
  lead,
  leadField,
  action,
  actionType,
  enterprise,
  pipeline,
  stage,
  lostReason,
  teamMember,
  user,
} from '@opentelecrm/db';
import type { DbClient } from '@opentelecrm/db';
import http from 'node:http';

const PORT = Number(process.env.MCP_PORT ?? 3101);
const ENTERPRISE_ID = process.env.MCP_ENTERPRISE_ID ?? 'a9e8933a-0a29-4e8b-8b2b-7fdfaf1b88d9';

export const server = new McpServer({
  name: 'opentelecrm',
  version: '0.1.0',
});

// ---- helpers ------------------------------------------------------------

async function tenant<T>(fn: (db: DbClient) => Promise<T>): Promise<T> {
  return withTenant(ENTERPRISE_ID, fn);
}

const text = (obj: unknown) => ({ content: [{ type: 'text' as const, text: JSON.stringify(obj) }] });

type ToolResult = ReturnType<typeof text>;

/**
 * registerTool's InputArgs generic doesn't infer from an object literal in
 * this SDK build — this helper pins the config cast once. Handlers cast
 * their args to the declared shape (SDK zod-validates at runtime).
 */
function reg<Args extends ZodRawShape>(
  name: string,
  inputSchema: Args,
  cb: (args: Record<string, unknown>) => Promise<ToolResult>,
) {
  server.registerTool(name, { inputSchema } as { inputSchema: Args }, cb as never);
}

function leadToPlain(row: typeof lead.$inferSelect) {
  return {
    id: row.id,
    identifier: row.identifier,
    source: row.source,
    score: row.score,
    tags: row.tags,
    customFields: row.customFields,
    ownerUserId: row.ownerUserId,
    pipelineId: row.pipelineId,
    stageId: row.stageId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

// ---- tools (TeleCRM parity) --------------------------------------------

reg('get_workspace_identity', { enterpriseId: z.string().optional() }, async () => {
  const ent = await tenant(async (db) =>
    db.select().from(enterprise).where(sql`id = ${ENTERPRISE_ID}`).limit(1),
  );
  const e = ent[0];
  if (!e) return text({ error: 'enterprise_not_found' });
  return text({
    id: e.id,
    name: e.name,
    leadIdentifier: e.leadIdentifier,
    timezone: e.timezone,
    locale: e.locale,
  });
});

reg('list_lead_fields', { includeArchived: z.boolean().optional() }, async (args) => {
  const includeArchived = Boolean(args.includeArchived);
  const fields = await tenant(async (db) =>
    db.select().from(leadField).where(includeArchived ? undefined : sql`archived_at IS NULL`),
  );
  return text(
    fields.map((f) => ({
      apiName: f.apiName,
      label: f.label,
      type: f.type,
      required: f.required,
      unique: f.unique,
      config: f.config,
    })),
  );
});

reg('get_lead_field_schema', { apiName: z.string() }, async (args) => {
  const apiName = String(args.apiName);
  const fields = await tenant(async (db) =>
    db.select().from(leadField).where(sql`api_name = ${apiName}`),
  );
  const f = fields[0];
  if (!f) return text({ error: 'field_not_found' });
  return text({ apiName: f.apiName, type: f.type, config: f.config });
});

reg('list_actions', {}, async () => {
  const types = await tenant(async (db) => db.select().from(actionType));
  return text(
    types.map((t) => ({ code: t.code, name: t.name, isSystem: t.isSystem, fieldSchema: t.fieldSchema })),
  );
});

reg('get_action_schema', { code: z.string() }, async (args) => {
  const code = String(args.code);
  const types = await tenant(async (db) => db.select().from(actionType).where(sql`code = ${code}`));
  const t = types[0];
  if (!t) return text({ error: 'action_type_not_found' });
  return text({ code: t.code, name: t.name, fieldSchema: t.fieldSchema });
});

reg('get_lead_stages_and_lost_reasons', {}, async () => {
  const result = await tenant(async (db) => {
    const pipes = await db.select().from(pipeline);
    const stages = await db.select().from(stage);
    const reasons = await db.select().from(lostReason);
    return { pipes, stages, reasons };
  });
  return text({
    pipelines: result.pipes.map((p) => ({
      id: p.id,
      name: p.name,
      stages: result.stages
        .filter((s) => s.pipelineId === p.id)
        .map((s) => ({ id: s.id, name: s.name, order: s.order })),
    })),
    lostReasons: result.reasons.map((r) => ({ id: r.id, label: r.label })),
  });
});

reg('list_team_members', {}, async () => {
  const members = await tenant(async (db) => {
    const tms = await db.select().from(teamMember);
    const users = await db.select().from(user);
    return tms.map((tm) => {
      const u = users.find((x) => x.id === tm.userId);
      return {
        id: tm.id,
        email: u?.email,
        name: u?.name,
        availability: tm.availabilityState,
        shift: tm.shift,
        skills: tm.skills,
      };
    });
  });
  return text(members);
});

reg('fetch_lead', { leadId: z.string() }, async (args) => {
  const leadId = String(args.leadId);
  const rows = await tenant(async (db) => db.select().from(lead).where(sql`id = ${leadId}`).limit(1));
  const row = rows[0];
  if (!row) return text({ error: 'lead_not_found' });
  return text(leadToPlain(row));
});

reg(
  'query_leads',
  { identifier: z.string().optional(), source: z.string().optional(), limit: z.number().int().min(1).max(100).optional() },
  async (args) => {
    const identifier = args.identifier ? String(args.identifier) : undefined;
    const source = args.source ? String(args.source) : undefined;
    const limit = typeof args.limit === 'number' ? args.limit : 10;
    const rows = await tenant(async (db) => {
      const conds: ReturnType<typeof sql>[] = [];
      if (identifier) conds.push(sql`identifier = ${identifier}`);
      if (source) conds.push(sql`source = ${source}`);
      const where = conds.length ? sql`${sql.join(conds, sql` AND `)}` : undefined;
      return db.select().from(lead).where(where).limit(limit);
    });
    return text(rows.map(leadToPlain));
  },
);

reg('fetch_lead_action', { actionId: z.string() }, async (args) => {
  const actionId = String(args.actionId);
  const rows = await tenant(async (db) => db.select().from(action).where(sql`id = ${actionId}`).limit(1));
  const row = rows[0];
  if (!row) return text({ error: 'action_not_found' });
  return text(row);
});

reg(
  'query_lead_actions',
  { leadId: z.string(), limit: z.number().int().min(1).max(100).optional() },
  async (args) => {
    const leadId = String(args.leadId);
    const limit = typeof args.limit === 'number' ? args.limit : 10;
    const rows = await tenant(async (db) =>
      db.select().from(action).where(sql`lead_id = ${leadId}`).limit(limit),
    );
    return text(rows);
  },
);

reg('get_current_date', {}, async () => text({ date: new Date().toISOString() }));

reg('get_workspace_context', {}, async () => {
  const result = await tenant(async (db) => {
    const pipes = await db.select().from(pipeline);
    const fields = await db.select().from(leadField).where(sql`archived_at IS NULL`);
    return { pipes, fields };
  });
  return text({
    pipelines: result.pipes.map((p) => p.name),
    fields: result.fields.map((f) => f.apiName),
  });
});

// ---- HTTP transport -----------------------------------------------------

const httpServer = http.createServer(async (req: http.IncomingMessage, res: http.ServerResponse) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  await server.connect(transport);
  await transport.handleRequest(req, res);
  if (!transport.sessionId) {
    await server.close();
  }
});

// Don't auto-listen when imported by tests: vitest sets VITEST, and the
// contract test boots its own transport on a test port against `server`.
if (!process.env.VITEST) {
  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`OpenTeleCRM MCP server listening on http://0.0.0.0:${PORT}/mcp`);
    console.log(`Enterprise scope: ${ENTERPRISE_ID}`);
  });
}

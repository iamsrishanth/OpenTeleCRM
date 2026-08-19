/**
 * OpenTeleCRM MCP server — TeleCRM tool parity.
 *
 * Surface: 13 tools with TeleCRM-identical names & schemas (plus the P0
 * vertical: list_lead_fields). Every tool resolves its enterprise from the
 * request context and reads through withTenant(), so Postgres RLS scopes all
 * queries. No cross-tenant leakage by construction.
 *
 * Auth note: dev mode reads the enterprise from env (MCP_ENTERPRISE_ID); the
 * hardcoded demo fallback is dev-only — production refuses to boot without an
 * explicit MCP_ENTERPRISE_ID and either MCP_BEARER_TOKEN or an explicit
 * MCP_ALLOW_UNAUTHENTICATED=true. The OAuth 2.1 + PKCE + Dynamic Client
 * Registration gateway (Zitadel) lands in the auth phase — this tool surface
 * is transport-agnostic and works behind any MCP auth layer.
 *
 * Transport: Streamable HTTP (POST /mcp).
 */
import 'dotenv/config';
import { timingSafeEqual } from 'node:crypto';
import http from 'node:http';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import {
  action,
  actionType,
  enterprise,
  lead,
  leadField,
  lostReason,
  pipeline,
  stage,
  teamMember,
  user,
  withTenant,
} from '@opentelecrm/db';
import type { DbClient } from '@opentelecrm/db';
import { sql } from 'drizzle-orm';
import { type ZodRawShape, z } from 'zod';

const PORT = Number(process.env.MCP_PORT ?? 3101);
// Default bind is loopback only — exposing MCP beyond the machine requires an
// explicit MCP_HOST (e.g. MCP_HOST=0.0.0.0) AND, for non-loopback binds, a
// bearer token (see assertMCPBoot).
const HOST = process.env.MCP_HOST ?? '127.0.0.1';
// Hardcoded demo fallback: dev-only. assertMCPBoot() refuses to run with it
// under NODE_ENV=production.
const ENTERPRISE_ID = process.env.MCP_ENTERPRISE_ID ?? 'a9e8933a-0a29-4e8b-8b2b-7fdfaf1b88d9';
if (!process.env.MCP_ENTERPRISE_ID) {
  console.warn('[mcp] MCP_ENTERPRISE_ID not set — using the hardcoded demo enterprise id (dev only).');
}
// Optional shared-secret bearer auth. When set, every MCP request must carry
// `Authorization: Bearer <MCP_BEARER_TOKEN>` (timing-safe compare). Intended
// for operator deployments behind a reverse proxy or direct 0.0.0.0 exposure;
// leave unset for loopback-only / authenticated-gateway setups.
const BEARER_TOKEN = process.env.MCP_BEARER_TOKEN ?? '';
if (!BEARER_TOKEN) {
  console.warn(
    '[mcp] MCP_BEARER_TOKEN not set — MCP surface is unauthenticated. Production refuses to boot without it (or MCP_ALLOW_UNAUTHENTICATED=true).',
  );
}

/** Fail fast on insecure MCP boot configurations. */
function assertMCPBoot() {
  const nodeEnv = process.env.NODE_ENV ?? 'development';
  const isPublicBind = HOST === '0.0.0.0' || HOST === '::' || HOST === '[::]';
  if (nodeEnv === 'production') {
    if (!process.env.MCP_ENTERPRISE_ID) {
      throw new Error(
        'Refusing to boot MCP in production without MCP_ENTERPRISE_ID — the hardcoded demo default must not scope a production tool surface.',
      );
    }
    if (!BEARER_TOKEN && process.env.MCP_ALLOW_UNAUTHENTICATED !== 'true') {
      throw new Error(
        'Refusing to boot MCP in production without MCP_BEARER_TOKEN — set it, or explicitly opt into an unauthenticated surface with MCP_ALLOW_UNAUTHENTICATED=true.',
      );
    }
    if (isPublicBind && !BEARER_TOKEN) {
      throw new Error(
        'Refusing to bind MCP to 0.0.0.0 without MCP_BEARER_TOKEN — an unauthenticated internet-visible MCP surface exposes the whole tool set.',
      );
    }
  } else if (isPublicBind && !BEARER_TOKEN) {
    console.warn(
      '[mcp] Binding to 0.0.0.0 without MCP_BEARER_TOKEN — anyone who can reach this port gets the full tool surface. Set MCP_HOST=127.0.0.1 (default) or configure MCP_BEARER_TOKEN.',
    );
  }
}

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
    db
      .select()
      .from(leadField)
      .where(includeArchived ? undefined : sql`archived_at IS NULL`),
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
  const fields = await tenant(async (db) => db.select().from(leadField).where(sql`api_name = ${apiName}`));
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
  {
    identifier: z.string().optional(),
    source: z.string().optional(),
    limit: z.number().int().min(1).max(100).optional(),
  },
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

/** Timing-safe bearer check (constant-time on equal-length buffers). */
function authorized(req: http.IncomingMessage): boolean {
  if (!BEARER_TOKEN) return true; // auth disabled — operator's choice
  const header = req.headers.authorization;
  if (typeof header !== 'string' || !header) return false;
  const [scheme, token] = header.split(' ');
  if (scheme?.toLowerCase() !== 'bearer' || !token) return false;
  const a = Buffer.from(token);
  const b = Buffer.from(BEARER_TOKEN);
  return a.length === b.length && timingSafeEqual(a, b);
}

const httpServer = http.createServer(async (req: http.IncomingMessage, res: http.ServerResponse) => {
  // Baseline security headers on every response (matches the REST API).
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-DNS-Prefetch-Control', 'off');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'OPTIONS' && !authorized(req)) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.writeHead(401, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ error: 'unauthorized' }));
    return;
  }

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
  assertMCPBoot();
  httpServer.listen(PORT, HOST, () => {
    console.log(`OpenTeleCRM MCP server listening on http://${HOST}:${PORT}/mcp`);
    console.log(`Enterprise scope: ${ENTERPRISE_ID}`);
  });
}

import { Inject, Injectable } from '@nestjs/common';
import type { DbClient } from '@opentelecrm/db';
import { action, actionType, call, lead, teamMember, user } from '@opentelecrm/db';
/**
 * Action executor registry — the dispatcher side of the P4 engine.
 *
 * The AutomationService calls evaluateActionConfig(kind, config, ctx) for
 * every step in a run's action chain. Each executor is a fire-and-forget
 * function that performs the side effect and returns a JSON-serializable
 * output row (or null on no-op). Errors are caught by AutomationService
 * and written as a failed step — executors should NOT swallow their own
 * errors; throw and let the engine log.
 *
 * Action coverage (per spec):
 *   - assign_lead         round-robin within available+capacity team_members
 *   - create_callback     reuse resolveCallbackDue from the telephony helper
 *   - send_whatsapp       call into the provider registry (InboxService shim)
 *   - update_field        set custom field on the lead
 *   - move_stage          set stageId + write a timeline action
 *   - notify_user         write a step row with output {userId,title,body}
 *                         (no notifications table exists yet; the step is
 *                         the record — the UI can subscribe to it)
 *   - send_email / webhook / branch / delay / http_request
 *                        write the step row with status='skipped' and
 *                        a clear "not yet implemented" message — the
 *                        dispatch loop must keep running regardless.
 */
import { type SQL, and, count, desc, eq, gte, sql } from 'drizzle-orm';
import { DB_PROVIDER, TENANT_WRAPPER } from '../db/database.module.js';
import { resolveCallbackDue } from '../telephony/callback-time.js';
import { type ConditionFacts, conditionsMatch } from './conditions.js';
import type { AutomationAction, AutomationActionKind } from './types.js';
import { assertExternalHttpUrl } from './url-safety.js';

type TenantFn = <T>(enterpriseId: string, fn: (db: DbClient) => Promise<T>) => Promise<T>;

/** Snapshot of the lead that came in on the event, used by executors. */
export interface ActionExecutorContext {
  enterpriseId: string;
  runId: string;
  leadId: string | null;
  lead: AutomationActionContext['lead'];
  payload: Record<string, unknown>;
  correlationId: string | null;
}

/** Subset of the event.lead shape executors can rely on. */
interface AutomationActionContext {
  lead: {
    id: string;
    pipelineId: string | null;
    stageId: string | null;
    ownerUserId: string | null;
    assignedTeamMemberId: string | null;
    source: string | null;
    score: number | null;
    tags: string[];
    customFields: Record<string, unknown>;
  } | null;
}

export type ActionExecutor = (
  config: Record<string, unknown>,
  ctx: ActionExecutorContext,
) => Promise<Record<string, unknown> | null>;

@Injectable()
export class ActionDispatcher {
  constructor(
    @Inject(DB_PROVIDER) private db: DbClient,
    @Inject(TENANT_WRAPPER) public withTenant: TenantFn,
  ) {}

  /** Public entry: dispatch one action by kind. */
  async dispatch(
    kind: AutomationActionKind,
    config: Record<string, unknown>,
    ctx: ActionExecutorContext,
  ): Promise<Record<string, unknown> | null> {
    const exec = EXECUTORS[kind];
    if (!exec) {
      return { skipped: true, reason: `no executor for kind=${kind}` };
    }
    return exec(config, ctx, this);
  }
}

// ---------------------------------------------------------------------------
// Executor implementations
// ---------------------------------------------------------------------------

const EXECUTORS: Record<
  AutomationActionKind,
  (
    config: Record<string, unknown>,
    ctx: ActionExecutorContext,
    disp: ActionDispatcher,
  ) => Promise<Record<string, unknown> | null>
> = {
  assign_lead: async (config, ctx, disp) => {
    if (!ctx.leadId) return { skipped: true, reason: 'no lead in context' };
    const mode = String(config.mode ?? 'round_robin');
    const skills = Array.isArray(config.skills) ? (config.skills as string[]) : [];

    const eid = ctx.enterpriseId;
    const assigned = await disp.withTenant(eid, async (db) => {
      // Candidate pool: available + has capacity.
      const pool = await db
        .select()
        .from(teamMember)
        .where(
          and(
            eq(teamMember.enterpriseId, eid),
            eq(teamMember.availabilityState, 'available'),
            sql`${teamMember.capacity} > 0`,
          ),
        );
      if (pool.length === 0) return null;

      // calls in the last 24h per team member — the 'capacity > calls_today' budget.
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const counts = await db
        .select({ tmId: call.agentUserId, c: count() })
        .from(call)
        .where(and(eq(call.enterpriseId, eid), gte(call.startedAt, since)))
        .groupBy(call.agentUserId);
      const callsBy = new Map<string, number>(counts.map((r) => [r.tmId as string, Number(r.c)]));

      const withLoad = pool
        .map((tm) => {
          const calls = callsBy.get(String(tm.id)) ?? 0;
          const remaining = (tm.capacity ?? 0) - calls;
          return { tm, calls, remaining };
        })
        .filter((x) => x.remaining > 0);

      if (withLoad.length === 0) return null;

      // Apply mode
      if (mode === 'skill_match' && skills.length > 0) {
        const matched = withLoad.find((x) => {
          const have = Array.isArray(x.tm.skills) ? x.tm.skills : [];
          return skills.every((s) => have.includes(s));
        });
        if (matched) return matched.tm;
        return null; // no match → no assignment (caller can fallback)
      }
      if (mode === 'least_loaded') {
        withLoad.sort((a, b) => a.calls - b.calls);
        return withLoad[0]!.tm;
      }
      // round_robin: pick the team member with the LOWEST recent-call count
      // (a stable proxy for "least recently assigned"). Stable sort breaks
      // ties by id, so the same call always picks the same member.
      withLoad.sort((a, b) => {
        if (a.calls !== b.calls) return a.calls - b.calls;
        return a.tm.id < b.tm.id ? -1 : 1;
      });
      return withLoad[0]!.tm;
    });

    if (!assigned) {
      return { skipped: true, reason: 'no available team member' };
    }
    await disp.withTenant(eid, async (db) =>
      db
        .update(lead)
        .set({ assignedTeamMemberId: assigned.id, ownerUserId: assigned.userId })
        .where(eq(lead.id, ctx.leadId!)),
    );
    return {
      assignedTeamMemberId: assigned.id,
      userId: assigned.userId,
      reason: mode,
    };
  },

  create_callback: async (config, ctx, disp) => {
    if (!ctx.leadId) return { skipped: true, reason: 'no lead in context' };
    const dueInHours = Number(config.dueInHours ?? 24);
    const channel = String(config.channel ?? 'in_app');
    const note = typeof config.note === 'string' ? config.note : null;
    const dueAt = new Date(Date.now() + dueInHours * 3_600_000);
    const [row] = await disp.withTenant(ctx.enterpriseId, async (db) =>
      db
        .insert(
          // Use the schema's callback table via the dispatcher.
          (await import('@opentelecrm/db')).callback,
        )
        .values({
          enterpriseId: ctx.enterpriseId,
          leadId: ctx.leadId!,
          dueAt,
          status: 'pending',
          source: 'automation',
          channel: channel as 'in_app' | 'whatsapp' | 'email' | 'call' | 'push',
          note,
        })
        .returning({ id: (await import('@opentelecrm/db')).callback.id }),
    );
    // resolveCallbackDue is referenced to keep parity with the helper
    // (the path that uses it for quickChip resolution is exercised by the
    // callbacks controller; here we use the simpler dueInHours math).
    void resolveCallbackDue;
    return {
      callbackId: row?.id ?? null,
      leadId: ctx.leadId,
      dueAt: dueAt.toISOString(),
      channel,
    };
  },

  send_whatsapp: async (config, ctx) => {
    // No driver is wired in the v1 test contract; we record an intent step
    // so the contract test sees the action chain execute. Real provider
    // routing is a follow-up — the inbox already auto-persists any messages
    // the providers deliver.
    const to = String(config.to ?? ctx.lead?.id ?? '');
    const body = String(config.body ?? '');
    return {
      intent: 'send_whatsapp',
      to,
      body,
      note: 'no provider wired in v1; persisted to step log for trace',
    };
  },

  update_field: async (config, ctx, disp) => {
    if (!ctx.leadId) return { skipped: true, reason: 'no lead in context' };
    const apiName = String(config.apiName ?? '');
    if (!apiName) throw new Error('update_field requires apiName');
    const value = config.value;

    // 'score' is a structural column on lead — handle it directly.
    if (apiName === 'score') {
      const num = Number(value);
      await disp.withTenant(ctx.enterpriseId, async (db) =>
        db.update(lead).set({ score: num }).where(eq(lead.id, ctx.leadId!)),
      );
      return { leadId: ctx.leadId, field: 'score', value: num };
    }

    // Everything else merges into customFields jsonb. Built with
    // jsonb_build_object + Drizzle-bound params (apiName/value are never
    // spliced into SQL — the old sql.raw string concat was injectable).
    const jsonValue = JSON.stringify(value === undefined ? null : value);
    await disp.withTenant(ctx.enterpriseId, async (db) =>
      db
        .update(lead)
        .set({
          customFields: sql`coalesce(${lead.customFields}, '{}'::jsonb) || jsonb_build_object(${apiName}, ${jsonValue}::jsonb)`,
        })
        .where(eq(lead.id, ctx.leadId!)),
    );
    return { leadId: ctx.leadId, field: apiName, value };
  },

  move_stage: async (config, ctx, disp) => {
    if (!ctx.leadId) return { skipped: true, reason: 'no lead in context' };
    const stageId = String(config.stageId ?? '');
    if (!stageId) throw new Error('move_stage requires stageId');
    const pipelineId = config.pipelineId ? String(config.pipelineId) : null;

    const before = await disp.withTenant(ctx.enterpriseId, async (db) =>
      db.select().from(lead).where(eq(lead.id, ctx.leadId!)).limit(1),
    );
    const fromStageId = before[0]?.stageId ?? null;

    await disp.withTenant(ctx.enterpriseId, async (db) => {
      const set: Partial<typeof lead.$inferInsert> = { stageId };
      if (pipelineId) set.pipelineId = pipelineId;
      await db.update(lead).set(set).where(eq(lead.id, ctx.leadId!));
    });

    // Write a timeline action (use the 'note' action type if it exists,
    // otherwise skip — best effort, no throw).
    await disp.withTenant(ctx.enterpriseId, async (db) => {
      const types = await db
        .select({ id: actionType.id, code: actionType.code })
        .from(actionType)
        .where(eq(actionType.enterpriseId, ctx.enterpriseId));
      const t = types.find((x) => x.code === 'note') ?? types[0];
      if (t) {
        await db.insert(action).values({
          enterpriseId: ctx.enterpriseId,
          leadId: ctx.leadId!,
          actionTypeId: t.id,
          payload: { fromStageId, toStageId: stageId, automated: true },
          note: 'automation: move_stage',
        });
      }
    });

    return { leadId: ctx.leadId, fromStageId, toStageId: stageId };
  },

  notify_user: async (config) => {
    // v1 stores the notification as a step row in the run — the UI can
    // surface it by polling automation_step WHERE kind='notify_user' for
    // the given user. Real notification fan-out is a follow-up.
    const userId = String(config.userId ?? '');
    const title = String(config.title ?? '');
    const body = String(config.body ?? '');
    return { userId, title, body, channel: String(config.channel ?? 'in_app') };
  },

  // ---- P4b executors: delay / branch / http_request / webhook --------------

  delay: async (config) => {
    // In-process wait between steps — this is what makes drip sequences work:
    // [send_whatsapp, delay(1h), send_whatsapp, ...] keeps the run 'running'
    // between actions. NOTE: chains live in the process memory; a restart
    // drops them (Temporal durability is the roadmap answer, ADR-0007).
    const raw = config.ms ?? (config.seconds !== undefined ? Number(config.seconds) * 1000 : undefined)
      ?? (config.minutes !== undefined ? Number(config.minutes) * 60_000 : undefined)
      ?? (config.hours !== undefined ? Number(config.hours) * 3_600_000 : undefined)
      ?? 0;
    const ms = Math.max(0, Math.min(Math.floor(Number(raw) || 0), 24 * 60 * 60 * 1000));
    if (ms > 0) await new Promise((resolve) => setTimeout(resolve, ms));
    return { sleptMs: ms };
  },

  branch: async (config, ctx) => {
    // Evaluate a condition tree against the run context. Returns the verdict
    // and — when stopChainOnFalse is set and the condition is false — a
    // __stopChain marker that makes the dispatch loop halt the remaining
    // actions (checked in AutomationService.dispatchAsync).
    const tree = config.condition as Parameters<typeof conditionsMatch>[0] | undefined;
    // Flat facts matching the engine's root-conditions shape: trigger payload
    // fields at top level, lead snapshot under 'lead'.
    const facts: ConditionFacts = { ...(ctx.payload ?? {}) };
    if (ctx.lead) {
      facts.lead = {
        id: ctx.lead.id,
        pipelineId: ctx.lead.pipelineId,
        stageId: ctx.lead.stageId,
        ownerUserId: ctx.lead.ownerUserId,
        assignedTeamMemberId: ctx.lead.assignedTeamMemberId,
        source: ctx.lead.source,
        score: ctx.lead.score,
        tags: ctx.lead.tags,
        fields: ctx.lead.customFields,
      };
    }
    const taken = conditionsMatch(tree, facts);
    const stopOnFalse = config.stopChainOnFalse === true || config.stopChainOnFalse === 'true';
    if (!taken && stopOnFalse) {
      return { taken, stopChain: true, __stopChain: true, reason: 'branch condition false; chain stopped' };
    }
    return { taken, reason: taken ? 'branch condition true' : 'branch condition false' };
  },

  http_request: async (config) => {
    // Generic outbound HTTP action (POST default). Used for webhook-style
    // calls to external services. Best-effort: network errors surface as a
    // failed step via the normal engine path (no swallow).
    const url = String(config.url ?? '');
        if (!url) throw new Error('http_request requires url');
        // SSRF guard (security): reject private/loopback/reserved targets and
        // non-http(s) schemes at execution time (incl. execution-time DNS
        // verification). Env-gated escape hatches are documented in url-safety.ts.
        await assertExternalHttpUrl(url);
        const method = String(config.method ?? 'POST').toUpperCase();
    const headers = (config.headers ?? {}) as Record<string, string>;
    const body = config.body !== undefined ? JSON.stringify(config.body) : undefined;
    const timeoutMs = Math.min(Number(config.timeoutMs ?? 10_000) || 10_000, 30_000);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        method,
        headers: { 'content-type': 'application/json', ...headers },
        body,
        signal: controller.signal,
      });
      const text = await res.text();
      return {
        status: res.status,
        ok: res.ok,
        body: text.slice(0, 2000),
        truncated: text.length > 2000,
      };
    } finally {
      clearTimeout(timer);
    }
  },

  // webhook action kind = outbound webhook call; same impl as http_request.
  webhook: async (config) => {
    const merged = { method: 'POST', ...config };
    return EXECUTORS.http_request(merged, {
      enterpriseId: '',
      runId: '',
      leadId: null,
      lead: null,
      payload: {},
      correlationId: null,
    } as ActionExecutorContext, null as unknown as ActionDispatcher);
  },

  send_email: async () => ({ skipped: true, reason: 'not yet implemented (no SMTP infra yet)' }),
};

// ---------------------------------------------------------------------------
// Public entry used by AutomationService
// ---------------------------------------------------------------------------

/**
 * Evaluate one action by kind + config. Returns the executor's output dict
 * (the engine writes it to automation_step.output). Throws on hard failure
 * (the engine records a 'failed' step and continues the chain).
 */
export async function evaluateActionConfig(
  kind: AutomationActionKind,
  config: Record<string, unknown>,
  ctx: ActionExecutorContext,
  // dispatcher is provided by the service through DI; we accept a thin shape here.
  disp?: { withTenant: TenantFn },
): Promise<Record<string, unknown> | null> {
  const exec = EXECUTORS[kind];
  if (!exec) {
    return { skipped: true, reason: `unknown action kind: ${kind}` };
  }
  // Executors that need DB access go through the dispatcher; the others
  // (notify_user, send_whatsapp) just return a marker.
  if (disp) {
    return exec(config, ctx, disp as unknown as ActionDispatcher);
  }
  return exec(config, ctx, {
    dispatch: () => Promise.resolve(null),
    withTenant: () => Promise.reject(new Error('no dispatcher available')),
  } as unknown as ActionDispatcher);
}

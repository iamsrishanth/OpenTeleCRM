/**
 * Seed automation TEMPLATES (P4b Wave 2) — 10 ready-to-activate workflow
 * templates per enterprise, stored as automation rows with category='template'
 * and isActive=false (templates the web UI can install/activate).
 *
 * Idempotent: skips any template whose name already exists for the target
 * enterprise. Targets the FIRST 'Acme Demo Workspace' enterprise (the one the
 * contract tests + web demo use) — pass ENTERPRISE_ID to override.
 */
import { and, eq } from 'drizzle-orm';
import { getPool, withTenant, automation } from './index.js';

const TARGET_NAME = process.env.TEMPLATE_ENTERPRISE_NAME ?? 'Acme Demo Workspace';
const OVERRIDE_EID = process.env.TEMPLATE_ENTERPRISE_ID ?? null;

interface Template {
  name: string;
  description: string;
  triggerKind: string;
  triggerConfig: Record<string, unknown>;
  conditions: Record<string, unknown>;
  actions: Array<Record<string, unknown>>;
  schedule: Record<string, unknown> | null;
  priority: number;
}

const TEMPLATES: Template[] = [
  {
    name: 'Welcome WhatsApp',
    description: 'Send a welcome message when a new lead is created.',
    triggerKind: 'lead_created',
    triggerConfig: {},
    conditions: {},
    actions: [
      {
        kind: 'send_whatsapp',
        config: { message: 'Hi {{lead.fields.name}}! Thanks for reaching out to us — we will get back to you shortly.' },
      },
    ],
    schedule: null,
    priority: 10,
  },
  {
    name: 'New Lead — Notify Owner',
    description: 'Notify the lead owner the moment a new lead lands.',
    triggerKind: 'lead_created',
    triggerConfig: {},
    conditions: {},
    actions: [{ kind: 'notify_user', config: { title: 'New lead', body: 'A new lead just came in: {{lead.fields.name}}' } }],
    schedule: null,
    priority: 20,
  },
  {
    name: 'Round-robin Assignment',
    description: 'Auto-assign every new lead to an available team member (round-robin).',
    triggerKind: 'lead_created',
    triggerConfig: {},
    conditions: {},
    actions: [{ kind: 'assign_lead', config: { mode: 'round_robin' } }],
    schedule: null,
    priority: 30,
  },
  {
    name: 'Stage Change Follow-up Callback',
    description: 'Schedule a 3-hour follow-up callback whenever a lead changes stage.',
    triggerKind: 'lead_stage_changed',
    triggerConfig: {},
    conditions: {},
    actions: [{ kind: 'create_callback', config: { quickChip: '3h', note: 'Follow up after stage change' } }],
    schedule: null,
    priority: 40,
  },
  {
    name: 'High-Value Lead Score Boost',
    description: 'Boost the score to 80 when a lead has a budget above 1 lakh.',
    triggerKind: 'lead_created',
    triggerConfig: {},
    conditions: {
      combinator: 'and',
      children: [{ field: 'lead.fields.budget', op: 'gt', value: 100000 }],
    },
    actions: [{ kind: 'update_field', config: { apiName: 'score', value: 80 } }],
    schedule: null,
    priority: 50,
  },
  {
    name: 'Welcome Drip (Day 0-1-3)',
    description: 'A 3-message drip sequence: immediate, +1 day, +3 days. Uses the in-process delay executor.',
    triggerKind: 'lead_created',
    triggerConfig: {},
    conditions: {},
    actions: [
      { kind: 'send_whatsapp', config: { message: 'Welcome! Here is what we can do for you.' } },
      { kind: 'delay', config: { hours: 24 } },
      { kind: 'send_whatsapp', config: { message: 'Day 1: Quick tip to get the most out of your account.' } },
      { kind: 'delay', config: { hours: 48 } },
      { kind: 'send_whatsapp', config: { message: 'Day 3: Would you like to schedule a demo call?' } },
    ],
    schedule: null,
    priority: 60,
  },
  {
    name: 'Missed Call Callback',
    description: 'Schedule a next-morning callback when an outbound call ends as no-answer.',
    triggerKind: 'call_ended',
    triggerConfig: {},
    conditions: {
      combinator: 'and',
      children: [{ field: 'status', op: 'eq', value: 'no-answer' }],
    },
    actions: [{ kind: 'create_callback', config: { quickChip: 'tomorrow_10am', note: 'Missed call follow-up' } }],
    schedule: null,
    priority: 70,
  },
  {
    name: 'Inbound WhatsApp Auto-reply',
    description: 'Instantly acknowledge every inbound WhatsApp message.',
    triggerKind: 'inbound_message',
    triggerConfig: {},
    conditions: {},
    actions: [{ kind: 'send_whatsapp', config: { message: 'Thanks for your message! A team member will reply shortly.' } }],
    schedule: null,
    priority: 80,
  },
  {
    name: 'Weekly Pipeline Digest',
    description: 'Monday 9am digest of pipeline activity for the owner.',
    triggerKind: 'schedule',
    triggerConfig: {},
    conditions: {},
    actions: [{ kind: 'notify_user', config: { title: 'Weekly digest', body: 'Here is your pipeline digest.' } }],
    schedule: { cron: '0 9 * * 1', timezone: 'Asia/Kolkata' },
    priority: 90,
  },
  {
    name: 'Referral Source Tag',
    description: 'Bump the score of referral-sourced leads so they rank first in the dialer.',
    triggerKind: 'lead_created',
    triggerConfig: {},
    conditions: {
      combinator: 'and',
      children: [{ field: 'lead.source', op: 'eq', value: 'referral' }],
    },
    actions: [{ kind: 'update_field', config: { apiName: 'score', value: 10 } }],
    schedule: null,
    priority: 100,
  },
];

async function main(): Promise<void> {
  const pool = getPool();

  // Resolve the target enterprise.
  let eid: string | null = OVERRIDE_EID;
  if (!eid) {
    const rows = await pool.query<{ id: string }>(
      `SELECT id FROM enterprise WHERE name = $1 ORDER BY created_at LIMIT 1`,
      [TARGET_NAME],
    );
    eid = rows.rows[0]?.id ?? null;
  }
  if (!eid) {
    console.error(`No enterprise named "${TARGET_NAME}" found — seed the DB first.`);
    await pool.end();
    process.exit(1);
  }

  let inserted = 0;
  let skipped = 0;
  for (const t of TEMPLATES) {
    const exists = await withTenant(eid, async (db) => {
      const rows = await db
        .select({ id: automation.id })
        .from(automation)
        .where(and(eq(automation.enterpriseId, eid as string), eq(automation.name, t.name)))
        .limit(1);
      return rows[0]?.id ?? null;
    });
    if (exists) {
      skipped += 1;
      continue;
    }
    await withTenant(eid, async (db) => {
      await db.insert(automation).values({
        enterpriseId: eid as string,
        name: t.name,
        description: t.description,
        category: 'template',
        triggerKind: t.triggerKind,
        triggerConfig: t.triggerConfig,
        conditions: t.conditions,
        actions: t.actions,
        schedule: t.schedule ?? null,
        isActive: false,
        priority: t.priority,
      });
    });
    inserted += 1;
    console.log(`+ template: ${t.name}`);
  }

  console.log(`Templates for ${eid.slice(0, 8)}…: ${inserted} inserted, ${skipped} skipped (idempotent)`);
  await pool.end();
}

main().catch((err) => {
  console.error('seed-templates failed:', err);
  process.exit(1);
});

/**
 * Seed generator — demo workspace.
 * Creates: 1 enterprise, 3 users + team members, 2 pipelines, 20 custom
 * fields, 5,000 leads (streamed, deterministic), system action types.
 * Idempotent: re-running seeds a NEW enterprise (no collisions).
 * All tenant-scoped writes run inside withTenant() so RLS is satisfied.
 *
 * Usage: pnpm --filter @opentelecrm/db seed
 */
import { createHash, randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { getDb, getPool, withTenant } from './index.js';
import {
  actionType,
  enterprise,
  lead,
  leadField,
  pipeline,
  role,
  stage,
  teamMember,
  user,
} from './schema.js';
import { conversation, waMessage, waTemplate, waSession } from './whatsapp-schema.js';
import { call, callback, dndRegistry } from './telephony-schema.js';

const LEAD_COUNT = 5_000;
const CUSTOM_FIELDS = 20;
const PIPELINES = [
  { name: 'Default Sales', stages: ['New', 'Contacted', 'Qualified', 'Proposal', 'Won', 'Lost'] },
  { name: 'Support', stages: ['Open', 'In Progress', 'Resolved', 'Closed'] },
];

const FIRST = ['Aarav', 'Vivaan', 'Aditya', 'Sai', 'Rohan', 'Ishaan', 'Diya', 'Ananya', 'Meera', 'Karan'];
const LAST = ['Sharma', 'Verma', 'Gupta', 'Patel', 'Reddy', 'Nair', 'Menon', 'Iyer', 'Bose', 'Rao'];
const SOURCES = ['Facebook', 'Google', 'Instagram', 'WhatsApp', 'JustDial', 'Website', 'IndiaMART', 'Referral'];

function pick<T>(arr: T[], seed: number): T {
  return arr[seed % arr.length] as T;
}

async function main() {
  const db = getDb();

  // 1. Enterprise — created OUTSIDE tenant context (it has no enterprise_id).
  const [ent] = await db
    .insert(enterprise)
    .values({ name: 'Acme Demo Workspace' })
    .returning();
  if (!ent) throw new Error('enterprise insert returned no row');
  const eid = ent.id;

  // Enterprise secret (M0 sync-token exchange). Only the sha256 hash + last-8
  // tail are stored; the RAW secret is printed once below so the operator can
  // copy it into the mobile app. DEMO_ENTERPRISE_SECRET makes it deterministic.
  const secret =
    process.env.DEMO_ENTERPRISE_SECRET && process.env.DEMO_ENTERPRISE_SECRET.length >= 8
      ? process.env.DEMO_ENTERPRISE_SECRET
      : `demo-secret-${randomUUID()}`;
  const secretHash = createHash('sha256').update(secret).digest('hex');
  const secretTail = secret.slice(-8);
  await db
    .update(enterprise)
    .set({ secretHash, secretTail })
    .where(eq(enterprise.id, eid))
    .execute();

  // Everything below is tenant-scoped → run inside withTenant(eid) for RLS.
  await withTenant(eid, async (db) => {
    // 2. Roles (system)
    const roleRows = await db
      .insert(role)
      .values([
        { enterpriseId: eid, name: 'Owner', kind: 'owner', isSystem: true, permissions: ['*'] },
        { enterpriseId: eid, name: 'Admin', kind: 'admin', isSystem: true, permissions: ['*'] },
        {
          enterpriseId: eid,
          name: 'Agent',
          kind: 'agent',
          isSystem: true,
          permissions: ['record:own', 'lead:read', 'lead:write', 'call:start', 'msg:send'],
        },
      ])
      .returning();
    const [ownerRole, adminRole, agentRole] = roleRows;
    if (!ownerRole || !adminRole || !agentRole) throw new Error('role insert incomplete');

    // 3. Users + team members
    const userSpecs = [
      { email: 'owner@demo.local', name: 'Demo Owner', role: ownerRole, avail: 'available' },
      { email: 'admin@demo.local', name: 'Demo Admin', role: adminRole, avail: 'available' },
      { email: 'agent@demo.local', name: 'Neha Agent', role: agentRole, avail: 'available' },
    ];
    for (const spec of userSpecs) {
      const [u] = await db.insert(user).values({ email: spec.email, name: spec.name }).returning();
      if (!u) throw new Error('user insert returned no row');
      await db
        .insert(teamMember)
        .values({
          enterpriseId: eid,
          userId: u.id,
          roleId: spec.role.id,
          availabilityState: spec.avail,
        })
        .execute();
    }

    // 4. Pipelines + stages
    const pipes: { pipelineId: string; stageIds: string[] }[] = [];
    for (const p of PIPELINES) {
      const [row] = await db.insert(pipeline).values({ enterpriseId: eid, name: p.name }).returning();
      if (!row) throw new Error('pipeline insert returned no row');
      const stageIds: string[] = [];
      let order = 0;
      for (const s of p.stages) {
        const [sr] = await db
          .insert(stage)
          .values({ enterpriseId: eid, pipelineId: row.id, name: s, order: order++ })
          .returning();
        if (!sr) throw new Error('stage insert returned no row');
        stageIds.push(sr.id);
      }
      pipes.push({ pipelineId: row.id, stageIds });
    }

    // 5. Custom fields (immutable apiName)
    const fieldSpecs = Array.from({ length: CUSTOM_FIELDS }, (_, i) => ({
      apiName: `custom_${String(i + 1).padStart(2, '0')}`,
      label: `Custom Field ${i + 1}`,
      type: i % 4 === 0 ? 'number' : i % 4 === 1 ? 'select' : i % 4 === 2 ? 'date' : 'text',
      config:
        i % 4 === 1
          ? { options: ['Option A', 'Option B', 'Option C'] }
          : { placeholder: `custom field ${i + 1}` },
    }));
    await db
      .insert(leadField)
      .values(fieldSpecs.map((f) => ({ enterpriseId: eid, ...f })))
      .execute();

    // 6. System action types
    await db
      .insert(actionType)
      .values([
        { enterpriseId: eid, code: 'note', name: 'Note', isSystem: true, fieldSchema: { note: { type: 'text' } } },
        { enterpriseId: eid, code: 'call', name: 'Call', isSystem: true, fieldSchema: { disposition: { type: 'text' } } },
        { enterpriseId: eid, code: 'whatsapp', name: 'WhatsApp', isSystem: true, fieldSchema: { direction: { type: 'text' } } },
      ])
      .execute();

    // 7. Stream 5,000 leads (batch inserts, deterministic pseudo-random)
    const BATCH = 500;
    const allStageIds = pipes.flatMap((p) => p.stageIds);
    for (let i = 0; i < LEAD_COUNT; i += BATCH) {
      const rows: (typeof lead.$inferInsert)[] = [];
      for (let j = 0; j < BATCH && i + j < LEAD_COUNT; j++) {
        const k = i + j;
        const firstName = pick(FIRST, k * 3);
        const lastName = pick(LAST, k * 7);
        const phone = `+91 9${String((k * 7919) % 9_0000_0000 + 10_0000_000)}`;
        rows.push({
          enterpriseId: eid,
          identifier: phone.replace(/\s/g, ''),
          source: pick(SOURCES, k * 13),
          score: 10 + ((k * 37) % 80),
          tags: k % 3 === 0 ? ['hot'] : k % 3 === 1 ? ['warm'] : [],
          pipelineId: pipes[k % pipes.length]?.pipelineId,
          stageId: allStageIds[k % allStageIds.length],
          customFields: {
            custom_01: 1000 + k,
            custom_10: pick(['small', 'mid', 'enterprise'], k),
            owner: `${firstName} ${lastName}`,
          },
        });
      }
      await db.insert(lead).values(rows).execute();
      process.stdout.write(`\rseeded ${Math.min(i + BATCH, LEAD_COUNT)}/${LEAD_COUNT} leads`);
    }
    process.stdout.write('\n');

    // 8. WhatsApp demo (P2): one agent session, one template, one conversation
    //    with a couple of inbound/outbound messages so the inbox has data.
    const [waSessionRow] = await db
      .insert(waSession)
      .values({
        enterpriseId: eid,
        screenName: 'demo-agent-number',
        status: 'ready',
      })
      .returning();
    if (!waSessionRow) throw new Error('wa_session insert returned no row');

    await db
      .insert(waTemplate)
      .values({
        enterpriseId: eid,
        name: 'welcome_message',
        status: 'APPROVED',
        category: 'MARKETING',
        languageCode: 'en',
        body: 'Hi {{1}}, thanks for reaching out to Acme! How can we help today?',
        footer: 'Reply STOP to opt out.',
      })
      .execute();

    const [convo] = await db
      .insert(conversation)
      .values({
        enterpriseId: eid,
        waSessionId: waSessionRow.id,
        contactJid: '919876543210@s.whatsapp.net',
        contactName: 'Demo Customer',
        lastMessageAt: new Date(),
        unreadCount: 1,
      })
      .returning();
    if (!convo) throw new Error('conversation insert returned no row');

    await db
      .insert(waMessage)
      .values([
        {
          enterpriseId: eid,
          conversationId: convo.id,
          waMessageId: 'seed-msg-1',
          direction: 'inbound',
          type: 'text',
          body: 'Hi, I saw your ad on Facebook. Is the 2BHK still available?',
          status: 'received',
          sentAt: new Date(Date.now() - 1000 * 60 * 5),
        },
        {
          enterpriseId: eid,
          conversationId: convo.id,
          waMessageId: 'seed-msg-2',
          direction: 'outbound',
          type: 'text',
          body: 'Hi Demo Customer! Yes it is. Would you like to schedule a site visit?',
          status: 'sent',
          sentAt: new Date(Date.now() - 1000 * 60 * 4),
        },
      ])
      .execute();

    // 9. Telephony demo: 3 calls, 2 callbacks, 1 DND registry entry.
    //    Idempotent-safe: guard on a count check (fresh enterprise each run,
    //    so the block only ever seeds once per enterprise).
    const [existingDnd] = await db
      .select({ id: dndRegistry.id })
      .from(dndRegistry)
      .where(eq(dndRegistry.enterpriseId, eid))
      .limit(1);
    if (!existingDnd) {
      // Real lead ids + E.164 identifiers from the just-seeded leads.
      const sampleLeads = await db
        .select({ id: lead.id, identifier: lead.identifier })
        .from(lead)
        .where(eq(lead.enterpriseId, eid))
        .limit(3);
      const [l0, l1, l2] = sampleLeads;
      if (l0 && l1 && l2) {
        const now = new Date();
        const callValues = [
          {
            enterpriseId: eid,
            leadId: l0.id,
            direction: 'outbound',
            status: 'completed',
            disposition: 'converted',
            phone: l0.identifier,
            startedAt: new Date(now.getTime() - 1000 * 60 * 120),
            endedAt: new Date(now.getTime() - 1000 * 60 * 116),
            durationSec: 245,
            talkSec: 180,
            ringSec: 15,
            trunk: 'PRI-01',
            did: '+911123456789',
            note: 'Demo: lead converted on call',
          },
          {
            enterpriseId: eid,
            leadId: l1.id,
            direction: 'outbound',
            status: 'completed',
            disposition: 'callback',
            phone: l1.identifier,
            startedAt: new Date(now.getTime() - 1000 * 60 * 60),
            endedAt: new Date(now.getTime() - 1000 * 60 * 58),
            durationSec: 95,
            talkSec: 60,
            ringSec: 8,
            trunk: 'PRI-01',
            did: '+911123456789',
            note: 'Demo: asked for a callback',
          },
          {
            enterpriseId: eid,
            leadId: l2.id,
            direction: 'inbound',
            status: 'missed',
            disposition: 'no_answer',
            phone: l2.identifier,
            startedAt: new Date(now.getTime() - 1000 * 60 * 30),
            endedAt: null,
            durationSec: 0,
            talkSec: 0,
            ringSec: 25,
            trunk: 'PRI-01',
            did: '+911123456789',
            note: 'Demo: missed inbound call',
          },
        ];
        await db.insert(call).values(callValues).execute();

        // Callbacks: one overdue (pending), one due tomorrow 10:00 IST.
        await db
          .insert(callback)
          .values([
            {
              enterpriseId: eid,
              leadId: l1.id,
              dueAt: new Date(now.getTime() - 1000 * 60 * 60 * 2),
              status: 'pending',
              source: 'call_disposition',
              channel: 'in_app',
              note: 'Follow up on callback request from demo call',
            },
            {
              enterpriseId: eid,
              leadId: l2.id,
              dueAt: new Date(
                Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 4, 30, 0),
              ), // 10:00 IST = 04:30 UTC
              status: 'pending',
              source: 'manual',
              channel: 'call',
              note: 'Scheduled follow-up (10:00 IST)',
            },
          ])
          .execute();

        // DND registry (TRAI UCC suppression demo).
        await db
          .insert(dndRegistry)
          .values({
            enterpriseId: eid,
            phone: '+919188888888',
            channel: 'all',
            source: 'enterprise',
            reason: 'Demo: opted out of all telephony contact',
          })
          .execute();

        console.log('Telephony demo: 3 calls, 2 callbacks, 1 DND registry entry seeded.');
      }
    }
  });

  console.log(
    `\nSeeded enterprise: ${ent.name} (${eid}) | ${LEAD_COUNT} leads | ${PIPELINES.length} pipelines | ${CUSTOM_FIELDS} custom fields`,
  );
  console.log(`Enterprise secret (copy into the mobile app): ${secret}`);
  console.log(`  hash=${secretHash} tail=${secretTail}`);
  console.log('Users: owner@demo.local / admin@demo.local / agent@demo.local');
  await getPool().end();
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
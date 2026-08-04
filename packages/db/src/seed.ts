/**
 * Seed generator — demo workspace.
 * Creates: 1 enterprise, 3 users + team members, 2 pipelines, 20 custom
 * fields, 5,000 leads (streamed, deterministic), system action types.
 * Idempotent: re-running seeds a NEW enterprise (no collisions).
 * All tenant-scoped writes run inside withTenant() so RLS is satisfied.
 *
 * Usage: pnpm --filter @opentelecrm/db seed
 */
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
  });

  console.log(
    `\nSeeded enterprise: ${ent.name} (${eid}) | ${LEAD_COUNT} leads | ${PIPELINES.length} pipelines | ${CUSTOM_FIELDS} custom fields`,
  );
  console.log('Users: owner@demo.local / admin@demo.local / agent@demo.local');
  await getPool().end();
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
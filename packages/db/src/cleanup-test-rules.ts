/** One-shot: delete leftover contract-test automation rules from the demo enterprise. */
import { and, eq, like } from 'drizzle-orm';
import { getPool, withTenant, automation, automationRun, automationStep } from './index.js';

const eid = process.env.CLEANUP_EID ?? 'a9e8933a-0a29-4e8b-8b2b-7fdfaf1b88d9';

await withTenant(eid, async (tx) => {
  const rules = await tx
    .select({ id: automation.id, name: automation.name })
    .from(automation)
    .where(
      and(
        eq(automation.enterpriseId, eid),
        like(automation.name, 'contract-%'),
      ),
    );
  const testRules = await tx
    .select({ id: automation.id, name: automation.name })
    .from(automation)
    .where(and(eq(automation.enterpriseId, eid), like(automation.name, 'test-rule-%')));
  const all = [...rules, ...testRules];
  console.log(`rules to delete: ${all.length}`);
  for (const r of all) {
    const runs = await tx
      .select({ id: automationRun.id })
      .from(automationRun)
      .where(eq(automationRun.automationId, r.id));
    for (const run of runs) {
      await tx.delete(automationStep).where(eq(automationStep.runId, run.id));
    }
    await tx.delete(automationRun).where(eq(automationRun.automationId, r.id));
    await tx.delete(automation).where(eq(automation.id, r.id));
  }
  console.log('cleanup done');
});

const pool = getPool();
await pool.end();

/**
 * Row-Level Security for OpenTeleCRM.
 *
 * Every tenanted table has RLS enabled with a single policy that reads the
 * `app.enterprise_id` session/transaction variable:
 *
 *   SET LOCAL app.enterprise_id = '<uuid>'   -- inside a transaction
 *
 * The API layer wraps every request-scoped query in a transaction that sets
 * this variable first (see db.ts `withTenant`). A missing/invalid enterprise
 * id yields zero rows — no cross-tenant leakage by construction.
 *
 * `opentelecrm` (the DB role the API uses) is NOT a superuser/table owner, so
 * RLS applies. Table owners bypass RLS by default in Postgres; the migration
 * revokes ownership semantics by enabling FORCE ROW LEVEL SECURITY.
 */
import { sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from './schema.js';
import * as whatsappSchema from './whatsapp-schema.js';
import * as telephonySchema from './telephony-schema.js';
import * as automationSchema from './automation-schema.js';
import * as workforceSchema from './workforce-schema.js';
import { TENANT_TABLES } from './schema.js';
import { WHATSAPP_TENANT_TABLES } from './whatsapp-schema.js';
import { TELEPHONY_TENANT_TABLES } from './telephony-schema.js';
import { AUTOMATION_TENANT_TABLES } from './automation-schema.js';
import { WORKFORCE_TENANT_TABLES } from './workforce-schema.js';

/** The merged set of tenant-scoped tables RLS is applied to. */
export const ALL_TENANT_TABLES = [
  ...TENANT_TABLES,
  ...WHATSAPP_TENANT_TABLES,
  ...TELEPHONY_TENANT_TABLES,
  ...AUTOMATION_TENANT_TABLES,
  ...WORKFORCE_TENANT_TABLES,
] as const;

export interface RlsContext {
  enterpriseId: string;
}

/** Drizzle stores the table name under this well-known symbol. */
const DRIZZLE_NAME: PropertyKey = Symbol.for('drizzle:Name');

/** Resolve a Drizzle table's SQL name. */
function tableName(table: unknown): string {
  const name = (table as Record<PropertyKey, unknown>)[DRIZZLE_NAME] as string | undefined;
  if (!name) throw new Error('cannot resolve table name for RLS');
  return name;
}

/**
 * Enables RLS + the enterprise policy + FORCE on every tenanted table.
 * Runs inside the migration bootstrap; idempotent.
 */
export async function enableRls(
  db: NodePgDatabase<
    typeof schema &
      typeof whatsappSchema &
      typeof telephonySchema &
      typeof automationSchema &
      typeof workforceSchema
  >,
): Promise<void> {
  for (const table of ALL_TENANT_TABLES) {
    const name = tableName(table);
    // Enable RLS
    await db.execute(sql`ALTER TABLE ${sql.identifier(name)} ENABLE ROW LEVEL SECURITY`);
    // FORCE: even the table owner obeys RLS (the owner is a service role).
    await db.execute(sql`ALTER TABLE ${sql.identifier(name)} FORCE ROW LEVEL SECURITY`);
    // Drop any pre-existing policy with our name (idempotent).
    await db.execute(
      sql`DROP POLICY IF EXISTS enterprise_isolation ON ${sql.identifier(name)}`,
    );
    // The single isolation policy: enterprise_id must equal the session var.
    // Compare as TEXT to avoid a uuid cast error when the var is unset/empty on
    // a pooled connection — unset => enterprise_id::text = NULL => 0 rows, safely.
    await db.execute(
      sql`
        CREATE POLICY enterprise_isolation ON ${sql.identifier(name)}
        USING (enterprise_id::text = current_setting('app.enterprise_id', true))
        WITH CHECK (enterprise_id::text = current_setting('app.enterprise_id', true))
      `,
    );
  }
}

/** Sets the tenant context for the CURRENT transaction. Call inside a txn. */
export function setTenantContext(enterpriseId: string): ReturnType<typeof sql> {
  return sql`SELECT set_config('app.enterprise_id', ${enterpriseId}, true)`;
}

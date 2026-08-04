/**
 * Shared Postgres client + tenant-scoped transaction helper.
 * The API and MCP services both use this. Every request-scoped query MUST
 * run inside withTenant(enterpriseId) so RLS scopes it to the tenant.
 */
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import * as schema from './schema.js';
import * as whatsappSchema from './whatsapp-schema.js';
import * as telephonySchema from './telephony-schema.js';
import { setTenantContext } from './rls.js';

export type DbSchema = typeof schema & typeof whatsappSchema & typeof telephonySchema;

const { Pool } = pg;

let pool: pg.Pool | null = null;
let db: NodePgDatabase<DbSchema> | null = null;

export function getConnectionString(): string {
  return (
    process.env.DATABASE_URL ??
    'postgres://opentelecrm:CHANGE_ME_DB_PASSWORD@127.0.0.1:5432/opentelecrm'
  );
}

export function getPool(): pg.Pool {
  if (!pool) {
    pool = new Pool({ connectionString: getConnectionString(), max: 10 });
  }
  return pool;
}

export function getDb(): NodePgDatabase<DbSchema> {
  if (!db) {
    db = drizzle(getPool(), {
      schema: { ...schema, ...whatsappSchema, ...telephonySchema },
    }) as NodePgDatabase<DbSchema>;
  }
  return db;
}

export type DbClient = NodePgDatabase<DbSchema>;

/**
 * Run `fn` inside a transaction scoped to `enterpriseId`.
 * RLS guarantees the fn can only see that tenant's rows.
 */
export async function withTenant<T>(
  enterpriseId: string,
  fn: (db: DbClient) => Promise<T>,
): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT set_config($1, $2, true)', ['app.enterprise_id', enterpriseId]);
    const tx = drizzle(client, {
      schema: { ...schema, ...whatsappSchema, ...telephonySchema },
    }) as DbClient;
    const result = await fn(tx);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export * from './schema.js';
export * from './whatsapp-schema.js';
export * from './telephony-schema.js';
export { enableRls, setTenantContext, ALL_TENANT_TABLES } from './rls.js';

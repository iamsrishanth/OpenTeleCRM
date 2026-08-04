/**
 * Migration runner — applies pending Drizzle migrations then enables RLS.
 * Usage: pnpm --filter @opentelecrm/db migrate
 */
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { getDb, getPool } from './index.js';
import { enableRls } from './rls.js';

async function main() {
  const db = getDb();
  console.log('==> Applying Drizzle migrations…');
  await migrate(db, { migrationsFolder: './drizzle' });
  console.log('==> Enabling RLS on tenant tables…');
  await enableRls(db);
  console.log('==> Migrations applied + RLS enabled.');
  await getPool().end();
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});

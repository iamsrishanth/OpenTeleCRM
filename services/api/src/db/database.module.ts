import { Global, Module } from '@nestjs/common';
import { getDb, withTenant } from '@opentelecrm/db';

/**
 * Provides tenant-scoped DB access. withTenant() runs a transaction that sets
 * the app.enterprise_id session var first, so a caller can only touch its own
 * tenant's rows (enforced by Postgres RLS).
 */
export const DB_PROVIDER = Symbol('OPENTELECRM_DB');
export const TENANT_WRAPPER = Symbol('OPENTELECRM_TENANT');

@Global()
@Module({
  providers: [
    { provide: DB_PROVIDER, useFactory: () => getDb() },
    { provide: TENANT_WRAPPER, useValue: withTenant },
  ],
  exports: [DB_PROVIDER, TENANT_WRAPPER],
})
export class DatabaseModule {}
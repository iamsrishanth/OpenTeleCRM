import { Module } from '@nestjs/common';
import { LeadsController } from './leads.controller.js';
import { ActionsController } from './actions.controller.js';

/**
 * TeleCRM Sync-parity surface: leads + actions.
 * DatabaseModule is @Global (DB_PROVIDER / TENANT_WRAPPER), so a plain
 * providers list here is enough — no explicit import needed.
 */
@Module({
  controllers: [LeadsController, ActionsController],
})
export class SyncModule {}

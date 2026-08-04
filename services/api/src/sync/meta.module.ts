import { Module } from '@nestjs/common';
import { MetaController } from './meta.controller.js';

/**
 * Sync meta surface (TeleCRM parity).
 * Routes:
 *   GET  /autoupdate/v2/enterprise/{eid}/custom-actions
 *   POST /autoupdate/v2/enterprise/{eid}/custom-actions
 *   PATCH /autoupdate/v2/enterprise/{eid}/custom-actions/:code
 *   PATCH /autoupdate/v2/enterprise/{eid}/custom-fields/:apiName
 * (GET custom-fields lives in metadata.controller.ts — not duplicated here.)
 */
@Module({
  controllers: [MetaController],
})
export class MetaModule {}
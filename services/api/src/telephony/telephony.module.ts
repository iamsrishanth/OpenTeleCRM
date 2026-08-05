import { Module } from '@nestjs/common';
import { CallsController } from './calls.controller.js';
import { CallerIdController } from './caller-id.controller.js';
import { DialerController } from './dialer.controller.js';
import { CallbacksController } from './callbacks.controller.js';
import { RecordingsController } from './recordings.controller.js';
import { CallEventBridge } from './call-events.bridge.js';

/**
 * Telephony API surface (P3) — call logging/tracking (A1.3), live caller ID
 * (A1.6), smart dialer queue (A1.1), call dispositions (A1.1), follow-up
 * callbacks (A1.5) and recording metadata (A1.2 partial).
 * Routes (all under the global /autoupdate/v2 prefix):
 *   POST/GET     /enterprise/{eid}/calls, GET /calls/{id}
 *   GET          /enterprise/{eid}/caller-id/{phone}
 *   POST         /enterprise/{eid}/dialer/next
 *   POST         /enterprise/{eid}/dialer/{leadId}/disposition|skip
 *   POST/GET     /enterprise/{eid}/callbacks, PATCH /callbacks/{id}
 *   GET          /enterprise/{eid}/recordings/{id}
 *
 * DatabaseModule is @Global, so DB_PROVIDER / TENANT_WRAPPER inject without an
 * explicit import. All queries run through withTenant(eid) (RLS scoping).
 * Dialer scoring comes from the @opentelecrm/telephony service (pure fns).
 */
@Module({
  imports: [],
  controllers: [CallsController, CallerIdController, DialerController, CallbacksController, RecordingsController],
  providers: [CallEventBridge],
})
export class TelephonyModule {}

import { Module } from '@nestjs/common';
import { InboxController } from './inbox.controller.js';
import { BroadcastsController } from './broadcasts.controller.js';
import { TemplatesController } from './templates.controller.js';

/**
 * WhatsApp API surface — unified inbox, send, broadcasts + templates.
 * Routes:
 *   GET  /autoupdate/v2/enterprise/{eid}/whatsapp/conversations
 *   GET  /autoupdate/v2/enterprise/{eid}/whatsapp/conversations/{id}/messages
 *   POST /autoupdate/v2/enterprise/{eid}/whatsapp/send
 *   GET/POST .../whatsapp/broadcasts, POST .../broadcasts/:id/start|optimout
 *   GET/POST/PATCH/DELETE .../whatsapp/templates
 *
 * DatabaseModule is @Global, so DB_PROVIDER / TENANT_WRAPPER inject without an
 * explicit import. Controllers pull InboxService + providerFor directly from
 * @opentelecrm/whatsapp (no DI providers needed — the provider registry is a
 * module-level Map keyed by agentSessionId).
 */
@Module({
  imports: [],
  controllers: [InboxController, BroadcastsController, TemplatesController],
  providers: [],
})
export class WhatsappModule {}
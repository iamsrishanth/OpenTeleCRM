/**
 * OpenTeleCRM WhatsApp service — public surface.
 * Exposes provider construction, session management, and the inbox bridge.
 * NOTE: the whatsapp-web.js driver is intentionally NOT re-exported here —
 * loading it pulls puppeteer + whatsapp-web.js into the importing process
 * (spawns headless Chrome; breaks the API's mock path). The pairing CLI
 * imports it directly from providers/.
 */
export * from './sessions.js';
export * from './inbox.service.js';
export * from './providers/mock.provider.js';
export type { WhatsAppProvider, WhatsAppMessage } from '@opentelecrm/contracts';

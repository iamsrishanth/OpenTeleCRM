/**
 * OpenTeleCRM WhatsApp service — public surface.
 * Exposes provider construction, session management, and the inbox bridge.
 * NOTE: the Baileys driver is intentionally NOT re-exported here — loading it
 * pulls @whiskeysockets/baileys into the importing process (breaks the API's
 * mock path). The pairing CLI imports it directly from providers/.
 */
export * from './sessions.js';
export * from './inbox.service.js';
export * from './providers/mock.provider.js';
export type { WhatsAppProvider, WhatsAppMessage } from '@opentelecrm/contracts';

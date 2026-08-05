/**
 * WhatsApp session manager — owns provider lifecycle per agent session.
 * Map<agentSessionId, WhatsAppProvider>.
 *
 * The whatsapp-web.js driver is loaded LAZILY via dynamic import: the API
 * process (mock path) must never pull puppeteer/whatsapp-web.js into memory —
 * it would spawn a headless Chrome per request. Only the pairing CLI / a
 * real-number worker imports it directly.
 */
import type { WhatsAppProvider } from '@opentelecrm/contracts';
import { MockWhatsAppProvider } from './providers/mock.provider.js';

/** Drivers the provider registry can construct. */
export type WhatsAppDriver = 'mock' | 'wwebjs' | 'baileys' | 'cloud-api';

const sessions = new Map<string, WhatsAppProvider>();

export async function providerFor(
  agentSessionId: string,
  kind: WhatsAppDriver = 'mock',
): Promise<WhatsAppProvider> {
  const existing = sessions.get(agentSessionId);
  if (existing) return existing;

  let provider: WhatsAppProvider;
  if (kind === 'wwebjs') {
    const { WWebJsWhatsAppProvider } = await import('./providers/wwebjs.provider.js');
    provider = new WWebJsWhatsAppProvider();
  } else if (kind === 'baileys') {
    const { BaileysWhatsAppProvider } = await import('./providers/baileys.provider.js');
    provider = new BaileysWhatsAppProvider();
  } else {
    provider = new MockWhatsAppProvider();
  }

  sessions.set(agentSessionId, provider);
  return provider;
}

export function allSessions(): Map<string, WhatsAppProvider> {
  return sessions;
}

export function dropSession(agentSessionId: string): void {
  sessions.delete(agentSessionId);
}

/**
 * Operator-env wiring: the API picks the live driver from env instead of
 * hardcoding 'mock'.
 *   WHATSAPP_DRIVER=mock|wwebjs   (default mock — contract tests stay hermetic)
 *   WHATSAPP_SESSION_ID           session key to reuse (the pairing CLI pairs
 *                                 under 'cli'; operator deployments set this)
 * The default session key is `${eid}:${driver}` so multiple tenants keep
 * separate wwebjs LocalAuth dirs when no override is set.
 */
export function resolveWhatsappDriver(): WhatsAppDriver {
  const d = process.env.WHATSAPP_DRIVER;
  return d === 'wwebjs' || d === 'baileys' ? d : 'mock';
}

export function resolveAgentSessionId(eid: string, driver: WhatsAppDriver): string {
  return process.env.WHATSAPP_SESSION_ID ?? `${eid}:${driver}`;
}

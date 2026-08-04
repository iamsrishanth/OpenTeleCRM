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

const sessions = new Map<string, WhatsAppProvider>();

export async function providerFor(
  agentSessionId: string,
  kind: 'mock' | 'wwebjs' | 'cloud-api' = 'mock',
): Promise<WhatsAppProvider> {
  const existing = sessions.get(agentSessionId);
  if (existing) return existing;

  let provider: WhatsAppProvider;
  if (kind === 'wwebjs') {
    const { WWebJsWhatsAppProvider } = await import('./providers/wwebjs.provider.js');
    provider = new WWebJsWhatsAppProvider();
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

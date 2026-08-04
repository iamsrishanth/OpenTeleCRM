/**
 * WhatsApp session manager — owns provider lifecycle per agent session.
 * Map<agentSessionId, WhatsAppProvider>.
 *
 * The Baileys driver is loaded LAZILY via dynamic import: the API process
 * (mock path) must never pull @whiskeysockets/baileys into memory — its ESM
 * interop (named `proto` export) breaks when loaded from the Nest app. Only
 * the pairing CLI / a real-number worker imports it directly.
 */
import type { WhatsAppProvider } from '@opentelecrm/contracts';
import { MockWhatsAppProvider } from './providers/mock.provider.js';

const sessions = new Map<string, WhatsAppProvider>();

export async function providerFor(
  agentSessionId: string,
  kind: 'mock' | 'baileys' | 'cloud-api' = 'mock',
): Promise<WhatsAppProvider> {
  const existing = sessions.get(agentSessionId);
  if (existing) return existing;

  let provider: WhatsAppProvider;
  if (kind === 'baileys') {
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

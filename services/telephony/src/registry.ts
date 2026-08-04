/**
 * Telephony provider registry — owns provider lifecycle per enterprise.
 * Map<enterpriseId, TelephonyProvider>.
 *
 * The Asterisk ARI driver is loaded LAZILY via dynamic import: the API process
 * (mock path) must never pull the ARI client into memory. Only deployments
 * that actually dial real trunks hit that branch. Live ARI wiring is a later
 * phase — the driver currently scaffolds the contract (see providers/).
 */
import type { TelephonyProvider } from '@opentelecrm/contracts'
import { MockTelephonyProvider } from './providers/mock.provider.js'

const providers = new Map<string, TelephonyProvider>()

export async function telephonyProviderFor(
  enterpriseId: string,
  kind: 'mock' | 'asterisk-ari' = 'mock',
): Promise<TelephonyProvider> {
  const existing = providers.get(enterpriseId)
  if (existing) return existing

  let provider: TelephonyProvider
  if (kind === 'asterisk-ari') {
    const { AsteriskAriProvider } = await import('./providers/asterisk-ari.provider.js')
    provider = new AsteriskAriProvider()
  } else {
    provider = new MockTelephonyProvider()
  }

  providers.set(enterpriseId, provider)
  return provider
}

export function allProviders(): Map<string, TelephonyProvider> {
  return providers
}

export function dropProvider(enterpriseId: string): void {
  providers.delete(enterpriseId)
}

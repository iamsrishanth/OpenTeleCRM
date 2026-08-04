/**
 * OpenTeleCRM telephony service — public surface.
 * Exposes the smart dialer scoring service (A1.1), the provider registry, and
 * the mock driver.
 * NOTE: the Asterisk ARI driver is intentionally NOT re-exported here — the
 * registry lazy-loads it via dynamic import so the API process's mock path
 * never pulls the ARI client into memory (same rule as whatsapp's Baileys
 * driver). Live ARI wiring is a later phase.
 */
export * from './scoring.js'
export * from './registry.js'
export * from './providers/mock.provider.js'
export type { TelephonyProvider } from '@opentelecrm/contracts'

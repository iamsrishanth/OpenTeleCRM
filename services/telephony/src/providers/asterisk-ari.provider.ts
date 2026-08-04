/**
 * Asterisk ARI telephony provider — SCAFFOLD.
 *
 * Live ARI wiring is a later phase. This class implements the TelephonyProvider
 * contract and will talk to Asterisk's REST API (ari/channels, ari/recordings)
 * once TELEPHONY_ARI_URL is set. Until then every method throws, so a
 * mis-configured deployment fails loudly at dial time instead of silently
 * no-op'ing.
 *
 * Transport is global fetch only (no new deps). Auth is HTTP Basic
 * (ari_user/ari_password from ARI config). callState polling is expected to be
 * replaced by ARI WebSocket events in the live phase; on() is a placeholder.
 */
import type { CallStatus, TelephonyProvider } from '@opentelecrm/contracts'

export interface AsteriskAriOptions {
  /** Base URL of the Asterisk ARI endpoint, e.g. http://pbx:8088. */
  ariUrl?: string | null
  ariUser?: string | null
  ariPassword?: string | null
  /** Origination endpoint, e.g. PJSIP/<trunk>. */
  trunk?: string | null
}

const NOT_CONFIGURED = 'asterisk-ari not configured — set TELEPHONY_ARI_* env'

export class AsteriskAriProvider implements TelephonyProvider {
  readonly kind = 'asterisk-ari' as const

  private readonly ariUrl: string | null
  private readonly ariUser: string
  private readonly ariPassword: string
  private readonly trunk: string

  constructor(options: AsteriskAriOptions = {}) {
    this.ariUrl = options.ariUrl ?? process.env.TELEPHONY_ARI_URL ?? null
    this.ariUser = options.ariUser ?? process.env.TELEPHONY_ARI_USER ?? ''
    this.ariPassword = options.ariPassword ?? process.env.TELEPHONY_ARI_PASSWORD ?? ''
    this.trunk = options.trunk ?? process.env.TELEPHONY_ARI_TRUNK ?? 'PJSIP/default'
  }

  private assertConfigured(): void {
    if (!this.ariUrl) throw new Error(NOT_CONFIGURED)
  }

  private authHeaders(): Record<string, string> {
    const basic = Buffer.from(`${this.ariUser}:${this.ariPassword}`).toString('base64')
    return {
      Authorization: `Basic ${basic}`,
      'Content-Type': 'application/json',
    }
  }

  async dial(
    to: string,
    from?: string,
    context?: Record<string, unknown>,
  ): Promise<{ callId: string }> {
    this.assertConfigured()
    const res = await fetch(`${this.ariUrl}/ari/channels`, {
      method: 'POST',
      headers: this.authHeaders(),
      body: JSON.stringify({
        endpoint: this.trunk,
        callerId: from ? `"OpenTeleCRM" <${from}>` : undefined,
        context: 'from-internal',
        extension: to,
        ...(context ?? {}),
      }),
    })
    if (!res.ok) {
      throw new Error(`asterisk-ari dial failed: HTTP ${res.status} ${res.statusText}`)
    }
    const data = (await res.json()) as { id?: string }
    return { callId: data.id ?? `ari-${Date.now()}` }
  }

  async hangup(callId: string): Promise<void> {
    this.assertConfigured()
    const res = await fetch(`${this.ariUrl}/ari/channels/${callId}`, {
      method: 'DELETE',
      headers: this.authHeaders(),
    })
    if (!res.ok) {
      throw new Error(`asterisk-ari hangup failed: HTTP ${res.status} ${res.statusText}`)
    }
  }

  async callState(callId: string): Promise<{ status: CallStatus; durationSec: number }> {
    this.assertConfigured()
    const res = await fetch(`${this.ariUrl}/ari/channels/${callId}`, {
      headers: this.authHeaders(),
    })
    if (res.status === 404) return { status: 'completed', durationSec: 0 }
    if (!res.ok) {
      throw new Error(`asterisk-ari callState failed: HTTP ${res.status} ${res.statusText}`)
    }
    const data = (await res.json()) as { state?: string; creationtime?: string }
    const durationSec = data.creationtime
      ? Math.max(0, Math.round((Date.now() - Date.parse(data.creationtime)) / 1000))
      : 0
    return { status: mapAriState(data.state), durationSec }
  }

  async startRecording(callId: string): Promise<{ recordingId: string }> {
    this.assertConfigured()
    const name = `rec-${callId}-${Date.now()}`
    const res = await fetch(
      `${this.ariUrl}/ari/channels/${callId}/recordings?name=${encodeURIComponent(name)}&format=wav`,
      { method: 'POST', headers: this.authHeaders() },
    )
    if (!res.ok) {
      throw new Error(`asterisk-ari startRecording failed: HTTP ${res.status} ${res.statusText}`)
    }
    return { recordingId: name }
  }

  async stopRecording(callId: string): Promise<{ recordingId: string }> {
    this.assertConfigured()
    // Simplification: drop the channel's stored recordings. The live phase
    // should address the live recording by the name returned by startRecording
    // (POST /ari/recordings/live/{name}/stop).
    const res = await fetch(`${this.ariUrl}/ari/channels/${callId}/recordings`, {
      method: 'DELETE',
      headers: this.authHeaders(),
    })
    if (!res.ok && res.status !== 404) {
      throw new Error(`asterisk-ari stopRecording failed: HTTP ${res.status} ${res.statusText}`)
    }
    return { recordingId: `rec-${callId}` }
  }

  on(_event: 'call' | 'status', _cb: (arg: unknown) => void): () => void {
    // ARI WebSocket event wiring lands with the live phase.
    return () => {}
  }
}

function mapAriState(state: string | undefined): CallStatus {
  switch (state) {
    case 'Ringing':
      return 'ringing'
    case 'Up':
      return 'in-progress'
    case 'Down':
      return 'completed'
    default:
      return 'queued'
  }
}

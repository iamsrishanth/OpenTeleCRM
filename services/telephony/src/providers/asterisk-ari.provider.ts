/**
 * Asterisk ARI telephony provider — LIVE wiring (A1.1).
 *
 * Talks to Asterisk's REST API (ari/channels, ari/recordings) and subscribes
 * to the Stasis application over the ARI WebSocket events endpoint, mapping
 * StasisStart / ChannelStateChange / ChannelDestroyed into CRM call events.
 *
 * Transport is global fetch + global WebSocket only (no new deps). Auth is
 * HTTP Basic (ari_user/ari_password from ARI config); the WebSocket passes
 * the same creds via the documented `api_key` query parameter.
 *
 * Origination: POST /ari/channels with endpoint PJSIP/<trunk> + context
 * <TELEPHONY_ARI_CONTEXT, default from-crm>. The dialplan hands the channel
 * to Stasis/opentelecrm (extensions.conf) and events flow back here.
 */
import { EventEmitter } from 'node:events'
import type { CallStatus, TelephonyProvider } from '@opentelecrm/contracts'

export interface AsteriskAriOptions {
  /** Base URL of the Asterisk ARI endpoint, e.g. http://pbx:8088. */
  ariUrl?: string | null
  ariUser?: string | null
  ariPassword?: string | null
  /** Origination endpoint, e.g. PJSIP/<trunk>. */
  trunk?: string | null
  /** Dialplan context the originated channel lands in. */
  context?: string | null
  /** Stasis application name the events WebSocket subscribes to. */
  app?: string | null
}

/** A normalized call lifecycle event emitted by on('call'). */
export interface AriCallEvent {
  type: 'ringing' | 'answered' | 'ended'
  /** ARI channel id — maps to call.provider_call_id. */
  callId: string
  /** Channel variable set at originate (enterprise_id). */
  enterpriseId?: string
  /** Channel variable set at originate (lead_id). */
  leadId?: string | null
  /** For 'ended': elapsed seconds since channel creation. */
  durationSec?: number
}

const NOT_CONFIGURED = 'asterisk-ari not configured — set TELEPHONY_ARI_* env'

export class AsteriskAriProvider implements TelephonyProvider {
  readonly kind = 'asterisk-ari' as const

  private readonly ariUrl: string | null
  private readonly ariUser: string
  private readonly ariPassword: string
  private readonly trunk: string
  private readonly context: string
  private readonly app: string

  private events = new EventEmitter()
  private ws: WebSocket | null = null

  constructor(options: AsteriskAriOptions = {}) {
    // Normalize to the Asterisk BASE (strip a trailing /ari) so every call
    // site appends /ari/... consistently — dial hits /ari/channels, the
    // events websocket hits /ari/events. Accepts both
    // TELEPHONY_ARI_URL=http://host:8088 and http://host:8088/ari.
    this.ariUrl = (options.ariUrl ?? process.env.TELEPHONY_ARI_URL ?? null)?.replace(/\/ari\/?$/, '') ?? null
    this.ariUser = options.ariUser ?? process.env.TELEPHONY_ARI_USER ?? ''
    this.ariPassword = options.ariPassword ?? process.env.TELEPHONY_ARI_PASSWORD ?? ''
    this.trunk = options.trunk ?? process.env.TELEPHONY_ARI_TRUNK ?? 'PJSIP/from-crm'
    this.context = options.context ?? process.env.TELEPHONY_ARI_CONTEXT ?? 'from-crm'
    this.app = options.app ?? process.env.TELEPHONY_ARI_APP ?? 'opentelecrm'
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

  /**
   * Open the ARI events WebSocket for the Stasis app (idempotent).
   * The channel variables set at originate (enterprise_id / lead_id) are
   * echoed back on every event so the API can tenant-scope the update.
   */
  async startEvents(): Promise<void> {
    if (this.ws) return
    if (!this.ariUrl) return // not configured → no-op (mock-compatible)
    const wsBase = this.ariUrl.replace(/^http/, 'ws')
    const wsUrl =
      `${wsBase}/ari/events?app=${encodeURIComponent(this.app)}` +
      `&api_key=${encodeURIComponent(`${this.ariUser}:${this.ariPassword}`)}`

    let WS = (globalThis as { WebSocket?: typeof WebSocket }).WebSocket
    if (!WS) {
      // Node 20 (system node on Debian 13) has no global WebSocket (21+).
      // Fall back to undici's WebSocket so the operator env works on either.
      try {
        const undici = await import('undici')
        WS = undici.WebSocket as typeof WebSocket
      } catch {
        WS = undefined
      }
    }
    if (!WS) {
      throw new Error(
        'no WebSocket available — run on Node 22+ or add undici to the deploy env',
      )
    }

    this.ws = new WS(wsUrl)
    this.ws.onmessage = (ev) => this.handleEvent(String(ev.data))
    this.ws.onclose = () => {
      this.ws = null
      // Reconnect on a delay — the bridge re-subscribes on the next call.
      setTimeout(() => {
        this.startEvents().catch(() => {})
      }, 5_000)
    }
    this.ws.onerror = (err) => {
      console.warn(
        '[asterisk-ari] events websocket error:',
        (err as { message?: string } | undefined)?.message ?? 'unknown',
      )
    }
  }

  private handleEvent(raw: string): void {
    let msg: {
      type?: string
      channel?: { id?: string; state?: string; creationtime?: string; variables?: Record<string, unknown> }
    }
    try {
      msg = JSON.parse(raw) as typeof msg
    } catch {
      return
    }
    const channel = msg.channel
    if (!msg.type || !channel?.id) return

    const callId = channel.id
    const vars = channel.variables ?? {}
    const enterpriseId = typeof vars.enterprise_id === 'string' ? vars.enterprise_id : undefined
    const leadId = typeof vars.lead_id === 'string' ? vars.lead_id : null

    switch (msg.type) {
      case 'StasisStart':
        this.events.emit('call', { type: 'ringing', callId, enterpriseId, leadId })
        break
      case 'ChannelStateChange':
        if (channel.state === 'Up') {
          this.events.emit('call', { type: 'answered', callId, enterpriseId, leadId })
        }
        break
      case 'ChannelDestroyed': {
        const durationSec = channel.creationtime
          ? Math.max(0, Math.round((Date.now() - Date.parse(channel.creationtime)) / 1000))
          : 0
        this.events.emit('call', { type: 'ended', callId, enterpriseId, leadId, durationSec })
        break
      }
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
        context: this.context,
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

  on(event: 'call' | 'status', cb: (arg: unknown) => void): () => void {
    this.events.on(event, cb)
    return () => this.events.off(event, cb)
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

/**
 * Hermes-bridge WhatsApp provider — delegates OUTBOUND to the local Hermes
 * Baileys bridge (127.0.0.1:3000).
 *
 * Why this driver exists: the operator's WhatsApp number is a Business
 * account that rejects fresh waweb registration (401 Connection Failure,
 * platform "smba" — see the ultracode operator-live-wiring reference). The
 * Hermes gateway on this host already maintains a PAIRED, CONNECTED Baileys
 * session (bridge.js, bot mode, number from its own session dir) — so the
 * CRM rides that transport instead of pairing its own session:
 *
 *   POST /send   { chatId, message }        → send text (long msgs chunked)
 *   GET  /health → { status: 'connected' }  → session status
 *
 * INBOUND IS INTENTIONALLY NOT SUPPORTED: the bridge's GET /messages
 * DEQUEUES the shared queue (single consumer — Hermes's gateway). Polling it
 * from the CRM would steal the user's own bot messages. Chat-sync (A2.2)
 * for the bridge path is out of scope; outbound (A2.1 send, A2.4 broadcast,
 * automation send_whatsapp) is the win.
 */
import { EventEmitter } from 'node:events'
import type {
  WhatsAppContact,
  WhatsAppContactId,
  WhatsAppMessage,
  WhatsAppProvider,
  WhatsAppSessionStatus,
  SendTextOptions,
} from '@opentelecrm/contracts'

export interface HermesBridgeOptions {
  /** Base URL of the local Hermes bridge, e.g. http://127.0.0.1:3000. */
  bridgeUrl?: string | null
  /** Poll the bridge /health once and treat 'connected' as ready. */
  healthTimeoutMs?: number
}

export class HermesBridgeProvider implements WhatsAppProvider {
  readonly kind = 'hermes-bridge' as const
  readonly ownsSession = false // the bridge owns the socket

  private readonly bridgeUrl: string
  private readonly healthTimeoutMs: number
  private readonly events = new EventEmitter()
  private healthy = false

  constructor(options: HermesBridgeOptions = {}) {
    this.bridgeUrl = (options.bridgeUrl ?? process.env.WHATSAPP_BRIDGE_URL ?? 'http://127.0.0.1:3000').replace(
      /\/$/,
      '',
    )
    this.healthTimeoutMs = options.healthTimeoutMs ?? 5_000
  }

  private async health(): Promise<{ connected: boolean }> {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), this.healthTimeoutMs)
    try {
      const res = await fetch(`${this.bridgeUrl}/health`, { signal: ctrl.signal })
      if (!res.ok) return { connected: false }
      const body = (await res.json()) as { status?: string }
      return { connected: body.status === 'connected' }
    } catch {
      return { connected: false }
    } finally {
      clearTimeout(timer)
    }
  }

  async connect(agentSessionId: string): Promise<WhatsAppSessionStatus> {
    const { connected } = await this.health()
    this.healthy = connected
    return { status: connected ? 'ready' : 'disconnected' }
  }

  async sessionStatus(agentSessionId: string): Promise<WhatsAppSessionStatus> {
    const { connected } = await this.health()
    this.healthy = connected
    return { status: connected ? 'ready' : 'disconnected' }
  }

  async isOnline(agentSessionId: string): Promise<boolean> {
    return this.healthy || (await this.health()).connected
  }

  async sendText(
    agentSessionId: string,
    to: WhatsAppContactId,
    text: string,
    options?: SendTextOptions,
  ): Promise<{ messageId: string }> {
    if (!(await this.health()).connected) {
      throw new Error('hermes-bridge not connected — is the Hermes gateway running?')
    }
    const res = await fetch(`${this.bridgeUrl}/send`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        chatId: to,
        message: text,
        ...(options?.replyToId ? { replyTo: options.replyToId } : {}),
      }),
    })
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string }
      throw new Error(`hermes-bridge send failed: HTTP ${res.status} ${body.error ?? res.statusText}`)
    }
    const body = (await res.json()) as { messageId?: string; messageIds?: string[] }
    const messageId = body.messageId ?? body.messageIds?.[0]
    if (!messageId) throw new Error('hermes-bridge send returned no message id')
    return { messageId }
  }

  async sendTemplate(
    _agentSessionId: string,
    _to: WhatsAppContactId,
    _templateName: string,
    _languageCode: string,
    _components: Record<string, unknown>[],
  ): Promise<{ messageId: string }> {
    throw new Error('templates require the cloud-api driver, not hermes-bridge')
  }

  async resolveContact(
    _agentSessionId: string,
    _jid: WhatsAppContactId,
  ): Promise<WhatsAppContact | null> {
    // The bridge has no contact-resolution endpoint; inbound sync is out of
    // scope for this driver (see header note).
    return null
  }

  on(
    event: 'message' | 'status',
    cb: (arg: WhatsAppMessage | WhatsAppSessionStatus['status']) => void,
  ): () => void {
    // Inbound intentionally not supported — polling /messages would consume
    // the shared queue that Hermes's own gateway reads (see header note).
    this.events.on(event, cb)
    return () => this.events.off(event, cb)
  }

  async disconnect(agentSessionId: string): Promise<void> {
    this.healthy = false
    this.events.emit('status', 'disconnected')
  }
}

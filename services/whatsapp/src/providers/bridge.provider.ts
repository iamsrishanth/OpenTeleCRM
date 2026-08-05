/**
 * Bridge WhatsApp provider — delegates to a standalone OpenTeleCRM
 * whatsapp-bridge instance (HTTP API, deploy-anywhere — see
 * services/whatsapp-bridge/README.md).
 *
 * The bridge owns its OWN Baileys session (baileys 7.x — the version that
 * handles smba/business accounts) and its OWN inbound queue, so the CRM is
 * the single consumer: this driver sends outbound AND polls inbound for chat
 * sync. Point WHATSAPP_BRIDGE_URL at any bridge instance (local or remote).
 *
 * API used:
 *   GET  /health    → { status: connected, registered, number, uptime }
 *   POST /send      → { chatId, message, replyTo? } → { success, messageId }
 *   GET  /messages  → drains the bridge's inbound queue (single consumer)
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

export interface BridgeProviderOptions {
  /** Base URL of the standalone bridge, e.g. http://127.0.0.1:3000. */
  bridgeUrl?: string | null
  /** How often to drain the inbound queue (ms). */
  pollIntervalMs?: number
  /** Request timeout for health/send/poll (ms). */
  timeoutMs?: number
}

interface BridgeInbound {
  id: string
  chatId: string
  fromMe: boolean
  senderId: string
  pushName?: string | null
  body: string
  type: string
  timestamp: number
}

export class BridgeProvider implements WhatsAppProvider {
  readonly kind = 'bridge' as const
  readonly ownsSession = false // the bridge owns the socket

  private readonly bridgeUrl: string
  private readonly pollIntervalMs: number
  private readonly timeoutMs: number
  private readonly events = new EventEmitter()
  private pollTimer: ReturnType<typeof setInterval> | null = null
  private healthy = false

  constructor(options: BridgeProviderOptions = {}) {
    this.bridgeUrl = (options.bridgeUrl ?? process.env.WHATSAPP_BRIDGE_URL ?? 'http://127.0.0.1:3000').replace(
      /\/$/,
      '',
    )
    this.pollIntervalMs = options.pollIntervalMs ?? 2_000
    this.timeoutMs = options.timeoutMs ?? 5_000
  }

  private async request(path: string, init?: RequestInit): Promise<Response> {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), this.timeoutMs)
    try {
      return await fetch(`${this.bridgeUrl}${path}`, { ...init, signal: ctrl.signal })
    } finally {
      clearTimeout(timer)
    }
  }

  private async health(): Promise<boolean> {
    try {
      const res = await this.request('/health')
      if (!res.ok) return false
      const body = (await res.json()) as { status?: string }
      return body.status === 'connected'
    } catch {
      return false
    }
  }

  async connect(agentSessionId: string): Promise<WhatsAppSessionStatus> {
    this.healthy = await this.health()
    this.startPolling(agentSessionId)
    return { status: this.healthy ? 'ready' : 'disconnected' }
  }

  async sessionStatus(agentSessionId: string): Promise<WhatsAppSessionStatus> {
    this.healthy = await this.health()
    return { status: this.healthy ? 'ready' : 'disconnected' }
  }

  async isOnline(agentSessionId: string): Promise<boolean> {
    return this.healthy || (await this.health())
  }

  async sendText(
    agentSessionId: string,
    to: WhatsAppContactId,
    text: string,
    options?: SendTextOptions,
  ): Promise<{ messageId: string }> {
    if (!(await this.health())) {
      throw new Error('bridge not connected — is the whatsapp-bridge running?')
    }
    const res = await this.request('/send', {
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
      throw new Error(`bridge send failed: HTTP ${res.status} ${body.error ?? res.statusText}`)
    }
    const body = (await res.json()) as { messageId?: string; messageIds?: string[] }
    const messageId = body.messageId ?? body.messageIds?.[0]
    if (!messageId) throw new Error('bridge send returned no message id')
    return { messageId }
  }

  async sendTemplate(
    _agentSessionId: string,
    _to: WhatsAppContactId,
    _templateName: string,
    _languageCode: string,
    _components: Record<string, unknown>[],
  ): Promise<{ messageId: string }> {
    throw new Error('templates require the cloud-api driver, not bridge')
  }

  async resolveContact(
    _agentSessionId: string,
    _jid: WhatsAppContactId,
  ): Promise<WhatsAppContact | null> {
    return null // contact resolution is not exposed by the bridge API yet
  }

  on(
    event: 'message' | 'status',
    cb: (arg: WhatsAppMessage | WhatsAppSessionStatus['status']) => void,
  ): () => void {
    this.events.on(event, cb)
    return () => this.events.off(event, cb)
  }

  async disconnect(agentSessionId: string): Promise<void> {
    this.stopPolling()
    this.healthy = false
    this.events.emit('status', 'disconnected')
  }

  // -------------------------------------------------------------------------
  // Inbound polling — the CRM is the SINGLE consumer of the bridge queue.
  // -------------------------------------------------------------------------
  private startPolling(agentSessionId: string): void {
    if (this.pollTimer) return
    this.pollTimer = setInterval(() => void this.drain(agentSessionId), this.pollIntervalMs)
  }

  private stopPolling(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer)
      this.pollTimer = null
    }
  }

  private async drain(agentSessionId: string): Promise<void> {
    let res: Response
    try {
      res = await this.request('/messages')
    } catch {
      return // bridge unreachable — retry next tick
    }
    if (!res.ok) return
    const msgs = (await res.json()) as BridgeInbound[]
    for (const m of msgs) {
      if (m.fromMe) continue
      const msg: WhatsAppMessage = {
        id: m.id,
        chatId: m.chatId,
        fromMe: false,
        direction: 'inbound',
        type: m.type === 'text' ? 'text' : 'unknown',
        body: m.body ?? '',
        timestamp: m.timestamp,
        mediaUrl: null,
        mimeType: null,
        replyToId: null,
        isGroup: m.chatId.endsWith('@g.us'),
      }
      this.events.emit('message', msg)
    }
  }
}

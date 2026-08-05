/**
 * OpenTeleCRM standalone WhatsApp bridge (deploy-anywhere).
 *
 * A self-contained Baileys (7.0.0-rc.9 — the version proven to hold a
 * session on smba/business accounts) WhatsApp Web bridge exposing a tiny
 * HTTP API. Owns its OWN Baileys session (file-backed creds via BufferJSON)
 * and its OWN inbound message queue — no dependency on Hermes or any other
 * host service. Deploy it on any Linux box with Node 18+.
 *
 * API:
 *   GET  /health            { status, registered, number, uptime }
 *   POST /send              { chatId, message, replyTo? } -> { success, messageId, messageIds }
 *   GET  /messages          long-poll/drain inbound queue (normalized)
 *   POST /typing            { chatId } — typing indicator
 *
 * Pairing: on boot, if the session is not registered, print a QR (or request
 * a pairing code when WHATSAPP_PAIRING_CODE is set) and hold until linked.
 * Session persists under SESSION_DIR (default .data/bridge-session).
 *
 * Env:
 *   PORT                   HTTP port (default 3000)
 *   SESSION_DIR            session dir (default .data/bridge-session)
 *   WHATSAPP_PAIRING_CODE  phone to pair via code (no +); empty = QR mode
 *   WAIT_FOR_LINK          hold for the link on boot (default true)
 *   PAIR_ONLY              exit after pairing instead of serving (default false)
 *   ALLOWED_USERS          comma-separated numbers for inbound; empty = all
 *   MAX_QUEUE              inbound queue cap (default 1000)
 */
import { createServer } from 'node:http'
import { mkdirSync, readFileSync, writeFileSync, readdirSync, unlinkSync } from 'node:fs'
import { join } from 'node:path'
import {
  makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  type WASocket,
  type WAMessage,
} from '@whiskeysockets/baileys'
import qrcode from 'qrcode-terminal'

const PORT = Number(process.env.PORT ?? 3098)
const SESSION_DIR = process.env.SESSION_DIR ?? join(process.cwd(), '.data', 'bridge-session')
const PAIRING_PHONE = (process.env.WHATSAPP_PAIRING_CODE ?? '').replace(/[^0-9]/g, '')
const WAIT_FOR_LINK = (process.env.WAIT_FOR_LINK ?? 'true') !== 'false'
const PAIR_ONLY = (process.env.PAIR_ONLY ?? 'false') === 'true'
const MAX_QUEUE = Number(process.env.MAX_QUEUE ?? 1000)
const ALLOWED = new Set(
  (process.env.ALLOWED_USERS ?? '')
    .split(',')
    .map((s) => s.trim().replace(/[^0-9]/g, ''))
    .filter(Boolean),
)

mkdirSync(SESSION_DIR, { recursive: true })

let sock: WASocket | null = null
let connectionState: 'connecting' | 'connected' | 'disconnected' = 'disconnected'
let registered = false
let startTs = Date.now()

// ---------------------------------------------------------------------------
// Inbound queue (single consumer — the bridge OWNS this queue, no sharing)
// ---------------------------------------------------------------------------
const queue: Record<string, unknown>[] = []

function normalizeNumber(id: string): string {
  return String(id || '').replace(/:.*@/, '@').replace(/@.*/, '')
}

function allowed(sender: string): boolean {
  if (ALLOWED.size === 0) return true
  return ALLOWED.has(normalizeNumber(sender))
}

function pushMessage(raw: Record<string, unknown>): void {
  queue.push(raw)
  if (queue.length > MAX_QUEUE) queue.splice(0, queue.length - MAX_QUEUE)
}

// ---------------------------------------------------------------------------
// Socket
// ---------------------------------------------------------------------------
async function startSocket(): Promise<void> {
  const { state, saveCreds } = await useMultiFileAuthState(SESSION_DIR)
  const { version } = await fetchLatestBaileysVersion()

  sock = makeWASocket({
    version,
    auth: state,
    printQRInTerminal: false,
    browser: ['OpenTeleCRM Bridge', 'Chrome', '120.0'],
    syncFullHistory: false,
    markOnlineOnConnect: true,
    // Baileys 7.x: needed for E2EE session re-establishment on inbound.
    getMessage: async () => ({ conversation: '' }),
  })

  sock.ev.on('creds.update', () => {
    saveCreds()
    registered = !!state.creds?.registered
  })

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect, qr } = update
    registered = !!state.creds?.registered

    if (qr) {
      if (PAIRING_PHONE && !registered) {
        ;(async () => {
          try {
            const code = await sock!.requestPairingCode(PAIRING_PHONE)
            console.log('\n' + '═'.repeat(56))
            console.log(`  PAIRING CODE: ${code}`)
            console.log('  WhatsApp → Settings → Linked devices →')
            console.log('  Link with phone number → enter the code')
            console.log('═'.repeat(56) + '\n')
          } catch (e) {
            console.log(`  pairing code failed (${(e as Error).message}) — showing QR:\n`)
            qrcode.generate(qr, { small: true })
          }
        })()
        return
      }
      console.log('\n📱 Scan this QR with WhatsApp → Linked devices → Link a device:\n')
      qrcode.generate(qr, { small: true })
      console.log('\nWaiting for scan...\n')
    }

    if (connection === 'close') {
      connectionState = 'disconnected'
      const err = lastDisconnect?.error as { output?: { statusCode?: number }; code?: number } | undefined
      const code = err?.output?.statusCode ?? err?.code

      if (code === DisconnectReason.loggedOut) {
        console.log('❌ Logged out — clearing session and restarting...')
        try {
          for (const f of readdirSync(SESSION_DIR)) unlinkSync(join(SESSION_DIR, f))
        } catch {}
        setTimeout(startSocket, 1000)
        return
      }
      // 515 = restart requested (common after pairing). Always reconnect.
      console.log(`↻ Connection closed (reason: ${code}). Reconnecting...`)
      setTimeout(startSocket, code === 515 ? 1000 : 3000)
    } else if (connection === 'open') {
      connectionState = 'connected'
      console.log('✅ WhatsApp connected!')
      if (PAIR_ONLY) {
        console.log('✅ Pairing complete. Credentials saved.')
        setTimeout(() => process.exit(0), 2000)
      }
    }
  })

  sock.ev.on('messages.upsert', ({ messages }) => {
    for (const m of messages) {
      if (!m.message) continue
      const chatId = m.key.remoteJid ?? ''
      if (chatId.endsWith('@g.us')) continue // groups: v1 out of scope
      if (chatId === 'status@broadcast') continue
      const senderId = m.key.participant || chatId
      if (m.key.fromMe) continue // never queue our own echoes
      if (!allowed(senderId)) {
        console.log(`[bridge] ignored inbound from ${senderId} (not in ALLOWED_USERS)`)
        continue
      }
      const body = extractText(m.message)
      if (body === null) continue
      pushMessage({
        id: m.key.id ?? `${chatId}:${m.messageTimestamp}`,
        chatId,
        fromMe: false,
        senderId,
        pushName: m.pushName ?? null,
        body,
        type: m.message.conversation ? 'text' : 'unknown',
        timestamp: typeof m.messageTimestamp === 'number' ? m.messageTimestamp * 1000 : Date.now(),
      })
    }
  })
}

function extractText(message: NonNullable<WAMessage['message']>): string | null {
  const msg = message as {
    conversation?: string
    extendedTextMessage?: { text?: string }
    imageMessage?: { caption?: string }
    videoMessage?: { caption?: string }
  }
  if (msg.conversation) return msg.conversation
  if (msg.extendedTextMessage?.text) return msg.extendedTextMessage.text
  if (msg.imageMessage?.caption) return `[image] ${msg.imageMessage.caption}`
  if (msg.videoMessage?.caption) return `[video] ${msg.videoMessage.caption}`
  return null // non-text (audio/sticker/…) skipped in v1
}

// ---------------------------------------------------------------------------
// HTTP API
// ---------------------------------------------------------------------------
function sendJson(res: import('node:http').ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { 'content-type': 'application/json' })
  res.end(JSON.stringify(body))
}

function readBody(req: import('node:http').IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve) => {
    let data = ''
    req.on('data', (c) => (data += c))
    req.on('end', () => {
      try {
        resolve(JSON.parse(data || '{}'))
      } catch {
        resolve({})
      }
    })
  })
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://${req.headers.host ?? '127.0.0.1'}`)
  const path = url.pathname

  if (req.method === 'GET' && path === '/health') {
    sendJson(res, 200, {
      status: connectionState,
      registered,
      number: sock?.user?.id ?? null,
      uptime: (Date.now() - startTs) / 1000,
    })
    return
  }

  if (req.method === 'POST' && path === '/send') {
    if (!sock || connectionState !== 'connected') {
      sendJson(res, 503, { error: 'Not connected to WhatsApp' })
      return
    }
    const body = await readBody(req)
    const { chatId, message, replyTo } = body
    if (typeof chatId !== 'string' || typeof message !== 'string' || !message) {
      sendJson(res, 400, { error: 'chatId and message are required' })
      return
    }
    try {
      const messageIds: string[] = []
      const chunks = chunkText(message)
      for (const chunk of chunks) {
        const sent = await sock.sendMessage(chatId, { text: chunk })
        if (sent?.key?.id) messageIds.push(sent.key.id)
        if (chunks.length > 1) await sleep(200)
      }
      sendJson(res, 200, { success: true, messageId: messageIds[messageIds.length - 1], messageIds })
    } catch (err) {
      sendJson(res, 500, { error: (err as Error).message })
    }
    return
  }

  if (req.method === 'GET' && path === '/messages') {
    sendJson(res, 200, queue.splice(0, queue.length))
    return
  }

  if (req.method === 'POST' && path === '/typing') {
    if (!sock || connectionState !== 'connected') {
      sendJson(res, 503, { error: 'Not connected to WhatsApp' })
      return
    }
    const body = await readBody(req)
    if (typeof body.chatId !== 'string') {
      sendJson(res, 400, { error: 'chatId is required' })
      return
    }
    try {
      await sock.sendPresenceUpdate('composing', body.chatId)
      sendJson(res, 200, { success: true })
    } catch (err) {
      sendJson(res, 500, { error: (err as Error).message })
    }
    return
  }

  sendJson(res, 404, { error: 'not_found' })
})

function chunkText(text: string, max = 4096): string[] {
  if (text.length <= max) return [text]
  const out: string[] = []
  for (let i = 0; i < text.length; i += max) out.push(text.slice(i, i + max))
  return out
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[bridge] HTTP API on 0.0.0.0:${PORT}`)
  console.log(`[bridge] session dir: ${SESSION_DIR}`)
  if (PAIRING_PHONE) console.log(`[bridge] pairing-code mode for ${PAIRING_PHONE}`)
  else console.log('[bridge] QR mode — scan when the QR prints')
  void startSocket()
})

/**
 * whatsapp-web.js WhatsApp provider — drives WhatsApp Web through Puppeteer.
 *
 * Wraps the `whatsapp-web.js` Client (Apache-2.0) for the OpenTeleCRM chat-agent
 * surface. Pairs a number by QR (or phone pairing code), streams inbound /
 * outbound messages to the internal event bus (forwarded via
 * on('message')/on('status')), and sends plain text + interactive buttons.
 *
 * Auth/persistence: LocalAuth stores a Chrome profile + session per
 * agentSessionId under `.data/wwebjs/<agentSessionId>/`. Once paired, the
 * API/worker can boot later and reuse the saved session — no re-scan.
 *
 * JID translation: whatsapp-web.js uses `@c.us` suffixes for private chats
 * (the contract uses `@s.whatsapp.net`); the provider normalizes in/out so
 * the domain layer never sees `@c.us`.
 *
 * Templates are NOT supported here — the unofficial web channel cannot run
 * Meta-approved templates; the cloud-api driver is responsible for those.
 */
import { EventEmitter } from 'node:events';
// ESM interop: whatsapp-web.js is CJS and Node's cjs-module-lexer does NOT
// reliably detect its named exports — `import { LocalAuth } ...` crashes with
// "does not provide an export named 'LocalAuth'", and a namespace import
// yields undefined members at runtime ("LocalAuth is not a constructor").
// Load the real CJS module via createRequire; the type position still uses
// the package's own declarations. Same rule as Baileys' `proto`.
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const WWebJS = require('whatsapp-web.js') as typeof import('whatsapp-web.js');
const { Client, LocalAuth, MessageTypes } = WWebJS;
// Type-only namespace for TYPE positions (the runtime `WWebJS` const above
// can't be used as a namespace in type position).
import type * as WWebJs from 'whatsapp-web.js';
import type {
  WhatsAppContact,
  WhatsAppContactId,
  WhatsAppMessage,
  WhatsAppMessageType,
  WhatsAppProvider,
  WhatsAppSessionStatus,
  SendTextOptions,
} from '@opentelecrm/contracts';

type Status = WhatsAppSessionStatus['status'];
type EventCb = (arg: WhatsAppMessage | Status) => void;

/** Session directory: OPENTELECRM_DATA_DIR or repo .data. */
const DATA_ROOT =
  process.env.OPENTELECRM_DATA_DIR ?? new URL('../../../../.data', import.meta.url).pathname;
const WWEBJS_DIR = `${DATA_ROOT}/wwebjs`;

/** System Chrome (puppeteer download was skipped) — override for other paths. */
const CHROME_PATH =
  process.env.WA_PUPPETEER_EXECUTABLE ??
  '/usr/bin/google-chrome';

/** `@c.us` → contract `@s.whatsapp.net` (and back) for private chats. */
function toWWebJsJid(jid: WhatsAppContactId): string {
  return jid.replace(/@s\.whatsapp\.net$/, '@c.us');
}
function toContractJid(jid: string): WhatsAppContactId {
  return jid.replace(/@c\.us$/, '@s.whatsapp.net');
}

function isGroup(jid: string): boolean {
  return jid.endsWith('@g.us');
}

/** Map whatsapp-web.js MessageTypes to the contract's WhatsAppMessageType. */
function toContractType(type: WWebJs.MessageTypes): WhatsAppMessageType {
  switch (type) {
    case MessageTypes.TEXT:
      return 'text';
    case MessageTypes.IMAGE:
      return 'image';
    case MessageTypes.VIDEO:
      return 'video';
    case MessageTypes.AUDIO:
    case MessageTypes.VOICE:
      return 'audio';
    case MessageTypes.DOCUMENT:
      return 'document';
    case MessageTypes.STICKER:
      return 'sticker';
    case MessageTypes.LOCATION:
      return 'location';
    case MessageTypes.CONTACT_CARD:
    case MessageTypes.CONTACT_CARD_MULTI:
      return 'contact';
    case MessageTypes.REACTION:
      return 'reaction';
    default:
      return 'unknown';
  }
}

/** One live whatsapp-web.js session, scoped to an agentSessionId. */
interface WWebJsSessionRecord {
  agentSessionId: string;
  client: WWebJs.Client;
  status: Status;
  qr: string | null;
  screenName: string | null;
  contacts: Map<WhatsAppContactId, string>;
}

export class WWebJsWhatsAppProvider implements WhatsAppProvider {
  readonly kind = 'wwebjs' as const;
  readonly ownsSession = true;

  private static sessions = new Map<string, WWebJsSessionRecord>();
  private events = new EventEmitter();

  async connect(agentSessionId: string): Promise<WhatsAppSessionStatus> {
    const existing = WWebJsWhatsAppProvider.sessions.get(agentSessionId);
    if (existing) {
      // Re-announce current state; the client keeps running if already ready.
      return this.sessionStatus(agentSessionId);
    }

    const client = new Client({
      authStrategy: new LocalAuth({
        dataPath: `${WWEBJS_DIR}/${agentSessionId}`,
      }),
      puppeteer: {
        headless: true,
        executablePath: CHROME_PATH,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
      },
    });

    const record: WWebJsSessionRecord = {
      agentSessionId,
      client,
      status: 'connecting',
      qr: null,
      screenName: null,
      contacts: new Map(),
    };
    WWebJsWhatsAppProvider.sessions.set(agentSessionId, record);
    this.attach(record);

    // initialize() resolves on 'ready' but fires 'qr'/'code' while pairing —
    // do not await it here; poll sessionStatus instead.
    client
      .initialize()
      .catch((err) => {
        this.setStatus(record, 'dead');
        console.error(`[wwebjs] initialize failed for ${agentSessionId}:`, err);
      });

    return this.sessionStatus(agentSessionId);
  }

  async sessionStatus(agentSessionId: string): Promise<WhatsAppSessionStatus> {
    const session = this.require(agentSessionId);
    return {
      status: session.status,
      qrCode: session.qr,
      screenName: session.screenName,
    };
  }

  async isOnline(agentSessionId: string): Promise<boolean> {
    const session = WWebJsWhatsAppProvider.sessions.get(agentSessionId);
    return session?.status === 'ready';
  }

  async sendText(
    agentSessionId: string,
    to: WhatsAppContactId,
    text: string,
    options?: SendTextOptions,
  ): Promise<{ messageId: string }> {
    const session = this.require(agentSessionId);
    const chatId = toWWebJsJid(to);

    let message: WWebJs.Message;
    if (options?.buttons?.length) {
      const btn = new WWebJS.Buttons(
        text,
        options.buttons.map((b) => ({ id: b.id, body: b.title })),
        undefined,
        'OpenTeleCRM',
      );
      message = await session.client.sendMessage(chatId, btn);
    } else {
      message = await session.client.sendMessage(chatId, text);
    }

    const messageId = message.id._serialized ?? `out-${Date.now()}`;
    this.events.emit('message', {
      id: messageId,
      chatId: to,
      fromMe: true,
      direction: 'outbound',
      type: 'text',
      body: text,
      timestamp: Date.now(),
      replyToId: options?.replyToId ?? null,
    });
    return { messageId };
  }

  async sendTemplate(
    agentSessionId: string,
    _to: WhatsAppContactId,
    _templateName: string,
    _languageCode: string,
    _components: Record<string, unknown>[],
  ): Promise<{ messageId: string }> {
    // Unofficial web driver cannot run Meta-approved templates. The cloud-api
    // driver owns ban-safe broadcast; bail loudly to avoid silent fallbacks.
    this.require(agentSessionId);
    throw new Error('templates require cloud-api driver, not whatsapp-web.js');
  }

  async resolveContact(
    agentSessionId: string,
    jid: WhatsAppContactId,
  ): Promise<WhatsAppContact | null> {
    const session = WWebJsWhatsAppProvider.sessions.get(agentSessionId);
    if (!session) return null;
    const cached = session.contacts.get(jid);
    if (cached !== undefined) return { id: jid, name: cached };

    try {
      const contact = await session.client.getContactById(toWWebJsJid(jid));
      const name =
        contact.name ?? contact.pushname ?? contact.number ?? jid;
      session.contacts.set(jid, name);
      return { id: jid, name };
    } catch {
      return null;
    }
  }

  on(event: 'message' | 'status', cb: EventCb): () => void {
    this.events.on(event, cb);
    return () => this.events.off(event, cb);
  }

  async disconnect(agentSessionId: string): Promise<void> {
    const session = WWebJsWhatsAppProvider.sessions.get(agentSessionId);
    if (!session) return;
    try {
      await session.client.destroy();
    } catch {
      // already gone
    }
    WWebJsWhatsAppProvider.sessions.delete(agentSessionId);
    this.events.emit('status', 'disconnected');
  }

  // ---- pairing helpers (used by the pairing CLI) ------------------------

  /** Request a phone pairing code (wwebjs `pairWithPhoneNumber` option). */
  async requestPairingCode(
    agentSessionId: string,
    phoneNumber: string,
  ): Promise<string> {
    const session = this.require(agentSessionId);
    // Race 1: wwebjs's requestPairingCode touches `client.pupPage` immediately,
    // but the page is only created after initialize() boots the browser and
    // loads web.whatsapp.com. NB: the field is initialized to `null` (not
    // undefined) — check both.
    const start = Date.now();
    while (
      (session.client as unknown as { pupPage?: unknown }).pupPage == null &&
      Date.now() - start < 30_000
    ) {
      await new Promise((r) => setTimeout(r, 250));
    }
    const page = (session.client as unknown as { pupPage?: { evaluate: (fn: () => unknown) => Promise<unknown> } })
      .pupPage;
    if (page == null) {
      throw new Error('wwebjs page did not initialize within 30s — cannot request pairing code');
    }
    // Race 2: requestPairingCode's in-page loop reads
    // `window.AuthStore.PairingCodeLinkUtils` and CRASHES (not spins) when
    // `window.AuthStore` is still undefined. Wait for the app store to boot.
    let authStoreReady = false;
    for (let i = 0; i < 120 && !authStoreReady; i++) {
      try {
        authStoreReady = Boolean(
          await page.evaluate(() => {
            const g = globalThis as { AuthStore?: unknown };
            return typeof g.AuthStore !== 'undefined';
          }),
        );
      } catch {
        // page may still be mid-navigation — keep polling
      }
      if (!authStoreReady) await new Promise((r) => setTimeout(r, 250));
    }
    if (!authStoreReady) {
      throw new Error('wwebjs AuthStore did not boot within 30s — cannot request pairing code');
    }
    const code = await session.client.requestPairingCode(phoneNumber);
    return code;
  }

  // ---- internals ---------------------------------------------------------

  private require(agentSessionId: string): WWebJsSessionRecord {
    const session = WWebJsWhatsAppProvider.sessions.get(agentSessionId);
    if (!session) {
      throw new Error(`wwebjs session not connected: ${agentSessionId}`);
    }
    return session;
  }

  private setStatus(session: WWebJsSessionRecord, status: Status, qr?: string | null): void {
    session.status = status;
    if (qr !== undefined && qr !== null) {
      session.qr = qr;
      this.events.emit('qr' as never, qr);
    }
    this.events.emit('status', status);
  }

  private attach(session: WWebJsSessionRecord): void {
    const { client } = session;

    client.on('qr', (qr: string) => {
      this.setStatus(session, 'paired', qr);
    });

    client.on('code', (code: string) => {
      this.events.emit('code' as never, code);
    });

    client.on('authenticated', () => {
      session.qr = null;
    });

    client.on('auth_failure', (msg: string) => {
      console.error(`[wwebjs] auth failure for ${session.agentSessionId}:`, msg);
      this.setStatus(session, 'dead');
    });

    client.on('ready', () => {
      session.screenName =
        client.info?.pushname ?? client.info?.wid?.user ?? 'WhatsApp';
      this.setStatus(session, 'ready');
    });

    client.on('change_state', (state: string) => {
      // WAState: UNPAIRED/UNPAIRED_IDLE → pairing, CONNECTED → ready,
      // others → disconnected.
      if (state === 'CONNECTED') this.setStatus(session, 'ready');
      else if (state === 'UNPAIRED' || state === 'UNPAIRED_IDLE' || state === 'PAIRING') {
        this.setStatus(session, 'paired');
      } else if (session.status === 'ready' || session.status === 'paired') {
        this.setStatus(session, 'disconnected');
      }
    });

    client.on('disconnected', (reason: string) => {
      session.qr = null;
      if (reason === 'LOGOUT') {
        this.setStatus(session, 'dead');
      } else {
        this.setStatus(session, 'disconnected');
      }
    });

    client.on('message', (msg: WWebJs.Message) => {
      const normalized = this.toWhatsAppMessage(msg);
      if (normalized) this.events.emit('message', normalized);
    });
  }

  /** Translate a whatsapp-web.js Message into the contract shape. */
  private toWhatsAppMessage(msg: WWebJs.Message): WhatsAppMessage | null {
    const chatId = msg.from;
    if (!chatId) return null;
    if (chatId === 'status@broadcast') return null; // skip status stories
    const contractChatId = toContractJid(chatId);

    return {
      id: msg.id._serialized ?? `${chatId}:${msg.timestamp}`,
      chatId: contractChatId,
      fromMe: msg.fromMe,
      direction: msg.fromMe ? 'outbound' : 'inbound',
      type: toContractType(msg.type),
      body: msg.body ?? '',
      timestamp: msg.timestamp ? msg.timestamp * 1000 : Date.now(),
      mediaUrl: null, // media download is a later phase
      mimeType: null,
      replyToId: null, // quoted message resolution is a later phase
      isGroup: isGroup(chatId),
    };
  }
}

/**
 * Baileys WhatsApp provider — unofficial multi-device web driver.
 *
 * Wraps @whiskeysockets/baileys makeWASocket for the OpenTeleCRM chat-agent
 * surface. Pairs a number by QR, streams inbound/outbound messages to the
 * internal event bus (forwarded via on('message')/on('status')), and sends
 * plain text + interactive buttons.
 *
 * v1 keeps credentials in-memory per agentSessionId. The auth store is shaped
 * as a SignalKeyStore + saveCreds hook so it can be swapped for a DB-backed
 * persistence layer (persistToDb) in a later phase without touching callers.
 *
 * Templates are NOT supported here — the unofficial web channel cannot run
 * Meta-approved templates; the cloud-api driver is responsible for those.
 */
import { EventEmitter } from 'node:events';
import * as Baileys from '@whiskeysockets/baileys';
import { FileCredentialStore, type BaileysCredentialStore } from './credential-store.js';

// Destructure runtime pieces from the namespace import. `proto` is a CJS
// export not exposed as a named ESM binding, hence the namespace access.
// NOTE: Baileys ALSO declares a global `proto` type namespace (proto.IMessage
// etc.) which we use in TYPE positions below — the runtime value is aliased to
// `protoVal` so the const doesn't shadow the global type namespace.
const { makeWASocket, initAuthCreds, generateWAMessageFromContent, DisconnectReason } = Baileys;
const protoVal = Baileys.proto;
type WASocket = Baileys.WASocket;
type AuthenticationCreds = Baileys.AuthenticationCreds;
type SignalKeyStore = Baileys.SignalKeyStore;
type SignalDataTypeMap = Baileys.SignalDataTypeMap;
type SignalDataSet = Baileys.SignalDataSet;
type WAMessage = Baileys.WAMessage;
type WAConnectionState = Baileys.WAConnectionState;
import type {
  WhatsAppContact,
  WhatsAppContactId,
  WhatsAppMessage,
  WhatsAppMessageType,
  WhatsAppProvider,
  WhatsAppSessionStatus,
  SendTextOptions,
} from '@opentelecrm/contracts';

/** Contract status string + the raw WS connection state we read from Baileys. */
type Status = WhatsAppSessionStatus['status'];

/** Callbacks objects the internal EventEmitter fans out to. */
interface ProviderEvents {
  message: WhatsAppMessage;
  status: Status;
  /** Supplementary QR stream (not part of the WhatsAppProvider contract). */
  qr: string;
}

/**
 * Persistence seam. Implementations (FileCredentialStore, NoopCredentialStore)
 * live in credential-store.ts — kept here as a type re-export for imports.
 */
export type { BaileysCredentialStore } from './credential-store.js';

/** No-op store — kept for tests that must not touch disk. */
class NoopCredentialStore implements BaileysCredentialStore {
  loadCreds(): Promise<AuthenticationCreds | null> {
    return Promise.resolve(null);
  }
  saveCreds(): Promise<void> {
    return Promise.resolve();
  }
  loadKeys(): Promise<SignalDataSet> {
    return Promise.resolve({});
  }
  saveKeys(): Promise<void> {
    return Promise.resolve();
  }
}

/** In-memory SignalKeyStore keyed `<type>:<id>`, with an async persistence hook. */
class InMemorySignalKeyStore implements SignalKeyStore {
  private store = new Map<string, unknown>();

  constructor(
    private readonly agentSessionId: string,
    private readonly persist: BaileysCredentialStore,
  ) {}

  async get<T extends keyof SignalDataTypeMap>(
    type: T,
    ids: string[],
  ): Promise<{ [id: string]: SignalDataTypeMap[T] }> {
    const out: Record<string, unknown> = {};
    for (const id of ids) {
      const value = this.store.get(`${type}:${id}`);
      if (value !== undefined) out[id] = value;
    }
    return out as { [id: string]: SignalDataTypeMap[T] };
  }

  async set(data: SignalDataSet): Promise<void> {
    for (const [type, entries] of Object.entries(data)) {
      if (!entries) continue;
      for (const [id, value] of Object.entries(entries)) {
        const key = `${type}:${id}`;
        if (value === null || value === undefined) this.store.delete(key);
        else this.store.set(key, value);
      }
    }
    // Structured for DB persistence later — currently the no-op store drops it.
    await this.persist.saveKeys(this.agentSessionId, data).catch(() => undefined);
  }
}

/** One live Baileys session, scoped to an agentSessionId. */
export interface BaileysSessionRecord {
  agentSessionId: string;
  sock: WASocket;
  creds: AuthenticationCreds;
  keys: SignalKeyStore;
  status: Status;
  qr: string | null;
  connection: WAConnectionState | null;
  screenName: string | null;
  contactsSyncing: boolean;
  /** jid -> display name cache from contacts.upsert / history sync. */
  contacts: Map<WhatsAppContactId, string>;
}

/**
 * Translate a Baileys message payload into the normalized WhatsAppMessage
 * contract shape.
 */
function toWhatsAppMessage(raw: WAMessage): WhatsAppMessage | null {
  const chatId = raw.key?.remoteJid;
  if (!chatId) return null;
  if (chatId === 'status@broadcast') return null; // skip status stories
  const m = raw.message;
  if (!m) return null;

  const fromMe = !!raw.key.fromMe;
  const type = inferType(m);

  const contextInfo =
    m.extendedTextMessage?.contextInfo ??
    m.imageMessage?.contextInfo ??
    m.videoMessage?.contextInfo ??
    m.audioMessage?.contextInfo ??
    m.documentMessage?.contextInfo ??
    undefined;

  return {
    id: raw.key.id ?? `${chatId}:${epochMs(raw.messageTimestamp)}`,
    chatId,
    fromMe,
    direction: fromMe ? 'outbound' : 'inbound',
    type,
    body: extractBody(m),
    timestamp: epochMs(raw.messageTimestamp),
    mediaUrl: null, // media streaming/download is a later phase
    mimeType:
      m.imageMessage?.mimetype ??
      m.videoMessage?.mimetype ??
      m.audioMessage?.mimetype ??
      m.documentMessage?.mimetype ??
      null,
    replyToId: contextInfo?.stanzaId ?? null,
    isGroup: chatId.endsWith('@g.us'),
  };
}

function inferType(m: Baileys.proto.IMessage): WhatsAppMessageType {
  if (m.conversation || m.extendedTextMessage) return 'text';
  if (m.imageMessage) return 'image';
  if (m.videoMessage) return 'video';
  if (m.audioMessage) return 'audio';
  if (m.documentMessage) return 'document';
  if (m.stickerMessage) return 'sticker';
  if (m.locationMessage) return 'location';
  if (m.contactMessage || m.contactsArrayMessage) return 'contact';
  if (m.reactionMessage) return 'reaction';
  return 'unknown';
}

function extractBody(m: Baileys.proto.IMessage): string {
  return (
    m.conversation ??
    m.extendedTextMessage?.text ??
    m.imageMessage?.caption ??
    m.videoMessage?.caption ??
    m.documentMessage?.caption ??
    ''
  );
}

/** proto.IWebMessageInfo.messageTimestamp is epoch-seconds (Long | number). */
function epochMs(ts: unknown): number {
  if (ts === null || ts === undefined) return Date.now();
  const withToNumber = ts as { toNumber?: () => number };
  const n = typeof withToNumber.toNumber === 'function' ? withToNumber.toNumber() : Number(ts);
  return n < 1e12 ? n * 1000 : n;
}

export class BaileysWhatsAppProvider implements WhatsAppProvider {
  readonly kind = 'baileys' as const;
  readonly ownsSession = true;

  /** All live Baileys sessions, keyed by agentSessionId. */
  private static readonly sessions = new Map<string, BaileysSessionRecord>();

  private readonly events = new EventEmitter();
  private readonly persist: BaileysCredentialStore;
  private readonly constructorOptions?: {
    browser: [string, string, string];
  };

  constructor(options?: { persist?: BaileysCredentialStore; browser?: [string, string, string] }) {
    this.persist = options?.persist ?? new FileCredentialStore();
    this.constructorOptions = {
      browser: options?.browser ?? ['OpenTeleCRM', 'Chrome', '7.0.0'],
    };
  }

  /** Static accessor for the session record of a given agentSessionId. */
  static getSession(agentSessionId: string): BaileysSessionRecord | undefined {
    return BaileysWhatsAppProvider.sessions.get(agentSessionId);
  }

  /** Drop a session record (used by the session manager on teardown). */
  static dropSession(agentSessionId: string): void {
    BaileysWhatsAppProvider.sessions.delete(agentSessionId);
  }

  async connect(agentSessionId: string): Promise<WhatsAppSessionStatus> {
    const existing = BaileysWhatsAppProvider.sessions.get(agentSessionId);
    if (existing) {
      return this.sessionStatus(agentSessionId);
    }

    const loaded = (await this.persist.loadCreds(agentSessionId)) ?? initAuthCreds();
    // If a pairing-code attempt left a partial `me` (from requestPairingCode)
    // but the device was never registered, strip it so the socket re-enters
    // registration mode instead of sending a login node the server rejects.
    const creds: AuthenticationCreds =
      loaded.me && !loaded.registered
        ? { ...loaded, me: undefined, pairingCode: undefined }
        : loaded;
    const keys = new InMemorySignalKeyStore(agentSessionId, this.persist);

    // WhatsApp rejects registration handshakes from stale client versions.
    // Fetch the latest supported WA web version at connect time and pin it.
    let version: [number, number, number] | undefined;
    try {
      const { version: latest } = await Baileys.fetchLatestBaileysVersion();
      version = latest;
    } catch {
      // network hiccup — fall back to letting Baileys use its default
    }

    const sock = makeWASocket({
      printQRInTerminal: false,
      auth: { creds, keys },
      browser: this.constructorOptions?.browser ?? ['OpenTeleCRM', 'Chrome', '7.0.0'],
      syncFullHistory: false,
      markOnlineOnConnect: true,
      version,
      connectTimeoutMs: 60_000,
      keepAliveIntervalMs: 30_000,
    });

    const record: BaileysSessionRecord = {
      agentSessionId,
      sock,
      creds,
      keys,
      status: 'connecting',
      qr: null,
      connection: null,
      screenName: creds.me?.name ?? null,
      contactsSyncing: false,
      contacts: new Map(),
    };

    BaileysWhatsAppProvider.sessions.set(agentSessionId, record);
    this.attach(agentSessionId, record);
    return this.sessionStatus(agentSessionId);
  }

  async sessionStatus(agentSessionId: string): Promise<WhatsAppSessionStatus> {
    const session = this.require(agentSessionId);
    return {
      status: session.status,
      qrCode: session.qr,
      screenName: session.screenName,
      contactsSyncing: session.contactsSyncing,
    };
  }

  async isOnline(agentSessionId: string): Promise<boolean> {
    const session = BaileysWhatsAppProvider.sessions.get(agentSessionId);
    if (!session) return false;
    if (session.connection === 'open' || session.status === 'ready') return true;
    return false;
  }

  async sendText(
    agentSessionId: string,
    to: WhatsAppContactId,
    text: string,
    options?: SendTextOptions,
  ): Promise<{ messageId: string }> {
    const session = this.require(agentSessionId);
    const quoted = options?.replyToId
      ? ({ key: { remoteJid: to, fromMe: true, id: options.replyToId } } as WAMessage)
      : undefined;

    let messageId: string;
    if (options?.buttons?.length) {
      const body = protoVal.Message.fromObject({
        buttonsMessage: {
          contentText: text,
          footerText: 'OpenTeleCRM',
          headerType: 1,
          buttons: options.buttons.map((b) => ({
            buttonId: b.id,
            buttonText: { displayText: b.title },
            type: 1,
          })),
          contextInfo: quoted ? { stanzaId: options.replyToId } : undefined,
        },
      });
      const waMsg = generateWAMessageFromContent(to, body, {
        timestamp: new Date(),
        userJid: session.sock.user?.id ?? to,
      });
      messageId = waMsg.key.id ?? (await session.sock.relayMessage(to, waMsg.message!, { messageId: waMsg.key.id ?? undefined }));
    } else {
      const sent = await session.sock.sendMessage(to, { text }, quoted ? { quoted } : undefined);
      messageId = (sent?.key?.id as string | undefined) ?? `out-${Date.now()}`;
    }

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
    throw new Error('templates require cloud-api driver, not baileys');
  }

  async resolveContact(
    agentSessionId: string,
    jid: WhatsAppContactId,
  ): Promise<WhatsAppContact | null> {
    const session = BaileysWhatsAppProvider.sessions.get(agentSessionId);
    const cachedName = session?.contacts.get(jid) ?? null;

    if (session) {
      // Attempt a live status read; otherwise return the cached/fallback stub.
      try {
        await session.sock.fetchStatus(jid);
      } catch {
        // unknown jid / not on WhatsApp — fall through to stub
      }
    }

    return { id: jid, name: cachedName, pushName: cachedName };
  }

  on(event: 'message' | 'status', cb: (msg: WhatsAppMessage | Status) => void): () => void {
    const ee = this.events;
    // Discriminate by event: pass the message or the status string through.
    if (event === 'message') {
      const h = (arg: unknown) => {
        if (arg && typeof arg === 'object' && 'chatId' in (arg as object)) cb(arg as WhatsAppMessage);
      };
      ee.on('message', h);
      return () => {
        ee.off('message', h);
      };
    }
    const h2 = (arg: unknown) => {
      if (typeof arg === 'string') cb(arg as Status);
    };
    ee.on('status', h2);
    return () => {
      ee.off('status', h2);
    };
  }

  /**
   * Supplementary QR stream for pairing UIs. Not part of the WhatsAppProvider
   * contract — yields the latest raw QR string as it is regenerated.
   */
  onQr(cb: (qr: string) => void): () => void {
    const handler = (qr: string) => cb(qr);
    this.events.on('qr', handler);
    return () => {
      this.events.off('qr', handler);
    };
  }

  async disconnect(agentSessionId: string): Promise<void> {
    const session = BaileysWhatsAppProvider.sessions.get(agentSessionId);
    if (!session) return;
    session.status = 'disconnected';
    session.sock.end(new Error('disconnect requested'));
    this.setStatus(session, 'disconnected');
    BaileysWhatsAppProvider.dropSession(agentSessionId);
  }

  /**
   * Request a pairing code instead of a QR. The phone number must be the full
   * international digits (e.g. '918465067156') WITHOUT '+' or the '@s.whatsapp.net'
   * suffix. Returns the 8-digit code, which the user enters in
   * WhatsApp > Settings > Linked devices > Link with phone number.
   */
  async requestPairingCode(agentSessionId: string, phoneNumber: string): Promise<string> {
    const session = this.require(agentSessionId);
    const sock = session.sock;

    // The socket needs a live WS to the WA server before it can ask for a
    // pairing code. The QR event normally guarantees this, but wait briefly
    // in case we're called slightly before the handshake settles.
    for (let i = 0; i < 30 && !sock.ws?.isOpen; i++) {
      await new Promise((r) => setTimeout(r, 200));
    }
    if (!sock.ws?.isOpen) {
      throw new Error('baileys socket not connected — cannot request pairing code');
    }

    const code = await sock.requestPairingCode(phoneNumber);
    return code;
  }

  // ---- internals ---------------------------------------------------------

  private require(agentSessionId: string): BaileysSessionRecord {
    const session = BaileysWhatsAppProvider.sessions.get(agentSessionId);
    if (!session) {
      throw new Error(`baileys session not connected: ${agentSessionId}`);
    }
    return session;
  }

  private setStatus(session: BaileysSessionRecord, status: Status, qr?: string | null): void {
    session.status = status;
    if (qr !== undefined && qr !== null) {
      session.qr = qr;
      this.events.emit('qr', qr);
    }
    this.events.emit('status', status);
  }

  private attach(agentSessionId: string, session: BaileysSessionRecord): void {
    const { sock } = session;

    sock.ev.on('connection.update', (update) => {
      if (update.qr) {
        session.qr = update.qr;
        this.events.emit('qr', update.qr);
      }
      session.connection = update.connection ?? session.connection;

      if (update.connection === 'close') {
        session.qr = null;
        const err = update.lastDisconnect?.error as
          | { output?: { statusCode?: number } }
          | undefined;
        const code = err?.output?.statusCode;
        const dead =
          code === DisconnectReason.loggedOut ||
          code === DisconnectReason.badSession ||
          code === DisconnectReason.multideviceMismatch ||
          code === DisconnectReason.forbidden;
        this.setStatus(session, dead ? 'dead' : 'disconnected');
        // Drop the stale record so a subsequent connect() creates a fresh
        // socket instead of returning the dead record immediately.
        BaileysWhatsAppProvider.dropSession(agentSessionId);
        return;
      }

      if (update.connection === 'open') {
        // `receivedPendingNotifications` flips true when history is flushed,
        // i.e. the socket is fully usable — that is our "ready" moment.
        const ready = update.receivedPendingNotifications === true;
        session.screenName = session.creds.me?.name ?? session.screenName;
        this.setStatus(session, ready ? 'ready' : 'paired');
        if (update.isOnline === false) this.setStatus(session, 'connecting');
        return;
      }

      if (session.connection === 'connecting') {
        this.setStatus(session, 'connecting', session.qr);
      }
    });

    // Key material changed (QR scanned) -> refresh creds + push through store.
    sock.ev.on('creds.update', (partial) => {
      Object.assign(session.creds, partial);
      session.screenName = session.creds.me?.name ?? session.screenName;
      void this.persist.saveCreds(agentSessionId, session.creds).catch(() => undefined);
    });

    sock.ev.on('contacts.upsert', (contacts) => {
      for (const c of contacts) {
        if (c.id && c.name) session.contacts.set(c.id, c.name);
        if (c.id && c.notify) session.contacts.set(c.id, c.notify);
      }
    });

    const forward = (raw: WAMessage) => {
      const msg = toWhatsAppMessage(raw);
      if (msg) this.events.emit('message', msg);
    };

    sock.ev.on('messages.upsert', ({ messages }) => {
      for (const raw of messages) forward(raw);
    });

    sock.ev.on('messaging-history.set', ({ messages, contacts, progress }) => {
      session.contactsSyncing = progress !== null && progress !== undefined && progress < 100;
      for (const c of contacts) {
        if (c.id && c.name) session.contacts.set(c.id, c.name);
        if (c.id && c.notify) session.contacts.set(c.id, c.notify);
      }
      for (const raw of messages) forward(raw);
      if (progress === null || progress === undefined || progress >= 100) {
        session.contactsSyncing = false;
      }
    });

    // Presence/health: surface the machine on every update.
    this.events.emit('status', session.status);
  }
}
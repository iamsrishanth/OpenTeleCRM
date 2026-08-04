/**
 * Mock WhatsApp provider — in-memory, for tests and demos.
 * Implements the exact WhatsAppProvider contract. Simulates a paired session:
 * sendText echoes an outbound message to the event bus; callers can inject
 * inbound messages to simulate a contact replying.
 */
import type {
  WhatsAppContact,
  WhatsAppContactId,
  WhatsAppMessage,
  WhatsAppProvider,
  WhatsAppSessionStatus,
  SendTextOptions,
} from '@opentelecrm/contracts';

type EventCb = (msg: WhatsAppMessage) => void;
type StatusCb = (status: WhatsAppSessionStatus['status']) => void;

const SELF_JID = '919900000000@s.whatsapp.net';

export class MockWhatsAppProvider implements WhatsAppProvider {
  readonly kind = 'mock' as const;
  readonly ownsSession = true;

  private messageListeners: EventCb[] = [];
  private statusListeners: StatusCb[] = [];
  private status: WhatsAppSessionStatus['status'] = 'connecting';
  private seq = 0;
  private contacts = new Map<WhatsAppContactId, WhatsAppContact>();

  constructor() {
    this.contacts.set(SELF_JID, { id: SELF_JID, name: 'Mock Agent Number' });
  }

  async connect(_agentSessionId: string): Promise<WhatsAppSessionStatus> {
    this.status = 'ready';
    this.statusListeners.forEach((cb) => cb(this.status));
    return { status: this.status, screenName: 'Mock Agent Number' };
  }

  async sessionStatus(): Promise<WhatsAppSessionStatus> {
    return { status: this.status, screenName: 'Mock Agent Number' };
  }

  async isOnline(): Promise<boolean> {
    return this.status === 'ready';
  }

  async sendText(
    _agentSessionId: string,
    to: WhatsAppContactId,
    text: string,
    options?: SendTextOptions,
  ): Promise<{ messageId: string }> {
    if (this.status !== 'ready') {
      throw new Error('mock provider not ready');
    }
    const messageId = `mock-out-${++this.seq}`;
    const msg: WhatsAppMessage = {
      id: messageId,
      chatId: to,
      fromMe: true,
      direction: 'outbound',
      type: 'text',
      body: text,
      timestamp: Date.now(),
      replyToId: options?.replyToId ?? null,
    };
    this.messageListeners.forEach((cb) => cb(msg));
    return { messageId };
  }

  async sendTemplate(): Promise<{ messageId: string }> {
    // Mock always falls back to plain text behavior (no Meta templates).
    return this.sendText(SELF_JID, SELF_JID, '[template-placeholder]');
  }

  async resolveContact(_agentSessionId: string, jid: WhatsAppContactId): Promise<WhatsAppContact | null> {
    return this.contacts.get(jid) ?? null;
  }

  on(event: 'message' | 'status', cb: EventCb | StatusCb): () => void {
    if (event === 'message') {
      this.messageListeners.push(cb as EventCb);
      return () => {
        this.messageListeners = this.messageListeners.filter((l) => l !== cb);
      };
    }
    this.statusListeners.push(cb as StatusCb);
    return () => {
      this.statusListeners = this.statusListeners.filter((l) => l !== cb);
    };
  }

  async disconnect(): Promise<void> {
    this.status = 'disconnected';
    this.statusListeners.forEach((cb) => cb(this.status));
  }

  // ---- test helpers (not part of the contract) ---------------------------

  /** Simulate an inbound message from a contact (test/demo injection). */
  injectInbound(to: WhatsAppContactId, body: string, type: WhatsAppMessage['type'] = 'text'): WhatsAppMessage {
    const msg: WhatsAppMessage = {
      id: `mock-in-${++this.seq}`,
      chatId: to,
      fromMe: false,
      direction: 'inbound',
      type,
      body,
      timestamp: Date.now(),
    };
    this.messageListeners.forEach((cb) => cb(msg));
    return msg;
  }

  /** Register a fake contact so resolveContact works. */
  addContact(contact: WhatsAppContact): void {
    this.contacts.set(contact.id, contact);
  }
}

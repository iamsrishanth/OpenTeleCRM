/**
 * OpenTeleCRM — adapter contracts.
 *
 * Rule: every external system sits behind an interface defined here, with a
 * mock implementation used by tests. No concrete provider leaks upward.
 * This defines the WhatsApp provider surface (P2) and is where telephony/SMS/
 * email adapters will be added in later phases.
 */

// ---------------------------------------------------------------------------
// WhatsApp provider interface — implements TeleCRM's Chat Sync + Cloud API
// ---------------------------------------------------------------------------

export type WhatsAppContactId = string; // normalized JID: <number>@s.whatsapp.net

export interface WhatsAppContact {
  id: WhatsAppContactId;
  name?: string | null;
  pushName?: string | null;
}

export type WhatsAppMessageStatus =
  | 'received'
  | 'sent'
  | 'read'
  | 'delivered'
  | 'failed';

export type WhatsAppMessageType = 'text' | 'image' | 'video' | 'audio' | 'document' | 'sticker' | 'location' | 'contact' | 'reaction' | 'unknown';

export interface WhatsAppMessage {
  id: string;
  chatId: WhatsAppContactId;
  fromMe: boolean;
  direction: 'inbound' | 'outbound';
  type: WhatsAppMessageType;
  body: string;
  // 0 = received/sent time (epoch ms)
  timestamp: number;
  mediaUrl?: string | null;
  mimeType?: string | null;
  replyToId?: string | null;
  isGroup?: boolean;
}

export interface SendTextOptions {
  /** List interactive buttons (max 3) — Cloud API parity. */
  buttons?: { id: string; title: string }[];
  /** Reply — reduces queries by 90% (business-initiated within window). */
  replyToId?: string;
  /** Template name for cloud-api (ban-safe broadcast). */
  template?: string;
  templateParams?: string[];
}

export interface WhatsAppSessionStatus {
  status: 'connecting' | 'paired' | 'ready' | 'disconnected' | 'dead';
  qrCode?: string | null;
  screenName?: string | null;
  contactsSyncing?: boolean;
}

/**
 * The provider boundary. Every driver (mock, Baileys/WAHA unofficial-web,
 * Meta cloud-api) implements this exactly. Drivers handle their own transport,
 * session persistence and reconnect; the domain layer only sees this surface.
 */
export interface WhatsAppProvider {
  readonly kind: 'mock' | 'baileys' | 'cloud-api';
  readonly ownsSession: boolean;

  /** Connect + begin processing this number's session. Resolves a session status. */
  connect(agentSessionId: string): Promise<WhatsAppSessionStatus>;
  /** Poll pairing progress (QR, ready, failed). */
  sessionStatus(agentSessionId: string): Promise<WhatsAppSessionStatus>;

  /** Presence / connection check. */
  isOnline(agentSessionId: string): Promise<boolean>;

  /** Send a plain text message (with optional buttons / reply-to). */
  sendText(
    agentSessionId: string,
    to: WhatsAppContactId,
    text: string,
    options?: SendTextOptions,
  ): Promise<{ messageId: string }>;

  /** Send an interactive template message (cloud-api only; others reject). */
  sendTemplate(
    agentSessionId: string,
    to: WhatsAppContactId,
    templateName: string,
    languageCode: string,
    components: Record<string, unknown>[],
  ): Promise<{ messageId: string }>;

  /** Resolve the display name for a contact JID. */
  resolveContact(agentSessionId: string, jid: WhatsAppContactId): Promise<WhatsAppContact | null>;

  /**
   * Subscribe to events. cb receives a WhatsAppMessage for 'message' events or
   * a session status string for 'status' events (discriminate by the event
   * name). Returns an unsubscribe fn.
   */
  on(event: 'message' | 'status', cb: (arg: WhatsAppMessage | WhatsAppSessionStatus['status']) => void): () => void;

  /** Tear down a session cleanly. */
  disconnect(agentSessionId: string): Promise<void>;
}

// ---------------------------------------------------------------------------
// Broadcast / marketing contracts (A2.4)
// ---------------------------------------------------------------------------

export type BroadcastChannel = 'whatsapp';
export type BroadcastStatus = 'draft' | 'scheduled' | 'sending' | 'paused' | 'completed' | 'cancelled' | 'failed';

export interface BroadcastRecipientStatus {
  jid: WhatsAppContactId;
  status: 'queued' | 'sent' | 'delivered' | 'read' | 'failed' | 'opted_out';
  error?: string | null;
  sentAt?: number | null;
}

export interface BroadcastJob {
  id: string;
  enterpriseId: string;
  channel: BroadcastChannel;
  agentSessionId: string;
  templateName?: string | null;
  templateLanguageCode?: string | null;
  text?: string | null;
  recipients: BroadcastRecipientStatus[];
  status: BroadcastStatus;
  /** Outbound send throttle: messages per minute (jitter applied upstream). */
  throttlePerMinute: number;
  useCloudApi: boolean;
  createdAt: number;
  scheduledAt?: number | null;
}

// ---------------------------------------------------------------------------
// Consent / opt-out ledger (DPDP / TRAI DND compliance hooks)
// ---------------------------------------------------------------------------

export interface ConsentRecord {
  jid: WhatsAppContactId;
  optedIn: boolean;
  source: 'agent' | 'widget' | 'broadcast' | 'auto'| 'import';
  channel: 'whatsapp' | 'email' | 'sms' | 'call';
  changedAt: number;
  /** Reason / audit trail (who or what changed it). */
  note?: string | null;
}
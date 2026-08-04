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
 * The provider boundary. Every driver (mock, whatsapp-web.js, Meta cloud-api)
 * implements this exactly. Drivers handle their own transport, session
 * persistence and reconnect; the domain layer only sees this surface.
 */
export interface WhatsAppProvider {
  readonly kind: 'mock' | 'wwebjs' | 'cloud-api';
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

// ---------------------------------------------------------------------------
// Telephony provider interface — implements TeleCRM's call management (A1.x)
// ---------------------------------------------------------------------------

export type CallDirection = 'inbound' | 'outbound';

export type CallStatus =
  | 'queued'
  | 'ringing'
  | 'in-progress'
  | 'completed'
  | 'failed'
  | 'no-answer'
  | 'missed'
  | 'rejected'
  | 'busy'
  | 'cancelled';

export type CallDisposition =
  | 'answered'
  | 'no_answer'
  | 'busy'
  | 'not_connected'
  | 'wrong_number'
  | 'not_interested'
  | 'callback'
  | 'dnc'
  | 'converted'
  | 'follow_up'
  | 'other';

export interface CallRecord {
  id: string;
  enterpriseId: string;
  /** Linked lead when the number resolved (auto from caller-id / dialer). */
  leadId: string | null;
  direction: CallDirection;
  status: CallStatus;
  disposition: CallDisposition | null;
  /** E.164-normalized dialed/calling party number. */
  phone: string;
  startedAt: string;
  endedAt: string | null;
  durationSec: number;
  /** Talk time (excludes ring/wrap-up). */
  talkSec: number;
  ringSec: number;
  recordingId: string | null;
  trunk: string | null;
  did: string | null;
  agentUserId: string | null;
  note: string | null;
  createdAt: string;
}

export interface RecordingRef {
  id: string;
  callId: string;
  /** Short-lived signed URL (object storage). */
  url: string;
  mimeType: string;
  sizeBytes: number;
  durationSec: number;
  status: 'recorded' | 'processing' | 'ready' | 'failed';
}

/** Follow-up reminder (A1.5) — quick chips: 1h / 3h / tomorrow 10am / custom. */
export interface CallbackRequest {
  id: string;
  enterpriseId: string;
  leadId: string;
  dueAt: string;
  status: 'pending' | 'done' | 'cancelled' | 'missed';
  source: 'manual' | 'dialer' | 'automation' | 'call_disposition';
  channel: 'in_app' | 'whatsapp' | 'email' | 'push' | 'call';
  note: string | null;
  createdAt: string;
  completedAt: string | null;
}

/** Smart dialer queue candidate (A1.1). Score = priority; higher dials first. */
export interface DialerCandidate {
  leadId: string;
  identifier: string;
  phone: string;
  score: number;
  /** Human-readable priority breakdown, e.g. ["follow-up-due +500", "score +42"]. */
  reasons: string[];
  followUpDueAt: string | null;
  slaBreachRisk: number;
  leadScore: number;
  freshnessHours: number;
  lastDialedAt: string | null;
}

export type DialerMode = 'power' | 'preview' | 'progressive';

/**
 * The provider boundary for telephony. Every driver (mock, Asterisk ARI)
 * implements this exactly. The domain layer (dialer, caller-id, call logging)
 * only ever sees this surface — no PBX details leak upward.
 */
export interface TelephonyProvider {
  readonly kind: 'mock' | 'asterisk-ari';

  /** Place an outbound call; returns the provider-side call id. */
  dial(to: string, from?: string, context?: Record<string, unknown>): Promise<{ callId: string }>;

  /** Hang up an in-progress call. */
  hangup(callId: string): Promise<void>;

  /** Current status + elapsed seconds for a call (polled by the dialer). */
  callState(callId: string): Promise<{ status: CallStatus; durationSec: number }>;

  /** Start recording on a live call; returns a provider-side recording id. */
  startRecording(callId: string): Promise<{ recordingId: string }>;

  /** Stop recording; finalizes the audio object. */
  stopRecording(callId: string): Promise<{ recordingId: string }>;

  /**
   * Subscribe to lifecycle events. cb receives a CallRecord-ish update for
   * 'call' events or a status string for 'status' events (discriminate by the
   * event name). Returns an unsubscribe fn.
   */
  on(event: 'call' | 'status', cb: (arg: unknown) => void): () => void;
}

/** TRAI UCC/DND compliance hook: a number blocked from a channel. */
export interface DndEntry {
  phone: string;
  channel: 'call' | 'whatsapp' | 'sms' | 'all';
  source: 'trai' | 'enterprise' | 'agent';
  reason?: string | null;
  expiresAt?: string | null;
}
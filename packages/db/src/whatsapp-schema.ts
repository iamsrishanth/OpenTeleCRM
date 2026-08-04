/**
 * OpenTeleCRM — WhatsApp domain schema (TeleCRM Chat Sync / Cloud API parity).
 * All tables enterprise-scoped; RLS enabled by the shared rls.ts.
 * Conversation = a chat thread with one external contact for one agent number.
 * Message = individual WhatsApp message (in/out), persisted for the unified
 * inbox + auto lead-attribution.
 */
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

const withTimestamps = {
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
};

/** A WhatsApp Web multi-device session for one agent number (Baileys state). */
export const waSession = pgTable(
  'wa_session',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    enterpriseId: uuid('enterprise_id').notNull(),
    /** Display name / phone of the agent number this session represents. */
    screenName: varchar('screen_name', { length: 128 }),
    /** connecting | paired | ready | disconnected | dead */
    status: varchar('status', { length: 32 }).default('connecting').notNull(),
    /** QR code payload for the current pairing attempt (cleared after ready). */
    qrCode: text('qr_code'),
    /** Base64/JSON session creds (Baileys multi-device state); encrypted at rest in prod. */
    creds: jsonb('creds').$type<Record<string, unknown>>(),
    authVersion: integer('auth_version').default(1),
    lastPairedAt: timestamp('last_paired_at', { withTimezone: true }),
    ...withTimestamps,
  },
  (t) => [index('wasession_ent_idx').on(t.enterpriseId), uniqueIndex('wasession_ent_name_uq').on(t.enterpriseId, t.screenName)],
);

/** One chat thread: an external contact ↔ this enterprise's agent number. */
export const conversation = pgTable(
  'conversation',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    enterpriseId: uuid('enterprise_id').notNull(),
    /** The agent number session hosting this chat. */
    waSessionId: uuid('wa_session_id').notNull(),
    /** External contact JID: <number>@s.whatsapp.net */
    contactJid: varchar('contact_jid', { length: 128 }).notNull(),
    contactName: varchar('contact_name', { length: 255 }),
    /** Linked lead id if attribution resolved (auto from inbound number). */
    leadId: uuid('lead_id'),
    /** Last activity for sorting the inbox. */
    lastMessageAt: timestamp('last_message_at', { withTimezone: true }).defaultNow().notNull(),
    /** true when any participant is typing (presence). */
    isGroup: boolean('is_group').default(false).notNull(),
    unreadCount: integer('unread_count').default(0).notNull(),
    /** agent opt-out flag for broadcasts to this contact. */
    suppressedForBroadcast: boolean('suppressed_for_broadcast').default(false).notNull(),
    ...withTimestamps,
  },
  (t) => [
    index('convo_ent_idx').on(t.enterpriseId),
    uniqueIndex('convo_session_jid_uq').on(t.enterpriseId, t.waSessionId, t.contactJid),
    index('convo_lastmsg_idx').on(t.enterpriseId, t.lastMessageAt),
  ],
);

/** A persisted WhatsApp message (unified inbox + auto-attribution source). */
export const waMessage = pgTable(
  'wa_message',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    enterpriseId: uuid('enterprise_id').notNull(),
    conversationId: uuid('conversation_id')
      .notNull()
      .references(() => conversation.id, { onDelete: 'cascade' }),
    waMessageId: varchar('wa_message_id', { length: 128 }),
    /** inbound | outbound */
    direction: varchar('direction', { length: 16 }).notNull(),
    /** text|image|video|audio|document|sticker|location|contact|reaction|unknown */
    type: varchar('type', { length: 32 }).default('text').notNull(),
    body: text('body').notNull().default(''),
    /** received | sent | read | delivered | failed */
    status: varchar('status', { length: 16 }).default('received').notNull(),
    mediaUrl: text('media_url'),
    mimeType: varchar('mime_type', { length: 128 }),
    replyToId: varchar('reply_to_id', { length: 128 }),
    /** Which agent handled this conversation (if assigned). */
    assignedUserId: uuid('assigned_user_id'),
    source: varchar('source', { length: 32 }).default('whatsapp').notNull(),
    sentAt: timestamp('sent_at', { withTimezone: true }).defaultNow().notNull(),
    ...withTimestamps,
  },
  (t) => [
    index('wamsg_ent_idx').on(t.enterpriseId),
    index('wamsg_convo_idx').on(t.enterpriseId, t.conversationId, t.sentAt),
  ],
);

/** Message template (HSM) with cloud-api approval status sync. */
export const waTemplate = pgTable(
  'wa_template',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    enterpriseId: uuid('enterprise_id').notNull(),
    name: varchar('name', { length: 128 }).notNull(),
    /** PENDING | APPROVED | REJECTED | PAUSED (Meta approval lifecycle). */
    status: varchar('status', { length: 32 }).default('PENDING').notNull(),
    category: varchar('category', { length: 48 }).default('UTILITY'),
    languageCode: varchar('language_code', { length: 16 }).default('en'),
    /** Template body with {{1}} variables. */
    body: text('body').notNull(),
    header: jsonb('header').$type<Record<string, unknown>>(),
    footer: text('footer'),
    buttons: jsonb('buttons').$type<Record<string, unknown>[]>(),
    /** Meta template id on cloud-api (null for unofficial-web). */
    cloudTemplateId: varchar('cloud_template_id', { length: 128 }),
    rejectionReason: text('rejection_reason'),
    ...withTimestamps,
  },
  (t) => [index('watmpl_ent_idx').on(t.enterpriseId), uniqueIndex('watmpl_ent_name_uq').on(t.enterpriseId, t.name)],
);

/** A broadcast/marketing job (A2.4). */
export const waBroadcast = pgTable(
  'wa_broadcast',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    enterpriseId: uuid('enterprise_id').notNull(),
    name: varchar('name', { length: 128 }).notNull(),
    status: varchar('status', { length: 32 }).default('draft').notNull(),
    templateId: uuid('template_id').references(() => waTemplate.id, { onDelete: 'set null' }),
    /** Plain-text fallback (unofficial-web driver). */
    text: text('text'),
    agentSessionId: uuid('agent_session_id').notNull(),
    /** Send throttle: messages per minute. */
    throttlePerMinute: integer('throttle_per_minute').default(120).notNull(),
    useCloudApi: boolean('use_cloud_api').default(false).notNull(),
    /** jsonb: [{leadId?, jid, status, error?, sentAt?}] */
    recipients: jsonb('recipients').$type<Record<string, unknown>[]>().default([]).notNull(),
    scheduledAt: timestamp('scheduled_at', { withTimezone: true }),
    startedAt: timestamp('started_at', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    totalRecipients: integer('total_recipients').default(0).notNull(),
    deliveredCount: integer('delivered_count').default(0).notNull(),
    failedCount: integer('failed_count').default(0).notNull(),
    ...withTimestamps,
  },
  (t) => [index('wabcst_ent_idx').on(t.enterpriseId), index('wabcst_ent_status_idx').on(t.enterpriseId, t.status)],
);

/** Dop-out / consent ledger (DPDP + TRAI DND compliance hooks). */
export const consentLedger = pgTable(
  'consent_ledger',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    enterpriseId: uuid('enterprise_id').notNull(),
    contactJid: varchar('contact_jid', { length: 128 }).notNull(),
    channel: varchar('channel', { length: 16 }).notNull(),
    optedIn: boolean('opted_in').notNull(),
    source: varchar('source', { length: 24 }).notNull(),
    note: text('note'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index('consent_ent_idx').on(t.enterpriseId, t.contactJid, t.channel)],
);

export type WaSessionRow = typeof waSession.$inferSelect;
export type ConversationRow = typeof conversation.$inferSelect;
export type WaMessageRow = typeof waMessage.$inferSelect;
export type WaTemplateRow = typeof waTemplate.$inferSelect;
export type WaBroadcastRow = typeof waBroadcast.$inferSelect;
export type ConsentLedgerRow = typeof consentLedger.$inferSelect;

/** WhatsApp tenant tables — must be RLS-enforced with the core tables. */
export const WHATSAPP_TENANT_TABLES = [
  waSession,
  conversation,
  waMessage,
  waTemplate,
  waBroadcast,
  consentLedger,
] as const;
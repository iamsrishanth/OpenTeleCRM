/**
 * OpenTeleCRM — Telephony domain schema (dialer, call recordings, callbacks, DND).
 * All tables enterprise-scoped; RLS enabled by the shared rls.ts.
 * Calls link to leads + agents; recordings hang off calls; callbacks are
 * follow-up reminders; dnd_registry enforces TRAI UCC/DND suppression.
 */
import {
  bigint,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
  type AnyPgColumn,
} from 'drizzle-orm/pg-core';
import { lead, user } from './schema.js';

const withTimestamps = {
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
};

/**
 * One dialer call leg.
 * direction: inbound | outbound
 * status: queued | ringing | in-progress | completed | failed | no-answer |
 *         missed | rejected | busy | cancelled
 * disposition: answered | no_answer | busy | not_connected | wrong_number |
 *              not_interested | callback | dnc | converted | follow_up | other
 */
export const call = pgTable(
  'call',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    enterpriseId: uuid('enterprise_id').notNull(),
    leadId: uuid('lead_id').references(() => lead.id, { onDelete: 'set null' }),
    direction: varchar('direction', { length: 16 }).notNull(),
    status: varchar('status', { length: 32 }).notNull(),
    disposition: varchar('disposition', { length: 32 }),
    /** E.164 number dialed / calling from. */
    phone: varchar('phone', { length: 32 }).notNull(),
    startedAt: timestamp('started_at', { withTimezone: true }).defaultNow().notNull(),
    endedAt: timestamp('ended_at', { withTimezone: true }),
    durationSec: integer('duration_sec').default(0).notNull(),
    talkSec: integer('talk_sec').default(0).notNull(),
    ringSec: integer('ring_sec').default(0).notNull(),
    recordingId: uuid('recording_id').references((): AnyPgColumn => recording.id, { onDelete: 'set null' }),
    /** SIP trunk / carrier route the leg rode. */
    trunk: varchar('trunk', { length: 64 }),
    /** Number the call was placed to / received on. */
    did: varchar('did', { length: 32 }),
    agentUserId: uuid('agent_user_id').references(() => user.id, { onDelete: 'set null' }),
    note: text('note'),
    ...withTimestamps,
  },
  (t) => [
    index('call_ent_created_idx').on(t.enterpriseId, t.createdAt),
    index('call_ent_lead_idx').on(t.enterpriseId, t.leadId),
  ],
);

/**
 * Object-storage recording of a call leg.
 * status: recorded | processing | ready | failed
 */
export const recording = pgTable(
  'recording',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    enterpriseId: uuid('enterprise_id').notNull(),
    callId: uuid('call_id')
      .notNull()
      .references((): AnyPgColumn => call.id, { onDelete: 'cascade' }),
    /** Object-storage key (bucket-relative). */
    objectKey: varchar('object_key', { length: 512 }).notNull(),
    /** Signed / expiring URL for playback (never persisted long-term). */
    url: text('url'),
    mimeType: varchar('mime_type', { length: 128 }).default('audio/ogg'),
    sizeBytes: bigint('size_bytes', { mode: 'number' }).default(0).notNull(),
    durationSec: integer('duration_sec').default(0).notNull(),
    status: varchar('status', { length: 16 }).default('recorded').notNull(),
    ...withTimestamps,
  },
  (t) => [index('rec_ent_call_idx').on(t.enterpriseId, t.callId)],
);

/**
 * Follow-up reminder for a lead.
 * status: pending | done | cancelled | missed
 * source: manual | dialer | automation | call_disposition
 * channel: in_app | whatsapp | email | push | call
 */
export const callback = pgTable(
  'callback',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    enterpriseId: uuid('enterprise_id').notNull(),
    leadId: uuid('lead_id')
      .notNull()
      .references(() => lead.id, { onDelete: 'cascade' }),
    dueAt: timestamp('due_at', { withTimezone: true }).notNull(),
    status: varchar('status', { length: 16 }).default('pending').notNull(),
    source: varchar('source', { length: 32 }).default('manual').notNull(),
    channel: varchar('channel', { length: 16 }).default('in_app').notNull(),
    note: text('note'),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    ...withTimestamps,
  },
  (t) => [
    index('cb_ent_due_idx').on(t.enterpriseId, t.dueAt),
    index('cb_ent_lead_idx').on(t.enterpriseId, t.leadId),
  ],
);

/**
 * Do-Not-Disturb registry (TRAI UCC / DND compliance).
 * channel: call | whatsapp | sms | all
 * source: trai | enterprise | agent
 */
export const dndRegistry = pgTable(
  'dnd_registry',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    enterpriseId: uuid('enterprise_id').notNull(),
    /** E.164 number suppressed. */
    phone: varchar('phone', { length: 32 }).notNull(),
    channel: varchar('channel', { length: 16 }).default('call').notNull(),
    source: varchar('source', { length: 16 }).default('enterprise').notNull(),
    reason: text('reason'),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index('dnd_ent_phone_idx').on(t.enterpriseId, t.phone)],
);

export type CallRow = typeof call.$inferSelect;
export type RecordingRow = typeof recording.$inferSelect;
export type CallbackRow = typeof callback.$inferSelect;
export type DndRegistryRow = typeof dndRegistry.$inferSelect;

/** Telephony tenant tables — must be RLS-enforced with the core tables. */
export const TELEPHONY_TENANT_TABLES = [
  call,
  recording,
  callback,
  dndRegistry,
] as const;

/**
 * OpenTeleCRM — Drizzle schema (PostgreSQL 16).
 * Every table is enterprise-scoped. RLS is enabled on every tenant table and
 * wired to the `app.enterprise_id` session variable (see src/rls.ts).
 */
import { sql } from 'drizzle-orm';
import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

const withTimestamps = {
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
};

/** Top-level tenant boundary. */
export const enterprise = pgTable('enterprise', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  leadIdentifier: varchar('lead_identifier', { length: 64 }).default('phone').notNull(),
  timezone: varchar('timezone', { length: 64 }).default('Asia/Kolkata').notNull(),
  locale: varchar('locale', { length: 16 }).default('en-IN').notNull(),
  ...withTimestamps,
});

export const user = pgTable(
  'user',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    email: varchar('email', { length: 255 }).notNull(),
    name: varchar('name', { length: 255 }).notNull(),
    phone: varchar('phone', { length: 32 }),
    avatarUrl: text('avatar_url'),
    lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
    ...withTimestamps,
  },
  (t) => [index('user_email_idx').on(t.email)],
);

export const role = pgTable(
  'role',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    enterpriseId: uuid('enterprise_id')
      .notNull()
      .references(() => enterprise.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 64 }).notNull(),
    // owner | admin | manager | team_lead | agent | read_only | custom
    kind: varchar('kind', { length: 32 }).notNull(),
    permissions: jsonb('permissions').$type<string[]>().default([]).notNull(),
    isSystem: boolean('is_system').default(false).notNull(),
    ...withTimestamps,
  },
  (t) => [index('role_ent_idx').on(t.enterpriseId)],
);

export const teamMember = pgTable(
  'team_member',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    enterpriseId: uuid('enterprise_id')
      .notNull()
      .references(() => enterprise.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => user.id),
    roleId: uuid('role_id')
      .notNull()
      .references(() => role.id),
    availabilityState: varchar('availability_state', { length: 16 }).default('available').notNull(),
    shift: varchar('shift', { length: 64 }),
    skills: jsonb('skills').$type<string[]>().default([]),
    capacity: integer('capacity').default(100),
    ...withTimestamps,
  },
  (t) => [index('tm_ent_idx').on(t.enterpriseId), index('tm_user_idx').on(t.userId)],
);

export const pipeline = pgTable(
  'pipeline',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    enterpriseId: uuid('enterprise_id')
      .notNull()
      .references(() => enterprise.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 128 }).notNull(),
    wipLimit: integer('wip_limit'),
    ...withTimestamps,
  },
  (t) => [index('pipeline_ent_idx').on(t.enterpriseId)],
);

export const stage = pgTable(
  'stage',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    enterpriseId: uuid('enterprise_id')
      .notNull()
      .references(() => enterprise.id, { onDelete: 'cascade' }),
    pipelineId: uuid('pipeline_id')
      .notNull()
      .references(() => pipeline.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 128 }).notNull(),
    order: integer('order').default(0).notNull(),
    probability: integer('probability'),
    color: varchar('color', { length: 32 }),
    lost: boolean('lost').default(false).notNull(),
    ...withTimestamps,
  },
  (t) => [index('stage_ent_idx').on(t.enterpriseId), index('stage_pipe_idx').on(t.pipelineId)],
);

export const lostReason = pgTable(
  'lost_reason',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    enterpriseId: uuid('enterprise_id')
      .notNull()
      .references(() => enterprise.id, { onDelete: 'cascade' }),
    pipelineId: uuid('pipeline_id').references(() => pipeline.id, { onDelete: 'set null' }),
    label: varchar('label', { length: 255 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index('lostreason_ent_idx').on(t.enterpriseId)],
);

/** Immutable apiName per enterprise (TeleCRM parity: "Information → API Name"). */
export const leadField = pgTable(
  'lead_field',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    enterpriseId: uuid('enterprise_id')
      .notNull()
      .references(() => enterprise.id, { onDelete: 'cascade' }),
    apiName: varchar('api_name', { length: 64 }).notNull(),
    label: varchar('label', { length: 255 }).notNull(),
    type: varchar('type', { length: 32 }).notNull(),
    required: boolean('required').default(false).notNull(),
    unique: boolean('unique').default(false).notNull(),
    config: jsonb('config').$type<Record<string, unknown>>().default({}).notNull(),
    archivedAt: timestamp('archived_at', { withTimezone: true }),
    ...withTimestamps,
  },
  (t) => [index('leadfield_ent_idx').on(t.enterpriseId), index('leadfield_api_idx').on(t.enterpriseId, t.apiName)],
);

export const lead = pgTable(
  'lead',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    enterpriseId: uuid('enterprise_id')
      .notNull()
      .references(() => enterprise.id, { onDelete: 'cascade' }),
    identifier: varchar('identifier', { length: 255 }).notNull(),
    ownerUserId: uuid('owner_user_id').references(() => user.id, { onDelete: 'set null' }),
    assignedTeamMemberId: uuid('assigned_team_member_id').references(() => teamMember.id, {
      onDelete: 'set null',
    }),
    pipelineId: uuid('pipeline_id').references(() => pipeline.id, { onDelete: 'set null' }),
    stageId: uuid('stage_id').references(() => stage.id, { onDelete: 'set null' }),
    lostReasonId: uuid('lost_reason_id').references(() => lostReason.id, { onDelete: 'set null' }),
    source: varchar('source', { length: 64 }),
    score: integer('score'),
    tags: jsonb('tags').$type<string[]>().default([]),
    customFields: jsonb('custom_fields').$type<Record<string, unknown>>().default({}).notNull(),
    ...withTimestamps,
  },
  (t) => [
    index('lead_ent_idx').on(t.enterpriseId),
    index('lead_ident_idx').on(t.enterpriseId, t.identifier),
    index('lead_owner_idx').on(t.enterpriseId, t.ownerUserId),
    index('lead_pipe_stage_idx').on(t.enterpriseId, t.pipelineId, t.stageId),
  ],
);

export const actionType = pgTable(
  'action_type',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    enterpriseId: uuid('enterprise_id')
      .notNull()
      .references(() => enterprise.id, { onDelete: 'cascade' }),
    /** Numeric code; custom actions use e.g. "1001" (TeleCRM parity). */
    code: varchar('code', { length: 32 }).notNull(),
    name: varchar('name', { length: 128 }).notNull(),
    fieldSchema: jsonb('field_schema').$type<Record<string, unknown>>().default({}).notNull(),
    isSystem: boolean('is_system').default(false).notNull(),
    ...withTimestamps,
  },
  (t) => [index('actiontype_ent_idx').on(t.enterpriseId), index('actiontype_code_idx').on(t.enterpriseId, t.code)],
);

export const action = pgTable(
  'action',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    enterpriseId: uuid('enterprise_id')
      .notNull()
      .references(() => enterprise.id, { onDelete: 'cascade' }),
    leadId: uuid('lead_id')
      .notNull()
      .references(() => lead.id, { onDelete: 'cascade' }),
    actionTypeId: uuid('action_type_id')
      .notNull()
      .references(() => actionType.id),
    userId: uuid('user_id').references(() => user.id, { onDelete: 'set null' }),
    payload: jsonb('payload').$type<Record<string, unknown>>().default({}).notNull(),
    note: text('note'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index('action_ent_idx').on(t.enterpriseId), index('action_lead_idx').on(t.enterpriseId, t.leadId)],
);

export const apiToken = pgTable(
  'api_token',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    enterpriseId: uuid('enterprise_id')
      .notNull()
      .references(() => enterprise.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 128 }).notNull(),
    // async | sync — NOT interchangeable (TeleCRM parity)
    type: varchar('type', { length: 16 }).notNull(),
    tokenHash: varchar('token_hash', { length: 64 }).notNull(),
    tokenTail: varchar('token_tail', { length: 8 }).notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    ...withTimestamps,
  },
  (t) => [index('apitoken_ent_idx').on(t.enterpriseId)],
);

export const auditLog = pgTable(
  'audit_log',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    enterpriseId: uuid('enterprise_id')
      .notNull()
      .references(() => enterprise.id, { onDelete: 'cascade' }),
    actorUserId: uuid('actor_user_id').references(() => user.id, { onDelete: 'set null' }),
    actorTokenId: uuid('actor_token_id').references(() => apiToken.id, { onDelete: 'set null' }),
    action: varchar('action', { length: 64 }).notNull(),
    resourceType: varchar('resource_type', { length: 64 }).notNull(),
    resourceId: varchar('resource_id', { length: 64 }),
    before: jsonb('before'),
    after: jsonb('after'),
    ip: varchar('ip', { length: 64 }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index('audit_ent_idx').on(t.enterpriseId), index('audit_ent_created_idx').on(t.enterpriseId, t.createdAt)],
);

// Convenience row type exports for the API layer.
export type EnterpriseRow = typeof enterprise.$inferSelect;
export type UserRow = typeof user.$inferSelect;
export type TeamMemberRow = typeof teamMember.$inferSelect;
export type RoleRow = typeof role.$inferSelect;
export type PipelineRow = typeof pipeline.$inferSelect;
export type StageRow = typeof stage.$inferSelect;
export type LostReasonRow = typeof lostReason.$inferSelect;
export type LeadFieldRow = typeof leadField.$inferSelect;
export type LeadRow = typeof lead.$inferSelect;
export type ActionTypeRow = typeof actionType.$inferSelect;
export type ActionRow = typeof action.$inferSelect;
export type ApiTokenRow = typeof apiToken.$inferSelect;
export type AuditLogRow = typeof auditLog.$inferSelect;

/** Tenanted tables — the set RLS is applied to. */
export const TENANT_TABLES = [
  role,
  teamMember,
  pipeline,
  stage,
  lostReason,
  leadField,
  lead,
  actionType,
  action,
  apiToken,
  auditLog,
] as const;

// Helper for the time triggers.
export const setUpdateTimestamp = sql`(now())`;
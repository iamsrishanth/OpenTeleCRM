/**
 * OpenTeleCRM — Workforce management domain (ByteCodeEMS port).
 * Attendance (GPS check-in/out), EOD reports, task assignment, departments,
 * configurable metrics vs targets, weekly reports, and device-side call
 * tracking. All tables enterprise-scoped; RLS enabled by the shared rls.ts.
 */
import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
  type AnyPgColumn,
} from 'drizzle-orm/pg-core';
import { teamMember } from './schema.js';

const withTimestamps = {
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
};

/**
 * Team department (ByteCodeEMS `department`).
 * headMemberId points at the department head's team_member row.
 */
export const department = pgTable(
  'department',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    enterpriseId: uuid('enterprise_id').notNull(),
    name: varchar('name', { length: 128 }).notNull(),
    headMemberId: uuid('head_member_id').references(() => teamMember.id, { onDelete: 'set null' }),
    isActive: boolean('is_active').default(true).notNull(),
    ...withTimestamps,
  },
  (t) => [index('dept_ent_idx').on(t.enterpriseId), index('dept_ent_head_idx').on(t.enterpriseId, t.headMemberId)],
);

/**
 * One attendance day per member.
 * status: present | late | half_day | absent
 * Lateness rule: check-in after 09:30 → late; total hours < 4h → half_day.
 */
export const attendance = pgTable(
  'attendance',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    enterpriseId: uuid('enterprise_id').notNull(),
    memberId: uuid('member_id').notNull().references(() => teamMember.id, { onDelete: 'cascade' }),
    workDate: date('work_date').notNull(),
    checkInAt: timestamp('check_in_at', { withTimezone: true }),
    checkOutAt: timestamp('check_out_at', { withTimezone: true }),
    status: varchar('status', { length: 16 }).default('present').notNull(),
    totalHours: numeric('total_hours', { precision: 5, scale: 2 }),
    checkInLat: numeric('check_in_lat', { precision: 9, scale: 6 }),
    checkInLng: numeric('check_in_lng', { precision: 9, scale: 6 }),
    checkOutLat: numeric('check_out_lat', { precision: 9, scale: 6 }),
    checkOutLng: numeric('check_out_lng', { precision: 9, scale: 6 }),
    /** web | mobile */
    source: varchar('source', { length: 16 }).default('web').notNull(),
    ...withTimestamps,
  },
  (t) => [
    index('att_ent_date_idx').on(t.enterpriseId, t.workDate),
    index('att_ent_member_idx').on(t.enterpriseId, t.memberId),
  ],
);

/**
 * End-of-day report per member per working day.
 * status: submitted | late | missed
 * Late if submitted at/after 18:00; missed is set by the EOD cutoff job.
 */
export const eodReport = pgTable(
  'eod_report',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    enterpriseId: uuid('enterprise_id').notNull(),
    memberId: uuid('member_id').notNull().references(() => teamMember.id, { onDelete: 'cascade' }),
    reportDate: date('report_date').notNull(),
    summary: text('summary').notNull(),
    hoursWorked: numeric('hours_worked', { precision: 5, scale: 2 }),
    taskRefs: jsonb('task_refs').$type<string[]>().default([]).notNull(),
    submittedAt: timestamp('submitted_at', { withTimezone: true }).defaultNow().notNull(),
    status: varchar('status', { length: 16 }).default('submitted').notNull(),
    ...withTimestamps,
  },
  (t) => [
    index('eod_ent_date_idx').on(t.enterpriseId, t.reportDate),
    index('eod_ent_member_idx').on(t.enterpriseId, t.memberId),
  ],
);

/**
 * Assigned work item.
 * status: todo | in_progress | blocked | done
 */
export const task = pgTable(
  'task',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    enterpriseId: uuid('enterprise_id').notNull(),
    title: varchar('title', { length: 255 }).notNull(),
    description: text('description'),
    assignedToMemberId: uuid('assigned_to_member_id')
      .notNull()
      .references(() => teamMember.id, { onDelete: 'cascade' }),
    assignedByMemberId: uuid('assigned_by_member_id').references(() => teamMember.id, { onDelete: 'set null' }),
    priority: varchar('priority', { length: 16 }).default('medium').notNull(),
    status: varchar('status', { length: 16 }).default('todo').notNull(),
    dueDate: date('due_date'),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    attachments: jsonb('attachments').$type<Record<string, unknown>[]>().default([]).notNull(),
    ...withTimestamps,
  },
  (t) => [
    index('task_ent_assignee_idx').on(t.enterpriseId, t.assignedToMemberId),
    index('task_ent_status_idx').on(t.enterpriseId, t.status),
    index('task_ent_due_idx').on(t.enterpriseId, t.dueDate),
  ],
);

/**
 * Department-defined daily metric (ByteCodeEMS `metric_definition`).
 * Sales defines leads/calls; dev defines commits, etc. Data-driven, not code.
 */
export const metricDefinition = pgTable(
  'metric_definition',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    enterpriseId: uuid('enterprise_id').notNull(),
    departmentId: uuid('department_id').notNull().references((): AnyPgColumn => department.id, { onDelete: 'cascade' }),
    key: varchar('key', { length: 64 }).notNull(),
    label: varchar('label', { length: 128 }).notNull(),
    defaultDailyTarget: numeric('default_daily_target', { precision: 10, scale: 2 }),
    ...withTimestamps,
  },
  (t) => [index('metricdef_ent_dept_idx').on(t.enterpriseId, t.departmentId)],
);

/**
 * Per-member metric target override (daily | weekly).
 */
export const target = pgTable(
  'target',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    enterpriseId: uuid('enterprise_id').notNull(),
    memberId: uuid('member_id').notNull().references(() => teamMember.id, { onDelete: 'cascade' }),
    metricKey: varchar('metric_key', { length: 64 }).notNull(),
    value: numeric('value', { precision: 10, scale: 2 }).notNull(),
    period: varchar('period', { length: 16 }).default('daily').notNull(),
    effectiveFrom: date('effective_from').notNull(),
    ...withTimestamps,
  },
  (t) => [index('target_ent_member_idx').on(t.enterpriseId, t.memberId)],
);

/**
 * Daily logged value for a metric (leads, calls, …).
 */
export const dailyMetricEntry = pgTable(
  'daily_metric_entry',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    enterpriseId: uuid('enterprise_id').notNull(),
    memberId: uuid('member_id').notNull().references(() => teamMember.id, { onDelete: 'cascade' }),
    metricKey: varchar('metric_key', { length: 64 }).notNull(),
    entryDate: date('entry_date').notNull(),
    value: numeric('value', { precision: 10, scale: 2 }).notNull(),
    ...withTimestamps,
  },
  (t) => [index('dme_ent_date_idx').on(t.enterpriseId, t.entryDate), index('dme_ent_member_idx').on(t.enterpriseId, t.memberId)],
);

/**
 * Saturday-generated weekly summary per member (Mon–Sat working week).
 */
export const weeklyReport = pgTable(
  'weekly_report',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    enterpriseId: uuid('enterprise_id').notNull(),
    memberId: uuid('member_id').notNull().references(() => teamMember.id, { onDelete: 'cascade' }),
    weekStart: date('week_start').notNull(),
    weekEnd: date('week_end').notNull(),
    metricTotals: jsonb('metric_totals').$type<Record<string, number>>().default({}).notNull(),
    tasksCompleted: integer('tasks_completed').default(0).notNull(),
    eodSubmitted: integer('eod_submitted').default(0).notNull(),
    daysPresent: integer('days_present').default(0).notNull(),
    employeeNote: text('employee_note'),
    generatedAt: timestamp('generated_at', { withTimezone: true }).defaultNow().notNull(),
    ...withTimestamps,
  },
  (t) => [index('wr_ent_week_idx').on(t.enterpriseId, t.weekStart), index('wr_ent_member_idx').on(t.enterpriseId, t.memberId)],
);

/**
 * Device-side call log row uploaded by the mobile app (ByteCodeEMS call tracker).
 * callType: incoming | outgoing | missed
 */
export const deviceCall = pgTable(
  'device_call',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    enterpriseId: uuid('enterprise_id').notNull(),
    memberId: uuid('member_id').notNull().references(() => teamMember.id, { onDelete: 'cascade' }),
    phoneNumber: varchar('phone_number', { length: 32 }).notNull(),
    callType: varchar('call_type', { length: 16 }).notNull(),
    durationSec: integer('duration_sec').default(0).notNull(),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull(),
    simSlot: varchar('sim_slot', { length: 16 }),
    simCarrier: varchar('sim_carrier', { length: 64 }),
    ...withTimestamps,
  },
  (t) => [index('dc_ent_member_idx').on(t.enterpriseId, t.memberId), index('dc_ent_started_idx').on(t.enterpriseId, t.startedAt)],
);

export type DepartmentRow = typeof department.$inferSelect;
export type AttendanceRow = typeof attendance.$inferSelect;
export type EodReportRow = typeof eodReport.$inferSelect;
export type TaskRow = typeof task.$inferSelect;
export type MetricDefinitionRow = typeof metricDefinition.$inferSelect;
export type TargetRow = typeof target.$inferSelect;
export type DailyMetricEntryRow = typeof dailyMetricEntry.$inferSelect;
export type WeeklyReportRow = typeof weeklyReport.$inferSelect;
export type DeviceCallRow = typeof deviceCall.$inferSelect;

/** Workforce tenant tables — must be RLS-enforced with the core tables. */
export const WORKFORCE_TENANT_TABLES = [
  department,
  attendance,
  eodReport,
  task,
  metricDefinition,
  target,
  dailyMetricEntry,
  weeklyReport,
  deviceCall,
] as const;

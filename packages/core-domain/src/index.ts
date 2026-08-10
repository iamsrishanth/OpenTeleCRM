/**
 * OpenTeleCRM — core domain types.
 * Mirrors TeleCRM's data model so integrations stay wire-compatible.
 * All entities are enterprise-scoped (multi-tenant from line one).
 */

/** A workspace / enterprise (top-level tenant boundary). */
export interface Enterprise {
  id: string;
  name: string;
  /** What field uniquely identifies a lead in this enterprise (default: phone). */
  leadIdentifier: string;
  createdAt: string;
  updatedAt: string;
}

/** Platform user (auth subject); belongs to one or more enterprises. */
export interface User {
  id: string;
  email: string;
  name: string;
  phone?: string | null;
  avatarUrl?: string | null;
  lastLoginAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Membership of a user in an enterprise with a role. */
export interface TeamMember {
  id: string;
  enterpriseId: string;
  userId: string;
  roleId: string;
  /** Availability_state for distribution; shift/skills for routing. */
  availabilityState: 'available' | 'busy' | 'offline';
  shift?: string | null;
  skills?: string[] | null;
  createdAt: string;
  updatedAt: string;
}

/** Role + permission bundle for RBAC. */
export interface Role {
  id: string;
  enterpriseId: string;
  name: string; // owner | admin | manager | team_lead | agent | read_only | custom
  /** Permission codes: record_scope, field:read/write, action:* ... */
  permissions: string[];
  isSystem: boolean;
  createdAt: string;
  updatedAt: string;
}

/** A sales lead. Custom fields stored in jsonb `customFields`. */
export interface Lead {
  id: string;
  enterpriseId: string;
  /** The enterprise's lead identifier value (phone by default). */
  identifier: string;
  ownerUserId?: string | null;
  assignedTeamMemberId?: string | null;
  pipelineId?: string | null;
  stageId?: string | null;
  lostReasonId?: string | null;
  source?: string | null;
  score?: number | null;
  tags?: string[] | null;
  customFields: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

/** Immutable apiName per enterprise (TeleCRM parity). */
export interface LeadField {
  id: string;
  enterpriseId: string;
  apiName: string;
  label: string;
  type: string; // text|longtext|number|currency|date|datetime|phone|email|select|multi_select|boolean|file|json|...
  required: boolean;
  unique: boolean;
  config: Record<string, unknown>;
  archivedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Pipeline {
  id: string;
  enterpriseId: string;
  name: string;
  wipLimit?: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface Stage {
  id: string;
  enterpriseId: string;
  pipelineId: string;
  name: string;
  order: number;
  probability?: number | null;
  color?: string | null;
  lost?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface LostReason {
  id: string;
  enterpriseId: string;
  pipelineId?: string | null;
  label: string;
  createdAt: string;
}

/** Typed activity; custom actions carry a numeric code (TeleCRM parity). */
export interface ActionType {
  id: string;
  enterpriseId: string;
  /** Numeric code for custom actions (e.g. "1001"), mandatory for parity. */
  code: string;
  name: string;
  /** JSON schema of this action type's sub-fields. */
  fieldSchema: Record<string, unknown>;
  isSystem: boolean;
  createdAt: string;
}

export interface Action {
  id: string;
  enterpriseId: string;
  leadId: string;
  actionTypeId: string;
  userId: string;
  /** Action-specific fields. */
  payload: Record<string, unknown>;
  note?: string | null;
  createdAt: string;
}

export interface ApiToken {
  id: string;
  enterpriseId: string;
  name: string;
  type: 'async' | 'sync'; // NOT interchangeable (TeleCRM parity)
  /** sha256 hash of the raw token; only the hash is stored. */
  tokenHash: string;
  /** Last 4 of the raw token, shown in UI for identification. */
  tokenTail: string;
  createdAt: string;
  expiresAt?: string | null;
  lastUsedAt?: string | null;
  revokedAt?: string | null;
}

/** Immutable audit trail of every mutation (who/what/before/after/IP). */
export interface AuditLog {
  id: string;
  enterpriseId: string;
  actorUserId?: string | null;
  actorTokenId?: string | null;
  action: string;
  resourceType: string;
  resourceId?: string | null;
  before?: unknown | null;
  after?: unknown | null;
  /** Client IP that performed the mutation. */
  ip?: string | null;
  createdAt: string;
}
// ─── Workforce management (ByteCodeEMS port) ────────────────────────────────

/** Team department. */
export interface Department {
  id: string;
  enterpriseId: string;
  name: string;
  headMemberId?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/** One attendance day per member. */
export interface Attendance {
  id: string;
  enterpriseId: string;
  memberId: string;
  workDate: string;
  checkInAt?: string | null;
  checkOutAt?: string | null;
  status: 'present' | 'late' | 'half_day' | 'absent';
  totalHours?: string | null;
  checkInLat?: string | null;
  checkInLng?: string | null;
  checkOutLat?: string | null;
  checkOutLng?: string | null;
  source: 'web' | 'mobile';
  createdAt: string;
  updatedAt: string;
}

/** End-of-day report. */
export interface EodReport {
  id: string;
  enterpriseId: string;
  memberId: string;
  reportDate: string;
  summary: string;
  hoursWorked?: string | null;
  taskRefs: string[];
  submittedAt: string;
  status: 'submitted' | 'late' | 'missed';
  createdAt: string;
  updatedAt: string;
}

/** Assigned work item. */
export interface Task {
  id: string;
  enterpriseId: string;
  title: string;
  description?: string | null;
  assignedToMemberId: string;
  assignedByMemberId?: string | null;
  priority: 'low' | 'medium' | 'high';
  status: 'todo' | 'in_progress' | 'blocked' | 'done';
  dueDate?: string | null;
  completedAt?: string | null;
  attachments: unknown[];
  createdAt: string;
  updatedAt: string;
}

/** Department-defined metric (e.g. Sales → leads/calls). */
export interface MetricDefinition {
  id: string;
  enterpriseId: string;
  departmentId: string;
  key: string;
  label: string;
  defaultDailyTarget?: string | null;
}

/** Per-member metric target override. */
export interface MetricTarget {
  id: string;
  enterpriseId: string;
  memberId: string;
  metricKey: string;
  value: string;
  period: 'daily' | 'weekly';
  effectiveFrom: string;
}

/** Daily logged metric value. */
export interface DailyMetricEntry {
  id: string;
  enterpriseId: string;
  memberId: string;
  metricKey: string;
  entryDate: string;
  value: string;
}

/** Saturday-generated weekly summary. */
export interface WeeklyReport {
  id: string;
  enterpriseId: string;
  memberId: string;
  weekStart: string;
  weekEnd: string;
  metricTotals: Record<string, number>;
  tasksCompleted: number;
  eodSubmitted: number;
  daysPresent: number;
  employeeNote?: string | null;
  generatedAt: string;
}

/** Device-side call log row (mobile call tracker). */
export interface DeviceCall {
  id: string;
  enterpriseId: string;
  memberId: string;
  phoneNumber: string;
  callType: 'incoming' | 'outgoing' | 'missed';
  durationSec: number;
  startedAt: string;
  simSlot?: string | null;
  simCarrier?: string | null;
}

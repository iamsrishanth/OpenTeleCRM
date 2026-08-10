export interface Lead {
  id: string
  enterpriseId: string
  phone: string | null
  email: string | null
  name: string | null
  customFields: Record<string, unknown> | null
  pipelineId: string | null
  stageId: string | null
  createdAt: string
  updatedAt: string
}
export interface WhatsAppConversation {
  id: string
  contactJid: string
  contactName: string | null
  lastMessage: string | null
  lastMessageAt: string | null
  unread: number
}
export interface WhatsAppMessage {
  id: string
  conversationId: string
  fromMe: boolean
  body: string
  timestamp: string
  type: string
}
export interface Metadata {
  customFields: Array<{ id: string; apiName: string; label: string; fieldType: string }>
  pipelines: Array<{ id: string; name: string; stages: Array<{ id: string; name: string; color: string }> }>
}

export interface DashboardStats {
  leadsTotal: number
  callsToday: number
  openConversations: number
  callbacksDue: number
}

export interface AutomationTrigger {
  kind: string
  config?: Record<string, unknown>
}

export interface AutomationCondition {
  field?: string
  op?: string
  value?: unknown
  combinator?: 'and' | 'or'
  children?: AutomationCondition[]
}

export interface AutomationAction {
  kind: string
  config?: Record<string, unknown>
  when?: Record<string, unknown>
}

export interface AutomationRule {
  id: string
  enterpriseId: string
  name: string
  description: string | null
  category?: string
  trigger: AutomationTrigger
  conditions: AutomationCondition | null
  actions: AutomationAction[]
  schedule: { cron?: string; timezone?: string; runAt?: string } | null
  isActive: boolean
  priority: number
  lastRunAt?: string | null
  nextRunAt?: string | null
  createdAt: string
  updatedAt: string
}

export interface AutomationRun {
  id: string
  automationId: string
  leadId: string | null
  status: 'queued' | 'running' | 'success' | 'failed' | 'skipped' | 'throttled'
  stepsExecuted: number
  conditionsMatched: boolean
  error: string | null
  startedAt: string
  finishedAt: string | null
  durationMs: number
}

export interface Callback {
  id: string
  leadId: string | null
  dueAt: string
  status: 'pending' | 'done' | 'cancelled' | 'missed'
  source: string | null
  channel: string | null
  note: string | null
  completedAt: string | null
  createdAt: string
}

export interface WhatsAppTemplate {
  name: string
  body: string
  status?: string
  category?: string
  createdAt?: string
  updatedAt?: string
}

export interface WaBroadcast {
  id: string
  name: string
  templateName: string | null
  text: string | null
  status: string
  totalRecipients: number
  sentCount: number
  createdAt: string
  startedAt?: string | null
  finishedAt?: string | null
}

export interface DialerCandidate {
  leadId: string
  identifier: string
  name: string | null
  score: number
  reasons: string[]
}

/** Normalize possibly-paginated list responses into a plain array. */
export function asList<T>(data: unknown, key = 'items'): T[] {
  if (Array.isArray(data)) return data as T[]
  if (data && typeof data === 'object') {
    const obj = data as Record<string, unknown>
    for (const k of [key, 'leads', 'conversations', 'messages', 'data', 'results']) {
      if (Array.isArray(obj[k])) return obj[k] as T[]
    }
  }
  return []
}

// ─── Workforce management (ByteCodeEMS port) ─────────────────────────────────

export interface AttendanceRecord {
  id: string
  workDate: string
  checkInAt?: string | null
  checkOutAt?: string | null
  status: string
  totalHours?: string | null
  source: string
}

export interface AdminAttendanceRow {
  id: string
  memberId: string
  name: string
  checkInAt?: string | null
  checkOutAt?: string | null
  status: string
  totalHours?: string | null
}

export interface EodReport {
  id: string
  reportDate: string
  summary: string
  hoursWorked?: string | null
  taskRefs: string[]
  submittedAt: string
  status: string
}

export interface EodComplianceRow {
  memberId: string
  name: string
  submitted: boolean
  status: string
}

export interface TaskItem {
  id: string
  title: string
  description?: string | null
  assignedToMemberId: string
  assignedByMemberId?: string | null
  priority: string
  status: string
  dueDate?: string | null
  completedAt?: string | null
  createdAt: string
}

export interface DepartmentItem {
  id: string
  name: string
  headMemberId?: string | null
  headName?: string | null
  isActive: boolean
}

export interface MetricDefinitionItem {
  id: string
  departmentId: string
  key: string
  label: string
  defaultDailyTarget?: string | null
}

export interface MetricEntry {
  id: string
  metricKey: string
  entryDate: string
  value: string
}

export interface MetricDailyView {
  date: string
  metrics: { key: string; label: string; defaultDailyTarget?: string | null }[]
  members: { memberId: string; name: string; values: Record<string, string> }[]
}

export interface WeeklyReportItem {
  id: string
  weekStart: string
  weekEnd: string
  metricTotals: Record<string, number>
  tasksCompleted: number
  eodSubmitted: number
  daysPresent: number
  employeeNote?: string | null
  generatedAt: string
}

export interface TeamMemberInfo {
  id: string
  name: string
  roleName: string
  departmentId?: string | null
}

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
  trigger: AutomationTrigger
  conditions: AutomationCondition | null
  actions: AutomationAction[]
  schedule: { cron?: string; timezone?: string } | null
  isActive: boolean
  priority: number
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

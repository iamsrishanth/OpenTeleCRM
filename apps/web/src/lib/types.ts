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

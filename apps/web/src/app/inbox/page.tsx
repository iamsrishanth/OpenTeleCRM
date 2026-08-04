'use client'

import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Send } from 'lucide-react'
import { toast } from 'sonner'
import { AppShell } from '@/components/app-shell'
import { EmptyState, LoadingScreen } from '@/components/loading'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { api } from '@/lib/api'
import { useAuth } from '@/lib/auth-context'
import {
  asList,
  type WhatsAppConversation,
  type WhatsAppMessage,
} from '@/lib/types'

function formatTime(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function InboxPage() {
  const { isReady, token, enterpriseId } = useAuth()
  const router = useRouter()
  const [conversations, setConversations] = useState<
    WhatsAppConversation[] | null
  >(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [messages, setMessages] = useState<WhatsAppMessage[] | null>(null)
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const threadRef = useRef<HTMLDivElement>(null)

  const loadConversations = useCallback(async () => {
    if (!token || !enterpriseId) return
    try {
      const data = await api.get<unknown>('/whatsapp/conversations')
      const convs = asList<WhatsAppConversation>(data)
      setConversations(convs)
      setSelectedId((prev) => prev ?? convs[0]?.id ?? null)
    } catch {
      setConversations([])
    }
  }, [token, enterpriseId])

  const loadMessages = useCallback(
    async (convId: string) => {
      setMessages(null)
      try {
        const data = await api.get<unknown>(
          `/whatsapp/conversations/${convId}/messages`,
        )
        setMessages(asList<WhatsAppMessage>(data))
      } catch {
        setMessages([])
      }
    },
    [token, enterpriseId],
  )

  useEffect(() => {
    if (!isReady) return
    if (!token || !enterpriseId) {
      router.replace('/login')
      return
    }
    loadConversations()
  }, [isReady, token, enterpriseId, router, loadConversations])

  useEffect(() => {
    if (selectedId) loadMessages(selectedId)
  }, [selectedId, loadMessages])

  // Auto-scroll to newest message.
  useEffect(() => {
    const el = threadRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages])

  async function onSend(e: FormEvent) {
    e.preventDefault()
    const body = draft.trim()
    if (!body || !selectedId) return
    setSending(true)
    try {
      await api.post(`/whatsapp/conversations/${selectedId}/messages`, {
        body,
      })
      setDraft('')
      await loadMessages(selectedId)
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Failed to send message',
      )
    } finally {
      setSending(false)
    }
  }

  const selected = conversations?.find((c) => c.id === selectedId) ?? null

  if (!isReady || !token) return <LoadingScreen label="Checking session…" />

  return (
    <AppShell>
      <div className="flex h-[calc(100vh-8.5rem)] min-h-[28rem] overflow-hidden rounded-lg border border-border">
        {/* Conversation list */}
        <div className="flex w-72 shrink-0 flex-col border-r border-border">
          <div className="border-b border-border px-4 py-3">
            <h3 className="text-sm font-semibold">Conversations</h3>
          </div>
          <div className="flex-1 overflow-y-auto">
            {conversations === null ? (
              <LoadingScreen label="Loading conversations…" />
            ) : conversations.length === 0 ? (
              <div className="p-4">
                <EmptyState
                  title="No conversations"
                  hint="WhatsApp conversations will appear here."
                />
              </div>
            ) : (
              <ul>
                {conversations.map((c) => {
                  const active = c.id === selectedId
                  return (
                    <li key={c.id}>
                      <button
                        onClick={() => setSelectedId(c.id)}
                        className={cn(
                          'flex w-full items-start gap-3 border-b border-border/60 px-4 py-3 text-left transition-colors',
                          active
                            ? 'bg-primary/10'
                            : 'hover:bg-muted/50',
                        )}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-baseline justify-between gap-2">
                            <p className="truncate text-sm font-medium">
                              {c.contactName || c.contactJid}
                            </p>
                            <span className="shrink-0 text-[11px] text-muted-foreground">
                              {formatTime(c.lastMessageAt)}
                            </span>
                          </div>
                          <p className="mt-0.5 truncate text-xs text-muted-foreground">
                            {c.lastMessage || 'No messages yet'}
                          </p>
                        </div>
                        {c.unread > 0 && (
                          <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-semibold text-primary-foreground">
                            {c.unread}
                          </span>
                        )}
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </div>

        {/* Message thread */}
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex h-12 shrink-0 items-center border-b border-border px-4">
            <p className="truncate text-sm font-medium">
              {selected
                ? selected.contactName || selected.contactJid
                : 'Select a conversation'}
            </p>
          </div>

          <div
            ref={threadRef}
            className="flex-1 space-y-2 overflow-y-auto bg-background p-4"
          >
            {selectedId === null ? (
              <div className="flex h-full items-center justify-center">
                <p className="text-sm text-muted-foreground">
                  Pick a conversation to view messages.
                </p>
              </div>
            ) : messages === null ? (
              <LoadingScreen label="Loading messages…" />
            ) : messages.length === 0 ? (
              <div className="flex h-full items-center justify-center">
                <p className="text-sm text-muted-foreground">
                  No messages yet. Say hello!
                </p>
              </div>
            ) : (
              messages.map((m) => (
                <div
                  key={m.id}
                  className={cn(
                    'flex',
                    m.fromMe ? 'justify-end' : 'justify-start',
                  )}
                >
                  <div
                    className={cn(
                      'max-w-[75%] rounded-lg px-3 py-2 text-sm shadow-sm',
                      m.fromMe
                        ? 'rounded-br-sm bg-primary text-primary-foreground'
                        : 'rounded-bl-sm border border-border bg-card text-card-foreground',
                    )}
                  >
                    <p className="whitespace-pre-wrap break-words">{m.body}</p>
                    <p
                      className={cn(
                        'mt-1 text-right text-[10px]',
                        m.fromMe
                          ? 'text-primary-foreground/70'
                          : 'text-muted-foreground',
                      )}
                    >
                      {formatTime(m.timestamp)}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>

          <form
            onSubmit={onSend}
            className="flex shrink-0 items-center gap-2 border-t border-border p-3"
          >
            <Input
              placeholder={
                selectedId
                  ? 'Type a message…'
                  : 'Select a conversation to send'
              }
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              disabled={!selectedId}
              className="flex-1"
            />
            <Button
              type="submit"
              size="icon"
              disabled={!selectedId || !draft.trim() || sending}
              aria-label="Send message"
            >
              {sending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Send className="size-4" />
              )}
            </Button>
          </form>
        </div>
      </div>
    </AppShell>
  )
}

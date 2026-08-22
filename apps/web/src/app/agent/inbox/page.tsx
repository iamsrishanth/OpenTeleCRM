'use client'

import { useState } from 'react'
import {
  MessageSquare,
  Search,
  Send,
  Paperclip,
  PhoneCall,
  User,
  Sparkles,
  CheckCheck,
  Clock,
  Tag,
  Mic,
  Smile,
  FileText,
  Building,
  Check,
} from 'lucide-react'
import { AppShell } from '@/components/app-shell'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { toast } from 'sonner'

interface ChatMessage {
  id: string
  sender: 'lead' | 'agent'
  text: string
  time: string
  status?: 'sent' | 'delivered' | 'read'
}

interface ChatConversation {
  id: string
  name: string
  phone: string
  avatar: string
  stage: string
  unread: number
  lastMessage: string
  lastTime: string
  messages: ChatMessage[]
}

const CONVERSATIONS: ChatConversation[] = [
  {
    id: 'conv-1',
    name: 'Rajesh Malhotra',
    phone: '+91 98112 34567',
    avatar: 'RM',
    stage: 'New Lead',
    unread: 2,
    lastMessage: 'Can you please share the 3BHK floor plan PDF as well?',
    lastTime: '12:42 PM',
    messages: [
      { id: 'm1', sender: 'agent', text: 'Hi Rajesh! Thank you for speaking with us today on call.', time: '12:30 PM', status: 'read' },
      { id: 'm2', sender: 'agent', text: 'Here is our Bandra luxury project overview: https://telecrm.in/brochure', time: '12:31 PM', status: 'read' },
      { id: 'm3', sender: 'lead', text: 'Got it, thank you!', time: '12:35 PM' },
      { id: 'm4', sender: 'lead', text: 'Can you please share the 3BHK floor plan PDF as well?', time: '12:42 PM' },
    ],
  },
  {
    id: 'conv-2',
    name: 'Ananya Deshmukh',
    phone: '+91 97234 56789',
    avatar: 'AD',
    stage: 'Follow-Up',
    unread: 0,
    lastMessage: 'Will join the demo call tomorrow at 11 AM.',
    lastTime: '11:15 AM',
    messages: [
      { id: 'm1', sender: 'agent', text: 'Hi Ananya, confirming our scheduled live product demo for tomorrow.', time: '11:00 AM', status: 'read' },
      { id: 'm2', sender: 'lead', text: 'Will join the demo call tomorrow at 11 AM.', time: '11:15 AM' },
    ],
  },
  {
    id: 'conv-3',
    name: 'Amitabh Sen',
    phone: '+91 98300 12345',
    avatar: 'AS',
    stage: 'Proposal Sent',
    unread: 1,
    lastMessage: 'Please send GST invoice draft for 20 seats.',
    lastTime: 'Yesterday',
    messages: [
      { id: 'm1', sender: 'agent', text: 'Hello Mr. Sen, attached the Enterprise proposal for 20 telecalling licenses.', time: 'Yesterday', status: 'read' },
      { id: 'm2', sender: 'lead', text: 'Please send GST invoice draft for 20 seats.', time: 'Yesterday' },
    ],
  },
]

const QUICK_TEMPLATES = [
  'Send 3BHK Brochure PDF',
  'Confirm Callback Schedule',
  'Share Office Google Maps Location',
  'Send Payment Link via Razorpay',
]

export default function AgentInboxPage() {
  const [conversations, setConversations] = useState<ChatConversation[]>(CONVERSATIONS)
  const [selectedId, setSelectedId] = useState<string>('conv-1')
  const [search, setSearch] = useState('')
  const [inputMessage, setInputMessage] = useState('')

  const activeConv = conversations.find((c) => c.id === selectedId) || conversations[0]

  const handleSendMessage = () => {
    if (!inputMessage.trim()) return

    const newMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      sender: 'agent',
      text: inputMessage.trim(),
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      status: 'sent',
    }

    setConversations((prev) =>
      prev.map((c) =>
        c.id === activeConv.id
          ? {
              ...c,
              lastMessage: inputMessage.trim(),
              lastTime: 'Just now',
              messages: [...c.messages, newMsg],
            }
          : c
      )
    )

    setInputMessage('')
    toast.success(`Message sent to ${activeConv.name} on WhatsApp!`)
  }

  const handleSendTemplate = (tmpl: string) => {
    setInputMessage(tmpl)
  }

  return (
    <AppShell>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <MessageSquare className="size-5 text-emerald-500" />
              Agent WhatsApp & SMS Inbox
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Live one-on-one prospective chat threads
            </p>
          </div>
        </div>

        {/* 2-Column Split: Left = Conversations List, Right = Active Chat Thread */}
        <div className="grid grid-cols-1 md:grid-cols-12 rounded-2xl border border-border bg-card overflow-hidden h-[calc(100vh-12rem)] shadow-sm">
          
          {/* LEFT: Conversation Threads (4 cols) */}
          <div className="md:col-span-4 border-r border-border flex flex-col h-full bg-muted/20">
            {/* Search */}
            <div className="p-3 border-b border-border">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search chats..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="h-8 pl-8 text-xs bg-background"
                />
              </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto divide-y divide-border/60">
              {conversations.map((conv) => {
                const isSelected = conv.id === selectedId
                return (
                  <button
                    key={conv.id}
                    onClick={() => {
                      setSelectedId(conv.id)
                      setConversations((prev) =>
                        prev.map((c) => (c.id === conv.id ? { ...c, unread: 0 } : c))
                      )
                    }}
                    className={`w-full p-3.5 text-left transition-colors flex items-start gap-3 cursor-pointer ${
                      isSelected ? 'bg-primary/10 border-l-4 border-l-primary' : 'hover:bg-muted/40'
                    }`}
                  >
                    <Avatar className="size-9 shrink-0">
                      <AvatarFallback className="text-xs font-bold bg-primary/20 text-primary">
                        {conv.avatar}
                      </AvatarFallback>
                    </Avatar>

                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs text-foreground truncate">{conv.name}</span>
                        <span className="text-[10px] text-muted-foreground shrink-0">{conv.lastTime}</span>
                      </div>

                      <p className="text-[11px] text-muted-foreground truncate leading-relaxed">
                        {conv.lastMessage}
                      </p>

                      <div className="flex items-center justify-between pt-0.5">
                        <Badge variant="outline" className="text-[9px] font-mono">
                          {conv.stage}
                        </Badge>
                        {conv.unread > 0 && (
                          <span className="flex size-4 items-center justify-center rounded-full bg-emerald-500 text-[9px] font-bold text-white">
                            {conv.unread}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* RIGHT: Active Chat & Message Thread (8 cols) */}
          <div className="md:col-span-8 flex flex-col h-full bg-background">
            {/* Top Chat Header */}
            <div className="px-5 py-3 border-b border-border bg-card flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Avatar className="size-9">
                  <AvatarFallback className="text-xs font-bold bg-primary/20 text-primary">
                    {activeConv.avatar}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-xs text-foreground">{activeConv.name}</h3>
                    <Badge variant="outline" className="text-[9px] bg-emerald-500/10 text-emerald-500 border-emerald-500/20">
                      WhatsApp Connected
                    </Badge>
                  </div>
                  <p className="font-mono text-[11px] text-muted-foreground">{activeConv.phone}</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  onClick={() => toast.success(`Calling ${activeConv.name}...`)}
                  className="h-8 text-xs font-bold gap-1 bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs"
                >
                  <PhoneCall className="size-3.5" /> Call Prospect
                </Button>
              </div>
            </div>

            {/* Message History Feed */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-muted/10">
              {activeConv.messages.map((msg) => {
                const isAgent = msg.sender === 'agent'
                return (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${isAgent ? 'items-end' : 'items-start'}`}
                  >
                    <div
                      className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-xs shadow-xs leading-relaxed ${
                        isAgent
                          ? 'bg-primary text-primary-foreground rounded-br-none'
                          : 'bg-card border border-border text-foreground rounded-bl-none'
                      }`}
                    >
                      <p>{msg.text}</p>
                    </div>
                    <div className="flex items-center gap-1 text-[10px] text-muted-foreground mt-1 px-1">
                      <span>{msg.time}</span>
                      {isAgent && <CheckCheck className="size-3 text-emerald-400" />}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Quick Template Chips Bar */}
            <div className="p-2 border-t border-border bg-card/60 flex items-center gap-1.5 overflow-x-auto">
              <span className="text-[10px] font-bold text-muted-foreground uppercase px-2 shrink-0">
                Templates:
              </span>
              {QUICK_TEMPLATES.map((tmpl) => (
                <button
                  key={tmpl}
                  onClick={() => handleSendTemplate(tmpl)}
                  className="px-2.5 py-1 rounded-lg text-[11px] font-medium bg-muted hover:bg-muted/80 text-foreground border border-border transition shrink-0 cursor-pointer"
                >
                  + {tmpl}
                </button>
              ))}
            </div>

            {/* Chat Input Bar */}
            <div className="p-3 border-t border-border bg-card flex items-center gap-2">
              <Input
                placeholder="Type WhatsApp message..."
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSendMessage()
                }}
                className="text-xs h-10 bg-background"
              />
              <Button
                onClick={handleSendMessage}
                disabled={!inputMessage.trim()}
                className="h-10 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold gap-1.5 shadow-sm shrink-0 cursor-pointer"
              >
                <Send className="size-3.5" /> Send
              </Button>
            </div>
          </div>

        </div>
      </div>
    </AppShell>
  )
}

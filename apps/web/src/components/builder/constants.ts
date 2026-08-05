import type { FieldDef, PaletteGroup } from './types'

// ---------------------------------------------------------------------------
// Palette definitions. Mirrors services/api/src/automation/types.ts — the
// wire kinds must match the engine exactly.
// ---------------------------------------------------------------------------

export const PALETTE_GROUPS: PaletteGroup[] = [
  {
    id: 'triggers',
    label: 'Triggers',
    items: [
      { value: 'lead_created', label: 'Lead created', hint: 'Fires when a new lead row is created', icon: 'Zap' },
      { value: 'lead_updated', label: 'Lead updated', hint: 'Fires when any lead field changes', icon: 'RefreshCw' },
      { value: 'lead_stage_changed', label: 'Lead stage changed', hint: 'Fires when a lead moves to a different stage', icon: 'GitBranch' },
      { value: 'lead_field_changed', label: 'Lead field changed', hint: 'Fires when a specific custom field changes', icon: 'PenLine' },
      { value: 'lead_assigned', label: 'Lead assigned', hint: 'Fires when a lead is (re)assigned to a user or team member', icon: 'UserPlus' },
      { value: 'call_ended', label: 'Call ended', hint: 'Fires when a call reaches a terminal state', icon: 'PhoneCall' },
      { value: 'action_logged', label: 'Action logged', hint: 'Fires when an action/note is logged on a lead', icon: 'ClipboardList' },
      { value: 'callback_due', label: 'Callback due', hint: 'Fires when a scheduled follow-up reaches its due time', icon: 'AlarmClock' },
      { value: 'inbound_message', label: 'Inbound message', hint: 'Fires when a new inbound WhatsApp message arrives', icon: 'MessageSquare' },
    ],
  },
  {
    id: 'conditions',
    label: 'Conditions',
    items: [
      {
        value: 'condition',
        label: 'Condition',
        hint: 'Field / operator / value rows joined by AND or OR',
        icon: 'Filter',
      },
    ],
  },
  {
    id: 'actions',
    label: 'Actions',
    items: [
      { value: 'assign_lead', label: 'Assign lead', hint: 'Route the lead to an available team member', icon: 'UserCheck' },
      { value: 'create_callback', label: 'Create callback', hint: 'Schedule a follow-up for the lead', icon: 'CalendarClock' },
      { value: 'send_whatsapp', label: 'Send WhatsApp', hint: 'Send a WhatsApp message to the lead', icon: 'MessageSquare' },
      { value: 'update_field', label: 'Update field', hint: 'Write a custom field on the lead', icon: 'PenLine' },
      { value: 'move_stage', label: 'Move stage', hint: 'Move the lead to another pipeline stage', icon: 'MoveRight' },
      { value: 'notify_user', label: 'Notify user', hint: 'Notify a user about this lead', icon: 'Bell' },
      { value: 'send_email', label: 'Send email', hint: 'Send an email to the lead', icon: 'Mail' },
      { value: 'webhook', label: 'Webhook', hint: 'POST an outbound webhook', icon: 'Webhook' },
      { value: 'branch', label: 'Branch', hint: 'Evaluate a condition and stop the chain when false', icon: 'GitFork' },
      { value: 'delay', label: 'Delay', hint: 'Wait between actions', icon: 'Timer' },
      { value: 'http_request', label: 'HTTP request', hint: 'Call an external HTTP endpoint', icon: 'Globe' },
    ],
  },
]

export function paletteItem(groupId: string, value: string) {
  const group = PALETTE_GROUPS.find((g) => g.id === groupId)
  return group?.items.find((i) => i.value === value)
}

export function triggerLabel(kind: string): string {
  return paletteItem('triggers', kind)?.label ?? kind
}

export function actionLabel(kind: string): string {
  return paletteItem('actions', kind)?.label ?? kind
}

export function kindIcon(kind: string, fallback = 'Zap'): string {
  return (
    paletteItem('triggers', kind)?.icon ??
    paletteItem('actions', kind)?.icon ??
    fallback
  )
}

// ---------------------------------------------------------------------------
// Properties panel field schemas.
// Editor keys are what the user types; compile.ts maps them to the wire keys
// the engine actually reads (see services/api/src/automation/dispatcher.ts).
// ---------------------------------------------------------------------------

/** Config fields for trigger nodes. Most triggers carry no config. */
export const TRIGGER_FIELDS: Record<string, FieldDef[]> = {
  lead_field_changed: [
    {
      key: 'fieldApiName',
      label: 'Field api name',
      placeholder: 'e.g. priority',
      required: true,
      help: 'Custom field API name that must change for this trigger to fire.',
    },
  ],
}

export const ACTION_FIELDS: Record<string, FieldDef[]> = {
  assign_lead: [
    {
      key: 'mode',
      label: 'Mode',
      type: 'select',
      options: [
        { value: 'round_robin', label: 'Round robin' },
        { value: 'least_loaded', label: 'Least loaded' },
        { value: 'skill_match', label: 'Skill match' },
      ],
      help: 'How the lead is routed to an available team member.',
    },
    { key: 'skills', label: 'Skills (comma separated)', placeholder: 'english, hindi', help: 'Used when mode is skill match.' },
  ],
  create_callback: [
    {
      key: 'quickChip',
      label: 'Due',
      type: 'select',
      options: [
        { value: '1h', label: 'In 1 hour' },
        { value: '3h', label: 'In 3 hours' },
        { value: 'tomorrow_10am', label: 'Tomorrow 10:00 AM' },
        { value: 'custom', label: 'Custom time' },
      ],
    },
    { key: 'dueAt', label: 'Custom due time', type: 'datetime', help: 'Used when Due is “Custom time”.' },
    { key: 'note', label: 'Note', placeholder: 'Follow up about the demo' },
  ],
  send_whatsapp: [
    { key: 'text', label: 'Message text', type: 'textarea', placeholder: 'Hi {{name}}, checking in…', required: true },
    { key: 'contactJid', label: 'Contact JID', placeholder: 'e.g. 919876543210@s.whatsapp.net — blank uses the lead' },
  ],
  update_field: [
    { key: 'apiName', label: 'Field api name', placeholder: 'e.g. priority', required: true, help: 'Custom field API name, or “score” for the lead score column.' },
    { key: 'value', label: 'Value', required: true },
  ],
  move_stage: [
    { key: 'stageId', label: 'Stage id', required: true },
    { key: 'pipelineId', label: 'Pipeline id', placeholder: 'Optional' },
  ],
  notify_user: [
    { key: 'title', label: 'Title', placeholder: 'New lead assigned' },
    { key: 'body', label: 'Body', type: 'textarea' },
    { key: 'userId', label: 'User id', placeholder: 'Blank = lead owner' },
  ],
  send_email: [
    { key: 'to', label: 'To' },
    { key: 'subject', label: 'Subject' },
    { key: 'body', label: 'Body', type: 'textarea' },
  ],
  webhook: [
    { key: 'url', label: 'URL', required: true },
    {
      key: 'method',
      label: 'Method',
      type: 'select',
      options: [
        { value: 'POST', label: 'POST' },
        { value: 'GET', label: 'GET' },
        { value: 'PUT', label: 'PUT' },
      ],
    },
    { key: 'headers', label: 'Headers (JSON)', type: 'textarea', placeholder: '{"Authorization": "Bearer …"}' },
    { key: 'body', label: 'Body (JSON)', type: 'textarea', placeholder: '{"leadId": "{{lead.id}}"}' },
  ],
  branch: [
    {
      key: 'note',
      label: 'Note',
      type: 'text',
      help: 'Branch evaluates the rule conditions against the run context. Leave a note for yourself.',
    },
  ],
  delay: [
    { key: 'hours', label: 'Hours', type: 'number', placeholder: '0' },
    { key: 'minutes', label: 'Minutes', type: 'number', placeholder: '0' },
    { key: 'seconds', label: 'Seconds', type: 'number', placeholder: '0' },
  ],
  http_request: [
    { key: 'url', label: 'URL', required: true },
    {
      key: 'method',
      label: 'Method',
      type: 'select',
      options: [
        { value: 'GET', label: 'GET' },
        { value: 'POST', label: 'POST' },
        { value: 'PUT', label: 'PUT' },
        { value: 'PATCH', label: 'PATCH' },
        { value: 'DELETE', label: 'DELETE' },
      ],
    },
    { key: 'headers', label: 'Headers (JSON)', type: 'textarea', placeholder: '{"Authorization": "Bearer …"}' },
    { key: 'body', label: 'Body (JSON)', type: 'textarea', placeholder: '{"leadId": "{{lead.id}}"}' },
  ],
}

export function actionFields(kind: string): FieldDef[] {
  return ACTION_FIELDS[kind] ?? []
}

/** Field keys whose editor value maps to a different wire key at compile time. */
export const ACTION_WIRE_ALIASES: Record<string, Record<string, string>> = {
  send_whatsapp: { text: 'body', contactJid: 'to' },
}

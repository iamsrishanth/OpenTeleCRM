/**
 * Typed event emitters — the bridge between B5-audited mutations and the
 * P4 automation engine. The controller call sites do:
 *
 *   await this.auditService.record({ ... });
 *   fireLeadCreated(automationService, eid, lead);
 *
 * and `fireLeadCreated` is responsible for shaping the AutomationEvent the
 * engine consumes. Doing it this way keeps the wire format out of the
 * controllers (so the engine can evolve the event shape independently) and
 * keeps the fire-and-forget contract in one place.
 */
import type { AutomationEvent } from './types.js';
import { AutomationService } from './automation.service.js';

function safe(svc: AutomationService | undefined, event: AutomationEvent): void {
  if (!svc) return;
  try {
    void svc.fire(event);
  } catch {
    /* fire() never throws; this is paranoia */
  }
}

function leadSnapshot(lead: {
  id: string;
  pipelineId?: string | null | undefined;
  stageId?: string | null | undefined;
  ownerUserId?: string | null | undefined;
  assignedTeamMemberId?: string | null | undefined;
  source?: string | null | undefined;
  score?: number | null | undefined;
  tags?: string[] | null | undefined;
  customFields?: Record<string, unknown> | null | undefined;
}): AutomationEvent['lead'] {
  return {
    id: lead.id,
    pipelineId: lead.pipelineId ?? null,
    stageId: lead.stageId ?? null,
    ownerUserId: lead.ownerUserId ?? null,
    assignedTeamMemberId: lead.assignedTeamMemberId ?? null,
    source: lead.source ?? null,
    score: lead.score ?? null,
    tags: lead.tags ?? [],
    customFields: lead.customFields ?? {},
  };
}

export function leadCreated(
  svc: AutomationService,
  eid: string,
  lead: Parameters<typeof leadSnapshot>[0],
): void {
  safe(svc, {
    kind: 'lead_created',
    enterpriseId: eid,
    correlationId: lead.id,
    payload: { leadId: lead.id },
    lead: leadSnapshot(lead),
  });
}

export function leadUpdated(
  svc: AutomationService,
  eid: string,
  lead: Parameters<typeof leadSnapshot>[0],
  before: Parameters<typeof leadSnapshot>[0],
  changedFields: string[] = [],
): void {
  safe(svc, {
    kind: 'lead_updated',
    enterpriseId: eid,
    correlationId: lead.id,
    payload: { leadId: lead.id, changedFields },
    lead: leadSnapshot(lead),
  });
  // Also fire stage_changed if applicable — keeps consumers from having to
  // track both events for the same logical operation.
  if (before.stageId !== lead.stageId) {
    safe(svc, {
      kind: 'lead_stage_changed',
      enterpriseId: eid,
      correlationId: lead.id,
      payload: {
        leadId: lead.id,
        fromStageId: before.stageId,
        toStageId: lead.stageId,
        pipelineId: lead.pipelineId,
      },
      lead: leadSnapshot(lead),
    });
  }
}

export function leadStageChanged(
  svc: AutomationService,
  eid: string,
  lead: Parameters<typeof leadSnapshot>[0],
  fromStageId: string | null,
  toStageId: string | null,
): void {
  safe(svc, {
    kind: 'lead_stage_changed',
    enterpriseId: eid,
    correlationId: lead.id,
    payload: { leadId: lead.id, fromStageId, toStageId, pipelineId: lead.pipelineId },
    lead: leadSnapshot(lead),
  });
}

export function leadFieldChanged(
  svc: AutomationService,
  eid: string,
  lead: Parameters<typeof leadSnapshot>[0],
  field: string,
  before: unknown,
  after: unknown,
): void {
  safe(svc, {
    kind: 'lead_field_changed',
    enterpriseId: eid,
    correlationId: lead.id,
    payload: { leadId: lead.id, field, before, after },
    lead: leadSnapshot(lead),
  });
}

export function leadAssigned(
  svc: AutomationService,
  eid: string,
  lead: Parameters<typeof leadSnapshot>[0],
  toUserId: string | null,
  toTeamMemberId: string | null,
): void {
  safe(svc, {
    kind: 'lead_assigned',
    enterpriseId: eid,
    correlationId: lead.id,
    payload: { leadId: lead.id, toUserId, toTeamMemberId },
    lead: leadSnapshot(lead),
  });
}

export function callEnded(
  svc: AutomationService,
  eid: string,
  call: {
    id: string;
    leadId: string | null;
    direction: 'inbound' | 'outbound';
    status: string;
    disposition: string | null;
    durationSec: number;
  },
): void {
  // Only fire on terminal call states — queued/ringing/in-progress don't
  // count as "ended". A4.2 only acts on completed dispositions.
  const terminal: ReadonlyArray<string> = [
    'completed',
    'failed',
    'no-answer',
    'missed',
    'rejected',
    'busy',
    'cancelled',
  ];
  if (!terminal.includes(call.status)) return;
  safe(svc, {
    kind: 'call_ended',
    enterpriseId: eid,
    correlationId: call.id,
    payload: {
      callId: call.id,
      leadId: call.leadId,
      direction: call.direction,
      status: call.status,
      disposition: call.disposition,
      durationSec: call.durationSec,
    },
    lead: call.leadId
      ? leadSnapshot({
          id: call.leadId,
          pipelineId: null,
          stageId: null,
          ownerUserId: null,
          assignedTeamMemberId: null,
          source: null,
          score: null,
          tags: null,
          customFields: null,
        })
      : null,
  });
}

export function actionLogged(
  svc: AutomationService,
  eid: string,
  a: {
    id: string;
    leadId: string;
    actionTypeId: string;
    actionTypeCode?: string;
  },
): void {
  safe(svc, {
    kind: 'action_logged',
    enterpriseId: eid,
    correlationId: a.id,
    payload: {
      actionId: a.id,
      leadId: a.leadId,
      actionTypeId: a.actionTypeId,
      actionTypeCode: a.actionTypeCode ?? null,
    },
    lead: leadSnapshot({
      id: a.leadId,
      pipelineId: null,
      stageId: null,
      ownerUserId: null,
      assignedTeamMemberId: null,
      source: null,
      score: null,
      tags: null,
      customFields: null,
    }),
  });
}

export function callbackDue(
  svc: AutomationService,
  eid: string,
  cb: { id: string; leadId: string; dueAt: string | Date },
): void {
  const dueAtIso = cb.dueAt instanceof Date ? cb.dueAt.toISOString() : cb.dueAt;
  safe(svc, {
    kind: 'callback_due',
    enterpriseId: eid,
    correlationId: cb.id,
    payload: { callbackId: cb.id, leadId: cb.leadId, dueAt: dueAtIso },
    lead: leadSnapshot({
      id: cb.leadId,
      pipelineId: null,
      stageId: null,
      ownerUserId: null,
      assignedTeamMemberId: null,
      source: null,
      score: null,
      tags: null,
      customFields: null,
    }),
  });
}

export function inboundMessage(
  svc: AutomationService,
  eid: string,
  msg: { messageId: string; conversationId: string; body: string; fromMe?: boolean },
): void {
  if (msg.fromMe !== false) return; // only inbound
  safe(svc, {
    kind: 'inbound_message',
    enterpriseId: eid,
    correlationId: msg.messageId,
    payload: {
      messageId: msg.messageId,
      conversationId: msg.conversationId,
      body: msg.body,
    },
    lead: null,
  });
}

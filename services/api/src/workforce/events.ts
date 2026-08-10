/**
 * Workforce event emitters — bridge workforce mutations to the automation
 * engine (M2). Same contract as automation/events.ts: controllers do
 * mutation → audit → emitter, and the emitter shapes the AutomationEvent.
 */
import type { AutomationEvent } from '../automation/types.js';
import { AutomationService } from '../automation/automation.service.js';

function safe(svc: AutomationService | undefined, event: AutomationEvent): void {
  if (!svc) return;
  try {
    void svc.fire(event);
  } catch {
    /* fire() never throws; paranoia */
  }
}

export interface WfAttendanceEv {
  id: string;
  memberId: string;
  workDate: string;
  status: string;
}

export function attendanceCheckedIn(svc: AutomationService, eid: string, att: WfAttendanceEv): void {
  safe(svc, {
    kind: 'attendance_checked_in',
    enterpriseId: eid,
    correlationId: att.id,
    payload: { attendanceId: att.id, memberId: att.memberId, workDate: att.workDate, status: att.status },
  });
}

export function attendanceCheckedOut(
  svc: AutomationService,
  eid: string,
  att: WfAttendanceEv,
  totalHours: number | null,
): void {
  safe(svc, {
    kind: 'attendance_checked_out',
    enterpriseId: eid,
    correlationId: att.id,
    payload: { attendanceId: att.id, memberId: att.memberId, workDate: att.workDate, status: att.status, totalHours },
  });
}

export interface WfEodEv {
  id: string;
  memberId: string;
  reportDate: string;
  status: string;
}

export function eodSubmitted(svc: AutomationService, eid: string, eod: WfEodEv): void {
  safe(svc, {
    kind: 'eod_submitted',
    enterpriseId: eid,
    correlationId: eod.id,
    payload: { eodId: eod.id, memberId: eod.memberId, reportDate: eod.reportDate, status: eod.status },
  });
}

export function eodMissed(svc: AutomationService, eid: string, eod: WfEodEv): void {
  safe(svc, {
    kind: 'eod_missed',
    enterpriseId: eid,
    correlationId: eod.id,
    payload: { eodId: eod.id, memberId: eod.memberId, reportDate: eod.reportDate },
  });
}

export interface WfTaskEv {
  id: string;
  title: string;
  assignedToMemberId: string;
  assignedByMemberId: string | null;
  priority: string;
  dueDate: string | null;
}

export function taskAssigned(svc: AutomationService, eid: string, t: WfTaskEv): void {
  safe(svc, {
    kind: 'task_assigned',
    enterpriseId: eid,
    correlationId: t.id,
    payload: {
      taskId: t.id,
      title: t.title,
      assignedToMemberId: t.assignedToMemberId,
      assignedByMemberId: t.assignedByMemberId,
      priority: t.priority,
      dueDate: t.dueDate,
    },
  });
}

export function taskOverdue(svc: AutomationService, eid: string, t: WfTaskEv): void {
  safe(svc, {
    kind: 'task_overdue',
    enterpriseId: eid,
    correlationId: t.id,
    payload: { taskId: t.id, title: t.title, assignedToMemberId: t.assignedToMemberId, priority: t.priority, dueDate: t.dueDate },
  });
}

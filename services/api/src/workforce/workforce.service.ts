/**
 * Workforce domain service — shared business logic for attendance/EOD status.
 * Lateness + EOD-cutoff cutoffs are hour-of-day floats in server-local time;
 * the operator host is expected to run IST (Asia/Kolkata), matching the
 * seeded enterprise timezone. See docs/adr for the UTC-cron handling note.
 */
import { Injectable } from '@nestjs/common';
import { and, eq, inArray } from 'drizzle-orm';
import type { DbClient } from '@opentelecrm/db';
import { attendance, teamMember, user } from '@opentelecrm/db';
import { notFound } from './roles.js';

/** Check-in later than 09:30 → late. */
export const LATENESS_CUTOFF_HOUR = 9.5;
/** EOD submitted at/after 18:00 → late. */
export const EOD_CUTOFF_HOUR = 18;
/** Check-out with fewer than this many hours → half_day. */
export const HALF_DAY_HOURS = 4;

@Injectable()
export class WorkforceService {
  /** ISO string → local Date. */
  toDate(iso: string | Date): Date {
    return iso instanceof Date ? iso : new Date(iso);
  }

  /** Attendance status on check-in: ≤09:30 → present, else late. */
  checkInStatus(at: Date): 'present' | 'late' {
    const h = at.getHours() + at.getMinutes() / 60;
    return h <= LATENESS_CUTOFF_HOUR ? 'present' : 'late';
  }

  /**
   * Recompute a row on check-out: totalHours from the ISO instants;
   * < 4h → half_day; otherwise keep the check-in status.
   */
  checkOutUpdate(
    row: { checkInAt: Date | null; status: string },
    out: Date,
  ): { status: string; totalHours: number | null } {
    if (!row.checkInAt) return { status: row.status, totalHours: null };
    const totalHours = (out.getTime() - row.checkInAt.getTime()) / 3_600_000;
    if (totalHours < HALF_DAY_HOURS) return { status: 'half_day', totalHours: round2(totalHours) };
    return { status: row.status, totalHours: round2(totalHours) };
  }

  /** EOD status on submit: hour ≥ 18 → late, else submitted. */
  eodStatus(at: Date): 'submitted' | 'late' {
    const h = at.getHours() + at.getMinutes() / 60;
    return h >= EOD_CUTOFF_HOUR ? 'late' : 'submitted';
  }

  /** ISO date string for `d` in server-local time. */
  dateKey(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  /** Monday of the Mon–Sat working week containing `d`. */
  weekStart(d: Date): string {
    const day = d.getDay(); // 0=Sun
    const diff = day === 0 ? 6 : day - 1;
    const monday = new Date(d);
    monday.setDate(d.getDate() - diff);
    return this.dateKey(monday);
  }

  /** Load member id → user display name (for compliance views). */
  async memberNames(db: DbClient, eid: string, memberIds: string[]): Promise<Map<string, string>> {
    if (memberIds.length === 0) return new Map();
    const rows = await db
      .select({ id: teamMember.id, name: user.name })
      .from(teamMember)
      .innerJoin(user, eq(teamMember.userId, user.id))
      .where(and(eq(teamMember.enterpriseId, eid), inArray(teamMember.id, memberIds)));
    return new Map(rows.map((r) => [r.id, r.name]));
  }
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Shared "get attendance row or 404" helper. */
export async function getAttendanceOr404(db: DbClient, eid: string, id: string) {
  const rows = await db
    .select()
    .from(attendance)
    .where(eq(attendance.id, id))
    .limit(1);
  const row = rows[0];
  if (!row || row.enterpriseId !== eid) throw notFound('attendance');
  return row;
}

/**
 * Workforce system jobs (ByteCodeEMS port, M2) — code-driven replacements
 * for the EMS web's Vercel cron:
 *   processEodCutoff()  12:30 UTC Mon–Sat — marks non-submitters missed
 *   processWeeklyRollup() Saturday 12:30 UTC — generates weekly reports
 * Hooks: the AutomationScheduler 60s tick calls these behind isCronMatch
 * guards (UTC-shifted — cron.ts evaluates server-local time).
 *
 * Both jobs iterate ALL enterprises (the enterprise table is not
 * tenant-scoped) and run per-enterprise work inside withTenant() so RLS
 * applies (workforce tables are FORCEd).
 */
import { Inject, Injectable } from '@nestjs/common';
import { and, eq, gte, lte } from 'drizzle-orm';
import type { DbClient } from '@opentelecrm/db';
import {
  attendance,
  dailyMetricEntry,
  department,
  eodReport,
  enterprise,
  task,
  teamMember,
  weeklyReport,
  withTenant,
} from '@opentelecrm/db';
import { DB_PROVIDER, TENANT_WRAPPER } from '../db/database.module.js';
import { AutomationService } from '../automation/automation.service.js';
import { eodMissed, taskOverdue } from './events.js';
import { WorkforceService } from './workforce.service.js';

type TenantFn = <T>(enterpriseId: string, fn: (db: DbClient) => Promise<T>) => Promise<T>;

const PRESENT_STATUSES = ['present', 'late', 'half_day'];

@Injectable()
export class WorkforceJobsService {
  constructor(
    @Inject(DB_PROVIDER) private db: DbClient,
    @Inject(TENANT_WRAPPER) private withTenant: TenantFn,
    @Inject(AutomationService) private readonly automation: AutomationService,
    @Inject(WorkforceService) private readonly svc: WorkforceService,
  ) {}

  /**
   * Mark every active member without an EOD row for `date` as missed.
   * Skips Sundays. Returns { processed } = missed rows created.
   */
  async processEodCutoff(date?: Date): Promise<{ processed: number }> {
    const target = date ?? new Date();
    if (target.getDay() === 0) return { processed: 0 }; // Sunday off
    const workDate = this.svc.dateKey(target);

    const ents = await this.db.select({ id: enterprise.id }).from(enterprise);
    let processed = 0;
    for (const ent of ents) {
      await this.withTenant(ent.id, async (db) => {
        const members = await db
          .select({ id: teamMember.id })
          .from(teamMember)
          .where(and(eq(teamMember.enterpriseId, ent.id), eq(teamMember.employmentStatus, 'active')));
        const existing = await db
          .select({ memberId: eodReport.memberId })
          .from(eodReport)
          .where(and(eq(eodReport.enterpriseId, ent.id), eq(eodReport.reportDate, workDate)));
        const have = new Set(existing.map((r) => r.memberId));

        for (const m of members) {
          if (have.has(m.id)) continue;
          const [row] = await db
            .insert(eodReport)
            .values({
              enterpriseId: ent.id,
              memberId: m.id,
              reportDate: workDate,
              summary: '',
              taskRefs: [],
              submittedAt: new Date(),
              status: 'missed',
            })
            .returning();
          if (row) {
            processed++;
            eodMissed(this.automation, ent.id, { id: row.id, memberId: m.id, reportDate: workDate, status: 'missed' });
          }
        }
      });
    }
    return { processed };
  }

  /**
   * Generate/refresh weekly_report rows for the Mon–Sat week containing
   * `date` (defaults to today; the Saturday job passes the Saturday).
   */
  async processWeeklyRollup(date?: Date): Promise<{ processed: number }> {
    const target = date ?? new Date();
    const weekStart = this.svc.weekStart(target);
    const ms = new Date(`${weekStart}T00:00:00`);
    const me = new Date(ms);
    me.setDate(ms.getDate() + 5);
    const weekEnd = this.svc.dateKey(me);
    const rangeStart = new Date(`${weekStart}T00:00:00`);
    const rangeEnd = new Date(`${weekEnd}T23:59:59.999`);

    const ents = await this.db.select({ id: enterprise.id }).from(enterprise);
    let processed = 0;
    for (const ent of ents) {
      await this.withTenant(ent.id, async (db) => {
        const members = await db
          .select({ id: teamMember.id })
          .from(teamMember)
          .where(eq(teamMember.enterpriseId, ent.id));
        for (const m of members) {
          const attRows = await db
            .select({ status: attendance.status })
            .from(attendance)
            .where(
              and(
                eq(attendance.enterpriseId, ent.id),
                eq(attendance.memberId, m.id),
                gte(attendance.workDate, weekStart),
                lte(attendance.workDate, weekEnd),
              ),
            );
          const daysPresent = attRows.filter((r) => PRESENT_STATUSES.includes(r.status)).length;

          const eodRows = await db
            .select({ status: eodReport.status })
            .from(eodReport)
            .where(
              and(
                eq(eodReport.enterpriseId, ent.id),
                eq(eodReport.memberId, m.id),
                gte(eodReport.reportDate, weekStart),
                lte(eodReport.reportDate, weekEnd),
              ),
            );
          const eodSubmitted = eodRows.filter((r) => r.status !== 'missed').length;

          const taskRows = await db
            .select({ completedAt: task.completedAt })
            .from(task)
            .where(
              and(
                eq(task.enterpriseId, ent.id),
                eq(task.assignedToMemberId, m.id),
                gte(task.completedAt, rangeStart),
                lte(task.completedAt, rangeEnd),
              ),
            );
          const tasksCompleted = taskRows.length;

          const metricRows = await db
            .select({ metricKey: dailyMetricEntry.metricKey, value: dailyMetricEntry.value })
            .from(dailyMetricEntry)
            .where(
              and(
                eq(dailyMetricEntry.enterpriseId, ent.id),
                eq(dailyMetricEntry.memberId, m.id),
                gte(dailyMetricEntry.entryDate, weekStart),
                lte(dailyMetricEntry.entryDate, weekEnd),
              ),
            );
          const metricTotals: Record<string, number> = {};
          for (const mr of metricRows) {
            metricTotals[mr.metricKey] = (metricTotals[mr.metricKey] ?? 0) + (Number(mr.value) || 0);
          }

          const existing = await db
            .select({ id: weeklyReport.id })
            .from(weeklyReport)
            .where(
              and(
                eq(weeklyReport.enterpriseId, ent.id),
                eq(weeklyReport.memberId, m.id),
                eq(weeklyReport.weekStart, weekStart),
              ),
            )
            .limit(1);

          const values = {
            metricTotals,
            tasksCompleted,
            eodSubmitted,
            daysPresent,
            generatedAt: new Date(),
          };
          if (existing[0]) {
            await db.update(weeklyReport).set(values).where(eq(weeklyReport.id, existing[0].id));
          } else {
            await db.insert(weeklyReport).values({
              enterpriseId: ent.id,
              memberId: m.id,
              weekStart,
              weekEnd,
              ...values,
            });
          }
          processed++;
        }
      });
    }
    return { processed };
  }

  /**
   * Fire task_overdue for tasks past their due date, once, in the enterprise
   * the task belongs to. Idempotent-ish: the automation engine dedupes by
   * correlationId; callers gate this with a schedule (e.g. daily).
   */
  async processOverdueTasks(date?: Date): Promise<{ processed: number }> {
    const target = date ?? new Date();
    const today = this.svc.dateKey(target);
    const ents = await this.db.select({ id: enterprise.id }).from(enterprise);
    let processed = 0;
    for (const ent of ents) {
      await this.withTenant(ent.id, async (db) => {
        const rows = await db
          .select()
          .from(task)
          .where(
            and(
              eq(task.enterpriseId, ent.id),
              eq(task.status, 'todo'),
              gte(task.dueDate, '2000-01-01'),
              lte(task.dueDate, today),
            ),
          );
        for (const r of rows) {
          taskOverdue(this.automation, ent.id, {
            id: r.id,
            title: r.title,
            assignedToMemberId: r.assignedToMemberId,
            assignedByMemberId: r.assignedByMemberId,
            priority: r.priority,
            dueDate: r.dueDate,
          });
          processed++;
        }
      });
    }
    return { processed };
  }

  /** All active departments, used by jobs that need department context. */
  async departments(eid: string): Promise<{ id: string; name: string }[]> {
    return this.withTenant(eid, async (db) => {
      const rows = await db
        .select({ id: department.id, name: department.name })
        .from(department)
        .where(eq(department.enterpriseId, eid));
      return rows;
    });
  }
}

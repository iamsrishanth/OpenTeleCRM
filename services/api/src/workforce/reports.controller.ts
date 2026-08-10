/**
 * Workforce — weekly reports + CSV exports (ByteCodeEMS port).
 *   GET /enterprise/{eid}/reports/weekly          own weekly reports
 *   GET /enterprise/{eid}/reports/weekly/admin?weekStart=  team view (admin)
 *   GET /enterprise/{eid}/reports/export/eod?from&to       CSV
 *   GET /enterprise/{eid}/reports/export/attendance?from&to CSV
 *   GET /enterprise/{eid}/reports/export/weekly?weekStart= CSV
 */
import { Controller, Get, HttpException, HttpStatus, Param, Query, Req, Res } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { and, desc, eq } from 'drizzle-orm';
import type { FastifyReply, FastifyRequest } from 'fastify';
import type { DbClient } from '@opentelecrm/db';
import { attendance, eodReport, teamMember, user, weeklyReport } from '@opentelecrm/db';
import type { AuthContext } from '../auth/auth.guard.js';
import { DB_PROVIDER, TENANT_WRAPPER } from '../db/database.module.js';
import { ADMIN_ROLES, MEMBER_ROLES, requireRole } from './roles.js';
import { WorkforceService } from './workforce.service.js';

type TenantFn = <T>(enterpriseId: string, fn: (db: DbClient) => Promise<T>) => Promise<T>;

@Controller('enterprise/:eid/reports')
export class ReportsController {
  constructor(
    @Inject(DB_PROVIDER) private db: DbClient,
    @Inject(TENANT_WRAPPER) private withTenant: TenantFn,
    @Inject(WorkforceService) private readonly svc: WorkforceService,
  ) {}

  private assertTenant(req: FastifyRequest, eid: string): AuthContext {
    const auth = req.auth;
    if (!auth) throw new Error('unauthenticated');
    if (auth.enterpriseId !== eid) throw new Error('enterprise mismatch');
    return auth;
  }

  private validationError(message: string): HttpException {
    return new HttpException({ error: { code: 'VALIDATION_ERROR', message } }, HttpStatus.BAD_REQUEST);
  }

  @Get('weekly')
  async weekly(@Param('eid') eid: string, @Req() req: FastifyRequest) {
    const auth = this.assertTenant(req, eid);
    return this.withTenant(eid, async (db) => {
      const member = await requireRole(db, eid, auth.userId, MEMBER_ROLES);
      const rows = await db
        .select()
        .from(weeklyReport)
        .where(and(eq(weeklyReport.enterpriseId, eid), eq(weeklyReport.memberId, member.id)))
        .orderBy(desc(weeklyReport.weekStart));
      return {
        data: rows.map((r) => ({
          id: r.id,
          weekStart: r.weekStart,
          weekEnd: r.weekEnd,
          metricTotals: r.metricTotals,
          tasksCompleted: r.tasksCompleted,
          eodSubmitted: r.eodSubmitted,
          daysPresent: r.daysPresent,
          employeeNote: r.employeeNote,
          generatedAt: r.generatedAt.toISOString(),
        })),
        total: rows.length,
      };
    });
  }

  @Get('weekly/admin')
  async weeklyAdmin(@Param('eid') eid: string, @Req() req: FastifyRequest, @Query('weekStart') weekStart?: string) {
    const auth = this.assertTenant(req, eid);
    return this.withTenant(eid, async (db) => {
      await requireRole(db, eid, auth.userId, ADMIN_ROLES);
      const conds = [eq(weeklyReport.enterpriseId, eid)];
      if (weekStart) conds.push(eq(weeklyReport.weekStart, weekStart));
      const rows = await db
        .select({
          id: weeklyReport.id,
          memberId: weeklyReport.memberId,
          name: user.name,
          weekStart: weeklyReport.weekStart,
          weekEnd: weeklyReport.weekEnd,
          metricTotals: weeklyReport.metricTotals,
          tasksCompleted: weeklyReport.tasksCompleted,
          eodSubmitted: weeklyReport.eodSubmitted,
          daysPresent: weeklyReport.daysPresent,
          employeeNote: weeklyReport.employeeNote,
        })
        .from(weeklyReport)
        .innerJoin(teamMember, eq(weeklyReport.memberId, teamMember.id))
        .innerJoin(user, eq(teamMember.userId, user.id))
        .where(and(...conds))
        .orderBy(desc(weeklyReport.weekStart));
      return {
        data: rows.map((r) => ({
          id: r.id,
          memberId: r.memberId,
          name: r.name,
          weekStart: r.weekStart,
          weekEnd: r.weekEnd,
          metricTotals: r.metricTotals,
          tasksCompleted: r.tasksCompleted,
          eodSubmitted: r.eodSubmitted,
          daysPresent: r.daysPresent,
          employeeNote: r.employeeNote,
        })),
      };
    });
  }

  @Get('export/eod')
  async exportEod(
    @Param('eid') eid: string,
    @Req() req: FastifyRequest,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Res({ passthrough: true }) res?: FastifyReply,
  ) {
    const auth = this.assertTenant(req, eid);
    return this.withTenant(eid, async (db) => {
      await requireRole(db, eid, auth.userId, ADMIN_ROLES);
      res?.header('Content-Type', 'text/csv');
      res?.header('Content-Disposition', 'attachment; filename="eod.csv"');
      const conds = [eq(eodReport.enterpriseId, eid)];
      if (from) conds.push(eq(eodReport.reportDate, from));
      if (to) conds.push(eq(eodReport.reportDate, to));
      const rows = await db
        .select({ name: user.name, reportDate: eodReport.reportDate, status: eodReport.status, summary: eodReport.summary })
        .from(eodReport)
        .innerJoin(teamMember, eq(eodReport.memberId, teamMember.id))
        .innerJoin(user, eq(teamMember.userId, user.id))
        .where(and(...conds))
        .orderBy(eodReport.reportDate);
      const lines = ['name,report_date,status,summary'];
      for (const r of rows) lines.push(`${csv(r.name)},${r.reportDate},${r.status},${csv(r.summary)}`);
      return lines.join('\n');
    });
  }

  @Get('export/attendance')
  async exportAttendance(
    @Param('eid') eid: string,
    @Req() req: FastifyRequest,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Res({ passthrough: true }) res?: FastifyReply,
  ) {
    const auth = this.assertTenant(req, eid);
    return this.withTenant(eid, async (db) => {
      await requireRole(db, eid, auth.userId, ADMIN_ROLES);
      res?.header('Content-Type', 'text/csv');
      res?.header('Content-Disposition', 'attachment; filename="attendance.csv"');
      const conds = [eq(attendance.enterpriseId, eid)];
      if (from) conds.push(eq(attendance.workDate, from));
      if (to) conds.push(eq(attendance.workDate, to));
      const rows = await db
        .select({
          name: user.name,
          workDate: attendance.workDate,
          status: attendance.status,
          totalHours: attendance.totalHours,
          checkInAt: attendance.checkInAt,
          checkOutAt: attendance.checkOutAt,
        })
        .from(attendance)
        .innerJoin(teamMember, eq(attendance.memberId, teamMember.id))
        .innerJoin(user, eq(teamMember.userId, user.id))
        .where(and(...conds))
        .orderBy(attendance.workDate);
      const lines = ['name,work_date,status,total_hours,check_in_at,check_out_at'];
      for (const r of rows) {
        lines.push(`${csv(r.name)},${r.workDate},${r.status},${r.totalHours ?? ''},${r.checkInAt?.toISOString() ?? ''},${r.checkOutAt?.toISOString() ?? ''}`);
      }
      return lines.join('\n');
    });
  }

  @Get('export/weekly')
  async exportWeekly(
    @Param('eid') eid: string,
    @Req() req: FastifyRequest,
    @Query('weekStart') weekStart?: string,
    @Res({ passthrough: true }) res?: FastifyReply,
  ) {
    const auth = this.assertTenant(req, eid);
    return this.withTenant(eid, async (db) => {
      await requireRole(db, eid, auth.userId, ADMIN_ROLES);
      res?.header('Content-Type', 'text/csv');
      res?.header('Content-Disposition', 'attachment; filename="weekly.csv"');
      const conds = [eq(weeklyReport.enterpriseId, eid)];
      if (weekStart) conds.push(eq(weeklyReport.weekStart, weekStart));
      const rows = await db
        .select({
          name: user.name,
          weekStart: weeklyReport.weekStart,
          daysPresent: weeklyReport.daysPresent,
          eodSubmitted: weeklyReport.eodSubmitted,
          tasksCompleted: weeklyReport.tasksCompleted,
          metricTotals: weeklyReport.metricTotals,
        })
        .from(weeklyReport)
        .innerJoin(teamMember, eq(weeklyReport.memberId, teamMember.id))
        .innerJoin(user, eq(teamMember.userId, user.id))
        .where(and(...conds))
        .orderBy(weeklyReport.weekStart);
      const lines = ['name,week_start,days_present,eod_submitted,tasks_completed,metric_totals'];
      for (const r of rows) lines.push(`${csv(r.name)},${r.weekStart},${r.daysPresent},${r.eodSubmitted},${r.tasksCompleted},${csv(JSON.stringify(r.metricTotals))}`);
      return lines.join('\n');
    });
  }
}

function csv(v: string | null | undefined): string {
  if (v == null) return '';
  const s = String(v);
  return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replaceAll('"', '""')}"` : s;
}

/**
 * Workforce — EOD reports (ByteCodeEMS port).
 *   POST /enterprise/{eid}/eod   { summary, hoursWorked?, taskRefs?, metrics? }
 *   GET  /enterprise/{eid}/eod   own history (30)
 *   GET  /enterprise/{eid}/eod/admin?date= compliance (admin)
 */
import { Body, Controller, Get, HttpCode, HttpException, HttpStatus, Param, Post, Query, Req } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { and, desc, eq } from 'drizzle-orm';
import type { FastifyRequest } from 'fastify';
import type { DbClient } from '@opentelecrm/db';
import { dailyMetricEntry, eodReport, teamMember, user } from '@opentelecrm/db';
import type { AuthContext } from '../auth/auth.guard.js';
import { DB_PROVIDER, TENANT_WRAPPER } from '../db/database.module.js';
import { AuditService } from '../audit/audit.service.js';
import { AutomationService } from '../automation/automation.service.js';
import { eodSubmitted } from './events.js';
import { ADMIN_ROLES, MEMBER_ROLES, requireRole } from './roles.js';
import { WorkforceService } from './workforce.service.js';

type TenantFn = <T>(enterpriseId: string, fn: (db: DbClient) => Promise<T>) => Promise<T>;

interface EodMetricDto {
  metricKey: string;
  value: number;
}

interface CreateEodDto {
  summary: string;
  hoursWorked?: number;
  taskRefs?: string[];
  metrics?: EodMetricDto[];
}

@Controller('enterprise/:eid/eod')
export class EodController {
  constructor(
    @Inject(DB_PROVIDER) private db: DbClient,
    @Inject(TENANT_WRAPPER) private withTenant: TenantFn,
    @Inject(AuditService) private readonly auditService: AuditService,
    @Inject(AutomationService) private readonly automationService: AutomationService,
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

  @Post()
  @HttpCode(200)
  async create(@Param('eid') eid: string, @Req() req: FastifyRequest, @Body() dto: CreateEodDto) {
    const auth = this.assertTenant(req, eid);
    const summary = dto?.summary;
    if (!summary || summary.trim().length === 0) throw this.validationError('summary is required');
    if (dto?.hoursWorked !== undefined && (typeof dto.hoursWorked !== 'number' || Number.isNaN(dto.hoursWorked))) {
      throw this.validationError('hoursWorked must be a number');
    }
    const taskRefs = Array.isArray(dto?.taskRefs) ? dto.taskRefs.map(String) : [];

    return this.withTenant(eid, async (db) => {
      const member = await requireRole(db, eid, auth.userId, MEMBER_ROLES);
      const now = new Date();
      const reportDate = this.svc.dateKey(now);

      const existing = await db
        .select()
        .from(eodReport)
        .where(and(eq(eodReport.enterpriseId, eid), eq(eodReport.memberId, member.id), eq(eodReport.reportDate, reportDate)))
        .limit(1);
      // A 'missed' row is created by the EOD cutoff job (12:30 UTC). A late
      // submission after the cutoff upgrades it to 'late' instead of 400.
      if (existing[0] && existing[0].status !== 'missed') {
        throw this.validationError('EOD already submitted for today');
      }

      const status = this.svc.eodStatus(now);
      let row = existing[0];
      if (row) {
        await db
          .update(eodReport)
          .set({ summary: summary.trim(), hoursWorked: dto?.hoursWorked !== undefined ? String(dto.hoursWorked) : null, taskRefs, submittedAt: now, status })
          .where(eq(eodReport.id, row.id));
        row = { ...row, summary: summary.trim(), hoursWorked: dto?.hoursWorked !== undefined ? String(dto.hoursWorked) : null, taskRefs, submittedAt: now, status };
      } else {
        const [inserted] = await db
          .insert(eodReport)
          .values({
            enterpriseId: eid,
            memberId: member.id,
            reportDate,
            summary: summary.trim(),
            hoursWorked: dto?.hoursWorked !== undefined ? String(dto.hoursWorked) : null,
            taskRefs,
            submittedAt: now,
            status,
          })
          .returning();
        if (!inserted) throw new Error('eod insert returned no row');
        row = inserted;
      }

      // Upsert sales metrics into daily_metric_entry (member + key + date).
      if (Array.isArray(dto?.metrics)) {
        for (const m of dto.metrics) {
          if (!m?.metricKey || typeof m.metricKey !== 'string') continue;
          const value = Number(m.value);
          if (Number.isNaN(value)) continue;
          const found = await db
            .select({ id: dailyMetricEntry.id })
            .from(dailyMetricEntry)
            .where(
              and(
                eq(dailyMetricEntry.enterpriseId, eid),
                eq(dailyMetricEntry.memberId, member.id),
                eq(dailyMetricEntry.metricKey, m.metricKey),
                eq(dailyMetricEntry.entryDate, reportDate),
              ),
            )
            .limit(1);
          if (found[0]) {
            await db
              .update(dailyMetricEntry)
              .set({ value: String(value) })
              .where(eq(dailyMetricEntry.id, found[0].id));
          } else {
            await db.insert(dailyMetricEntry).values({
              enterpriseId: eid,
              memberId: member.id,
              metricKey: m.metricKey,
              entryDate: reportDate,
              value: String(value),
            });
          }
        }
      }

      await this.auditService.record({
        enterpriseId: eid,
        actorUserId: auth.userId,
        actorTokenId: auth.apiTokenId,
        action: 'eod.submitted',
        resourceType: 'eod_report',
        resourceId: row.id,
        after: { id: row.id, reportDate, status: row.status },
      });
      eodSubmitted(this.automationService, eid, {
        id: row.id,
        memberId: member.id,
        reportDate,
        status: row.status,
      });
      return { id: row.id, reportDate, status: row.status };
    });
  }

  @Get()
  async history(@Param('eid') eid: string, @Req() req: FastifyRequest) {
    const auth = this.assertTenant(req, eid);
    return this.withTenant(eid, async (db) => {
      const member = await requireRole(db, eid, auth.userId, MEMBER_ROLES);
      const rows = await db
        .select()
        .from(eodReport)
        .where(and(eq(eodReport.enterpriseId, eid), eq(eodReport.memberId, member.id)))
        .orderBy(desc(eodReport.reportDate))
        .limit(30);
      return {
        data: rows.map((r) => ({
          id: r.id,
          reportDate: r.reportDate,
          summary: r.summary,
          hoursWorked: r.hoursWorked,
          taskRefs: r.taskRefs,
          submittedAt: r.submittedAt.toISOString(),
          status: r.status,
        })),
        total: rows.length,
      };
    });
  }

  @Get('admin')
  async adminView(@Param('eid') eid: string, @Req() req: FastifyRequest, @Query('date') date?: string) {
    const auth = this.assertTenant(req, eid);
    return this.withTenant(eid, async (db) => {
      await requireRole(db, eid, auth.userId, ADMIN_ROLES);
      const targetDate = date ?? this.svc.dateKey(new Date());

      const members = await db
        .select({ id: teamMember.id, name: user.name })
        .from(teamMember)
        .innerJoin(user, eq(teamMember.userId, user.id))
        .where(eq(teamMember.enterpriseId, eid));

      const rows = await db
        .select()
        .from(eodReport)
        .where(and(eq(eodReport.enterpriseId, eid), eq(eodReport.reportDate, targetDate)));

      const submittedIds = new Set(rows.map((r) => r.memberId));
      return {
        date: targetDate,
        data: members.map((m) => ({
          memberId: m.id,
          name: m.name,
          submitted: submittedIds.has(m.id),
          status: rows.find((r) => r.memberId === m.id)?.status ?? 'missed',
        })),
      };
    });
  }
}

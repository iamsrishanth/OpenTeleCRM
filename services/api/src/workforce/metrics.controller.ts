/**
 * Workforce — metrics (ByteCodeEMS port: department-defined metrics vs targets).
 *   GET  /enterprise/{eid}/metrics/definitions?departmentId=
 *   POST /enterprise/{eid}/metrics/definitions (admin) { departmentId, key, label, defaultDailyTarget? }
 *   POST /enterprise/{eid}/metrics/entries     { metricKey, entryDate?, value }
 *   GET  /enterprise/{eid}/metrics/entries?from&to
 *   GET  /enterprise/{eid}/metrics/daily?date= (admin) per-member totals vs default target
 */
import { Body, Controller, Get, HttpCode, HttpException, HttpStatus, Param, Post, Query, Req } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { and, desc, eq } from 'drizzle-orm';
import type { FastifyRequest } from 'fastify';
import type { DbClient } from '@opentelecrm/db';
import { dailyMetricEntry, department, metricDefinition, teamMember, user } from '@opentelecrm/db';
import type { AuthContext } from '../auth/auth.guard.js';
import { DB_PROVIDER, TENANT_WRAPPER } from '../db/database.module.js';
import { AuditService } from '../audit/audit.service.js';
import { ADMIN_ROLES, MEMBER_ROLES, requireRole } from './roles.js';
import { WorkforceService } from './workforce.service.js';

type TenantFn = <T>(enterpriseId: string, fn: (db: DbClient) => Promise<T>) => Promise<T>;

interface CreateDefDto {
  departmentId: string;
  key: string;
  label: string;
  defaultDailyTarget?: number;
}

interface CreateEntryDto {
  metricKey: string;
  entryDate?: string;
  value: number;
}

@Controller('enterprise/:eid/metrics')
export class MetricsController {
  constructor(
    @Inject(DB_PROVIDER) private db: DbClient,
    @Inject(TENANT_WRAPPER) private withTenant: TenantFn,
    @Inject(AuditService) private readonly auditService: AuditService,
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

  @Get('definitions')
  async definitions(@Param('eid') eid: string, @Req() req: FastifyRequest, @Query('departmentId') departmentId?: string) {
    this.assertTenant(req, eid);
    return this.withTenant(eid, async (db) => {
      const conds = [eq(metricDefinition.enterpriseId, eid)];
      if (departmentId) conds.push(eq(metricDefinition.departmentId, departmentId));
      const rows = await db.select().from(metricDefinition).where(and(...conds));
      return {
        data: rows.map((r) => ({
          id: r.id,
          departmentId: r.departmentId,
          key: r.key,
          label: r.label,
          defaultDailyTarget: r.defaultDailyTarget,
        })),
        total: rows.length,
      };
    });
  }

  @Post('definitions')
  @HttpCode(200)
  async createDefinition(@Param('eid') eid: string, @Req() req: FastifyRequest, @Body() dto: CreateDefDto) {
    const auth = this.assertTenant(req, eid);
    if (!dto?.key || dto.key.trim().length === 0) throw this.validationError('key is required');
    if (!dto?.label || dto.label.trim().length === 0) throw this.validationError('label is required');
    return this.withTenant(eid, async (db) => {
      await requireRole(db, eid, auth.userId, ADMIN_ROLES);
      const dept = await db.select({ id: department.id }).from(department).where(eq(department.id, dto.departmentId)).limit(1);
      if (!dept[0]) throw this.validationError('departmentId not found');
      const [row] = await db
        .insert(metricDefinition)
        .values({
          enterpriseId: eid,
          departmentId: dto.departmentId,
          key: dto.key.trim(),
          label: dto.label.trim(),
          defaultDailyTarget: dto?.defaultDailyTarget !== undefined ? String(dto.defaultDailyTarget) : null,
        })
        .returning();
      if (!row) throw new Error('metric definition insert returned no row');
      await this.auditService.record({
        enterpriseId: eid,
        actorUserId: auth.userId,
        actorTokenId: auth.apiTokenId,
        action: 'metric.definition_created',
        resourceType: 'metric_definition',
        resourceId: row.id,
        after: { id: row.id, key: row.key, label: row.label },
      });
      return { id: row.id, departmentId: row.departmentId, key: row.key, label: row.label };
    });
  }

  @Post('entries')
  @HttpCode(200)
  async createEntry(@Param('eid') eid: string, @Req() req: FastifyRequest, @Body() dto: CreateEntryDto) {
    const auth = this.assertTenant(req, eid);
    if (!dto?.metricKey) throw this.validationError('metricKey is required');
    const value = Number(dto?.value);
    if (Number.isNaN(value)) throw this.validationError('value must be a number');
    return this.withTenant(eid, async (db) => {
      const member = await requireRole(db, eid, auth.userId, MEMBER_ROLES);
      const entryDate = dto?.entryDate ?? this.svc.dateKey(new Date());
      const found = await db
        .select({ id: dailyMetricEntry.id })
        .from(dailyMetricEntry)
        .where(
          and(
            eq(dailyMetricEntry.enterpriseId, eid),
            eq(dailyMetricEntry.memberId, member.id),
            eq(dailyMetricEntry.metricKey, dto.metricKey),
            eq(dailyMetricEntry.entryDate, entryDate),
          ),
        )
        .limit(1);
      let id: string;
      if (found[0]) {
        await db.update(dailyMetricEntry).set({ value: String(value) }).where(eq(dailyMetricEntry.id, found[0].id));
        id = found[0].id;
      } else {
        const [row] = await db
          .insert(dailyMetricEntry)
          .values({ enterpriseId: eid, memberId: member.id, metricKey: dto.metricKey, entryDate, value: String(value) })
          .returning();
        if (!row) throw new Error('metric entry insert returned no row');
        id = row.id;
      }
      await this.auditService.record({
        enterpriseId: eid,
        actorUserId: auth.userId,
        actorTokenId: auth.apiTokenId,
        action: 'metric.entry_logged',
        resourceType: 'daily_metric_entry',
        resourceId: id,
        after: { id, metricKey: dto.metricKey, entryDate, value: String(value) },
      });
      return { id, metricKey: dto.metricKey, entryDate, value: String(value) };
    });
  }

  @Get('entries')
  async entries(@Param('eid') eid: string, @Req() req: FastifyRequest, @Query('from') from?: string, @Query('to') to?: string) {
    const auth = this.assertTenant(req, eid);
    return this.withTenant(eid, async (db) => {
      const member = await requireRole(db, eid, auth.userId, MEMBER_ROLES);
      const conds = [eq(dailyMetricEntry.enterpriseId, eid), eq(dailyMetricEntry.memberId, member.id)];
      if (from) conds.push(eq(dailyMetricEntry.entryDate, from));
      if (to) conds.push(eq(dailyMetricEntry.entryDate, to));
      const rows = await db.select().from(dailyMetricEntry).where(and(...conds)).orderBy(desc(dailyMetricEntry.entryDate));
      return {
        data: rows.map((r) => ({ id: r.id, metricKey: r.metricKey, entryDate: r.entryDate, value: r.value })),
        total: rows.length,
      };
    });
  }

  @Get('daily')
  async daily(@Param('eid') eid: string, @Req() req: FastifyRequest, @Query('date') date?: string) {
    const auth = this.assertTenant(req, eid);
    return this.withTenant(eid, async (db) => {
      await requireRole(db, eid, auth.userId, ADMIN_ROLES);
      const targetDate = date ?? this.svc.dateKey(new Date());

      const defs = await db.select().from(metricDefinition).where(eq(metricDefinition.enterpriseId, eid));
      const entries = await db
        .select({ memberId: dailyMetricEntry.memberId, metricKey: dailyMetricEntry.metricKey, value: dailyMetricEntry.value })
        .from(dailyMetricEntry)
        .where(and(eq(dailyMetricEntry.enterpriseId, eid), eq(dailyMetricEntry.entryDate, targetDate)));
      const members = await db
        .select({ id: teamMember.id, name: user.name })
        .from(teamMember)
        .innerJoin(user, eq(teamMember.userId, user.id))
        .where(eq(teamMember.enterpriseId, eid));

      const byMember = new Map<string, Map<string, string>>();
      for (const e of entries) {
        if (!byMember.has(e.memberId)) byMember.set(e.memberId, new Map());
        byMember.get(e.memberId)!.set(e.metricKey, e.value);
      }
      return {
        date: targetDate,
        metrics: defs.map((d) => ({ key: d.key, label: d.label, defaultDailyTarget: d.defaultDailyTarget })),
        members: members.map((m) => ({
          memberId: m.id,
          name: m.name,
          values: Object.fromEntries(byMember.get(m.id) ?? new Map()),
        })),
      };
    });
  }
}

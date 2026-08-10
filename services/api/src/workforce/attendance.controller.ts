/**
 * Workforce — attendance (ByteCodeEMS port).
 *   POST /enterprise/{eid}/attendance/check-in    { lat?, lng?, source? }
 *   POST /enterprise/{eid}/attendance/check-out   { lat?, lng? }
 *   GET  /enterprise/{eid}/attendance             own history (30)
 *   GET  /enterprise/{eid}/attendance/admin?date= team view (admin)
 */
import { Body, Controller, Get, HttpCode, HttpException, HttpStatus, Param, Post, Query, Req } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { and, desc, eq } from 'drizzle-orm';
import type { FastifyRequest } from 'fastify';
import type { DbClient } from '@opentelecrm/db';
import { attendance, teamMember, user } from '@opentelecrm/db';
import type { AuthContext } from '../auth/auth.guard.js';
import { DB_PROVIDER, TENANT_WRAPPER } from '../db/database.module.js';
import { AuditService } from '../audit/audit.service.js';
import { AutomationService } from '../automation/automation.service.js';
import { attendanceCheckedIn, attendanceCheckedOut } from './events.js';
import { ADMIN_ROLES, MEMBER_ROLES, requireRole } from './roles.js';
import { WorkforceService } from './workforce.service.js';

type TenantFn = <T>(enterpriseId: string, fn: (db: DbClient) => Promise<T>) => Promise<T>;

interface CheckInDto {
  lat?: number;
  lng?: number;
  source?: 'web' | 'mobile';
}

@Controller('enterprise/:eid/attendance')
export class AttendanceController {
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

  @Post('check-in')
  @HttpCode(200)
  async checkIn(@Param('eid') eid: string, @Req() req: FastifyRequest, @Body() dto: CheckInDto) {
    const auth = this.assertTenant(req, eid);
    return this.withTenant(eid, async (db) => {
      const member = await requireRole(db, eid, auth.userId, MEMBER_ROLES);
      const now = new Date();
      const workDate = this.svc.dateKey(now);

      const existing = await db
        .select({ id: attendance.id })
        .from(attendance)
        .where(and(eq(attendance.enterpriseId, eid), eq(attendance.memberId, member.id), eq(attendance.workDate, workDate)))
        .limit(1);
      if (existing[0]) throw this.validationError('already checked in today');

      const lat = dto?.lat;
      const lng = dto?.lng;
      if (lat !== undefined && (typeof lat !== 'number' || Number.isNaN(lat))) throw this.validationError('lat must be a number');
      if (lng !== undefined && (typeof lng !== 'number' || Number.isNaN(lng))) throw this.validationError('lng must be a number');

      const [row] = await db
        .insert(attendance)
        .values({
          enterpriseId: eid,
          memberId: member.id,
          workDate,
          checkInAt: now,
          status: this.svc.checkInStatus(now),
          checkInLat: lat !== undefined ? String(lat) : null,
          checkInLng: lng !== undefined ? String(lng) : null,
          source: dto?.source ?? 'web',
        })
        .returning();
      if (!row) throw new Error('attendance insert returned no row');

      await this.auditService.record({
        enterpriseId: eid,
        actorUserId: auth.userId,
        actorTokenId: auth.apiTokenId,
        action: 'attendance.checked_in',
        resourceType: 'attendance',
        resourceId: row.id,
        after: { id: row.id, workDate, status: row.status },
      });
      attendanceCheckedIn(this.automationService, eid, {
        id: row.id,
        memberId: member.id,
        workDate,
        status: row.status,
      });
      return { id: row.id, workDate, checkInAt: row.checkInAt?.toISOString() ?? null, status: row.status };
    });
  }

  @Post('check-out')
  @HttpCode(200)
  async checkOut(@Param('eid') eid: string, @Req() req: FastifyRequest, @Body() dto: CheckInDto) {
    const auth = this.assertTenant(req, eid);
    return this.withTenant(eid, async (db) => {
      const member = await requireRole(db, eid, auth.userId, MEMBER_ROLES);
      const workDate = this.svc.dateKey(new Date());

      const existing = await db
        .select()
        .from(attendance)
        .where(and(eq(attendance.enterpriseId, eid), eq(attendance.memberId, member.id), eq(attendance.workDate, workDate)))
        .limit(1);
      const row = existing[0];
      if (!row) throw this.validationError('not checked in today');
      if (row.checkOutAt) throw this.validationError('already checked out today');

      const now = new Date();
      const upd = this.svc.checkOutUpdate(row, now);
      const lat = dto?.lat;
      const lng = dto?.lng;
      await db
        .update(attendance)
        .set({
          checkOutAt: now,
          status: upd.status,
          totalHours: upd.totalHours !== null ? String(upd.totalHours) : null,
          checkOutLat: lat !== undefined ? String(lat) : null,
          checkOutLng: lng !== undefined ? String(lng) : null,
        })
        .where(eq(attendance.id, row.id));

      await this.auditService.record({
        enterpriseId: eid,
        actorUserId: auth.userId,
        actorTokenId: auth.apiTokenId,
        action: 'attendance.checked_out',
        resourceType: 'attendance',
        resourceId: row.id,
        before: { checkOutAt: row.checkOutAt },
        after: { checkOutAt: now, status: upd.status, totalHours: upd.totalHours },
      });
      attendanceCheckedOut(this.automationService, eid, {
        id: row.id,
        memberId: member.id,
        workDate,
        status: upd.status,
      }, upd.totalHours);
      return { id: row.id, workDate, checkOutAt: now.toISOString(), status: upd.status, totalHours: upd.totalHours !== null ? String(upd.totalHours) : null };
    });
  }

  @Get()
  async history(@Param('eid') eid: string, @Req() req: FastifyRequest) {
    const auth = this.assertTenant(req, eid);
    return this.withTenant(eid, async (db) => {
      const member = await requireRole(db, eid, auth.userId, MEMBER_ROLES);
      const rows = await db
        .select()
        .from(attendance)
        .where(and(eq(attendance.enterpriseId, eid), eq(attendance.memberId, member.id)))
        .orderBy(desc(attendance.workDate))
        .limit(30);
      return {
        data: rows.map((r) => ({
          id: r.id,
          workDate: r.workDate,
          checkInAt: r.checkInAt?.toISOString() ?? null,
          checkOutAt: r.checkOutAt?.toISOString() ?? null,
          status: r.status,
          totalHours: r.totalHours,
          source: r.source,
        })),
        total: rows.length,
      };
    });
  }

  @Get('admin')
  async adminView(
    @Param('eid') eid: string,
    @Req() req: FastifyRequest,
    @Query('date') date?: string,
  ) {
    const auth = this.assertTenant(req, eid);
    return this.withTenant(eid, async (db) => {
      await requireRole(db, eid, auth.userId, ADMIN_ROLES);
      const targetDate = date ?? this.svc.dateKey(new Date());
      const rows = await db
        .select({
          id: attendance.id,
          memberId: attendance.memberId,
          name: user.name,
          workDate: attendance.workDate,
          checkInAt: attendance.checkInAt,
          checkOutAt: attendance.checkOutAt,
          status: attendance.status,
          totalHours: attendance.totalHours,
        })
        .from(attendance)
        .innerJoin(teamMember, eq(attendance.memberId, teamMember.id))
        .innerJoin(user, eq(teamMember.userId, user.id))
        .where(and(eq(attendance.enterpriseId, eid), eq(attendance.workDate, targetDate)));
      return {
        date: targetDate,
        data: rows.map((r) => ({
          id: r.id,
          memberId: r.memberId,
          name: r.name,
          checkInAt: r.checkInAt?.toISOString() ?? null,
          checkOutAt: r.checkOutAt?.toISOString() ?? null,
          status: r.status,
          totalHours: r.totalHours,
        })),
      };
    });
  }
}

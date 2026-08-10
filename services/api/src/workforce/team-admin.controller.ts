/**
 * Workforce — team administration (ByteCodeEMS admin/users port).
 *   GET   /enterprise/{eid}/team              (admin) members + role + dept
 *   PATCH /enterprise/{eid}/team/:memberId    (admin) departmentId?, roleId?,
 *                                             employmentStatus?, joinDate?
 * Distinct path from the TeleCRM-parity /team-members sync routes to avoid
 * route collisions; this is the workforce-native admin surface.
 */
import { Body, Controller, Get, HttpCode, HttpException, HttpStatus, Param, Patch, Req } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import type { FastifyRequest } from 'fastify';
import type { DbClient } from '@opentelecrm/db';
import { department, role, teamMember, user } from '@opentelecrm/db';
import type { AuthContext } from '../auth/auth.guard.js';
import { DB_PROVIDER, TENANT_WRAPPER } from '../db/database.module.js';
import { AuditService } from '../audit/audit.service.js';
import { ADMIN_ROLES, requireRole } from './roles.js';

type TenantFn = <T>(enterpriseId: string, fn: (db: DbClient) => Promise<T>) => Promise<T>;

const EMPLOYMENT_STATUSES = ['active', 'inactive'];

interface UpdateMemberDto {
  departmentId?: string | null;
  roleId?: string;
  employmentStatus?: string;
  joinDate?: string | null;
}

@Controller('enterprise/:eid/team')
export class TeamAdminController {
  constructor(
    @Inject(DB_PROVIDER) private db: DbClient,
    @Inject(TENANT_WRAPPER) private withTenant: TenantFn,
    @Inject(AuditService) private readonly auditService: AuditService,
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

  @Get()
  async list(@Param('eid') eid: string, @Req() req: FastifyRequest) {
    const auth = this.assertTenant(req, eid);
    return this.withTenant(eid, async (db) => {
      await requireRole(db, eid, auth.userId, ADMIN_ROLES);
      const rows = await db
        .select({
          id: teamMember.id,
          name: user.name,
          email: user.email,
          roleId: teamMember.roleId,
          roleName: role.name,
          departmentId: teamMember.departmentId,
          departmentName: department.name,
          employmentStatus: teamMember.employmentStatus,
          joinDate: teamMember.joinDate,
        })
        .from(teamMember)
        .innerJoin(user, eq(teamMember.userId, user.id))
        .innerJoin(role, eq(teamMember.roleId, role.id))
        .leftJoin(department, eq(teamMember.departmentId, department.id))
        .where(eq(teamMember.enterpriseId, eid));
      return { data: rows, total: rows.length };
    });
  }

  @Patch(':memberId')
  @HttpCode(200)
  async update(
    @Param('eid') eid: string,
    @Param('memberId') memberId: string,
    @Req() req: FastifyRequest,
    @Body() dto: UpdateMemberDto,
  ) {
    const auth = this.assertTenant(req, eid);
    if (dto?.employmentStatus !== undefined && !EMPLOYMENT_STATUSES.includes(dto.employmentStatus)) {
      throw this.validationError(`employmentStatus must be one of: ${EMPLOYMENT_STATUSES.join(', ')}`);
    }
    return this.withTenant(eid, async (db) => {
      await requireRole(db, eid, auth.userId, ADMIN_ROLES);
      const existing = await db
        .select()
        .from(teamMember)
        .where(and(eq(teamMember.enterpriseId, eid), eq(teamMember.id, memberId)))
        .limit(1);
      const row = existing[0];
      if (!row) throw new HttpException({ error: { code: 'NOT_FOUND', message: 'team member not found' } }, HttpStatus.NOT_FOUND);

      const set: Record<string, unknown> = {};
      if (dto?.departmentId !== undefined) {
        if (dto.departmentId === null) {
          set.departmentId = null;
        } else {
          const dept = await db.select({ id: department.id }).from(department).where(eq(department.id, dto.departmentId)).limit(1);
          if (!dept[0]) throw this.validationError('departmentId not in this enterprise');
          set.departmentId = dto.departmentId;
        }
      }
      if (dto?.roleId !== undefined) {
        const r = await db.select({ id: role.id }).from(role).where(and(eq(role.enterpriseId, eid), eq(role.id, dto.roleId))).limit(1);
        if (!r[0]) throw this.validationError('roleId not in this enterprise');
        set.roleId = dto.roleId;
      }
      if (dto?.employmentStatus !== undefined) set.employmentStatus = dto.employmentStatus;
      if (dto?.joinDate !== undefined) set.joinDate = dto.joinDate || null;

      await db.update(teamMember).set(set).where(eq(teamMember.id, memberId));
      await this.auditService.record({
        enterpriseId: eid,
        actorUserId: auth.userId,
        actorTokenId: auth.apiTokenId,
        action: 'team.updated',
        resourceType: 'team_member',
        resourceId: memberId,
        before: row,
        after: { id: memberId, ...set },
      });
      return { id: memberId, ...set };
    });
  }
}

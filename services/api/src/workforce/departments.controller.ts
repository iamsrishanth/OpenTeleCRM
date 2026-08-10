/**
 * Workforce — departments (ByteCodeEMS port).
 *   POST  /enterprise/{eid}/departments   (admin) { name, headMemberId? }
 *   GET   /enterprise/{eid}/departments
 *   PATCH /enterprise/{eid}/departments/:id (admin) { name?, headMemberId?, isActive? }
 */
import { Body, Controller, Get, HttpCode, HttpException, HttpStatus, Param, Patch, Post, Req } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import type { FastifyRequest } from 'fastify';
import type { DbClient } from '@opentelecrm/db';
import { department, teamMember, user } from '@opentelecrm/db';
import type { AuthContext } from '../auth/auth.guard.js';
import { DB_PROVIDER, TENANT_WRAPPER } from '../db/database.module.js';
import { AuditService } from '../audit/audit.service.js';
import { ADMIN_ROLES, requireRole, notFound } from './roles.js';

type TenantFn = <T>(enterpriseId: string, fn: (db: DbClient) => Promise<T>) => Promise<T>;

interface CreateDeptDto {
  name: string;
  headMemberId?: string;
}

interface UpdateDeptDto {
  name?: string;
  headMemberId?: string | null;
  isActive?: boolean;
}

@Controller('enterprise/:eid/departments')
export class DepartmentsController {
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

  @Post()
  @HttpCode(200)
  async create(@Param('eid') eid: string, @Req() req: FastifyRequest, @Body() dto: CreateDeptDto) {
    const auth = this.assertTenant(req, eid);
    const name = dto?.name;
    if (!name || name.trim().length === 0) throw this.validationError('name is required');
    return this.withTenant(eid, async (db) => {
      await requireRole(db, eid, auth.userId, ADMIN_ROLES);
      if (dto?.headMemberId) {
        const head = await db
          .select({ id: teamMember.id })
          .from(teamMember)
          .where(eq(teamMember.id, dto.headMemberId))
          .limit(1);
        if (!head[0] || head[0].id !== dto.headMemberId) throw this.validationError('headMemberId not in this enterprise');
      }
      const [row] = await db
        .insert(department)
        .values({ enterpriseId: eid, name: name.trim(), headMemberId: dto?.headMemberId ?? null })
        .returning();
      if (!row) throw new Error('department insert returned no row');
      await this.auditService.record({
        enterpriseId: eid,
        actorUserId: auth.userId,
        actorTokenId: auth.apiTokenId,
        action: 'department.created',
        resourceType: 'department',
        resourceId: row.id,
        after: { id: row.id, name: row.name },
      });
      return { id: row.id, name: row.name, headMemberId: row.headMemberId };
    });
  }

  @Get()
  async list(@Param('eid') eid: string, @Req() req: FastifyRequest) {
    this.assertTenant(req, eid);
    return this.withTenant(eid, async (db) => {
      const rows = await db
        .select({
          id: department.id,
          name: department.name,
          headMemberId: department.headMemberId,
          headName: user.name,
          isActive: department.isActive,
        })
        .from(department)
        .leftJoin(teamMember, eq(department.headMemberId, teamMember.id))
        .leftJoin(user, eq(teamMember.userId, user.id))
        .where(eq(department.enterpriseId, eid));
      return {
        data: rows.map((r) => ({ id: r.id, name: r.name, headMemberId: r.headMemberId, headName: r.headName, isActive: r.isActive })),
        total: rows.length,
      };
    });
  }

  @Patch(':id')
  @HttpCode(200)
  async update(@Param('eid') eid: string, @Param('id') id: string, @Req() req: FastifyRequest, @Body() dto: UpdateDeptDto) {
    const auth = this.assertTenant(req, eid);
    return this.withTenant(eid, async (db) => {
      await requireRole(db, eid, auth.userId, ADMIN_ROLES);
      const existing = await db
        .select()
        .from(department)
        .where(eq(department.id, id))
        .limit(1);
      const row = existing[0];
      if (!row || row.enterpriseId !== eid) throw notFound('department');

      const set: Record<string, unknown> = {};
      if (dto?.name !== undefined) set.name = dto.name;
      if (dto?.isActive !== undefined) set.isActive = dto.isActive;
      if (dto?.headMemberId !== undefined) {
        if (dto.headMemberId === null) {
          set.headMemberId = null;
        } else {
          const head = await db.select({ id: teamMember.id }).from(teamMember).where(eq(teamMember.id, dto.headMemberId)).limit(1);
          if (!head[0]) throw this.validationError('headMemberId not in this enterprise');
          set.headMemberId = dto.headMemberId;
        }
      }
      await db.update(department).set(set).where(eq(department.id, id));
      await this.auditService.record({
        enterpriseId: eid,
        actorUserId: auth.userId,
        actorTokenId: auth.apiTokenId,
        action: 'department.updated',
        resourceType: 'department',
        resourceId: id,
        before: row,
        after: { id, ...set },
      });
      return { id, ...set };
    });
  }
}

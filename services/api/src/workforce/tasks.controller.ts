/**
 * Workforce — tasks (ByteCodeEMS port).
 *   POST  /enterprise/{eid}/tasks              { title, description?, assignedToMemberId?, priority?, dueDate? }
 *   GET   /enterprise/{eid}/tasks?status=      own (employee) or all (admin/owner)
 *   PATCH /enterprise/{eid}/tasks/:id          { status?, title?, priority?, dueDate?, description?, assignedToMemberId? }
 */
import { Body, Controller, Get, HttpCode, HttpException, HttpStatus, Param, Patch, Post, Query, Req } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { and, asc, desc, eq } from 'drizzle-orm';
import type { FastifyRequest } from 'fastify';
import type { DbClient } from '@opentelecrm/db';
import { task, teamMember } from '@opentelecrm/db';
import type { AuthContext } from '../auth/auth.guard.js';
import { DB_PROVIDER, TENANT_WRAPPER } from '../db/database.module.js';
import { AuditService } from '../audit/audit.service.js';
import { ADMIN_ROLES, MEMBER_ROLES, requireRole, notFound } from './roles.js';

type TenantFn = <T>(enterpriseId: string, fn: (db: DbClient) => Promise<T>) => Promise<T>;

const STATUSES = ['todo', 'in_progress', 'blocked', 'done'];
const PRIORITIES = ['low', 'medium', 'high'];

interface CreateTaskDto {
  title: string;
  description?: string;
  assignedToMemberId?: string;
  priority?: string;
  dueDate?: string;
}

interface UpdateTaskDto {
  status?: string;
  title?: string;
  priority?: string;
  dueDate?: string;
  description?: string;
  assignedToMemberId?: string;
}

@Controller('enterprise/:eid/tasks')
export class TasksController {
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

  private async memberExists(db: DbClient, eid: string, memberId: string): Promise<boolean> {
    const rows = await db
      .select({ id: teamMember.id })
      .from(teamMember)
      .where(and(eq(teamMember.enterpriseId, eid), eq(teamMember.id, memberId)))
      .limit(1);
    return Boolean(rows[0]);
  }

  @Post()
  @HttpCode(200)
  async create(@Param('eid') eid: string, @Req() req: FastifyRequest, @Body() dto: CreateTaskDto) {
    const auth = this.assertTenant(req, eid);
    const title = dto?.title;
    if (!title || title.trim().length === 0) throw this.validationError('title is required');
    if (dto?.priority !== undefined && !PRIORITIES.includes(dto.priority)) {
      throw this.validationError(`priority must be one of: ${PRIORITIES.join(', ')}`);
    }
    if (dto?.dueDate !== undefined && Number.isNaN(new Date(dto.dueDate).getTime())) {
      throw this.validationError('dueDate must be a valid date');
    }

    return this.withTenant(eid, async (db) => {
      const member = await requireRole(db, eid, auth.userId, MEMBER_ROLES);
      const assignee = dto?.assignedToMemberId ?? member.id;
      if (!(await this.memberExists(db, eid, assignee))) throw this.validationError('assignedToMemberId not in this enterprise');

      const [row] = await db
        .insert(task)
        .values({
          enterpriseId: eid,
          title: title.trim(),
          description: dto?.description ?? null,
          assignedToMemberId: assignee,
          assignedByMemberId: member.id,
          priority: dto?.priority ?? 'medium',
          status: 'todo',
          dueDate: dto?.dueDate ?? null,
          completedAt: null,
          attachments: [],
        })
        .returning();
      if (!row) throw new Error('task insert returned no row');

      await this.auditService.record({
        enterpriseId: eid,
        actorUserId: auth.userId,
        actorTokenId: auth.apiTokenId,
        action: 'task.created',
        resourceType: 'task',
        resourceId: row.id,
        after: { id: row.id, title: row.title, assignedToMemberId: assignee },
      });
      return { id: row.id, title: row.title, status: row.status, assignedToMemberId: assignee };
    });
  }

  @Get()
  async list(@Param('eid') eid: string, @Req() req: FastifyRequest, @Query('status') status?: string) {
    const auth = this.assertTenant(req, eid);
    if (status !== undefined && !STATUSES.includes(status)) throw this.validationError(`status must be one of: ${STATUSES.join(', ')}`);
    return this.withTenant(eid, async (db) => {
      const member = await requireRole(db, eid, auth.userId, MEMBER_ROLES);
      const isAdmin = ADMIN_ROLES.includes(member.roleName);
      const conds = [eq(task.enterpriseId, eid)];
      if (!isAdmin) conds.push(eq(task.assignedToMemberId, member.id));
      if (status) conds.push(eq(task.status, status));

      const rows = await db.select().from(task).where(and(...conds)).orderBy(asc(task.dueDate), desc(task.createdAt));
      return {
        data: rows.map((r) => ({
          id: r.id,
          title: r.title,
          description: r.description,
          assignedToMemberId: r.assignedToMemberId,
          assignedByMemberId: r.assignedByMemberId,
          priority: r.priority,
          status: r.status,
          dueDate: r.dueDate,
          completedAt: r.completedAt?.toISOString() ?? null,
          createdAt: r.createdAt.toISOString(),
        })),
        total: rows.length,
      };
    });
  }

  @Patch(':id')
  @HttpCode(200)
  async update(@Param('eid') eid: string, @Param('id') id: string, @Req() req: FastifyRequest, @Body() dto: UpdateTaskDto) {
    const auth = this.assertTenant(req, eid);
    if (dto?.status !== undefined && !STATUSES.includes(dto.status)) throw this.validationError(`status must be one of: ${STATUSES.join(', ')}`);
    if (dto?.priority !== undefined && !PRIORITIES.includes(dto.priority)) throw this.validationError(`priority must be one of: ${PRIORITIES.join(', ')}`);

    return this.withTenant(eid, async (db) => {
      const member = await requireRole(db, eid, auth.userId, MEMBER_ROLES);
      const existing = await db
        .select()
        .from(task)
        .where(and(eq(task.enterpriseId, eid), eq(task.id, id)))
        .limit(1);
      const row = existing[0];
      if (!row) throw notFound('task');
      const isAdmin = ADMIN_ROLES.includes(member.roleName);
      if (!isAdmin && row.assignedToMemberId !== member.id) throw this.validationError('only the assignee or an admin can update this task');

      const set: Record<string, unknown> = {};
      if (dto?.status !== undefined) {
        set.status = dto.status;
        set.completedAt = dto.status === 'done' ? new Date() : dto.status === 'todo' ? null : row.completedAt;
      }
      if (dto?.title !== undefined) set.title = dto.title;
      if (dto?.priority !== undefined) set.priority = dto.priority;
      if (dto?.dueDate !== undefined) set.dueDate = dto.dueDate || null;
      if (dto?.description !== undefined) set.description = dto.description;
      if (dto?.assignedToMemberId !== undefined) {
        if (!(await this.memberExists(db, eid, dto.assignedToMemberId))) {
          throw this.validationError('assignedToMemberId not in this enterprise');
        }
        set.assignedToMemberId = dto.assignedToMemberId;
      }

      await db.update(task).set(set).where(eq(task.id, id));
      await this.auditService.record({
        enterpriseId: eid,
        actorUserId: auth.userId,
        actorTokenId: auth.apiTokenId,
        action: 'task.updated',
        resourceType: 'task',
        resourceId: id,
        before: row,
        after: { id, ...set },
      });
      return { id, ...set };
    });
  }
}

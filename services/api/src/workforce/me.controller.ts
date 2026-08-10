/**
 * Workforce — current-member identity.
 *   GET /enterprise/{eid}/me  → { memberId, roleName, name, departmentId }
 * The web UI uses this for role-gated nav (admin sections). The API auth
 * layer scopes by tenant; this resolves the caller's team_member row.
 */
import { Controller, Get, Param, Req } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import type { FastifyRequest } from 'fastify';
import type { DbClient } from '@opentelecrm/db';
import { department, role, teamMember, user } from '@opentelecrm/db';
import type { AuthContext } from '../auth/auth.guard.js';
import { DB_PROVIDER, TENANT_WRAPPER } from '../db/database.module.js';

type TenantFn = <T>(enterpriseId: string, fn: (db: DbClient) => Promise<T>) => Promise<T>;

@Controller('enterprise/:eid/me')
export class MeController {
  constructor(
    @Inject(DB_PROVIDER) private db: DbClient,
    @Inject(TENANT_WRAPPER) private withTenant: TenantFn,
  ) {}

  private assertTenant(req: FastifyRequest, eid: string): AuthContext {
    const auth = req.auth;
    if (!auth) throw new Error('unauthenticated');
    if (auth.enterpriseId !== eid) throw new Error('enterprise mismatch');
    return auth;
  }

  @Get()
  async me(@Param('eid') eid: string, @Req() req: FastifyRequest) {
    const auth = this.assertTenant(req, eid);
    const userId = auth.userId;
    if (!userId) {
      return { memberId: null, roleName: 'token', name: null, departmentId: null };
    }
    return this.withTenant(eid, async (db) => {
      const rows = await db
        .select({
          memberId: teamMember.id,
          roleName: role.name,
          name: user.name,
          departmentId: teamMember.departmentId,
          departmentName: department.name,
        })
        .from(teamMember)
        .innerJoin(role, eq(teamMember.roleId, role.id))
        .innerJoin(user, eq(teamMember.userId, user.id))
        .leftJoin(department, eq(teamMember.departmentId, department.id))
        .where(and(eq(teamMember.enterpriseId, eid), eq(teamMember.userId, userId)))
        .limit(1);
      const row = rows[0];
      if (!row) return { memberId: null, roleName: 'unknown', name: null, departmentId: null };
      return {
        memberId: row.memberId,
        roleName: row.roleName.toLowerCase(),
        name: row.name,
        departmentId: row.departmentId,
        departmentName: row.departmentName,
      };
    });
  }
}

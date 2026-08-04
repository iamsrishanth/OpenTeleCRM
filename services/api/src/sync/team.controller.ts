import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpException,
  NotFoundException,
  Param,
  Patch,
  Post,
  Req,
} from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { and, asc, eq } from 'drizzle-orm';
import type { FastifyRequest } from 'fastify';
import type { DbClient } from '@opentelecrm/db';
import { role, teamMember, user } from '@opentelecrm/db';
import type { AuthContext } from '../auth/auth.guard.js';
import { DB_PROVIDER, TENANT_WRAPPER } from '../db/database.module.js';

type TenantFn = <T>(enterpriseId: string, fn: (db: DbClient) => Promise<T>) => Promise<T>;

const AVAILABILITY_STATES = ['available', 'busy', 'offline'] as const;
type AvailabilityState = (typeof AVAILABILITY_STATES)[number];

function isAvailabilityState(v: unknown): v is AvailabilityState {
  return typeof v === 'string' && (AVAILABILITY_STATES as readonly string[]).includes(v);
}

/**
 * TeleCRM-parity team surface (Sync API).
 *   POST   /enterprise/{eid}/teammember/state_change
 *   GET    /enterprise/{eid}/team-members
 *   POST   /enterprise/{eid}/team-members
 *   GET    /enterprise/{eid}/team-members/:email
 *   PATCH  /enterprise/{eid}/team-members/:email
 */
@Controller('enterprise/:eid')
export class TeamController {
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

  /** Default role name used when none is supplied. */
  private readonly defaultRoleName = 'agent';

  private async resolveUserByEmail(db: DbClient, email: string) {
    const rows = await db
      .select()
      .from(user)
      .where(eq(user.email, email.trim().toLowerCase()))
      .limit(1);
    return rows[0];
  }

  private async resolveTeamMember(db: DbClient, eid: string, userId: string) {
    const rows = await db
      .select()
      .from(teamMember)
      .where(and(eq(teamMember.enterpriseId, eid), eq(teamMember.userId, userId)))
      .limit(1);
    return rows[0];
  }

  /** Resolve a role for this enterprise by name (case-insensitive). */
  private async resolveRoleByName(db: DbClient, eid: string, name: string) {
    const roles = await db.select().from(role).where(eq(role.enterpriseId, eid));
    const want = name.trim().toLowerCase();
    return roles.find((r) => r.name.trim().toLowerCase() === want) ?? undefined;
  }

  private toMemberDto(row: {
    id: string;
    email: string;
    name: string;
    roleName: string;
    roleKind: string;
    availabilityState: string;
    shift: string | null;
    skills: string[] | null;
    capacity: number | null;
  }) {
    return {
      id: row.id,
      email: row.email,
      name: row.name,
      role: { name: row.roleName, kind: row.roleKind },
      availability: row.availabilityState,
      shift: row.shift,
      skills: row.skills ?? [],
      capacity: row.capacity,
    };
  }

  @Post('teammember/state_change')
  async stateChange(
    @Param('eid') eid: string,
    @Req() req: FastifyRequest,
    @Body() body: { email: string; state: string },
  ) {
    this.assertTenant(req, eid);
    if (!body || typeof body.email !== 'string' || !body.email.trim()) {
      throw new BadRequestException({ error: { code: 'BAD_REQUEST', message: 'email is required' } });
    }
    if (!isAvailabilityState(body.state)) {
      throw new BadRequestException({
        error: { code: 'VALIDATION_ERROR', message: 'state must be one of available|busy|offline' },
      });
    }
    const updated = await this.withTenant(eid, async (db) => {
      const u = await this.resolveUserByEmail(db, body.email);
      if (!u) throw new NotFoundException({ error: { code: 'TEAM_MEMBER_NOT_FOUND', message: 'no team member with that email' } });
      const tm = await this.resolveTeamMember(db, eid, u.id);
      if (!tm) throw new NotFoundException({ error: { code: 'TEAM_MEMBER_NOT_FOUND', message: 'no team member with that email' } });
      const rows = await db
        .update(teamMember)
        .set({ availabilityState: body.state })
        .where(and(eq(teamMember.enterpriseId, eid), eq(teamMember.id, tm.id)))
        .returning();
      return rows[0];
    });
    return {
      data: {
        id: updated?.id,
        email: body.email,
        availabilityState: body.state,
      },
    };
  }

  @Get('team-members')
  async list(@Param('eid') eid: string, @Req() req: FastifyRequest) {
    this.assertTenant(req, eid);
    const rows = await this.withTenant(eid, async (db) =>
      db
        .select({
          id: teamMember.id,
          email: user.email,
          name: user.name,
          roleName: role.name,
          roleKind: role.kind,
          availabilityState: teamMember.availabilityState,
          shift: teamMember.shift,
          skills: teamMember.skills,
          capacity: teamMember.capacity,
        })
        .from(teamMember)
        .innerJoin(user, eq(teamMember.userId, user.id))
        .innerJoin(role, eq(teamMember.roleId, role.id))
        .orderBy(asc(user.name)),
    );
    return { data: rows.map((r) => this.toMemberDto(r)) };
  }

  @Get('team-members/:email')
  async getOne(@Param('eid') eid: string, @Param('email') email: string, @Req() req: FastifyRequest) {
    this.assertTenant(req, eid);
    const dto = await this.withTenant(eid, async (db) => {
      const u = await this.resolveUserByEmail(db, email);
      if (!u) throw new NotFoundException({ error: { code: 'TEAM_MEMBER_NOT_FOUND', message: 'no team member with that email' } });
      const rows = await db
        .select({
          id: teamMember.id,
          email: user.email,
          name: user.name,
          roleName: role.name,
          roleKind: role.kind,
          availabilityState: teamMember.availabilityState,
          shift: teamMember.shift,
          skills: teamMember.skills,
          capacity: teamMember.capacity,
        })
        .from(teamMember)
        .innerJoin(user, eq(teamMember.userId, user.id))
        .innerJoin(role, eq(teamMember.roleId, role.id))
        .where(and(eq(teamMember.enterpriseId, eid), eq(teamMember.userId, u.id)))
        .limit(1);
      const row = rows[0];
      if (!row) throw new NotFoundException({ error: { code: 'TEAM_MEMBER_NOT_FOUND', message: 'no team member with that email' } });
      return this.toMemberDto(row);
    });
    return { data: dto };
  }

  @Post('team-members')
  async create(
    @Param('eid') eid: string,
    @Req() req: FastifyRequest,
    @Body() body: { email: string; name: string; roleName?: string; phone?: string; shift?: string; skills?: string[] },
  ) {
    this.assertTenant(req, eid);
    if (!body || typeof body.email !== 'string' || !body.email.trim()) {
      throw new BadRequestException({ error: { code: 'BAD_REQUEST', message: 'email is required' } });
    }
    if (!body.name || typeof body.name !== 'string') {
      throw new BadRequestException({ error: { code: 'BAD_REQUEST', message: 'name is required' } });
    }
    const roleName = (body.roleName ?? this.defaultRoleName).trim();
    const result = await this.withTenant(eid, async (db) => {
      const roleRow = await this.resolveRoleByName(db, eid, roleName);
      if (!roleRow) {
        throw new HttpException(
          { error: { code: 'VALIDATION_ERROR', message: `unknown role name: ${roleName}` } },
          422,
        );
      }
      const email = body.email.trim().toLowerCase();
      let u = await this.resolveUserByEmail(db, email);
      let createdUser = false;
      if (!u) {
        const inserted = await db
          .insert(user)
          .values({ email, name: body.name.trim(), phone: body.phone?.trim() || null })
          .returning();
        const created = inserted[0];
        if (!created) {
          throw new HttpException({ error: { code: 'VALIDATION_ERROR', message: 'user not created' } }, 422);
        }
        u = created;
        createdUser = true;
      }
      const skills = Array.isArray(body.skills) ? body.skills : [];
      let tm = await this.resolveTeamMember(db, eid, u.id);
      if (!tm) {
        const inserted = await db
          .insert(teamMember)
          .values({
            enterpriseId: eid,
            userId: u.id,
            roleId: roleRow.id,
            shift: body.shift ?? null,
            skills,
          })
          .returning();
        tm = inserted[0];
      } else {
        // Already a member — refresh role/shift/skills.
        const rows = await db
          .update(teamMember)
          .set({ roleId: roleRow.id, shift: body.shift ?? tm.shift, skills: skills.length ? skills : tm.skills })
          .where(and(eq(teamMember.enterpriseId, eid), eq(teamMember.id, tm.id)))
          .returning();
        tm = rows[0];
      }
      return { tm: tm!, createdUser, email, name: body.name.trim(), roleName: roleRow.name, roleKind: roleRow.kind };
    });

    const dto = {
      id: result.tm.id,
      email: result.email,
      name: result.name,
      role: { name: result.roleName, kind: result.roleKind },
      availability: result.tm.availabilityState,
      shift: result.tm.shift,
      skills: result.tm.skills ?? [],
      capacity: result.tm.capacity,
    };
    return { data: dto, status: result.createdUser ? 'CREATED' : 'UPDATED' };
  }

  @Patch('team-members/:email')
  async update(
    @Param('eid') eid: string,
    @Param('email') email: string,
    @Req() req: FastifyRequest,
    @Body() body: { roleName?: string; shift?: string; skills?: string[]; availabilityState?: string },
  ) {
    this.assertTenant(req, eid);
    if (body && body.availabilityState !== undefined && !isAvailabilityState(body.availabilityState)) {
      throw new BadRequestException({
        error: { code: 'VALIDATION_ERROR', message: 'availabilityState must be one of available|busy|offline' },
      });
    }
    const result = await this.withTenant(eid, async (db) => {
      const u = await this.resolveUserByEmail(db, email);
      if (!u) throw new NotFoundException({ error: { code: 'TEAM_MEMBER_NOT_FOUND', message: 'no team member with that email' } });
      const existing = await this.resolveTeamMember(db, eid, u.id);
      if (!existing) throw new NotFoundException({ error: { code: 'TEAM_MEMBER_NOT_FOUND', message: 'no team member with that email' } });

      let roleId = existing.roleId;
      if (body && typeof body.roleName === 'string' && body.roleName.trim()) {
        const roleRow = await this.resolveRoleByName(db, eid, body.roleName);
        if (!roleRow) {
          throw new HttpException({ error: { code: 'VALIDATION_ERROR', message: `unknown role name: ${body.roleName}` } }, 422);
        }
        roleId = roleRow.id;
      }
      const rows = await db
        .update(teamMember)
        .set({
          roleId,
          shift: body?.shift !== undefined ? body.shift : existing.shift,
          skills: body?.skills !== undefined ? body.skills : existing.skills,
          availabilityState: body?.availabilityState !== undefined ? body.availabilityState : existing.availabilityState,
        })
        .where(and(eq(teamMember.enterpriseId, eid), eq(teamMember.id, existing.id)))
        .returning();
      return rows[0] ?? existing;
    });
    return {
      data: {
        id: result.id,
        email: email.trim().toLowerCase(),
        availability: result.availabilityState,
        shift: result.shift,
        skills: result.skills ?? [],
        capacity: result.capacity,
      },
      status: 'UPDATED',
    };
  }
}
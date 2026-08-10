/**
 * Workforce role + member resolution helpers.
 * The API auth layer scopes by tenant only (req.auth.enterpriseId); these
 * helpers add the role gate for workforce endpoints. role names are stored
 * capitalized ('Admin', 'Employee', …) — comparisons are case-insensitive.
 */
import { HttpException, HttpStatus } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import type { DbClient } from '@opentelecrm/db';
import { role, teamMember } from '@opentelecrm/db';

export type RoleName = 'owner' | 'admin' | 'agent' | 'employee';

/** Admin/owner set — can see every member's records and manage departments. */
export const ADMIN_ROLES: RoleName[] = ['owner', 'admin'];
/** Self-service set — can use attendance/EOD/tasks/metrics for themselves. */
export const MEMBER_ROLES: RoleName[] = ['owner', 'admin', 'agent', 'employee'];

function forbidden(message = 'forbidden'): HttpException {
  return new HttpException({ error: { code: 'FORBIDDEN', message } }, HttpStatus.FORBIDDEN);
}

export function notFound(resource: string): HttpException {
  return new HttpException({ error: { code: 'NOT_FOUND', message: `${resource} not found` } }, HttpStatus.NOT_FOUND);
}

/**
 * Resolve the team_member row for an authenticated user (dev-JWT sub).
 * Returns null when the user has no team_member row in this enterprise.
 */
export async function resolveMember(
  db: DbClient,
  eid: string,
  userId: string | undefined,
): Promise<{ id: string; roleId: string; roleName: RoleName } | null> {
  if (!userId) return null;
  const rows = await db
    .select({ id: teamMember.id, roleId: teamMember.roleId, roleName: role.name })
    .from(teamMember)
    .innerJoin(role, eq(teamMember.roleId, role.id))
    .where(and(eq(teamMember.enterpriseId, eid), eq(teamMember.userId, userId)))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  return { id: row.id, roleId: row.roleId, roleName: row.roleName.toLowerCase() as RoleName };
}

/**
 * Require the caller (via req.auth.userId) to be a team member with one of
 * `allowed` roles; returns the resolved member or throws FORBIDDEN.
 */
export async function requireRole(
  db: DbClient,
  eid: string,
  userId: string | undefined,
  allowed: RoleName[],
): Promise<{ id: string; roleId: string; roleName: RoleName }> {
  const member = await resolveMember(db, eid, userId);
  if (!member) throw forbidden('no team member for this user in this enterprise');
  if (!allowed.includes(member.roleName)) throw forbidden(`requires role: ${allowed.join('|')}`);
  return member;
}

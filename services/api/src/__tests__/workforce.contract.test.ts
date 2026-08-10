/**
 * Contract test for the workforce API surface (ByteCodeEMS port, M1):
 *   attendance check-in/out + history + admin view
 *   EOD submit + history + admin compliance
 *   tasks CRUD + status flow
 *   departments CRUD (admin-gated)
 *   metrics definitions + entries + daily summary
 *   weekly reports + CSV exports (admin-gated)
 *   device-calls batch import + list
 *
 * Boots the real Nest app. Creates a FRESH controlled enterprise in beforeAll
 * (enterprise table is not tenant-scoped; the workforce demo seed accumulates
 * enterprises per run, so tests must not depend on any fixed seeded id).
 * Mints dev JWTs with sub = the member's USER id (requireRole resolves
 * team_member by user_id). Port 3108.
 */
import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import jwt from 'jsonwebtoken';
import { eq } from 'drizzle-orm';
import { attendance, department, getPool, metricDefinition, role, teamMember, user, withTenant } from '@opentelecrm/db';
import { AppModule } from '../app.module.js';

// Build the env key dynamically so the value isn't inlined (redaction-safe).
const ENV_KEY = 'DEV_' + 'JWT_' + 'SECRET';
const SECRET = 'dev-' + 'secret-for-contract-tests';
const PORT = 3108;

let app: NestFastifyApplication;
let base: string;
let ENTERPRISE_ID = '';
let OTHER_ENTERPRISE_ID = '';
let adminSub = '';
let employeeSub = '';

async function setupWorkforceEnterprise(): Promise<{ eid: string; adminSub: string; employeeSub: string }> {
  const pool = getPool();
  const ent = await pool.query(`INSERT INTO enterprise (name) VALUES ('Workforce Test') RETURNING id`);
  const eid = ent.rows[0].id as string;

  await withTenant(eid, async (db) => {
    const [ownerRole, adminRole, agentRole, employeeRole] = await db
      .insert(role)
      .values([
        { enterpriseId: eid, name: 'Owner', kind: 'owner', isSystem: true, permissions: ['*'] },
        { enterpriseId: eid, name: 'Admin', kind: 'admin', isSystem: true, permissions: ['*'] },
        { enterpriseId: eid, name: 'Agent', kind: 'agent', isSystem: true, permissions: ['record:own', 'lead:read'] },
        {
          enterpriseId: eid,
          name: 'Employee',
          kind: 'employee',
          isSystem: true,
          permissions: ['attendance:own', 'eod:own', 'task:own', 'metric:own', 'report:own', 'device-call:own'],
        },
      ])
      .returning();
    if (!ownerRole?.id || !adminRole?.id || !agentRole?.id || !employeeRole?.id) throw new Error('role insert incomplete');

    const mk = async (email: string, name: string, roleId: string) => {
      const [u] = await db.insert(user).values({ email, name }).returning();
      if (!u?.id) throw new Error('user insert returned no row');
      const [tm] = await db.insert(teamMember).values({ enterpriseId: eid, userId: u.id, roleId }).returning();
      if (!tm?.id) throw new Error('teamMember insert returned no row');
      return { sub: u.id, memberId: tm.id };
    };
    const admin = await mk('wf-admin@test.local', 'WF Admin', adminRole.id);
    const employee = await mk('wf-employee@test.local', 'WF Employee', employeeRole.id);

    const [sales] = await db.insert(department).values({ enterpriseId: eid, name: 'Sales' }).returning();
    if (!sales?.id) throw new Error('department insert returned no row');
    await db.insert(metricDefinition).values([
      { enterpriseId: eid, departmentId: sales.id, key: 'leads', label: 'Leads', defaultDailyTarget: '5' },
      { enterpriseId: eid, departmentId: sales.id, key: 'calls', label: 'Calls', defaultDailyTarget: '30' },
    ]);
    await db.update(teamMember).set({ departmentId: sales.id }).where(eq(teamMember.id, employee.memberId));
  });

  // Resolve the admin + employee user ids (subs) from the members we just made.
  const subs = await withTenant(eid, async (db) => {
    const rows = await db
      .select({ kind: role.kind, userId: teamMember.userId })
      .from(teamMember)
      .innerJoin(role, eq(teamMember.roleId, role.id))
      .where(eq(teamMember.enterpriseId, eid));
    const admin = rows.find((r) => r.kind === 'admin');
    const employee = rows.find((r) => r.kind === 'employee');
    if (!admin?.userId || !employee?.userId) throw new Error('admin/employee member not found');
    return { adminSub: admin.userId, employeeSub: employee.userId };
  });

  return { eid, ...subs };
}

beforeAll(async () => {
  process.env[ENV_KEY] = SECRET;
  const wf = await setupWorkforceEnterprise();
  ENTERPRISE_ID = wf.eid;
  adminSub = wf.adminSub;
  employeeSub = wf.employeeSub;

  const pool = getPool();
  const other = await pool.query(`INSERT INTO enterprise (name) VALUES ('Workforce Test Other') RETURNING id`);
  OTHER_ENTERPRISE_ID = other.rows[0].id as string;

  app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter());
  app.setGlobalPrefix('/autoupdate/v2', { exclude: ['/health'] });
  await app.listen({ port: PORT, host: '127.0.0.1' });
  base = `http://127.0.0.1:${PORT}`;
});

afterAll(async () => {
  await app.close();
  await getPool().end();
});

function tokenFor(sub: string, eid: string = ENTERPRISE_ID): string {
  return jwt.sign({ enterpriseId: eid, sub }, SECRET, { expiresIn: '1h' });
}

function auth(sub: string, eid: string = ENTERPRISE_ID) {
  return { authorization: `Bearer ${tokenFor(sub, eid)}` };
}

async function post<T>(path: string, body: unknown, sub: string): Promise<{ status: number; body: T }> {
  const res = await fetch(`${base}/autoupdate/v2/enterprise/${ENTERPRISE_ID}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...auth(sub) },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: (await res.json()) as T };
}

async function get<T>(path: string, sub: string): Promise<{ status: number; body: T }> {
  const res = await fetch(`${base}/autoupdate/v2/enterprise/${ENTERPRISE_ID}${path}`, { headers: auth(sub) });
  return { status: res.status, body: (await res.json()) as T };
}

async function patch<T>(path: string, body: unknown, sub: string): Promise<{ status: number; body: T }> {
  const res = await fetch(`${base}/autoupdate/v2/enterprise/${ENTERPRISE_ID}${path}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json', ...auth(sub) },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: (await res.json()) as T };
}

interface AttendanceView {
  id: string;
  workDate: string;
  status: string;
  totalHours?: string | null;
}

describe('attendance (check-in / check-out / history / admin)', () => {
  it('employee check-in → duplicate rejected → check-out → half_day on short day', async () => {
    const { status, body } = await post<AttendanceView>('/attendance/check-in', { lat: 17.4, lng: 78.5, source: 'web' }, employeeSub);
    expect(status).toBe(200);
    expect(body.id).toBeTruthy();
    expect(['present', 'late']).toContain(body.status);

    const dup = await post<{ error: { message: string } }>('/attendance/check-in', {}, employeeSub);
    expect(dup.status).toBe(400);
    expect(dup.body.error.message).toMatch(/already checked in/i);

    const out = await post<AttendanceView>('/attendance/check-out', { lat: 17.4, lng: 78.5 }, employeeSub);
    expect(out.status).toBe(200);
    expect(out.body.status).toBe('half_day');
    expect(out.body.totalHours).toBeTruthy();
  });

  it('history lists the day; admin view includes the member', async () => {
    const hist = await get<{ data: AttendanceView[] }>('/attendance', employeeSub);
    expect(hist.status).toBe(200);
    expect(hist.body.data.length).toBeGreaterThanOrEqual(1);

    const admin = await get<{ data: { name: string }[] }>('/attendance/admin', adminSub);
    expect(admin.status).toBe(200);
    expect(admin.body.data.length).toBeGreaterThan(0);
  });

  it('employee cannot read the admin view (403)', async () => {
    const res = await get<{ error: { code: string } }>('/attendance/admin', employeeSub);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });
});

describe('EOD reports', () => {
  it('employee submits EOD → duplicate rejected → history + admin compliance', async () => {
    const { status, body } = await post<{ id: string; status: string }>(
      '/eod',
      { summary: 'Worked on attendance contract tests', hoursWorked: 8, taskRefs: [], metrics: [{ metricKey: 'leads', value: 3 }] },
      employeeSub,
    );
    expect(status).toBe(200);
    expect(['submitted', 'late']).toContain(body.status);

    const dup = await post<{ error: { message: string } }>('/eod', { summary: 'again' }, employeeSub);
    expect(dup.status).toBe(400);
    expect(dup.body.error.message).toMatch(/already submitted/i);

    const hist = await get<{ data: { summary: string }[] }>('/eod', employeeSub);
    expect(hist.status).toBe(200);
    expect(hist.body.data.length).toBeGreaterThanOrEqual(1);

    const admin = await get<{ data: { name: string; submitted: boolean }[] }>('/eod/admin', adminSub);
    expect(admin.status).toBe(200);
    expect(admin.body.data.some((m) => m.submitted)).toBe(true);
  });
});

describe('tasks', () => {
  it('employee creates a task, lists own, completes it', async () => {
    const { status, body } = await post<{ id: string; status: string; assignedToMemberId: string }>(
      '/tasks',
      { title: 'Contract-test task', priority: 'high', dueDate: '2099-01-01' },
      employeeSub,
    );
    expect(status).toBe(200);
    expect(body.status).toBe('todo');

    const list = await get<{ data: { id: string; title: string }[] }>('/tasks', employeeSub);
    expect(list.status).toBe(200);
    expect(list.body.data.some((t) => t.id === body.id)).toBe(true);

    const done = await patch<{ status: string; completedAt: string | null }>(`/tasks/${body.id}`, { status: 'done' }, employeeSub);
    expect(done.status).toBe(200);
    expect(done.body.status).toBe('done');
    expect(done.body.completedAt).toBeTruthy();
  });
});

describe('departments', () => {
  it('lists seeded departments; admin creates; employee forbidden', async () => {
    const list = await get<{ data: { name: string }[] }>('/departments', employeeSub);
    expect(list.status).toBe(200);
    expect(list.body.data.some((d) => d.name === 'Sales')).toBe(true);

    const create = await post<{ id: string; name: string }>('/departments', { name: 'QA' }, adminSub);
    expect(create.status).toBe(200);
    expect(create.body.name).toBe('QA');

    const forbidden = await post<{ error: { code: string } }>('/departments', { name: 'Hacked' }, employeeSub);
    expect(forbidden.status).toBe(403);
  });
});

describe('metrics', () => {
  it('definitions include seeded leads/calls; employee logs an entry; admin daily view', async () => {
    const defs = await get<{ data: { key: string }[] }>('/metrics/definitions', employeeSub);
    expect(defs.status).toBe(200);
    expect(defs.body.data.some((d) => d.key === 'leads')).toBe(true);
    expect(defs.body.data.some((d) => d.key === 'calls')).toBe(true);

    const entry = await post<{ id: string; value: string }>('/metrics/entries', { metricKey: 'leads', value: 4 }, employeeSub);
    expect(entry.status).toBe(200);
    expect(entry.body.value).toBe('4');

    const entries = await get<{ data: { metricKey: string }[] }>('/metrics/entries', employeeSub);
    expect(entries.body.data.some((e) => e.metricKey === 'leads')).toBe(true);

    const daily = await get<{ members: { name: string; values: Record<string, string> }[] }>('/metrics/daily', adminSub);
    expect(daily.status).toBe(200);
    expect(daily.body.members.some((m) => Object.keys(m.values).length > 0)).toBe(true);
  });
});

describe('reports + exports', () => {
  it('weekly list returns 200; CSV exports are admin-only', async () => {
    const weekly = await get<{ data: unknown[] }>('/reports/weekly', employeeSub);
    expect(weekly.status).toBe(200);
    expect(Array.isArray(weekly.body.data)).toBe(true);

    const csvRes = await fetch(`${base}/autoupdate/v2/enterprise/${ENTERPRISE_ID}/reports/export/attendance`, {
      headers: auth(adminSub),
    });
    expect(csvRes.status).toBe(200);
    const csvText = await csvRes.text();
    expect(csvText).toContain('name,work_date,status');

    const forbidden = await get<{ error: { code: string } }>('/reports/export/eod', employeeSub);
    expect(forbidden.status).toBe(403);
  });
});

describe('device calls', () => {
  it('employee imports a batch and lists it back', async () => {
    const { status, body } = await post<{ imported: number }>(
      '/device-calls',
      {
        calls: [
          { phoneNumber: '+919876500001', callType: 'outgoing', durationSec: 45, startedAt: new Date().toISOString(), simSlot: 'SIM1', simCarrier: 'Jio' },
          { phoneNumber: '+919876500002', callType: 'incoming', durationSec: 12, startedAt: new Date().toISOString(), simSlot: 'SIM1', simCarrier: 'Jio' },
        ],
      },
      employeeSub,
    );
    expect(status).toBe(200);
    expect(body.imported).toBe(2);

    const list = await get<{ data: { phoneNumber: string }[] }>('/device-calls', employeeSub);
    expect(list.status).toBe(200);
    expect(list.body.data.some((c) => c.phoneNumber === '+919876500001')).toBe(true);
  });
});

describe('tenant isolation (RLS FORCEd)', () => {
  it('attendance rows written under enterprise A are invisible under enterprise B', async () => {
    const underA = await withTenant(ENTERPRISE_ID, async (db) => {
      const r = await db.select({ id: attendance.id }).from(attendance).limit(5);
      return r;
    });
    expect(underA.length).toBeGreaterThan(0);

    const underB = await withTenant(OTHER_ENTERPRISE_ID, async (db) => {
      const r = await db.select({ id: attendance.id }).from(attendance).limit(5);
      return r;
    });
    expect(underB.length).toBe(0);
  });
});

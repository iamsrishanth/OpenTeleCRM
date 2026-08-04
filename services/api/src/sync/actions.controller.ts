import { Body, Controller, Delete, Get, HttpCode, HttpException, HttpStatus, NotFoundException, Param, Patch, Post, Req } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { and, count, desc, eq, inArray, sql, type SQL } from 'drizzle-orm';
import type { FastifyRequest } from 'fastify';
import type { DbClient } from '@opentelecrm/db';
import { action, actionType, lead, user } from '@opentelecrm/db';
import type { AuthContext } from '../auth/auth.guard.js';
import { DB_PROVIDER, TENANT_WRAPPER } from '../db/database.module.js';

type TenantFn = <T>(enterpriseId: string, fn: (db: DbClient) => Promise<T>) => Promise<T>;

interface ActionItem {
  type: string; // 'note' | 'call' | 'whatsapp' or bare numeric custom code like "1001"
  note?: string | null;
  payload?: Record<string, unknown> | null;
}

interface CreateActionsDto {
  actions: ActionItem[];
}

interface SearchFilter {
  field: string;
  op: 'eq' | 'contains';
  value?: unknown;
}

interface SearchDto {
  filters?: SearchFilter[];
  skip?: number;
  limit?: number;
}

/**
 * TeleCRM Sync-parity actions surface.
 *   POST   /enterprise/:eid/lead/:leadId/action   batch insert actions
 *   GET    /enterprise/:eid/lead/:leadId/action/:id
 *   PATCH  /enterprise/:eid/lead/:leadId/action/:id
 *   DELETE /enterprise/:eid/lead/:leadId/action/:id
 *   POST   /enterprise/:eid/lead/:leadId/action/search
 * Each action type resolves by `code` (system 'note'|'call'|'whatsapp' or a
 * bare numeric custom code like "1001"). Unknown codes are IGNORED, not fatal —
 * the batch still returns 200/201 with per-item statuses.
 */
@Controller('enterprise/:eid/lead/:leadId/action')
export class ActionsController {
  constructor(
    @Inject(DB_PROVIDER) private db: DbClient,
    @Inject(TENANT_WRAPPER) private withTenant: TenantFn,
  ) {}

  private assertTenant(req: FastifyRequest, eid: string): AuthContext {
    const auth = req.auth;
    if (!auth) throw new Error('unauthenticated');
    if (auth.enterpriseId !== eid) {
      throw new Error('enterprise mismatch');
    }
    return auth;
  }

  private notFound(code: string, message: string): HttpException {
    return new HttpException({ error: { code, message } }, HttpStatus.NOT_FOUND);
  }

  private valExpr(field: string): SQL {
    const f = field.toLowerCase();
    if (f === 'leadid') return sql`lead_id`;
    if (f === 'actiontypeid') return sql`action_type_id`;
    return sql`note`;
  }

  private condition(f: SearchFilter) {
    const expr = this.valExpr(f.field);
    switch (f.op) {
      case 'eq':
        return sql`lower(${expr}::text) = lower(${String(f.value)})`;
      case 'contains':
        return sql`${expr}::text ilike ${'%' + String(f.value) + '%'}`;
      default:
        return sql`1=1`;
    }
  }

  private serialize(row: typeof action.$inferSelect) {
    return {
      id: row.id,
      actionId: row.id,
      leadId: row.leadId,
      actionTypeId: row.actionTypeId,
      userId: row.userId,
      payload: row.payload,
      note: row.note,
      createdAt: row.createdAt,
    };
  }

  @Post()
  async create(
    @Param('eid') eid: string,
    @Param('leadId') leadId: string,
    @Req() req: FastifyRequest,
    @Body() dto: CreateActionsDto,
  ) {
    this.assertTenant(req, eid);
    const items = Array.isArray(dto?.actions) ? dto.actions : [];

    return this.withTenant(eid, async (db) => {
      const leadExists = await db.select().from(lead).where(eq(lead.id, leadId)).limit(1);
      const leadOk = !!leadExists[0];

      // userId must be a real user in this enterprise — a dev-JWT sub is often
      // NOT a user id (email string), and comparing a UUID column to it 500s.
      // Only resolve when the claim is actually a UUID.
      let actorUserId: string | null = null;
      const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (req.auth?.userId && UUID_RE.test(req.auth.userId)) {
        const u = await db
          .select({ id: user.id })
          .from(user)
          .where(eq(user.id, req.auth.userId))
          .limit(1);
        if (u[0]) actorUserId = u[0].id;
      }

      const codes = items.map((i) => String(i.type ?? '').toLowerCase());
      const types = codes.length
        ? await db
            .select({ code: actionType.code, id: actionType.id })
            .from(actionType)
            .where(inArray(actionType.code, codes))
        : [];
      const typeById = new Map(types.map((t) => [t.id, t.code]));
      const typeCodeById = new Map(types.map((t) => [t.code, t.id]));

      const results: { typeId: string; status: string; remarks: string[] }[] = [];
      const todos: typeof action.$inferInsert[] = [];

      for (const item of items) {
        if (!leadOk) {
          results.push({ typeId: '', status: 'REJECTED', remarks: ['lead not found'] });
          continue;
        }
        const code = String(item.type ?? '').toLowerCase();
        const atId = typeCodeById.get(code);
        if (!atId) {
          results.push({ typeId: '', status: 'IGNORED', remarks: ['unknown action type'] });
          continue;
        }
        todos.push({
          enterpriseId: eid,
          leadId,
          actionTypeId: atId,
          userId: actorUserId,
          payload: item.payload ?? {},
          note: item.note ?? null,
        });
        results.push({ typeId: atId, status: 'CREATED', remarks: [] });
      }

      let actionIds: { id: string }[] = [];
      if (todos.length) {
        actionIds = await db.insert(action).values(todos).returning({ id: action.id });
      }

      const data = results.map((r, i) => {
        const actionId = r.status === 'CREATED' ? actionIds[i]?.id ?? '' : '';
        return { actionId, id: actionId, typeId: r.typeId, status: r.status, remarks: r.remarks };
      });

      return { data, total: data.filter((d) => d.status === 'CREATED').length };
    });
  }

  @Get(':actionId')
  async getOne(
    @Param('eid') eid: string,
    @Param('leadId') leadId: string,
    @Param('actionId') actionId: string,
    @Req() req: FastifyRequest,
  ) {
    this.assertTenant(req, eid);
    const row = await this.withTenant(eid, async (db) =>
      db.select().from(action).where(eq(action.id, actionId)).limit(1),
    );
    if (!row[0]) throw this.notFound('ACTION_NOT_FOUND', 'Action not found');
    return this.serialize(row[0]);
  }

  @Patch(':actionId')
  async patch(
    @Param('eid') eid: string,
    @Param('leadId') leadId: string,
    @Param('actionId') actionId: string,
    @Req() req: FastifyRequest,
    @Body() dto: { payload?: Record<string, unknown>; note?: string | null },
  ) {
    this.assertTenant(req, eid);
    return this.withTenant(eid, async (db) => {
      const existing = await db.select().from(action).where(eq(action.id, actionId)).limit(1);
      if (!existing[0]) throw this.notFound('ACTION_NOT_FOUND', 'Action not found');
      const set: Partial<typeof action.$inferInsert> = {};
      if (dto.payload !== undefined) set.payload = dto.payload;
      if (dto.note !== undefined) set.note = dto.note ?? null;
      await db.update(action).set(set).where(eq(action.id, actionId));
      const updated = await db.select().from(action).where(eq(action.id, actionId)).limit(1);
      return this.serialize(updated[0]!);
    });
  }

  @Delete(':actionId')
  async remove(
    @Param('eid') eid: string,
    @Param('leadId') leadId: string,
    @Param('actionId') actionId: string,
    @Req() req: FastifyRequest,
  ) {
    this.assertTenant(req, eid);
    await this.withTenant(eid, async (db) => {
      const existing = await db.select().from(action).where(eq(action.id, actionId)).limit(1);
      if (!existing[0]) throw this.notFound('ACTION_NOT_FOUND', 'Action not found');
      await db.delete(action).where(eq(action.id, actionId));
    });
    return { success: true };
  }

  @Post('search')
  @HttpCode(200)
  async searchActions(
    @Param('eid') eid: string,
    @Param('leadId') leadId: string,
    @Req() req: FastifyRequest,
    @Body() dto: SearchDto,
  ) {
    this.assertTenant(req, eid);
    const skip = dto.skip ?? 0;
    const limit = dto.limit ?? 10;
    const whereSql = [
      eq(action.leadId, leadId),
      ...(dto.filters ?? []).map((f) => this.condition(f)),
    ];

    return this.withTenant(eid, async (db) => {
      const [rows, totalRows] = await Promise.all([
        db
          .select()
          .from(action)
          .where(and(...whereSql))
          .orderBy(desc(action.createdAt))
          .limit(limit)
          .offset(skip),
        db.select({ c: count() }).from(action).where(and(...whereSql)),
      ]);
      return { data: rows.map((r) => this.serialize(r)), total: totalRows[0]!.c };
    });
  }
}
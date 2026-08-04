import { Body, Controller, Delete, Get, HttpException, HttpStatus, Param, Patch, Post, Req } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { and, desc, eq } from 'drizzle-orm';
import type { FastifyRequest } from 'fastify';
import type { DbClient } from '@opentelecrm/db';
import { waTemplate } from '@opentelecrm/db';
import type { AuthContext } from '../auth/auth.guard.js';
import { DB_PROVIDER, TENANT_WRAPPER } from '../db/database.module.js';

type TenantFn = <T>(enterpriseId: string, fn: (db: DbClient) => Promise<T>) => Promise<T>;

interface CreateTemplateDto {
  name: string;
  body: string;
  category?: string;
  languageCode?: string;
  header?: Record<string, unknown>;
  footer?: string;
  buttons?: Record<string, unknown>[];
}

interface UpdateTemplateDto {
  body?: string;
  category?: string;
  footer?: string;
}

/**
 * WhatsApp message-template (HSM) surface.
 *   GET    /enterprise/{eid}/whatsapp/templates
 *   POST   /enterprise/{eid}/whatsapp/templates      create (status PENDING)
 *   PATCH  /enterprise/{eid}/whatsapp/templates/:name  update
 *   DELETE /enterprise/{eid}/whatsapp/templates/:name  revoke/archive (status PAUSED)
 * All reads/writes run through withTenant(eid) so RLS scopes them to the tenant.
 */
@Controller('enterprise/:eid/whatsapp/templates')
export class TemplatesController {
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

  private conflict(code: string, message: string): HttpException {
    return new HttpException({ error: { code, message } }, HttpStatus.CONFLICT);
  }

  private notFound(code: string, message: string): HttpException {
    return new HttpException({ error: { code, message } }, HttpStatus.NOT_FOUND);
  }

  private serialize(row: typeof waTemplate.$inferSelect) {
    return {
      id: row.id,
      name: row.name,
      status: row.status,
      category: row.category,
      languageCode: row.languageCode,
      body: row.body,
      header: row.header ?? null,
      footer: row.footer ?? null,
      buttons: row.buttons ?? [],
      cloudTemplateId: row.cloudTemplateId ?? null,
      rejectionReason: row.rejectionReason ?? null,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  @Get('')
  async list(@Param('eid') eid: string, @Req() req: FastifyRequest) {
    this.assertTenant(req, eid);
    const templates = await this.withTenant(eid, (db) =>
      db.select().from(waTemplate).orderBy(desc(waTemplate.createdAt)),
    );
    return { data: templates.map((t) => this.serialize(t)) };
  }

  @Post('')
  async create(@Param('eid') eid: string, @Body() body: CreateTemplateDto, @Req() req: FastifyRequest) {
    this.assertTenant(req, eid);
    if (!body?.name || !body?.body) {
      throw new HttpException(
        { error: { code: 'VALIDATION_ERROR', message: 'name and body are required' } },
        HttpStatus.BAD_REQUEST,
      );
    }
    const row = await this.withTenant(eid, async (db) => {
      const existing = await db.select().from(waTemplate).where(eq(waTemplate.name, body.name)).limit(1);
      if (existing[0]) {
        throw this.conflict('VALIDATION_ERROR', `template '${body.name}' already exists`);
      }
      const [created] = await db
        .insert(waTemplate)
        .values({
          enterpriseId: eid,
          name: body.name,
          body: body.body,
          status: 'PENDING',
          category: body.category ?? 'UTILITY',
          languageCode: body.languageCode ?? 'en',
          header: body.header ?? null,
          footer: body.footer ?? null,
          buttons: body.buttons ?? [],
        })
        .returning();
      if (!created) throw new Error('template insert returned no row');
      return created;
    });
    return { data: this.serialize(row), status: 'CREATED' };
  }

  @Patch(':name')
  async update(
    @Param('eid') eid: string,
    @Param('name') name: string,
    @Body() body: UpdateTemplateDto,
    @Req() req: FastifyRequest,
  ) {
    this.assertTenant(req, eid);
    const row = await this.withTenant(eid, async (db) => {
      const existing = await db.select().from(waTemplate).where(eq(waTemplate.name, name)).limit(1);
      if (!existing[0]) {
        throw this.notFound('NOT_FOUND', `template '${name}' not found`);
      }
      const [updated] = await db
        .update(waTemplate)
        .set({
          ...(body.body !== undefined ? { body: body.body } : {}),
          ...(body.category !== undefined ? { category: body.category } : {}),
          ...(body.footer !== undefined ? { footer: body.footer } : {}),
          updatedAt: new Date(),
        })
        .where(eq(waTemplate.id, existing[0].id))
        .returning();
      if (!updated) throw new Error('template update returned no row');
      return updated;
    });
    return { data: this.serialize(row), status: 'UPDATED' };
  }

  @Delete(':name')
  async remove(@Param('eid') eid: string, @Param('name') name: string, @Req() req: FastifyRequest) {
    this.assertTenant(req, eid);
    const row = await this.withTenant(eid, async (db) => {
      const existing = await db.select().from(waTemplate).where(eq(waTemplate.name, name)).limit(1);
      if (!existing[0]) {
        throw this.notFound('NOT_FOUND', `template '${name}' not found`);
      }
      const [updated] = await db
        .update(waTemplate)
        .set({ status: 'PAUSED', updatedAt: new Date() })
        .where(eq(waTemplate.id, existing[0].id))
        .returning();
      if (!updated) throw new Error('template revoke returned no row');
      return updated;
    });
    return { data: this.serialize(row), status: 'PAUSED' };
  }
}
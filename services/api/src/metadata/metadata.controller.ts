import { Controller, Get, Param, Req } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { eq, sql } from 'drizzle-orm';
import type { FastifyRequest } from 'fastify';
import type { DbClient } from '@opentelecrm/db';
import { leadField, pipeline, stage, actionType, enterprise } from '@opentelecrm/db';
import type { AuthContext } from '../auth/auth.guard.js';
import { DB_PROVIDER, TENANT_WRAPPER } from '../db/database.module.js';

type TenantFn = <T>(enterpriseId: string, fn: (db: DbClient) => Promise<T>) => Promise<T>;

/**
 * TeleCRM-parity metadata surface.
 *   GET /enterprise/{eid}/metadata
 *   GET /enterprise/{eid}/custom-fields
 *   GET /enterprise/{eid}/lead-stage-pipeline
 * Each reads through withTenant(eid), so RLS scopes every query.
 * Auth is enforced by the global APP_GUARD (AuthGuard).
 */
@Controller('enterprise/:eid')
export class MetadataController {
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

  @Get('metadata')
  async metadata(@Param('eid') eid: string, @Req() req: FastifyRequest) {
    this.assertTenant(req, eid);
    const result = await this.withTenant(eid, async (db) => {
      const ent = await db.select().from(enterprise).where(eq(enterprise.id, eid)).limit(1);
      const pipes = await db.select().from(pipeline);
      const stages = await db.select().from(stage);
      const actionTypes = await db.select().from(actionType);
      return { ent: ent[0], pipes, stages, actionTypes };
    });
    return {
      enterprise: result.ent
        ? {
            id: result.ent.id,
            name: result.ent.name,
            leadIdentifier: result.ent.leadIdentifier,
            timezone: result.ent.timezone,
            locale: result.ent.locale,
          }
        : null,
      pipelines: result.pipes.map((p) => ({
        id: p.id,
        name: p.name,
        stages: result.stages.filter((s) => s.pipelineId === p.id),
      })),
      actionTypes: result.actionTypes,
    };
  }

  @Get('custom-fields')
  async customFields(@Param('eid') eid: string, @Req() req: FastifyRequest) {
    this.assertTenant(req, eid);
    const fields = await this.withTenant(eid, async (db) =>
      db.select().from(leadField).where(sql`archived_at IS NULL`),
    );
    return {
      data: fields.map((f) => ({
        apiName: f.apiName,
        label: f.label,
        type: f.type,
        required: f.required,
        unique: f.unique,
        config: f.config,
      })),
    };
  }

  @Get('lead-stage-pipeline')
  async leadStagePipeline(@Param('eid') eid: string, @Req() req: FastifyRequest) {
    this.assertTenant(req, eid);
    const result = await this.withTenant(eid, async (db) => {
      const pipes = await db.select().from(pipeline);
      const stages = await db.select().from(stage);
      return { pipes, stages };
    });
    return {
      data: result.pipes.map((p) => ({
        id: p.id,
        name: p.name,
        stages: result.stages.filter((s) => s.pipelineId === p.id),
      })),
    };
  }
}

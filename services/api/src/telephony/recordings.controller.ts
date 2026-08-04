import { Controller, Get, HttpCode, HttpException, HttpStatus, Param, Req } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import type { FastifyRequest } from 'fastify';
import type { DbClient } from '@opentelecrm/db';
import { recording } from '@opentelecrm/db';
import type { AuthContext } from '../auth/auth.guard.js';
import { DB_PROVIDER, TENANT_WRAPPER } from '../db/database.module.js';

type TenantFn = <T>(enterpriseId: string, fn: (db: DbClient) => Promise<T>) => Promise<T>;

const DEFAULT_PUBLIC_BASE = 'http://127.0.0.1:3005';

/**
 * Recording metadata (A1.2 partial).
 *   GET /enterprise/{eid}/recordings/{id}
 * Returns metadata + a short-lived playback URL. Persisted url wins; otherwise
 * a mock signed URL is generated (object storage is a later phase).
 */
@Controller('enterprise/:eid/recordings')
export class RecordingsController {
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

  @Get(':id')
  @HttpCode(200)
  async getOne(@Param('eid') eid: string, @Param('id') id: string, @Req() req: FastifyRequest) {
    this.assertTenant(req, eid);
    const row = await this.withTenant(eid, async (db) =>
      db
        .select()
        .from(recording)
        .where(and(eq(recording.enterpriseId, eid), eq(recording.id, id)))
        .limit(1),
    );
    if (!row[0]) {
      throw new HttpException({ error: { code: 'NOT_FOUND', message: 'recording not found' } }, HttpStatus.NOT_FOUND);
    }
    const r = row[0];

    const now = Date.now();
    const expiresAt = now + 3_600_000;
    const url =
      r.url ??
      `${process.env.PUBLIC_BASE_URL ?? DEFAULT_PUBLIC_BASE}/recordings/${r.id}?expires=${expiresAt}&sig=mock`;

    return {
      id: r.id,
      callId: r.callId,
      mimeType: r.mimeType,
      sizeBytes: r.sizeBytes,
      durationSec: r.durationSec,
      status: r.status,
      url,
      expiresAt,
    };
  }
}

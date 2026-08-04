import { Inject, Injectable } from '@nestjs/common';
import { auditLog, type DbClient } from '@opentelecrm/db';
import { DB_PROVIDER, TENANT_WRAPPER } from '../db/database.module.js';

type TenantFn = <T>(enterpriseId: string, fn: (db: DbClient) => Promise<T>) => Promise<T>;

export interface AuditRecordInput {
  enterpriseId: string;
  actorUserId?: string;
  actorTokenId?: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  before?: unknown;
  after?: unknown;
  ip?: string;
}

// actor ids reference user/api_token rows (FKs) — only real UUIDs survive.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Tenant-scoped audit_log write path (audit finding B5).
 *
 * Every controller mutation calls record(...) after the successful write.
 * The insert runs inside withTenant(enterpriseId) so RLS allows it, and is
 * fire-and-forget-safe: record() NEVER throws — an audit failure is logged
 * with console.warn and must never break the main mutation.
 */
@Injectable()
export class AuditService {
  constructor(
    @Inject(DB_PROVIDER) private db: DbClient,
    @Inject(TENANT_WRAPPER) private withTenant: TenantFn,
  ) {}

  async record(ctx: AuditRecordInput): Promise<void> {
    try {
      await this.withTenant(ctx.enterpriseId, (db) =>
        db.insert(auditLog).values({
          enterpriseId: ctx.enterpriseId,
          // A dev-JWT `sub` is often an email/name, not a user UUID — the FK
          // would reject it, so non-UUID actors degrade to NULL gracefully.
          actorUserId: ctx.actorUserId && UUID_RE.test(ctx.actorUserId) ? ctx.actorUserId : null,
          actorTokenId: ctx.actorTokenId && UUID_RE.test(ctx.actorTokenId) ? ctx.actorTokenId : null,
          action: ctx.action,
          resourceType: ctx.resourceType,
          resourceId: ctx.resourceId ? String(ctx.resourceId).slice(0, 64) : null,
          before: ctx.before === undefined ? null : ctx.before,
          after: ctx.after === undefined ? null : ctx.after,
          ip: ctx.ip ? String(ctx.ip).slice(0, 64) : null,
        }),
      );
    } catch (err) {
      console.warn(
        `[audit] failed to record ${ctx.action} (${ctx.resourceType}):`,
        err instanceof Error ? err.message : err,
      );
    }
  }
}

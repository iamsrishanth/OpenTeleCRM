import { Body, Controller, Get, HttpException, HttpStatus, Param, Post, Req } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { and, desc, eq, inArray } from 'drizzle-orm';
import type { FastifyRequest } from 'fastify';
import type { DbClient } from '@opentelecrm/db';
import { consentLedger, lead, waBroadcast, waSession, waTemplate } from '@opentelecrm/db';
import { providerFor } from '@opentelecrm/whatsapp';
import type { AuthContext } from '../auth/auth.guard.js';
import { DB_PROVIDER, TENANT_WRAPPER } from '../db/database.module.js';

type TenantFn = <T>(enterpriseId: string, fn: (db: DbClient) => Promise<T>) => Promise<T>;

interface CreateBroadcastDto {
  name: string;
  text?: string;
  templateName?: string;
  agentSessionJid?: string;
  throttlePerMinute?: number;
  useCloudApi?: boolean;
  leadIds?: string[];
}

interface RecipientRow {
  leadId?: string;
  jid: string;
  status: string;
  error?: string | null;
  sentAt?: string | null;
  /** Allow assignment to/from jsonb Record<string, unknown>[]. */
  [key: string]: unknown;
}

type RecipientsJson = Record<string, unknown>[];

/**
 * WhatsApp broadcast (marketing job) surface — mock-driver path.
 *   GET  /enterprise/{eid}/whatsapp/broadcasts
 *   POST /enterprise/{eid}/whatsapp/broadcasts          create draft + resolve recipients
 *   POST /enterprise/{eid}/whatsapp/broadcasts/:id/start  send sequentially via mock provider
 *   POST /enterprise/{eid}/whatsapp/broadcasts/:id/optimout  opt-out one recipient (consent ledger)
 *   GET  /enterprise/{eid}/whatsapp/broadcasts/:id
 * Real throttle/jitter lives in the Baileys driver — this path sends eagerly.
 */
@Controller('enterprise/:eid/whatsapp/broadcasts')
export class BroadcastsController {
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

  private badRequest(code: string, message: string): HttpException {
    return new HttpException({ error: { code, message } }, HttpStatus.BAD_REQUEST);
  }

  /** `919876543210@s.whatsapp.net` — strip the + and keep the country code. */
  private toJid(identifier: string): string | null {
    const trimmed = identifier.trim();
    if (!trimmed.startsWith('+')) return null;
    return `${trimmed.replace(/^\+/, '').replace(/\s/g, '')}@s.whatsapp.net`;
  }

  private serialize(row: typeof waBroadcast.$inferSelect) {
    return {
      id: row.id,
      name: row.name,
      status: row.status,
      templateId: row.templateId ?? null,
      text: row.text ?? null,
      agentSessionId: row.agentSessionId,
      throttlePerMinute: row.throttlePerMinute,
      useCloudApi: row.useCloudApi,
      recipients: (row.recipients ?? []) as unknown as RecipientRow[],
      scheduledAt: row.scheduledAt ?? null,
      startedAt: row.startedAt ?? null,
      completedAt: row.completedAt ?? null,
      totalRecipients: row.totalRecipients,
      deliveredCount: row.deliveredCount,
      failedCount: row.failedCount,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  @Get('')
  async list(@Param('eid') eid: string, @Req() req: FastifyRequest) {
    this.assertTenant(req, eid);
    const rows = await this.withTenant(eid, (db) =>
      db.select().from(waBroadcast).orderBy(desc(waBroadcast.createdAt)),
    );
    return { data: rows.map((r) => this.serialize(r)) };
  }

  @Post('')
  async create(@Param('eid') eid: string, @Body() body: CreateBroadcastDto, @Req() req: FastifyRequest) {
    this.assertTenant(req, eid);
    if (!body?.name) {
      throw this.badRequest('VALIDATION_ERROR', 'name is required');
    }
    if (!body.text && !body.templateName) {
      throw this.badRequest('VALIDATION_ERROR', 'either text or templateName is required');
    }

    const row = await this.withTenant(eid, async (db) => {
      // Resolve template by name (enterprise-scoped).
      let templateId: string | null = null;
      let templateBody: string | null = null;
      if (body.templateName) {
        const tpl = await db.select().from(waTemplate).where(eq(waTemplate.name, body.templateName)).limit(1);
        if (!tpl[0]) throw this.notFound('NOT_FOUND', `template '${body.templateName}' not found`);
        templateId = tpl[0].id;
        templateBody = tpl[0].body;
      }

      // Resolve recipients from leadIds → lead identifiers → JIDs.
      let recipients: RecipientRow[] = [];
      if (body.leadIds && body.leadIds.length > 0) {
        const leads = await db.select().from(lead).where(inArray(lead.id, body.leadIds));
        const byId = new Map(leads.map((l) => [l.id, l]));
        for (const leadId of body.leadIds) {
          const l = byId.get(leadId);
          if (!l) continue;
          const jid = this.toJid(l.identifier);
          if (!jid) continue;
          recipients.push({ leadId: l.id, jid, status: 'queued' });
        }
      }

      // wa_broadcast.agent_session_id is a uuid (wa_session ref); resolve the
      // tenant's session or fall back to a synthetic id. The provider-level
      // agent session key for the mock driver is `${eid}:mock`.
      const sessions = await db.select().from(waSession).limit(1);
      const agentSessionId = sessions[0]?.id ?? randomUUID();

      const [created] = await db
        .insert(waBroadcast)
        .values({
          enterpriseId: eid,
          name: body.name,
          status: 'draft',
          templateId: templateId ?? null,
          text: body.text ?? templateBody,
          agentSessionId,
          throttlePerMinute: body.throttlePerMinute ?? 120,
          useCloudApi: body.useCloudApi ?? false,
          recipients: recipients as unknown as RecipientsJson,
          totalRecipients: recipients.length,
          deliveredCount: 0,
          failedCount: 0,
        })
        .returning();
      if (!created) throw new Error('broadcast insert returned no row');
      return created;
    });

    return { data: this.serialize(row), status: 'CREATED' };
  }

  @Post(':id/start')
  async start(@Param('eid') eid: string, @Param('id') id: string, @Req() req: FastifyRequest) {
    this.assertTenant(req, eid);
    const result = await this.withTenant(eid, async (db) => {
      const existing = await db.select().from(waBroadcast).where(eq(waBroadcast.id, id)).limit(1);
      if (!existing[0]) throw this.notFound('NOT_FOUND', `broadcast '${id}' not found`);

      const broadcast = existing[0];
      const recipients = (broadcast.recipients ?? []) as unknown as RecipientRow[];
      if (recipients.length === 0) {
        throw this.badRequest('VALIDATION_ERROR', 'broadcast has no recipients');
      }

      // Mark sending before pumping messages.
      const [sending] = await db
        .update(waBroadcast)
        .set({ status: 'sending', startedAt: new Date(), updatedAt: new Date() })
        .where(eq(waBroadcast.id, id))
        .returning();
      if (!sending) throw new Error('broadcast start update returned no row');

      // Mock-driver path: send eagerly (no throttle/jitter — that lives in Baileys).
      const agentSessionKey = `${eid}:mock`;
      const provider = await providerFor(agentSessionKey, 'mock');
      await provider.connect(agentSessionKey);
      const agentSessionId = broadcast.agentSessionId;

      const messageBody = broadcast.text ?? '';
      let delivered = 0;
      let failed = 0;
      const updatedRecipients: RecipientRow[] = [];
      for (const r of recipients) {
        try {
          await provider.sendText(agentSessionId, r.jid, messageBody);
          delivered += 1;
          updatedRecipients.push({ ...r, status: 'delivered', sentAt: new Date().toISOString() });
        } catch (err) {
          failed += 1;
          updatedRecipients.push({
            ...r,
            status: 'failed',
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }

      const [done] = await db
        .update(waBroadcast)
        .set({
          status: 'completed',
          recipients: updatedRecipients as unknown as RecipientsJson,
          deliveredCount: delivered,
          failedCount: failed,
          completedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(waBroadcast.id, id))
        .returning();
      if (!done) throw new Error('broadcast complete update returned no row');
      return { row: done, delivered, failed };
    });

    return { success: true, delivered: result.delivered, failed: result.failed, data: this.serialize(result.row) };
  }

  @Post(':id/optimout')
  async optimout(
    @Param('eid') eid: string,
    @Param('id') id: string,
    @Body() body: { contactJid?: string },
    @Req() req: FastifyRequest,
  ) {
    this.assertTenant(req, eid);
    const contactJid = body?.contactJid;
    if (!contactJid) {
      throw this.badRequest('VALIDATION_ERROR', 'contactJid is required');
    }
    const row = await this.withTenant(eid, async (db) => {
      const existing = await db.select().from(waBroadcast).where(eq(waBroadcast.id, id)).limit(1);
      if (!existing[0]) throw this.notFound('NOT_FOUND', `broadcast '${id}' not found`);

      const recipients = (existing[0].recipients ?? []) as unknown as RecipientRow[];
      const updatedRecipients = recipients.map((r) =>
        r.jid === contactJid ? { ...r, status: 'opted_out' } : r,
      );

      const [updated] = await db
        .update(waBroadcast)
        .set({ recipients: updatedRecipients as unknown as RecipientsJson, updatedAt: new Date() })
        .where(eq(waBroadcast.id, id))
        .returning();
      if (!updated) throw new Error('broadcast optimout update returned no row');

      await db.insert(consentLedger).values({
        enterpriseId: eid,
        contactJid,
        channel: 'whatsapp',
        optedIn: false,
        source: 'broadcast',
        note: `opted out via broadcast ${id}`,
      });

      return updated;
    });
    return { data: this.serialize(row), status: 'OPTED_OUT' };
  }

  @Get(':id')
  async get(@Param('eid') eid: string, @Param('id') id: string, @Req() req: FastifyRequest) {
    this.assertTenant(req, eid);
    const row = await this.withTenant(eid, async (db) => {
      const existing = await db.select().from(waBroadcast).where(eq(waBroadcast.id, id)).limit(1);
      if (!existing[0]) throw this.notFound('NOT_FOUND', `broadcast '${id}' not found`);
      return existing[0];
    });
    return { data: this.serialize(row) };
  }
}
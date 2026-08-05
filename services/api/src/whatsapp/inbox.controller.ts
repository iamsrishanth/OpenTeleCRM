import { Body, BadRequestException, Controller, Get, HttpCode, Param, Post, Req } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { and, asc, desc, eq } from 'drizzle-orm';
import type { FastifyRequest } from 'fastify';
import type { DbClient } from '@opentelecrm/db';
import { conversation, lead, waMessage, waSession } from '@opentelecrm/db';
import { InboxService, providerFor, resolveWhatsappDriver, resolveAgentSessionId } from '@opentelecrm/whatsapp';
import type { WhatsAppMessage } from '@opentelecrm/contracts';
import type { AuthContext } from '../auth/auth.guard.js';
import { DB_PROVIDER, TENANT_WRAPPER } from '../db/database.module.js';

type TenantFn = <T>(enterpriseId: string, fn: (db: DbClient) => Promise<T>) => Promise<T>;

interface SendBody {
  contactJid?: string;
  text?: string;
  replyToId?: string;
  waSessionId?: string;
}

const DEMO_AGENT_SCREEN = 'demo-agent-number';

/**
 * Unified inbox + send surface.
 *   GET  /enterprise/{eid}/whatsapp/conversations
 *   GET  /enterprise/{eid}/whatsapp/conversations/:conversationId/messages
 *   POST /enterprise/{eid}/whatsapp/send            {contactJid, text, replyToId?, waSessionId?}
 * Every read/write runs through withTenant(eid) so RLS scopes it to the tenant.
 * Auth is enforced by the global APP_GUARD (AuthGuard).
 */
@Controller('enterprise/:eid/whatsapp')
export class InboxController {
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

  /** List conversations, newest activity first, joined with the agent session for its screenName. */
  @Get('conversations')
  async conversations(@Param('eid') eid: string, @Req() req: FastifyRequest) {
    this.assertTenant(req, eid);
    const rows = await this.withTenant(eid, async (db) =>
      db
        .select()
        .from(conversation)
        .leftJoin(waSession, eq(conversation.waSessionId, waSession.id))
        .orderBy(desc(conversation.lastMessageAt)),
    );
    return {
      data: rows.map((r) => ({
        id: r.conversation.id,
        contactJid: r.conversation.contactJid,
        contactName: r.conversation.contactName,
        leadId: r.conversation.leadId,
        lastMessageAt: r.conversation.lastMessageAt,
        unreadCount: r.conversation.unreadCount,
        isGroup: r.conversation.isGroup,
        waSessionId: r.conversation.waSessionId,
        screenName: r.wa_session?.screenName ?? null,
      })),
    };
  }

  /** Message thread for one conversation, oldest first. */
  @Get('conversations/:conversationId/messages')
  async messages(
    @Param('eid') eid: string,
    @Param('conversationId') conversationId: string,
    @Req() req: FastifyRequest,
  ) {
    this.assertTenant(req, eid);
    const rows = await this.withTenant(eid, async (db) =>
      db
        .select()
        .from(waMessage)
        .where(and(eq(waMessage.enterpriseId, eid), eq(waMessage.conversationId, conversationId)))
        .orderBy(asc(waMessage.sentAt)),
    );
    return { data: rows };
  }

  /**
   * Send an outbound WhatsApp text via the mock driver and persist it to the
   * unified inbox. Resolves the agent session (body waSessionId > the seeded
   * 'demo-agent-number' session, creating it if missing), then constructs the
   * WhatsAppMessage directly and persists it through the InboxService so the
   * conversation + message rows stay consistent. Outbound sends also
   * auto-attribute the linked lead by matching the JID's phone to lead.identifier.
   */
  @Post('send')
  @HttpCode(200)
  async send(
    @Param('eid') eid: string,
    @Req() req: FastifyRequest,
    @Body() body: SendBody,
  ) {
    this.assertTenant(req, eid);
    const contactJid = body?.contactJid;
    const text = body?.text;
    if (!contactJid || typeof text !== 'string' || text.length === 0) {
      throw new BadRequestException({
        error: { code: 'INVALID_ARGUMENT', message: 'contactJid and text are required' },
      });
    }

    // Driver comes from env (WHATSAPP_DRIVER) so the operator env can run
    // the real wwebjs session while contract tests stay on the mock.
    const driver = resolveWhatsappDriver();
    const agentSessionId = resolveAgentSessionId(eid, driver);
    const provider = await providerFor(agentSessionId, driver);
    // Mock driver starts 'connecting'; sendText rejects unless 'ready'.
    await provider.connect(agentSessionId);

    const result = await this.withTenant(eid, async (db) => {
      let waSessionId = body?.waSessionId;
      if (!waSessionId) {
        const session = await db
          .select({ id: waSession.id })
          .from(waSession)
          .where(
            and(
              eq(waSession.enterpriseId, eid),
              eq(waSession.screenName, DEMO_AGENT_SCREEN),
            ),
          )
          .limit(1);
        if (session[0]) {
          waSessionId = session[0].id;
        } else {
          const inserted = await db
            .insert(waSession)
            .values({ enterpriseId: eid, screenName: DEMO_AGENT_SCREEN, status: 'ready' })
            .returning({ id: waSession.id });
          waSessionId = inserted[0]!.id;
        }
      }

      const { messageId } = await provider.sendText(agentSessionId, contactJid, text, {
        replyToId: body?.replyToId ?? undefined,
      });

      // Deterministic direct-construction of the outbound message, then persist
      // through InboxService so conversation upsert + waMessage insert stay aligned.
      const inbox = new InboxService(provider);
      const msg: WhatsAppMessage = {
        id: messageId,
        chatId: contactJid,
        fromMe: true,
        direction: 'outbound',
        type: 'text',
        body: text,
        timestamp: Date.now(),
        replyToId: body?.replyToId ?? null,
      };
      const convo = await inbox.persist(
        { enterpriseId: eid, waSessionId, agentSessionId },
        msg,
      );

      // Auto-attribution for outbound (InboxService only auto-attributes inbound):
      // link the conversation to the lead whose identifier matches this JID's phone.
      if (!convo.leadId) {
        const phone = contactJid.split('@')[0];
        if (phone) {
          const leadRow = await db
            .select({ id: lead.id })
            .from(lead)
            .where(eq(lead.identifier, phone))
            .limit(1);
          if (leadRow[0]) {
            await db
              .update(conversation)
              .set({ leadId: leadRow[0].id })
              .where(eq(conversation.id, convo.id));
          }
        }
      }

      return { messageId, waSessionId };
    });

    return { success: true, messageId: result.messageId };
  }
}
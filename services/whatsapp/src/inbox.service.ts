/**
 * Unified inbox service — bridges provider events to the DB.
 * Responsibilities:
 *   - persist every inbound/outbound WhatsAppMessage to wa_message
 *   - upsert the conversation row (creating it on first contact)
 *   - auto-attribute inbound numbers to leads (lead.identifier match)
 *   - drive a `status` event stream for presence/broadcast logic
 */
import type { WhatsAppMessage, WhatsAppProvider } from '@opentelecrm/contracts';
import { and, eq, sql } from 'drizzle-orm';
import {
  conversation,
  lead,
  waMessage,
  withTenant,
  type DbClient,
  type ConversationRow,
} from '@opentelecrm/db';

export interface InboxConfig {
  enterpriseId: string;
  waSessionId: string;
  agentSessionId: string;
}

export class InboxService {
  private unsubscribers: (() => void)[] = [];

  constructor(private provider: WhatsAppProvider) {}

  /** Attach provider event handlers → DB persistence for this config. */
  async attach(cfg: InboxConfig): Promise<void> {
    this.unsubscribers.push(
      this.provider.on('message', (arg) => {
        // providers emit a WhatsAppMessage for 'message' events (status strings
        // for 'status'); guard to keep TS happy with the union callback type.
        if (arg && typeof arg === 'object' && 'chatId' in (arg as object)) {
          this.persist(cfg, arg as WhatsAppMessage).catch((err) =>
            console.error('[inbox] persist failed', err),
          );
        }
      }),
    );
  }

  async detach(): Promise<void> {
    this.unsubscribers.forEach((fn) => fn());
    this.unsubscribers = [];
  }

  /** Persist a message + upsert conversation + auto-attribute lead. */
  async persist(cfg: InboxConfig, msg: WhatsAppMessage): Promise<ConversationRow> {
    return withTenant(cfg.enterpriseId, async (db) => {
      let convo = await this.findConversation(db, cfg, msg.chatId);
      if (!convo) {
        const inserted = await db
          .insert(conversation)
          .values({
            enterpriseId: cfg.enterpriseId,
            waSessionId: cfg.waSessionId,
            contactJid: msg.chatId,
            lastMessageAt: new Date(msg.timestamp),
            unreadCount: msg.direction === 'inbound' ? 1 : 0,
            isGroup: msg.isGroup ?? false,
          })
          .returning();
        convo = inserted[0]!;
      } else {
        const unreadDelta = msg.direction === 'inbound' ? 1 : 0;
        await db
          .update(conversation)
          .set({
            lastMessageAt: new Date(msg.timestamp),
            unreadCount: sql`unread_count + ${unreadDelta}`,
          })
          .where(eq(conversation.id, convo.id));
      }

      await db.insert(waMessage).values({
        enterpriseId: cfg.enterpriseId,
        conversationId: convo.id,
        waMessageId: msg.id,
        direction: msg.direction,
        type: msg.type,
        body: msg.body,
        status: msg.direction === 'inbound' ? 'received' : 'sent',
        mediaUrl: msg.mediaUrl,
        mimeType: msg.mimeType,
        replyToId: msg.replyToId,
        sentAt: new Date(msg.timestamp),
      });

      // Auto-attribution: inbound number → lead.identifier.
      if (msg.direction === 'inbound' && !convo.leadId) {
        const phone = msg.chatId.split('@')[0];
        if (phone) {
          const leadRow = await db
            .select({ id: lead.id })
            .from(lead)
            .where(eq(lead.identifier, phone))
            .limit(1);
          if (leadRow[0]) {
            await db.update(conversation).set({ leadId: leadRow[0].id }).where(eq(conversation.id, convo.id));
            convo = { ...convo, leadId: leadRow[0].id };
          }
        }
      }

      return convo;
    });
  }

  private async findConversation(
    db: DbClient,
    cfg: InboxConfig,
    jid: string,
  ): Promise<ConversationRow | null> {
    const rows = await db
      .select()
      .from(conversation)
      .where(
        and(
          eq(conversation.enterpriseId, cfg.enterpriseId),
          eq(conversation.waSessionId, cfg.waSessionId),
          eq(conversation.contactJid, jid),
        ),
      )
      .limit(1);
    return rows[0] ?? null;
  }
}

/**
 * A1.1 live call-event bridge — maps ARI Stasis events to call rows.
 *
 * Active only when TELEPHONY_DRIVER=asterisk-ari. Subscribes to the ARI
 * provider's on('call') events and updates the matching call row (matched by
 * provider_call_id) with tenant scoping from the channel variables set at
 * originate (enterprise_id / lead_id). The mock driver emits nothing, so the
 * bridge is inert in tests.
 *
 * The ARI provider is a singleton for the whole PBX (key '*'); per-call
 * tenant context rides in the channel variables, not in the connection.
 */
import { Inject, Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import type { DbClient } from '@opentelecrm/db';
import { call } from '@opentelecrm/db';
import { resolveTelephonyDriver, telephonyProviderFor } from '@opentelecrm/telephony';
import { DB_PROVIDER, TENANT_WRAPPER } from '../db/database.module.js';

type TenantFn = <T>(enterpriseId: string, fn: (db: DbClient) => Promise<T>) => Promise<T>;

interface AriCallEvent {
  type: 'ringing' | 'answered' | 'ended';
  callId: string;
  enterpriseId?: string;
  leadId?: string | null;
  durationSec?: number;
}

const BRIDGE_KEY = '*'; // one ARI provider serves all tenants (PBX is shared)

@Injectable()
export class CallEventBridge implements OnModuleInit, OnModuleDestroy {
  private unsub: (() => void) | null = null;

  constructor(
    @Inject(DB_PROVIDER) private db: DbClient,
    @Inject(TENANT_WRAPPER) private withTenant: TenantFn,
  ) {}

  async onModuleInit(): Promise<void> {
    if (resolveTelephonyDriver() !== 'asterisk-ari') return;
    try {
      const provider = await telephonyProviderFor(BRIDGE_KEY, 'asterisk-ari');
      // Start the ARI events websocket (only the ARI provider has startEvents).
      const maybeStart = (provider as { startEvents?: () => Promise<void> }).startEvents;
      if (maybeStart) await maybeStart.call(provider);
      this.unsub = provider.on('call', (arg) => void this.applyEvent(arg));
      console.log('[call-events] ARI event bridge active');
    } catch (err) {
      console.warn(
        '[call-events] bridge failed to start:',
        err instanceof Error ? err.message : err,
      );
    }
  }

  onModuleDestroy(): void {
    this.unsub?.();
  }

  /** Public for contract tests: apply a normalized call event to the DB. */
  async applyEvent(arg: unknown): Promise<void> {
    const ev = arg as AriCallEvent;
    if (!ev.callId || !ev.enterpriseId) return; // no channel vars → nothing to scope
    try {
      await this.withTenant(ev.enterpriseId, async (db) => {
        const rows = await db
          .select({ id: call.id })
          .from(call)
          .where(
            and(
              eq(call.enterpriseId, ev.enterpriseId!),
              eq(call.providerCallId, ev.callId),
            ),
          )
          .limit(1);
        if (!rows[0]) return;
        const set: Partial<typeof call.$inferInsert> = {};
        switch (ev.type) {
          case 'ringing':
            set.status = 'ringing';
            break;
          case 'answered':
            set.status = 'in-progress';
            break;
          case 'ended':
            set.status = 'completed';
            set.durationSec = ev.durationSec ?? 0;
            set.endedAt = new Date();
            break;
        }
        await db.update(call).set(set).where(eq(call.id, rows[0].id));
      });
    } catch (err) {
      console.warn(
        '[call-events] failed to apply event:',
        err instanceof Error ? err.message : err,
      );
    }
  }
}

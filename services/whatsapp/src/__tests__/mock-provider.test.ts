import type { WhatsAppMessage, WhatsAppSessionStatus } from '@opentelecrm/contracts';
/**
 * Unit tests for MockWhatsAppProvider — pure in-memory provider logic.
 * (The whatsapp package had a `test` script with zero test files, which made
 * `pnpm test` exit 1. These cover the mock provider + session registry; the
 * DB-coupled InboxService is exercised by the API contract tests.)
 */
import { afterEach, describe, expect, it } from 'vitest';
import { MockWhatsAppProvider } from '../providers/mock.provider.js';

describe('MockWhatsAppProvider', () => {
  let provider: MockWhatsAppProvider;

  afterEach(() => {
    provider?.disconnect().catch(() => {});
  });

  it('starts disconnected and connects to ready', async () => {
    provider = new MockWhatsAppProvider();
    expect(await provider.isOnline()).toBe(false);
    const status = await provider.connect('agent-1');
    expect(status.status).toBe('ready');
    expect(await provider.isOnline()).toBe(true);
  });

  it('broadcasts status change to listeners on connect', async () => {
    provider = new MockWhatsAppProvider();
    const seen: string[] = [];
    provider.on('status', (s: WhatsAppSessionStatus['status']) => seen.push(s));
    await provider.connect('agent-1');
    expect(seen).toContain('ready');
  });

  it('sendText emits an outbound message event and returns an id', async () => {
    provider = new MockWhatsAppProvider();
    await provider.connect('agent-1');
    const received: unknown[] = [];
    provider.on('message', (m: WhatsAppMessage) => received.push(m));

    const { messageId } = await provider.sendText('agent-1', '919100000001@s.whatsapp.net', 'hello');

    expect(messageId).toMatch(/^mock-out-/);
    expect(received).toHaveLength(1);
    const msg = received[0] as { fromMe: boolean; direction: string; body: string; chatId: string };
    expect(msg.fromMe).toBe(true);
    expect(msg.direction).toBe('outbound');
    expect(msg.body).toBe('hello');
    expect(msg.chatId).toBe('919100000001@s.whatsapp.net');
  });

  it('sendText throws when not ready', async () => {
    provider = new MockWhatsAppProvider();
    await expect(provider.sendText('agent-1', '919100000001@s.whatsapp.net', 'hello')).rejects.toThrow(
      'not ready',
    );
  });

  it('injectInbound emits an inbound message to listeners', async () => {
    provider = new MockWhatsAppProvider();
    await provider.connect('agent-1');
    const received: unknown[] = [];
    provider.on('message', (m: WhatsAppMessage) => received.push(m));

    const msg = provider.injectInbound('919100000002@s.whatsapp.net', 'reply');

    expect(msg.fromMe).toBe(false);
    expect(msg.direction).toBe('inbound');
    expect(received[0]).toBe(msg);
  });

  it('resolveContact returns registered contacts and null for unknown jids', async () => {
    provider = new MockWhatsAppProvider();
    provider.addContact({ id: '919100000001@s.whatsapp.net', name: 'Acme Buyer' });
    expect(await provider.resolveContact('agent-1', '919100000001@s.whatsapp.net')).toEqual({
      id: '919100000001@s.whatsapp.net',
      name: 'Acme Buyer',
    });
    expect(await provider.resolveContact('agent-1', '919999999999@s.whatsapp.net')).toBeNull();
  });

  it('unsubscribe removes a message listener', async () => {
    provider = new MockWhatsAppProvider();
    await provider.connect('agent-1');
    const received: unknown[] = [];
    const unsub = provider.on('message', (m: WhatsAppMessage) => received.push(m));
    unsub();
    provider.injectInbound('919100000003@s.whatsapp.net', 'nobody home');
    expect(received).toHaveLength(0);
  });

  it('disconnect flips status and notifies listeners', async () => {
    provider = new MockWhatsAppProvider();
    await provider.connect('agent-1');
    const seen: string[] = [];
    provider.on('status', (s: WhatsAppSessionStatus['status']) => seen.push(s));
    await provider.disconnect();
    expect(await provider.isOnline()).toBe(false);
    expect(seen).toContain('disconnected');
  });
});

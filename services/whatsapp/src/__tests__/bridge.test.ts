/**
 * BridgeProvider unit tests — mocked fetch, no live bridge needed.
 * Pins the contract surface: connect/health, sendText passthrough, error
 * when the bridge is down, template rejection, and INBOUND polling (the CRM
 * is the single consumer of the bridge queue).
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BridgeProvider } from '../providers/bridge.provider.js';

const REAL_FETCH = globalThis.fetch;

function mockFetch(routes: Record<string, { status?: number; body: unknown }>): void {
  globalThis.fetch = vi.fn(async (input: string | URL, init?: RequestInit) => {
    const url = String(input);
    for (const [pattern, handler] of Object.entries(routes)) {
      if (url.includes(pattern)) {
        return new Response(JSON.stringify(handler.body), {
          status: handler.status ?? 200,
          headers: { 'content-type': 'application/json' },
        });
      }
    }
    return new Response(JSON.stringify({ error: 'unexpected ' + url }), { status: 500 });
  }) as unknown as typeof fetch;
}

afterEach(() => {
  globalThis.fetch = REAL_FETCH;
  vi.restoreAllMocks();
});

describe('BridgeProvider (standalone deploy-anywhere whatsapp-bridge client)', () => {
  it('connect reports ready when the bridge /health is connected', async () => {
    mockFetch({ '/health': { body: { status: 'connected', uptime: 1 } } });
    const provider = new BridgeProvider({ bridgeUrl: 'http://127.0.0.1:3000' });
    const s = await provider.connect('cli');
    expect(s.status).toBe('ready');
    expect(await provider.isOnline('cli')).toBe(true);
  });

  it('connect reports disconnected when the bridge is down', async () => {
    mockFetch({ '/health': { body: { status: 'disconnected' } } });
    const provider = new BridgeProvider({ bridgeUrl: 'http://127.0.0.1:3000' });
    expect((await provider.connect('cli')).status).toBe('disconnected');
  });

  it('sendText POSTs { chatId, message } and returns the bridge messageId', async () => {
    mockFetch({
      '/health': { body: { status: 'connected' } },
      '/send': { body: { success: true, messageId: 'BRIDGE-123' } },
    });
    const provider = new BridgeProvider({ bridgeUrl: 'http://127.0.0.1:3000' });
    const { messageId } = await provider.sendText('cli', '919500000001@s.whatsapp.net', 'hello');
    expect(messageId).toBe('BRIDGE-123');
    expect(globalThis.fetch).toHaveBeenCalledWith(
      'http://127.0.0.1:3000/send',
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('"chatId":"919500000001@s.whatsapp.net"'),
      }),
    );
  });

  it('sendText throws when the bridge is not connected', async () => {
    mockFetch({ '/health': { body: { status: 'disconnected' } } });
    const provider = new BridgeProvider({ bridgeUrl: 'http://127.0.0.1:3000' });
    await expect(provider.sendText('cli', 'x@s.whatsapp.net', 'hi')).rejects.toThrow(/not connected/);
  });

  it('sendText throws with the bridge error on non-2xx', async () => {
    mockFetch({
      '/health': { body: { status: 'connected' } },
      '/send': { status: 500, body: { error: 'boom' } },
    });
    const provider = new BridgeProvider({ bridgeUrl: 'http://127.0.0.1:3000' });
    await expect(provider.sendText('cli', 'x@s.whatsapp.net', 'hi')).rejects.toThrow(/boom/);
  });

  it('rejects templates (cloud-api only)', async () => {
    const provider = new BridgeProvider({ bridgeUrl: 'http://127.0.0.1:3000' });
    await expect(provider.sendTemplate('cli', 'x@s.whatsapp.net', 't', 'en', [])).rejects.toThrow(
      /cloud-api/,
    );
  });

  it('polls /messages and emits normalized inbound WhatsAppMessages', async () => {
    // The real bridge DEQUEUES on GET /messages — the mock must too.
    let drained = false;
    mockFetch({
      '/health': { body: { status: 'connected' } },
      '/messages': {
        body: [
          {
            id: 'm1',
            chatId: '919500000001@s.whatsapp.net',
            fromMe: false,
            senderId: '919500000001@s.whatsapp.net',
            pushName: 'Test',
            body: 'hello from the phone',
            type: 'text',
            timestamp: 1700000000000,
          },
        ],
      },
    });
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn(async (input: string | URL) => {
      if (String(input).includes('/messages')) {
        if (drained) return new Response(JSON.stringify([]), { status: 200 });
        drained = true;
        return originalFetch(input);
      }
      return originalFetch(input);
    }) as unknown as typeof fetch;
    const provider = new BridgeProvider({ bridgeUrl: 'http://127.0.0.1:3000', pollIntervalMs: 100 });
    const received: unknown[] = [];
    const unsub = provider.on('message', (m) => received.push(m));
    await provider.connect('cli');
    // give the poller a couple of ticks
    await new Promise((r) => setTimeout(r, 350));
    unsub();
    await provider.disconnect('cli');
    expect(received).toHaveLength(1);
    const msg = received[0] as { chatId: string; direction: string; body: string; fromMe: boolean };
    expect(msg.chatId).toBe('919500000001@s.whatsapp.net');
    expect(msg.direction).toBe('inbound');
    expect(msg.fromMe).toBe(false);
    expect(msg.body).toBe('hello from the phone');
  });

  it('does not emit bridge echo messages (fromMe true)', async () => {
    mockFetch({
      '/health': { body: { status: 'connected' } },
      '/messages': {
        body: [
          {
            id: 'echo1',
            chatId: '919500000001@s.whatsapp.net',
            fromMe: true,
            senderId: '919500000001@s.whatsapp.net',
            body: 'echo',
            type: 'text',
            timestamp: 1700000000000,
          },
        ],
      },
    });
    const provider = new BridgeProvider({ bridgeUrl: 'http://127.0.0.1:3000', pollIntervalMs: 100 });
    const received: unknown[] = [];
    const unsub = provider.on('message', (m) => received.push(m));
    await provider.connect('cli');
    await new Promise((r) => setTimeout(r, 350));
    unsub();
    await provider.disconnect('cli');
    expect(received).toHaveLength(0);
  });
});

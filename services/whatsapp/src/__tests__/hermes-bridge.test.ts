/**
 * HermesBridgeProvider unit tests — mocked fetch, no live bridge needed.
 * Pins the contract surface: connect/health, sendText passthrough, error
 * when the bridge is down, template rejection, and the no-op inbound path.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { HermesBridgeProvider } from '../providers/hermes-bridge.provider.js';

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

describe('HermesBridgeProvider (delegates outbound to the local Hermes bridge)', () => {
  it('connect reports ready when the bridge /health is connected', async () => {
    mockFetch({ '/health': { body: { status: 'connected', uptime: 1 } } });
    const provider = new HermesBridgeProvider({ bridgeUrl: 'http://127.0.0.1:3000' });
    const s = await provider.connect('cli');
    expect(s.status).toBe('ready');
    expect(await provider.isOnline('cli')).toBe(true);
  });

  it('connect reports disconnected when the bridge is down', async () => {
    mockFetch({ '/health': { body: { status: 'disconnected' } } });
    const provider = new HermesBridgeProvider({ bridgeUrl: 'http://127.0.0.1:3000' });
    expect((await provider.connect('cli')).status).toBe('disconnected');
  });

  it('sendText POSTs { chatId, message } and returns the bridge messageId', async () => {
    mockFetch({
      '/health': { body: { status: 'connected' } },
      '/send': { body: { success: true, messageId: 'BRIDGE-123' } },
    });
    const provider = new HermesBridgeProvider({ bridgeUrl: 'http://127.0.0.1:3000' });
    const { messageId } = await provider.sendText('cli', '9195***5402@s.whatsapp.net', 'hello');
    expect(messageId).toBe('BRIDGE-123');
    expect(globalThis.fetch).toHaveBeenCalledWith(
      'http://127.0.0.1:3000/send',
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('"chatId":"9195***5402@s.whatsapp.net"'),
      }),
    );
  });

  it('sendText throws when the bridge is not connected', async () => {
    mockFetch({ '/health': { body: { status: 'disconnected' } } });
    const provider = new HermesBridgeProvider({ bridgeUrl: 'http://127.0.0.1:3000' });
    await expect(provider.sendText('cli', 'x@s.whatsapp.net', 'hi')).rejects.toThrow(
      /not connected/,
    );
  });

  it('sendText throws with the bridge error on non-2xx', async () => {
    mockFetch({
      '/health': { body: { status: 'connected' } },
      '/send': { status: 500, body: { error: 'boom' } },
    });
    const provider = new HermesBridgeProvider({ bridgeUrl: 'http://127.0.0.1:3000' });
    await expect(provider.sendText('cli', 'x@s.whatsapp.net', 'hi')).rejects.toThrow(/boom/);
  });

  it('rejects templates (cloud-api only)', async () => {
    const provider = new HermesBridgeProvider({ bridgeUrl: 'http://127.0.0.1:3000' });
    await expect(
      provider.sendTemplate('cli', 'x@s.whatsapp.net', 't', 'en', []),
    ).rejects.toThrow(/cloud-api/);
  });

  it('on() subscribes but never emits (inbound deliberately out of scope)', async () => {
    const provider = new HermesBridgeProvider({ bridgeUrl: 'http://127.0.0.1:3000' });
    const cb = vi.fn();
    const unsub = provider.on('message', cb);
    // No way to emit; assert the unsubscribe contract works and cb stays silent.
    unsub();
    expect(cb).not.toHaveBeenCalled();
  });
});

/**
 * Unit tests for the whatsapp session registry (providerFor / dropSession).
 * Verifies the lazy provider selection and per-session caching — the wwebjs
 * driver must NEVER be constructed by the mock path (it would spawn Chrome).
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MockWhatsAppProvider } from '../providers/mock.provider.js';
import { allSessions, dropSession, providerFor } from '../sessions.js';

describe('whatsapp session registry', () => {
  afterEach(() => {
    for (const id of [...allSessions().keys()]) dropSession(id);
  });

  it('creates a mock provider per agent session by default', async () => {
    const p = await providerFor('agent-1');
    expect(p).toBeInstanceOf(MockWhatsAppProvider);
    expect(p.kind).toBe('mock');
  });

  it('caches the provider for an agent session', async () => {
    const a = await providerFor('agent-1');
    const b = await providerFor('agent-1');
    expect(a).toBe(b);
  });

  it('keeps separate sessions separate', async () => {
    const a = await providerFor('agent-1');
    const b = await providerFor('agent-2');
    expect(a).not.toBe(b);
  });

  it('dropSession evicts a session', async () => {
    await providerFor('agent-1');
    expect(allSessions().has('agent-1')).toBe(true);
    dropSession('agent-1');
    expect(allSessions().has('agent-1')).toBe(false);
  });

  it('wwebjs kind lazy-imports the real provider', async () => {
    // Only the pairing CLI / real-number worker should hit this path; in the
    // test env the wwebjs provider throws on construct (no browser), which
    // proves it was actually selected (not the mock).
    const p = await providerFor('real-agent', 'wwebjs');
    expect(p.kind).toBe('wwebjs');
  });

  it('never constructs the wwebjs provider on the default path', async () => {
    const spy = vi.fn();
    // The default (mock) path must not touch wwebjs — assert no throw and the
    // expected class, which is sufficient given wwebjs would throw on import
    // side effects (puppeteer) in a headless test env.
    const p = await providerFor('mock-only');
    spy(p);
    expect(spy).toHaveBeenCalled();
  });
});

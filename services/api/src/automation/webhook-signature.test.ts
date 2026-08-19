import { afterEach, describe, expect, it } from 'vitest';
import {
  DUMMY_SECRET,
  maxSkewSeconds,
  parseTimestamp,
  rememberRotatedSecret,
  rotatedSecretCandidates,
  rotationGraceSeconds,
  signWebhook,
  timestampInWindow,
  verifySignature,
  webhookMessage,
} from './webhook-signature.js';

const ENV_KEYS = ['WEBHOOK_MAX_SKEW_SECONDS', 'WEBHOOK_ROTATION_GRACE_SECONDS'] as const;

afterEach(() => {
  for (const key of ENV_KEYS) process.env[key] = undefined;
});

const SECRET = 'a'.repeat(64);
const EID = 'a9e8933a-0a29-4e8b-8b2b-7fdfaf1b88d9';
const NAME = 'order-created';
const TS = 1_724_000_000;
const BODY = '{ "payload": { "foo": 1 } }';

describe('webhook message canonicalization', () => {
  it('produces the exact canonical message (tenant, name, ts, rawBody)', () => {
    expect(webhookMessage(EID, NAME, TS, BODY)).toBe(`${EID}\n${NAME}\n${TS}\n${BODY}`);
  });
});

describe('signWebhook + verifySignature', () => {
  it('round-trips: a correct signature verifies', () => {
    const sig = signWebhook({ secret: SECRET, tenantId: EID, name: NAME, timestamp: TS, body: BODY });
    expect(sig.startsWith('sha256=')).toBe(true);
    expect(verifySignature(SECRET, EID, NAME, TS, BODY, sig.split('sha256=')[1]!)).toBe(true);
  });

  it('rejects a wrong secret', () => {
    const sig = signWebhook({ secret: SECRET, tenantId: EID, name: NAME, timestamp: TS, body: BODY });
    expect(verifySignature('b'.repeat(64), EID, NAME, TS, BODY, sig.split('sha256=')[1]!)).toBe(false);
  });

  it('rejects a tampered raw body', () => {
    const sig = signWebhook({ secret: SECRET, tenantId: EID, name: NAME, timestamp: TS, body: BODY });
    expect(verifySignature(SECRET, EID, NAME, TS, `${BODY}r`, sig.split('sha256=')[1]!)).toBe(false);
  });

  it('rejects a malformed (non-64-hex) signature without throwing', () => {
    expect(verifySignature(SECRET, EID, NAME, TS, BODY, 'not-hex')).toBe(false);
    expect(verifySignature(SECRET, EID, NAME, TS, BODY, 'abcd')).toBe(false);
    expect(verifySignature(SECRET, EID, NAME, TS, BODY, '')).toBe(false);
  });

  it('DUMMY_SECRET can never verify a real signature (uniform fallback)', () => {
    const sig = signWebhook({ secret: SECRET, tenantId: EID, name: NAME, timestamp: TS, body: BODY });
    expect(verifySignature(DUMMY_SECRET, EID, NAME, TS, BODY, sig.split('sha256=')[1]!)).toBe(false);
  });
});

describe('parseTimestamp', () => {
  it('accepts a valid unix-seconds integer string', () => {
    expect(parseTimestamp('1724000000')).toBe(1_724_000_000);
    expect(parseTimestamp(' 1724000000 ')).toBe(1_724_000_000);
  });

  it('rejects missing, fractional, non-numeric, and out-of-range values', () => {
    expect(parseTimestamp(undefined)).toBeNull();
    expect(parseTimestamp('')).toBeNull();
    expect(parseTimestamp('1724000000.5')).toBeNull();
    expect(parseTimestamp('abc')).toBeNull();
    expect(parseTimestamp('-5')).toBeNull();
    expect(parseTimestamp('999999999999999999999')).toBeNull(); // not safe-integer
  });
});

describe('timestampInWindow + maxSkewSeconds', () => {
  it('defaults to a 300s window', () => {
    expect(maxSkewSeconds()).toBe(300);
  });

  it('accepts now and rejects stale/future timestamps outside the window', () => {
    const now = Math.floor(Date.now() / 1000);
    expect(timestampInWindow(now, now)).toBe(true);
    expect(timestampInWindow(now - 120, now)).toBe(true);
    expect(timestampInWindow(now + 120, now)).toBe(true);
    expect(timestampInWindow(now - 3600, now)).toBe(false);
    expect(timestampInWindow(now + 3600, now)).toBe(false);
  });

  it('clamps the env override to the documented 30..3600 range', () => {
    process.env.WEBHOOK_MAX_SKEW_SECONDS = '1200';
    expect(maxSkewSeconds()).toBe(1200);
    process.env.WEBHOOK_MAX_SKEW_SECONDS = '5';
    expect(maxSkewSeconds()).toBe(300); // below min → default
    process.env.WEBHOOK_MAX_SKEW_SECONDS = '99999';
    expect(maxSkewSeconds()).toBe(300); // above max → default
    process.env.WEBHOOK_MAX_SKEW_SECONDS = 'junk';
    expect(maxSkewSeconds()).toBe(300); // NaN → default
  });
});

describe('rotation grace period', () => {
  it('keeps the previous secret valid only while grace is configured', () => {
    // Grace on → the old secret is available as a verification candidate.
    process.env.WEBHOOK_ROTATION_GRACE_SECONDS = '60';
    expect(rotationGraceSeconds()).toBe(60);
    rememberRotatedSecret('rule-1', 'old-secret');
    expect(rotatedSecretCandidates('rule-1')).toContain('old-secret');
  });

  it('records nothing when grace is 0 (default)', () => {
    rememberRotatedSecret('rule-2', 'old-secret');
    expect(rotatedSecretCandidates('rule-2')).toEqual([]);
  });
});

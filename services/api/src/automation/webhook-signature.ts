/**
 * Shared webhook signing primitives — ONE canonical protocol for BOTH the
 * public webhook ingress (webhook.controller.ts) and the outbound `webhook`
 * automation action (dispatcher.ts).
 *
 * Protocol v2 (canonical, language-independent):
 *   header            X-OT-Signature   sha256=<hex>
 *   header            X-OT-Timestamp   unix seconds (integer)
 *   signed message    `<tenantId>\n<name>\n<timestamp>\n<rawBody>`
 *
 * where `rawBody` is the EXACT request body bytes placed on the wire
 * (UTF-8). Signing the raw bytes — not JSON.stringify of a parsed object —
 * removes all JS-specific serialization coupling: any HTTP client can compute
 * the HMAC over the exact string it sends, so key order, whitespace, unicode
 * escapes, and number formatting never cause spurious 401s.
 *
 * Replay protection: the signed timestamp must be within the acceptable skew
 * window (WEBHOOK_MAX_SKEW_SECONDS, default 300s). A captured request cannot
 * be re-fired indefinitely. Exact-duplicate dedup within the window needs a
 * durable per-nonce table — documented as the follow-up.
 *
 * Enumeration hardening: the ingress uses a constant DUMMY_SECRET so a
 * missing rule / secret-less rule produces the SAME response as a bad
 * signature (no per-rule state leaks via status codes).
 */
import { createHmac, timingSafeEqual } from 'node:crypto';

export const SIGNATURE_HEADER = 'x-ot-signature';
export const TIMESTAMP_HEADER = 'x-ot-timestamp';
export const SIGNATURE_PREFIX = 'sha256=';

/** 64-hex dummy used to make missing-rule / secret-less responses identical. */
export const DUMMY_SECRET = '0'.repeat(64);

const HEX_64_RE = /^[0-9a-f]{64}$/i;

/** Max acceptable clock skew for the signed timestamp (seconds). */
export function maxSkewSeconds(): number {
  const raw = Number.parseInt(process.env.WEBHOOK_MAX_SKEW_SECONDS ?? '', 10);
  if (Number.isFinite(raw) && raw >= 30 && raw <= 3600) return raw;
  return 300;
}

/** Canonical signed message. `rawBody` must be the exact request bytes. */
export function webhookMessage(tenantId: string, name: string, timestamp: number, rawBody: string): string {
  return `${tenantId}\n${name}\n${timestamp}\n${rawBody}`;
}

/** Returns `sha256=<hex>` for the given secret + canonical message. */
export function signWebhook(opts: {
  secret: string;
  tenantId: string;
  name: string;
  timestamp: number;
  body: string; // exact raw bytes (UTF-8 string)
}): string {
  const hmac = createHmac('sha256', opts.secret);
  hmac.update(webhookMessage(opts.tenantId, opts.name, opts.timestamp, opts.body));
  return `${SIGNATURE_PREFIX}${hmac.digest('hex')}`;
}

/**
 * Timing-safe verification of a raw `X-OT-Signature` header value against a
 * known secret. Returns false for a malformed (non-64-hex) signature — the
 * caller decides the HTTP response. Use DUMMY_SECRET when no rule/secret
 * exists to keep responses uniform.
 */
export function verifySignature(
  secret: string,
  tenantId: string,
  name: string,
  timestamp: number,
  rawBody: string,
  provided: string,
): boolean {
  const hex = provided.startsWith(SIGNATURE_PREFIX) ? provided.slice(SIGNATURE_PREFIX.length) : provided;
  if (!HEX_64_RE.test(hex)) return false;
  const expected = createHmac('sha256', secret)
    .update(webhookMessage(tenantId, name, timestamp, rawBody))
    .digest('hex');
  try {
    return timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(hex, 'hex'));
  } catch {
    return false;
  }
}

/**
 * Parses an X-OT-Timestamp header into unix seconds or null when malformed.
 * Accepts an integer-second string (e.g. "1724000000"); fractional seconds
 * and non-numeric values are rejected.
 */
export function parseTimestamp(value: string | undefined): number | null {
  if (!value || typeof value !== 'string') return null;
  if (!/^\d{1,13}$/.test(value.trim())) return null;
  const ts = Number(value.trim());
  if (!Number.isSafeInteger(ts)) return null;
  return ts;
}

/** True when `ts` (unix seconds) is within the acceptable skew window. */
export function timestampInWindow(ts: number, nowSec: number = Math.floor(Date.now() / 1000)): boolean {
  return Math.abs(nowSec - ts) <= maxSkewSeconds();
}

// ---------------------------------------------------------------------------
// Rotation grace period (L1)
// ---------------------------------------------------------------------------
// WEBHOOK_ROTATION_GRACE_SECONDS (default 0 = no grace): after a rotate, the
// previous secret stays accepted for this many seconds so in-flight senders
// aren't hard-cut. Stored IN-PROCESS (single-node only — horizontally scaled
// deployments should set grace to 0, which is the default). Buffered
// per-rule, bounded, and purged on expiry.
const GRACE_MAX_ENTRIES_PER_RULE = 5;
const GRACE_MAX_SKEW = 12 * 60 * 60; // sanity cap: never more than 12h

const rotatedSecrets = new Map<string, Array<{ secret: string; expiresAt: number }>>();

export function rotationGraceSeconds(): number {
  const raw = Number.parseInt(process.env.WEBHOOK_ROTATION_GRACE_SECONDS ?? '', 10);
  if (Number.isFinite(raw) && raw >= 0 && raw <= GRACE_MAX_SKEW) return raw;
  return 0;
}

/** Called by rotateWebhookSecret BEFORE writing the new secret. */
export function rememberRotatedSecret(ruleId: string, oldSecret: string): void {
  const grace = rotationGraceSeconds();
  if (grace <= 0 || !oldSecret) return;
  const list = rotatedSecrets.get(ruleId) ?? [];
  list.push({ secret: oldSecret, expiresAt: Date.now() + grace * 1000 });
  while (list.length > GRACE_MAX_ENTRIES_PER_RULE) list.shift();
  rotatedSecrets.set(ruleId, list);
}

/** Unexpired previous secrets for a rule (for verification fallback). */
export function rotatedSecretCandidates(ruleId: string): string[] {
  const now = Date.now();
  const list = rotatedSecrets.get(ruleId) ?? [];
  let changed = false;
  const live: string[] = [];
  for (const entry of list) {
    if (entry.expiresAt > now) live.push(entry.secret);
    else changed = true;
  }
  if (changed) {
    const kept = list.filter((e) => e.expiresAt > now);
    if (kept.length === 0) rotatedSecrets.delete(ruleId);
    else rotatedSecrets.set(ruleId, kept);
  }
  return live;
}

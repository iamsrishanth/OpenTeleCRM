/**
 * SSRF guard for outbound automation actions (http_request / webhook).
 *
 * Policy (default-deny of internal targets):
 *   - schemes: http/https only.
 *   - hostnames: loopback / private hostname suffixes are rejected
 *     (localhost, *.localhost, *.local, *.internal, *.home.arpa, *.lan,
 *     bare 'local').
 *   - literal IPs: loopback, private, link-local, CGNAT, reserved,
 *     multicast, and IPv6 equivalents (incl. v4-mapped) are rejected.
 *   - DNS names are resolved at execution time and EVERY returned address is
 *     checked — a name that resolves (now or later) to a private address is
 *     rejected; resolution failures fail closed (never fetch what you cannot
 *     prove is public).
 *   - checked at execution time (not rule-create time), so a mutated or
 *     compromised rule cannot bypass the guard.
 *
 * Documented escape hatches (env-gated; see .env.example):
 *   AUTOMATION_URL_ALLOWLIST      comma-separated origins that bypass the
 *                                 private-range reject (entries are normalized
 *                                 to scheme://host[:port]; a host without a
 *                                 scheme is treated as http). NOTE: an
 *                                 allowlisted HOSTNAME also skips execution-time
 *                                 DNS verification — you are declaring the
 *                                 target trusted, so only allowlist origins you
 *                                 control (see L4 in url-safety review).
 *   AUTOMATION_ALLOW_PRIVATE_IPS  'true' disables the private/IP rejection
 *                                 entirely (self-hosted intranet).
 *
 * Redirects: the dispatcher uses redirect:'manual' and re-runs this guard on
 * every Location hop (services/api/src/automation/dispatcher.ts), so a 302 to
 * an internal address is still rejected.
 *
 * Known residual risk: classic DNS-rebinding TOCTOU — a hostile public name
 * that returns a public address to THIS lookup but a private address to the
 * later fetch. Closing it fully needs connect-time address pinning (out of
 * scope); the allowlist exists for stop-the-world needs.
 */
import dns from 'node:dns';
import net from 'node:net';

const ALLOWED_SCHEMES = new Set(['http:', 'https:']);

/** [base, prefixBits] — all ranges reject outright. */
const PRIVATE_V4_RANGES: Array<[number, number]> = [
  [0x00000000, 8], // 0.0.0.0/8
  [0x0a000000, 8], // 10.0.0.0/8
  [0x7f000000, 8], // 127.0.0.0/8
  [0x64400000, 10], // 100.64.0.0/10 (CGNAT)
  [0xac100000, 12], // 172.16.0.0/12
  [0xa9fe0000, 16], // 169.254.0.0/16 (link-local)
  [0xc0a80000, 16], // 192.168.0.0/16
  [0xc0000000, 24], // 192.0.0.0/24 (IETF protocol assignments)
  [0xc0000200, 24], // 192.0.2.0/24 (TEST-NET-1, RFC 5737)
  [0xc0586300, 24], // 192.88.99.0/24 (6to4 relay anycast, RFC 3068)
  [0xc6120000, 15], // 198.18.0.0/15 (benchmarking)
  [0xc6336400, 24], // 198.51.100.0/24 (TEST-NET-2, RFC 5737)
  [0xcb007100, 24], // 203.0.113.0/24 (TEST-NET-3, RFC 5737)
  [0xe0000000, 4], // 224.0.0.0/4 (multicast)
  [0xf0000000, 4], // 240.0.0.0/4 (reserved)
];

function v4ToInt(ip: string): number | null {
  const parts = ip.split('.');
  if (parts.length !== 4) return null;
  let n = 0;
  for (const p of parts) {
    if (!/^\d{1,3}$/.test(p)) return null;
    const v = Number(p);
    if (v < 0 || v > 255) return null;
    n = (n << 8) | v;
  }
  return n >>> 0;
}

function inV4Range(n: number, base: number, bits: number): boolean {
  const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
  return (n & mask) === (base & mask);
}

function isPrivateIpv4(ip: string): boolean {
  const n = v4ToInt(ip);
  if (n === null) return false;
  return PRIVATE_V4_RANGES.some(([base, bits]) => inV4Range(n, base, bits));
}

/**
 * Un-marshals v4-mapped/compatible IPv6 literals to the embedded IPv4.
 * Handles BOTH dotted-quad forms (::ffff:1.2.3.4) and the hex-normalized
 * forms WHATWG's URL parser produces ([::ffff:10.0.0.5] → hostname
 * "[::ffff:a00:5]"; [::10.0.0.5] → "[::a00:5]").
 */
function extractV4FromV6(host: string): string | null {
  const dotted =
    /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(host) ??
    /^::(\d+\.\d+\.\d+\.\d+)$/i.exec(host) ??
    /^::ffff:0:(\d+\.\d+\.\d+\.\d+)$/i.exec(host);
  if (dotted) return dotted[1]!;

  const expanded = expandV6(host);
  if (!expanded) return null;
  const parts = expanded.split(':');
  // v4-embedded forms: first four hextets zero, marker hextets 4-5 are
  // all-zero/ffff, and the embedded v4 lives in hextets 6-7. Covers:
  //   ::ffff:x:y       → [0,0,0,0,0,ffff,x,y]
  //   ::ffff:0:x:y     → [0,0,0,0,ffff,0,x,y]
  //   ::x:y (compat)   → [0,0,0,0,0,0,x,y]
  const marker = new Set(['0000', 'ffff']);
  const prefixOk =
    parts.slice(0, 4).every((p) => p === '0000') && marker.has(parts[4]!) && marker.has(parts[5]!);
  if (!prefixOk) return null;
  const hi = Number.parseInt(parts[6]!, 16);
  const lo = Number.parseInt(parts[7]!, 16);
  return `${hi >> 8}.${hi & 0xff}.${lo >> 8}.${lo & 0xff}`;
}

/** Expands a v6 literal to full 8-hextet form ('::' → '0000:...'). */
function expandV6(host: string): string | null {
  let h = host.toLowerCase();
  const zone = h.indexOf('%');
  if (zone !== -1) h = h.slice(0, zone);
  const dc = h.indexOf('::');
  const head = dc === -1 ? h : h.slice(0, dc);
  const tail = dc === -1 ? '' : h.slice(dc + 2);
  if (dc !== -1 && head.includes(':') && tail.includes(':')) {
    // more than one '::' is invalid
    if (h.indexOf('::', dc + 1) !== -1) return null;
  }
  const headParts = head === '' ? [] : head.split(':');
  const tailParts = tail === '' ? [] : tail.split(':');
  const fill = 8 - headParts.length - tailParts.length;
  if (fill < 1 && dc !== -1) return null;
  const parts = [...headParts, ...Array(Math.max(fill, 0)).fill('0'), ...tailParts];
  if (parts.length !== 8) return null;
  for (const p of parts) if (!/^[0-9a-f]{1,4}$/.test(p)) return null;
  return parts.map((p) => p.padStart(4, '0')).join(':');
}

function firstBytes(expanded: string): number[] {
  const hex = expanded.split(':').join('');
  const bytes: number[] = [];
  for (let i = 0; i < hex.length; i += 2) bytes.push(Number.parseInt(hex.slice(i, i + 2), 16));
  return bytes;
}

function ipv6InPrefix(expandedHost: string, expandedPrefix: string, bits: number): boolean {
  const a = firstBytes(expandedHost);
  const b = firstBytes(expandedPrefix);
  const full = Math.floor(bits / 8);
  for (let i = 0; i < full; i++) {
    if (a[i] !== b[i]) return false;
  }
  const rem = bits % 8;
  if (rem > 0) {
    const mask = (0xff << (8 - rem)) & 0xff;
    if ((a[full]! & mask) !== (b[full]! & mask)) return false;
  }
  return true;
}

const PRIVATE_V6_PREFIXES: Array<[string, number]> = [
  ['::', 128], // unspecified
  ['::1', 128], // loopback
  ['fc00::', 7], // unique local
  ['fe80::', 10], // link-local
  ['ff00::', 8], // multicast
];

function isPrivateIpv6(host: string): boolean {
  const v4 = extractV4FromV6(host);
  if (v4) return isPrivateIpv4(v4);
  const expanded = expandV6(host);
  if (!expanded) return false;
  return PRIVATE_V6_PREFIXES.some(([prefix, bits]) => {
    const exp = expandV6(prefix);
    return exp !== null && ipv6InPrefix(expanded, exp, bits);
  });
}

/** Exact single-label blocks, then dot-boundary suffixes (no substring misfires). */
const BLOCKED_HOST_EXACT = ['localhost', 'localhost.', 'local', 'local.'];
const BLOCKED_HOST_SUFFIXES = ['.localhost', '.local', '.internal', '.home.arpa', '.lan'];

function isBlockedHostname(host: string): boolean {
  const h = host.toLowerCase();
  if (BLOCKED_HOST_EXACT.includes(h)) return true;
  return BLOCKED_HOST_SUFFIXES.some((s) => h.endsWith(s));
}

/**
 * Parses AUTOMATION_URL_ALLOWLIST into normalized origins (scheme://host[:port]).
 * Entries are normalized through WHATWG URL parsing so a bare host becomes
 * http://host and trailing slashes are dropped — matching by url.origin is
 * exact. Malformed entries are skipped (never throw on operator typos).
 */
function allowlistOrigins(): Set<string> | null {
  const raw = process.env.AUTOMATION_URL_ALLOWLIST;
  if (!raw || !raw.trim()) return null;
  const set = new Set<string>();
  for (const entry of raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)) {
    try {
      const u = new URL(entry.includes('://') ? entry : `http://${entry}`);
      if (!ALLOWED_SCHEMES.has(u.protocol)) continue;
      set.add(u.origin);
    } catch {
      // skip malformed entry
    }
  }
  return set.size > 0 ? set : null;
}

function stripBrackets(host: string): string {
  return host.startsWith('[') && host.endsWith(']') ? host.slice(1, -1) : host;
}

/** Fail-closed DNS verification: reject if ANY resolved address is private. */
async function assertPublicDns(host: string): Promise<void> {
  let addresses: dns.LookupAddress[];
  try {
    addresses = await dns.promises.lookup(host, { all: true, verbatim: true });
  } catch {
    throw new Error(`http_request: DNS resolution failed for '${host}' (SSRF guard, fail-closed)`);
  }
  for (const addr of addresses) {
    const v = net.isIP(addr.address);
    const blocked = (v === 4 && isPrivateIpv4(addr.address)) || (v === 6 && isPrivateIpv6(addr.address));
    if (blocked) {
      throw new Error(`http_request: '${host}' resolves to blocked address '${addr.address}' (SSRF guard)`);
    }
  }
}

/**
 * Throws if `url` may target an internal/private destination per the policy
 * above. Returns normally for public HTTP(S) URLs. Call at execution time,
 * immediately before fetching.
 */
export async function assertExternalHttpUrl(rawUrl: string): Promise<void> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error(`http_request: invalid URL '${rawUrl.slice(0, 120)}'`);
  }
  if (!ALLOWED_SCHEMES.has(url.protocol)) {
    throw new Error(`http_request: protocol '${url.protocol}' is not allowed (http/https only)`);
  }
  const allow = allowlistOrigins();
  if (allow?.has(url.origin)) return;
  if (process.env.AUTOMATION_ALLOW_PRIVATE_IPS === 'true') return;

  const host = url.hostname;
  if (isBlockedHostname(host)) {
    throw new Error(
      `http_request: hostname '${host}' is blocked (loopback/private hostnames are not allowed)`,
    );
  }
  const literal = stripBrackets(host);
  const ipVersion = net.isIP(literal);
  if (ipVersion === 4) {
    if (isPrivateIpv4(literal)) {
      throw new Error(
        `http_request: private/reserved IPv4 address '${literal}' is not allowed (set AUTOMATION_URL_ALLOWLIST or AUTOMATION_ALLOW_PRIVATE_IPS=true to permit)`,
      );
    }
    return;
  }
  if (ipVersion === 6) {
    if (isPrivateIpv6(literal)) {
      throw new Error(
        `http_request: private/reserved IPv6 address '${literal}' is not allowed (set AUTOMATION_URL_ALLOWLIST or AUTOMATION_ALLOW_PRIVATE_IPS=true to permit)`,
      );
    }
    return;
  }
  // DNS name: verify at execution time (all addresses, fail-closed).
  await assertPublicDns(literal);
}

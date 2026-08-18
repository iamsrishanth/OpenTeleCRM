import { afterEach, describe, expect, it } from 'vitest';
import { assertExternalHttpUrl } from '../automation/url-safety.js';

/**
 * Unit tests for the automation SSRF guard (no DB required).
 *
 * The public-DNS-name cases resolve real DNS (e.g. api.example.com,
 * 127.0.0.1.nip.io) — the guard itself performs an execution-time lookup, so
 * those tests require network. IP-literal, hostname-suffix, scheme, and env
 * escape-hatch cases are fully offline.
 */
const ENV_KEYS = ['AUTOMATION_URL_ALLOWLIST', 'AUTOMATION_ALLOW_PRIVATE_IPS'] as const;

afterEach(() => {
  for (const key of ENV_KEYS) {
    process.env[key] = undefined;
  }
});

describe('assertExternalHttpUrl — public targets', () => {
  it('allows public https url', async () => {
    await expect(assertExternalHttpUrl('https://example.com/api/leads')).resolves.toBeUndefined();
  });

  it('allows public http url with explicit port', async () => {
    await expect(assertExternalHttpUrl('http://example.com:8080/hook')).resolves.toBeUndefined();
  });

  it('allows public literal IPv4', async () => {
    await expect(assertExternalHttpUrl('http://8.8.8.8/dns')).resolves.toBeUndefined();
  });

  it('allows public literal IPv6', async () => {
    await expect(assertExternalHttpUrl('http://[2606:4700:4700::1111]/dns')).resolves.toBeUndefined();
  });
});

describe('assertExternalHttpUrl — scheme and shape', () => {
  it('rejects non-http(s) protocols', async () => {
    await expect(assertExternalHttpUrl('file:///etc/passwd')).rejects.toThrow(/protocol/);
    await expect(assertExternalHttpUrl('ftp://10.0.0.5/x')).rejects.toThrow(/protocol/);
    await expect(assertExternalHttpUrl('gopher://127.0.0.1/x')).rejects.toThrow(/protocol/);
    await expect(assertExternalHttpUrl('javascript:alert(1)')).rejects.toThrow(/protocol/);
  });

  it('rejects unparseable urls', async () => {
    await expect(assertExternalHttpUrl('not a url')).rejects.toThrow(/invalid URL/);
    await expect(assertExternalHttpUrl('')).rejects.toThrow(/invalid URL/);
  });
});

describe('assertExternalHttpUrl — private IPv4 ranges', () => {
  const urls = [
    'http://127.0.0.1/',
    'http://127.0.0.1:8080/admin',
    'http://10.0.0.5/',
    'http://10.255.255.255/',
    'http://172.16.0.1/',
    'http://172.31.255.254/',
    'http://192.168.1.1/',
    'http://169.254.169.254/latest/meta-data/',
    'http://100.64.0.1/',
    'http://0.0.0.0/',
    'http://224.0.0.1/',
    'http://240.0.0.1/',
    'http://192.0.0.1/',
    'http://198.18.0.1/',
    // DNS name that resolves (via public DNS) to a loopback address —
    // caught by the execution-time DNS verification.
    'http://127.0.0.1.nip.io/',
  ];

  it.each(urls)('rejects %s', async (url) => {
    await expect(assertExternalHttpUrl(url)).rejects.toThrow(/not allowed|blocked/);
  });
});

describe('assertExternalHttpUrl — IPv6 private/reserved', () => {
  const urls = [
    'http://[::1]/',
    'http://[::]/',
    'http://[fc00::1]/',
    'http://[fd12:3456::1]/',
    'http://[fe80::1]/',
    'http://[ff02::1]/',
    // v4-mapped/compatible forms of private IPv4s:
    'http://[::ffff:127.0.0.1]/',
    'http://[::ffff:10.0.0.5]/',
    'http://[::10.0.0.5]/',
    'http://[::ffff:0:192.168.0.5]/',
  ];

  it.each(urls)('rejects %s', async (url) => {
    await expect(assertExternalHttpUrl(url)).rejects.toThrow(/not allowed|blocked/);
  });
});

describe('assertExternalHttpUrl — internal hostnames', () => {
  const urls = [
    'http://localhost/',
    'http://localhost:5432/',
    'http://foo.localhost/x',
    'http://foo.local/x',
    'http://local/',
    'http://svc.internal:3000/x',
    'http://router.home.arpa/x',
    'http://nas.lan/x',
  ];

  it.each(urls)('rejects %s', async (url) => {
    await expect(assertExternalHttpUrl(url)).rejects.toThrow(/blocked/);
  });
});

describe('assertExternalHttpUrl — escape hatches (explicit, env-gated)', () => {
  it('allowlist bypasses exact origins only', async () => {
    process.env.AUTOMATION_URL_ALLOWLIST = 'https://hooks.example.com,http://10.0.0.5:8080';

    await expect(assertExternalHttpUrl('http://10.0.0.5:8080/x')).resolves.toBeUndefined();
    await expect(assertExternalHttpUrl('https://hooks.example.com/x')).resolves.toBeUndefined();

    // Same host, different port → not allowed.
    await expect(assertExternalHttpUrl('http://10.0.0.5:9090/x')).rejects.toThrow(/not allowed/);
    // Host not in the allowlist → normal public checks still apply.
    await expect(assertExternalHttpUrl('https://api.public.com/x')).resolves.toBeUndefined();
  });

  it('AUTOMATION_ALLOW_PRIVATE_IPS=true disables the private rejection', async () => {
    process.env.AUTOMATION_ALLOW_PRIVATE_IPS = 'true';

    await expect(assertExternalHttpUrl('http://169.254.169.254/latest/meta-data/')).resolves.toBeUndefined();
    await expect(assertExternalHttpUrl('http://localhost:5432/')).resolves.toBeUndefined();
  });
});

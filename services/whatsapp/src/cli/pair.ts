/**
 * WhatsApp pairing CLI — boots a real Baileys session and pairs via a
 * PAIRING CODE (no QR scan needed).
 *
 * Usage:
 *   pnpm --filter @opentelecrm/whatsapp pair -- --code <full-international-phone>
 *   e.g. pnpm --filter @opentelecrm/whatsapp pair -- --code 918465067156
 *
 * Session id used is "cli". Credentials persist to .data/baileys/cli.json via
 * the FileCredentialStore, so once paired the API/worker can reuse the session
 * without re-pairing.
 *
 * IMPORTANT: the pairing code is requested ONCE and kept stable. Do NOT
 * re-request it on reconnect — a fresh request invalidates the previous code,
 * and the user can't type it that fast. The code stays valid server-side for
 * ~1 minute after request; we just hold the socket and wait for 'ready'.
 */
import { BaileysWhatsAppProvider } from '../providers/baileys.provider.js';
import { ensureStoreDir, sessionFileFor } from '../providers/credential-store.js';
import { writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const LINK_TIMEOUT_MS = 180_000; // 3 min wait for the link after code shown
const SESSION_ID = 'cli';

function argValue(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main(): Promise<void> {
  const phone = argValue('--code') ?? process.env.WA_PAIR_PHONE;
  if (!phone) {
    console.error(
      'Usage: pnpm --filter @opentelecrm/whatsapp pair -- --code <full-international-phone>\n' +
        '  e.g. --code 918465067156   (no +, no spaces)',
    );
    process.exit(1);
  }

  ensureStoreDir();
  console.log('[pair] booting Baileys WhatsApp provider...');
  console.log(`[pair] session id: ${SESSION_ID} → creds file: ${sessionFileFor(SESSION_ID)}`);
  console.log(`[pair] pairing via code for phone: ${phone}`);
  const provider = new BaileysWhatsAppProvider();

  // No QR rendering in pairing-code mode.
  const unsubQr = provider.onQr(() => {});

  const showCode = (code: string): void => {
    const pretty = code.length === 8 ? `${code.slice(0, 4)}-${code.slice(4)}` : code;
    console.log('\n' + '='.repeat(60));
    console.log('   PAIRING CODE — enter this in WhatsApp on your phone:');
    console.log('   Settings > Linked devices > Link with phone number');
    console.log('='.repeat(60));
    console.log('');
    console.log(`        ${pretty}`);
    console.log('');
    console.log('='.repeat(60) + '\n');
    try {
      const txtPath = sessionFileFor(SESSION_ID).replace(/\.json$/, '-pairing-code.txt');
      writeFileSync(txtPath, `${pretty}\n`, { mode: 0o600 });
      console.log(`[pair] code also saved to: ${txtPath}`);
      spawnSync('notify-send', ['WhatsApp Pairing Code', pretty], { stdio: 'ignore', timeout: 3_000 });
    } catch {
      /* best-effort */
    }
  };

  // 1) Connect.
  const initial = await provider.connect(SESSION_ID);
  console.log(`[pair] connect → ${initial.status}`);

  // 2) Wait for the QR event — per Baileys docs, the pairing code must be
  //    requested only AFTER the socket enters registration mode (signalled by
  //    the QR event). Requesting it earlier hits the server at the wrong phase
  //    and the connection gets dropped.
  const qrReady = new Promise<void>((resolve) => {
    const unsub = provider.onQr(() => {
      unsub();
      resolve();
    });
    // socket may already be in registration mode with a QR emitted before we
    // subscribed — bail out after a short grace period if the QR never comes.
    setTimeout(() => {
      unsub();
      resolve();
    }, 15_000);
  });
  await qrReady;

  // 3) Request the pairing code ONCE. Retry the request itself a few times if
  //    the socket needs a moment, but never re-request after it succeeds.
  let pairingCode: string | null = null;
  for (let attempt = 0; attempt < 10 && !pairingCode; attempt++) {
    try {
      pairingCode = await provider.requestPairingCode(SESSION_ID, phone);
    } catch (err) {
      console.error(
        `[pair] code request failed (${attempt + 1}/10):`,
        err instanceof Error ? err.message : err,
      );
      await new Promise((r) => setTimeout(r, 3_000));
    }
  }
  if (!pairingCode) {
    console.error('[pair] could not obtain a pairing code — giving up');
    process.exit(1);
  }
  showCode(pairingCode);

  // 3) Hold and wait for the link. If the socket drops, the server-side
  //    pairing session dies with it — so on reconnect we must request a
  //    FRESH code (the old one is invalid). Loop until linked or deadline.
  const deadline = Date.now() + LINK_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const outcome = await new Promise<'ready' | 'down' | 'timeout'>((resolve) => {
      let done = false;
      const finish = (v: 'ready' | 'down' | 'timeout'): void => {
        if (!done) {
          done = true;
          resolve(v);
        }
      };
      const unsub = provider.on('status', (status) => {
        console.log(`[pair] status -> ${status}`);
        if (status === 'ready') finish('ready');
        else if (status === 'dead' || status === 'disconnected') finish('down');
      });
      // give the socket a moment to settle before declaring idle
      const timer = setTimeout(() => finish('timeout'), 20_000);
      provider.isOnline(SESSION_ID).then((ok) => {
        if (ok) finish('ready');
      });
      // cleanup not strictly needed — this promise resolves exactly once
      void unsub;
      void timer;
    });
    if (outcome === 'ready') {
      console.log('[pair] linked successfully ✔');
      break;
    }
    if (outcome === 'down') {
      console.log(`[pair] socket dropped — reconnecting and refreshing code (${Math.round((deadline - Date.now()) / 1000)}s left)`);
      try {
        await provider.connect(SESSION_ID);
      } catch (err) {
        console.error('[pair] reconnect failed:', err instanceof Error ? err.message : err);
        await new Promise((r) => setTimeout(r, 3_000));
        continue;
      }
      // Wait for registration mode again, then request a fresh code.
      const qrAgain = new Promise<void>((resolve) => {
        const unsub2 = provider.onQr(() => {
          unsub2();
          resolve();
        });
        setTimeout(() => {
          unsub2();
          resolve();
        }, 15_000);
      });
      await qrAgain;
      try {
        pairingCode = await provider.requestPairingCode(SESSION_ID, phone);
        showCode(pairingCode);
      } catch (err) {
        console.error('[pair] refresh code failed:', err instanceof Error ? err.message : err);
      }
    } else {
      console.log(`[pair] waiting for link... (${Math.round((deadline - Date.now()) / 1000)}s left)`);
      await new Promise((r) => setTimeout(r, 5_000));
    }
  }

  unsubQr();
  await provider.disconnect(SESSION_ID);
  console.log('[pair] done');
}

main().catch((err) => {
  console.error('[pair] failed:', err);
  process.exit(1);
});

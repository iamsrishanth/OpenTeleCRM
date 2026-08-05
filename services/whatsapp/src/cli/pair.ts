/**
 * WhatsApp pairing CLI — boots a real Baileys session and pairs the operator
 * number. Two modes:
 *
 *   PAIRING CODE (preferred): request an 8-char code, type it on the phone
 *     in WhatsApp > Settings > Linked devices > Link with phone number.
 *       pnpm --filter @opentelecrm/whatsapp pair -- --code 918465067156
 *
 *   QR (fallback): render a scannable QR in the terminal, scan it with
 *     WhatsApp > Settings > Linked devices > Link a device.
 *       pnpm --filter @opentelecrm/whatsapp pair -- --qr
 *       (or just omit --code)
 *
 * Session id is "cli". Credentials persist to .data/baileys/cli.json via the
 * FileCredentialStore, so once paired the API/worker reuses the session
 * without re-pairing (WHATSAPP_DRIVER=baileys + WHATSAPP_SESSION_ID=cli).
 *
 * IMPORTANT (code mode): request the code ONCE and keep it stable. A fresh
 * request invalidates the previous code. It stays valid ~60s after request;
 * the CLI holds the socket and waits for the link.
 */
import { BaileysWhatsAppProvider } from '../providers/baileys.provider.js';
import { ensureStoreDir, sessionFileFor } from '../providers/credential-store.js';
import { rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import qrcode from 'qrcode-terminal';

const LINK_TIMEOUT_MS = 180_000; // 3 min wait for the link
const SESSION_ID = 'cli';

function argValue(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

function showCode(code: string): void {
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
}

function showQr(qr: string): void {
  console.log('\n' + '='.repeat(60));
  console.log('   SCAN THIS QR — WhatsApp on your phone:');
  console.log('   Settings > Linked devices > Link a device');
  console.log('='.repeat(60) + '\n');
  try {
    qrcode.generate(qr, { small: true }, (out: string) => console.log(out));
  } catch (err) {
    console.error('[pair] could not render QR:', err);
  }
  console.log('='.repeat(60) + '\n');
}

async function main(): Promise<void> {
  const phone = argValue('--code') ?? process.env.WA_PAIR_PHONE;
  const qrMode = process.argv.includes('--qr') || !phone;

  if (!qrMode && !phone) {
    console.error(
      'Usage:\n' +
        '  pnpm --filter @opentelecrm/whatsapp pair -- --code <full-international-phone>\n' +
        '    e.g. --code 918465067156   (no +, no spaces)\n' +
        '  pnpm --filter @opentelecrm/whatsapp pair -- --qr        (QR fallback)',
    );
    process.exit(1);
  }

  ensureStoreDir();
  // --fresh: wipe a stale/half-registered session before pairing. A previous
  // attempt that got a device id but never completed (registered:false in the
  // creds) makes WhatsApp bounce every reconnect with stream error 515 —
  // start clean.
  if (process.argv.includes('--fresh')) {
    const sessionFile = sessionFileFor(SESSION_ID);
    rmSync(sessionFile, { force: true });
    rmSync(sessionFile.replace(/\.json$/, '-pairing-code.txt'), { force: true });
    console.log('[pair] --fresh: wiped stale session file');
  }
  console.log('[pair] booting Baileys WhatsApp provider...');
  console.log(`[pair] session id: ${SESSION_ID} → creds file: ${sessionFileFor(SESSION_ID)}`);
  if (qrMode) {
    console.log('[pair] QR mode — scan with WhatsApp > Linked devices > Link a device');
  } else {
    console.log(`[pair] pairing via code for phone: ${phone}`);
  }
  const provider = new BaileysWhatsAppProvider();

  // 1) Connect.
  const initial = await provider.connect(SESSION_ID);
  console.log(`[pair] connect → ${initial.status}`);

  if (qrMode) {
    // QR mode: render every QR rotation (Baileys rotates ~every 20s).
    provider.onQr((qr) => showQr(qr));
    // The socket may emit the QR before we subscribed — poll sessionStatus.
    const s = await provider.sessionStatus(SESSION_ID);
    if (s.qrCode) showQr(s.qrCode);
  } else {
    // Code mode: wait for the registration phase (signalled by the QR event)
    // before requesting the code — requesting earlier hits the wrong phase.
    const qrReady = new Promise<void>((resolve) => {
      const unsub = provider.onQr(() => {
        unsub();
        resolve();
      });
      setTimeout(() => {
        unsub();
        resolve();
      }, 15_000);
    });
    await qrReady;

    // Request the code ONCE (retry the request itself, never re-request after
    // it succeeds).
    let pairingCode: string | null = null;
    for (let attempt = 0; attempt < 10 && !pairingCode; attempt++) {
      try {
        pairingCode = await provider.requestPairingCode(SESSION_ID, phone!);
      } catch (err) {
        console.error(
          `[pair] code request failed (${attempt + 1}/10):`,
          err instanceof Error ? err.message : err,
        );
        await new Promise((r) => setTimeout(r, 3_000));
      }
    }
    if (!pairingCode) {
      console.error('[pair] could not obtain a pairing code — try QR mode (--qr)');
      process.exit(1);
    }
    showCode(pairingCode);
  }

  // 2) Hold and wait for the link. On socket drop, reconnect with the SAME
  //    provider (creds persist in memory + file) and keep waiting.
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
      const timer = setTimeout(() => finish('timeout'), 20_000);
      provider.isOnline(SESSION_ID).then((ok) => {
        if (ok) finish('ready');
      });
      void unsub;
      void timer;
    });
    if (outcome === 'ready') {
      console.log('[pair] linked successfully ✔');
      break;
    }
    if (outcome === 'down') {
      console.log(`[pair] socket dropped — reconnecting, still waiting (${Math.round((deadline - Date.now()) / 1000)}s left)`);
      try {
        await provider.connect(SESSION_ID);
      } catch (err) {
        console.error('[pair] reconnect failed:', err instanceof Error ? err.message : err);
      }
    } else {
      console.log(`[pair] waiting for link... (${Math.round((deadline - Date.now()) / 1000)}s left)`);
      await new Promise((r) => setTimeout(r, 5_000));
    }
  }

  await provider.disconnect(SESSION_ID);
  console.log('[pair] done');
}

main().catch((err) => {
  console.error('[pair] failed:', err);
  process.exit(1);
});

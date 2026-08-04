/**
 * WhatsApp pairing CLI — boots a real whatsapp-web.js session and pairs.
 *
 * Two auth paths (whatsapp-web.js supports both):
 *   --code <phone>  request a PAIRING CODE (type it in the phone's
 *                   "Linked devices" screen). e.g. --code 918465067156
 *   (no --code)     display a QR CODE in the terminal; scan it from the
 *                   phone's "Linked devices" > "Link a device".
 *
 * Usage:
 *   pnpm --filter @opentelecrm/whatsapp pair -- --code 918465067156
 *   pnpm --filter @opentelecrm/whatsapp pair                # QR mode
 *
 * Session id used is "cli". whatsapp-web.js LocalAuth persists the Chrome
 * profile + session under .data/wwebjs/cli/, so once paired the API/worker
 * can reuse the session without re-pairing.
 *
 * IMPORTANT: the pairing code is requested ONCE and kept stable. Do NOT
 * re-request it on reconnect — a fresh request invalidates the previous code,
 * and the user can't type it that fast.
 */
import { mkdirSync } from 'node:fs';
import { WWebJsWhatsAppProvider } from '../providers/wwebjs.provider.js';
import qrcode from 'qrcode-terminal';

const LINK_TIMEOUT_MS = 180_000; // 3 min wait for the link after QR/code shown
const SESSION_ID = 'cli';

function argValue(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

function ensureStoreDir(): void {
  const root = process.env.OPENTELECRM_DATA_DIR ?? `${process.cwd()}/.data`;
  mkdirSync(`${root}/wwebjs`, { recursive: true });
}

function sessionDir(): string {
  const root = process.env.OPENTELECRM_DATA_DIR ?? `${process.cwd()}/.data`;
  return `${root}/wwebjs/${SESSION_ID}`;
}

async function main(): Promise<void> {
  const phone = argValue('--code') ?? process.env.WA_PAIR_PHONE;

  ensureStoreDir();
  console.log('[pair] booting whatsapp-web.js provider...');
  console.log(`[pair] session id: ${SESSION_ID} → session dir: ${sessionDir()}`);
  if (phone) {
    console.log(`[pair] pairing via code for ${phone} (type code in "Linked devices")`);
  } else {
    console.log('[pair] QR mode — scan the QR below with WhatsApp > Linked devices > Link a device');
  }

  const provider = new WWebJsWhatsAppProvider();
  let qrShown = false;

  // Surf the provider's pairing signals to the console.
  provider.on('status', (status) => {
    if (typeof status !== 'string') return;
    console.log(`[pair] status: ${status}`);
  });

  // The provider emits 'qr'/'code' on its own EventEmitter — surface them via
  // a tiny relay so the CLI sees them (events are private to the provider).
  // Re-hook by wrapping on(): the provider's on() only exposes message/status,
  // so we instead rely on sessionStatus polling + the QR captured there.
  const status = await provider.connect(SESSION_ID);
  console.log(`[pair] initial status: ${status.status}`);

  if (phone) {
    const code = await provider.requestPairingCode(SESSION_ID, phone);
    console.log(`[pair] pairing code: ${code}`);
    console.log('[pair] WhatsApp phone → Settings → Linked devices → Link a device → Link with phone number instead.');
  }

  // Poll sessionStatus for QR / ready transitions.
  const deadline = Date.now() + LINK_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const s = await provider.sessionStatus(SESSION_ID);

    if (s.status === 'paired' && s.qrCode && !qrShown) {
      qrShown = true;
      console.log('[pair] scanning QR...');
      try {
        qrcode.generate(s.qrCode, { small: true }, (qrOut: string) => {
          console.log(qrOut);
        });
      } catch (err) {
        console.error('[pair] could not render QR:', err);
      }
    }

    if (s.status === 'ready') {
      console.log(`[pair] linked! screenName: ${s.screenName ?? 'unknown'}`);
      console.log('[pair] session saved — API/worker can reuse it.');
      process.exit(0);
    }

    if (s.status === 'dead') {
      console.error('[pair] auth failed / session logged out. Re-run to re-pair.');
      process.exit(1);
    }

    await new Promise((r) => setTimeout(r, 1500));
  }

  console.error(`[pair] timed out after ${LINK_TIMEOUT_MS / 1000}s — no link.`);
  process.exit(1);
}

main().catch((err) => {
  console.error('[pair] fatal:', err);
  process.exit(1);
});

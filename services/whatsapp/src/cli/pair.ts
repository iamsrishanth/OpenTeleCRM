/**
 * WhatsApp pairing CLI — boots a real Baileys session, prints the QR code to
 * the terminal, and exits once the phone has linked (status 'ready').
 *
 * Usage: pnpm --filter @opentelecrm/whatsapp pair
 *
 * Session id used is "cli"; credentials stay in-memory for v1.
 */
import { BaileysWhatsAppProvider } from '../providers/baileys.provider.js';

const PAIR_TIMEOUT_MS = 120_000;
const SESSION_ID = 'cli';

async function main(): Promise<void> {
  console.log('[pair] booting Baileys WhatsApp provider...');
  const provider = new BaileysWhatsAppProvider();

  let qrPrinted = false;
  const unsubQr = provider.onQr((qr) => {
    qrPrinted = true;
    console.log('\n' + '='.repeat(60));
    console.log('Scan this QR code in WhatsApp:  Settings > Linked devices');
    console.log('='.repeat(60) + '\n');
    console.log(qr);
    console.log('\n' + '='.repeat(60) + '\n');
  });

  const timeout = setTimeout(() => {
    console.error(`[pair] timed out after ${PAIR_TIMEOUT_MS / 1000}s — no link received`);
    process.exit(1);
  }, PAIR_TIMEOUT_MS);
  timeout.unref();

  const initial = await provider.connect(SESSION_ID);
  console.log(`[pair] initial status: ${initial.status}`);

  if (initial.qrCode && !qrPrinted) {
    console.log('\n' + '='.repeat(60));
    console.log('Scan this QR code in WhatsApp:  Settings > Linked devices');
    console.log('='.repeat(60) + '\n');
    console.log(initial.qrCode);
    console.log('\n' + '='.repeat(60) + '\n');
  }

  const done = new Promise<'ready' | 'disconnected' | 'dead'>((resolve) => {
    const unsub = provider.on('status', (status) => {
      console.log(`[pair] status -> ${status}`);
      if (status === 'ready' || status === 'disconnected' || status === 'dead') {
        unsub();
        resolve(status);
      }
    });
  });

  const finalStatus = await done;
  clearTimeout(timeout);
  unsubQr();

  if (finalStatus === 'ready') {
    console.log('[pair] linked successfully ✔');
  } else {
    console.error(`[pair] session ended: ${finalStatus}`);
    process.exitCode = 1;
  }

  await provider.disconnect(SESSION_ID);
  console.log('[pair] done');
}

main().catch((err) => {
  console.error('[pair] failed:', err);
  process.exit(1);
});

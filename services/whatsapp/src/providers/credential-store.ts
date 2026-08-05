/**
 * File-backed Baileys credential store.
 *
 * Persists creds + signal keys to a JSON file per agentSessionId so a paired
 * session survives restarts: the pairing CLI links once, the API/worker boots
 * later and reuses the saved session (no re-scan). Files live under the repo's
 * `.data/baileys/<agentSessionId>.json` (gitignored).
 *
 * Wire-up: pass { persist: fileCredentialStore } to the Baileys provider, or
 * rely on the provider default (this store).
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  BufferJSON,
  type AuthenticationCreds,
  type SignalDataSet,
} from '@whiskeysockets/baileys';

/**
 * Persistence seam. v1 ships the file-backed FileCredentialStore; later this
 * can write creds/keys to the wa_session table keyed by agentSessionId.
 */
export interface BaileysCredentialStore {
  loadCreds(agentSessionId: string): Promise<AuthenticationCreds | null>;
  saveCreds(agentSessionId: string, creds: AuthenticationCreds): Promise<void>;
  loadKeys(agentSessionId: string): Promise<SignalDataSet>;
  saveKeys(agentSessionId: string, data: SignalDataSet): Promise<void>;
}

const DATA_ROOT = process.env.OPENTELECRM_DATA_DIR ?? join(process.cwd(), '.data');
const BAKEYS_DIR = join(DATA_ROOT, 'baileys');

function sessionFile(agentSessionId: string): string {
  return join(BAKEYS_DIR, `${agentSessionId}.json`);
}

interface FilePayload {
  version: 1;
  creds?: AuthenticationCreds;
  keys?: SignalDataSet;
}

export class FileCredentialStore implements BaileysCredentialStore {
  private cache = new Map<string, FilePayload>();

  private load(agentSessionId: string): FilePayload {
    const cached = this.cache.get(agentSessionId);
    if (cached) return cached;
    try {
      const raw = readFileSync(sessionFile(agentSessionId), 'utf8');
      // BufferJSON reviver restores Uint8Array/Buffer fields (noise/identity
      // keys) that plain JSON.stringify mangles — without it Baileys' crypto
      // handshake fails with ERR_INVALID_ARG_TYPE on reconnect.
      const parsed = JSON.parse(raw, BufferJSON.reviver) as FilePayload;
      this.cache.set(agentSessionId, parsed);
      return parsed;
    } catch {
      const fresh: FilePayload = { version: 1 };
      this.cache.set(agentSessionId, fresh);
      return fresh;
    }
  }

  private flush(agentSessionId: string): void {
    const payload = this.cache.get(agentSessionId);
    if (!payload) return;
    mkdirSync(BAKEYS_DIR, { recursive: true });
    writeFileSync(
      sessionFile(agentSessionId),
      JSON.stringify(payload, BufferJSON.replacer, 2),
      { mode: 0o600 },
    );
  }

  async loadCreds(agentSessionId: string): Promise<AuthenticationCreds | null> {
    return this.load(agentSessionId).creds ?? null;
  }

  async saveCreds(agentSessionId: string, creds: AuthenticationCreds): Promise<void> {
    const payload = this.load(agentSessionId);
    payload.creds = creds;
    this.flush(agentSessionId);
  }

  async loadKeys(agentSessionId: string): Promise<SignalDataSet> {
    return this.load(agentSessionId).keys ?? {};
  }

  async saveKeys(agentSessionId: string, data: SignalDataSet): Promise<void> {
    const payload = this.load(agentSessionId);
    payload.keys = data;
    this.flush(agentSessionId);
  }
}

export function sessionFileFor(agentSessionId: string): string {
  return sessionFile(agentSessionId);
}

/** Ensure the store directory exists (idempotent). */
export function ensureStoreDir(): void {
  mkdirSync(BAKEYS_DIR, { recursive: true });
}

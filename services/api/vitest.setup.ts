/**
 * Vitest setup — load the repo-root .env so contract tests see the real
 * DATABASE_URL / DEV_JWT_SECRET. Tests run from the service cwd
 * (services/api), where no .env exists; without this they fall back to the
 * code-default connection string and fail DB auth after any password change.
 *
 * dotenv never overrides vars already in process.env, so vitest config `env`
 * (PORT, API_BASE_PATH) still wins.
 */
import { config } from 'dotenv';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

config({
  path: resolve(dirname(fileURLToPath(import.meta.url)), '../../.env'),
});

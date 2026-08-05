/**
 * Vitest setup — load the repo-root .env so contract tests see the real
 * DATABASE_URL (the MCP server reads the seeded demo DB through getPool).
 * See services/api/vitest.setup.ts for the rationale.
 */
import { config } from 'dotenv';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

config({
  path: resolve(dirname(fileURLToPath(import.meta.url)), '../../.env'),
});

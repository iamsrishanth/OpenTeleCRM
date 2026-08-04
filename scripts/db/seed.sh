#!/usr/bin/env bash
# Seed a demo workspace (idempotent, safe to re-run).
# Requires: DB migrated, services/api dep chain installed.
set -euo pipefail
cd "$(dirname "$0")/../.."
corepack enable >/dev/null 2>&1 || true
pnpm --filter @opentelecrm/db seed
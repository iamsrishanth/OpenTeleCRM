#!/usr/bin/env bash
# Dev launcher for the OpenTeleCRM API (native, no Docker).
# Sources .env (contains DATABASE_URL + DEV_JWT_SECRET) then boots tsx.
# Script lives at services/api/dev.sh → repo root is ../../ from here.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
cd "$REPO_ROOT"

export PATH="/home/sri/.hermes/profiles/main/home/.nvm/versions/node/v22.23.1/bin:$PATH"
set -a
source "$REPO_ROOT/.env"
set +a
export PORT="${PORT_OVERRIDE:-3005}"

node "$REPO_ROOT/node_modules/.pnpm/tsx@4.23.5/node_modules/tsx/dist/cli.mjs" --tsconfig "$REPO_ROOT/services/api/tsconfig.json" "$REPO_ROOT/services/api/src/main.ts"

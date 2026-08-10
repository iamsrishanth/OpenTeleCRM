#!/usr/bin/env bash
# OpenTeleCRM API launcher for macOS (launchd). Portable path resolution —
# no hardcoded /home/sri or /mnt/data paths (those are this workstation's).
# Equivalent of services/api/dev.sh but Homebrew/nvm-agnostic and no watch flag.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
cd "$REPO_ROOT"

# Resolve node: Homebrew first, then nvm, then PATH.
NODE_BIN=""
if command -v node >/dev/null 2>&1; then
  NODE_BIN="$(command -v node)"
elif [ -n "$(ls "$HOME"/.nvm/versions/node/*/bin/node 2>/dev/null | head -1)" ]; then
  NODE_BIN="$(ls "$HOME"/.nvm/versions/node/*/bin/node 2>/dev/null | head -1)"
else
  echo "ERROR: node not found (need Homebrew node or nvm)" >&2
  exit 1
fi
export PATH="$(dirname "$NODE_BIN"):$PATH"

# Source .env for DATABASE_URL + DEV_JWT_SECRET.
set -a
source "$REPO_ROOT/.env"
set +a
export PORT="${PORT_OVERRIDE:-3005}"

# tsx is not a direct dep of services/api — it lives in the pnpm store.
# Resolve it portably (same layout on Linux and macOS).
TSX_CLI="$(ls "$REPO_ROOT"/node_modules/.pnpm/tsx@*/node_modules/tsx/dist/cli.mjs 2>/dev/null | head -1)"
if [ -z "$TSX_CLI" ]; then
  echo "ERROR: tsx not found in pnpm store — run: pnpm install" >&2
  exit 1
fi

exec "$NODE_BIN" "$TSX_CLI" --tsconfig "$REPO_ROOT/services/api/tsconfig.json" "$REPO_ROOT/services/api/src/main.ts"

#!/usr/bin/env bash
# OpenTeleCRM Web UI launcher for macOS (launchd). Portable path resolution.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
cd "$REPO_ROOT/apps/web"

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

export PORT="${PORT_OVERRIDE:-3007}"

# next is a direct dep of apps/web — resolves via node_modules/.bin.
exec "$NODE_BIN" "$REPO_ROOT/apps/web/node_modules/next/dist/bin/next" dev -p "$PORT" -H 0.0.0.0

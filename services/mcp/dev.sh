#!/usr/bin/env bash
# Dev launcher for the OpenTeleCRM MCP server (native, no Docker).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
cd "$REPO_ROOT"

export PATH="/home/sri/.hermes/profiles/main/home/.nvm/versions/node/v22.23.1/bin:$PATH"
set -a
source "$REPO_ROOT/.env"
set +a
export MCP_PORT="${MCP_PORT:-3100}"
export MCP_ENTERPRISE_ID="${MCP_ENTERPRISE_ID:-a9e8933a-0a29-4e8b-8b2b-7fdfaf1b88d9}"

node "$REPO_ROOT/node_modules/.pnpm/tsx@4.23.5/node_modules/tsx/dist/cli.mjs" --tsconfig "$REPO_ROOT/services/mcp/tsconfig.json" "$REPO_ROOT/services/mcp/src/index.ts"

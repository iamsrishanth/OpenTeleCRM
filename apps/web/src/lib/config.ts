// Single source of truth for the OpenTeleCRM API base URL.
//
// Modes (NEXT_PUBLIC_API_ACCESS):
//   local  (default) → http://localhost:3005/autoupdate/v2
//   tunnel           → ${NEXT_PUBLIC_API_TUNNEL_BASE}/autoupdate/v2
//
// Tunnel mode is opt-in via `make tunnel`, which writes
// NEXT_PUBLIC_API_ACCESS=tunnel + NEXT_PUBLIC_API_TUNNEL_BASE to
// apps/web/.env.local (gitignored). The tunnel base is deliberately NOT
// hardcoded here — it is the operator's public hostname and must never be
// committed to the repository.

const ACCESS = process.env.NEXT_PUBLIC_API_ACCESS ?? 'local'
const TUNNEL_BASE = process.env.NEXT_PUBLIC_API_TUNNEL_BASE?.replace(/\/+$/, '')

const LOCAL_API_BASE = 'http://localhost:3005/autoupdate/v2'

export const API_BASE =
  ACCESS === 'tunnel' && TUNNEL_BASE
    ? `${TUNNEL_BASE}/autoupdate/v2`
    : LOCAL_API_BASE

/** Public inbound webhook root — the API server root (no /autoupdate/v2 prefix). */
export const PUBLIC_BASE = API_BASE.replace(/\/autoupdate\/v2\/?$/, '')

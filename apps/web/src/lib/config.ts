// Single source of truth for the OpenTeleCRM API base URL.
//
// Resolution (client-side, evaluated per request):
//   1. NEXT_PUBLIC_API_ACCESS=tunnel + NEXT_PUBLIC_API_TUNNEL_BASE → explicit
//      tunnel mode (used by `make tunnel`).
//   2. Default: derive from window.location so every surface self-selects
//      the API origin without any env toggle:
//        - hostname === crm.srishanth.com (or *.srishanth.com)
//            → https://api.srishanth.com/autoupdate/v2
//        - anything else (localhost, LAN IP, Tailnet IP/hostname)
//            → ${protocol}//${hostname}:3005/autoupdate/v2
//   3. SSR fallback (no window): env override, else http://localhost:3005.
//
// PUBLIC_BASE is the PUBLIC webhook delivery origin (server-side env driven —
// webhook URLs must be reachable by external callers, so it stays the tunnel
// origin, never the LAN/tailnet host).

const ACCESS = process.env.NEXT_PUBLIC_API_ACCESS ?? 'auto'
const TUNNEL_BASE = process.env.NEXT_PUBLIC_API_TUNNEL_BASE?.replace(/\/+$/, '')

const API_PORT = 3005
const PUBLIC_WEB_HOST = 'crm.srishanth.com'
const PUBLIC_API_HOST = 'api.srishanth.com'

function explicitTunnelBase(): string | null {
  if (ACCESS === 'tunnel' && TUNNEL_BASE) {
    return `${TUNNEL_BASE}/autoupdate/v2`
  }
  return null
}

function ssrBase(): string {
  return explicitTunnelBase() ?? `http://localhost:${API_PORT}/autoupdate/v2`
}

/** Runtime API base — call at request time from client code. SSR-safe. */
export function getApiBase(): string {
  const tunnel = explicitTunnelBase()
  if (tunnel) return tunnel
  if (typeof window === 'undefined') return ssrBase()

  const { protocol, hostname } = window.location
  if (hostname === PUBLIC_WEB_HOST || hostname.endsWith(`.${PUBLIC_WEB_HOST}`)) {
    return `https://${PUBLIC_API_HOST}/autoupdate/v2`
  }
  return `${protocol}//${hostname}:${API_PORT}/autoupdate/v2`
}

/** Public webhook delivery origin (tunnel hostname), server-component safe. */
export const PUBLIC_BASE = (
  process.env.PUBLIC_BASE_URL ?? `http://localhost:${API_PORT}`
).replace(/\/+$/, '')

/** Module-scope alias for imports that never run in the browser (webhooks page). */
export const API_BASE = getApiBase()

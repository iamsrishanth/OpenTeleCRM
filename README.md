# OpenTeleCRM

**1:1 FOSS clone of TeleCRM** — a telecalling-first sales CRM. Multi-tenant from line one, self-hosted natively (no Docker), PostgreSQL with RLS.

| Surface | Status | Details |
|---------|--------|---------|
| REST API | ✅ 103/103 tests | NestJS + Fastify, /autoupdate/v2, port 3005 |
| JSON-RPC MCP | ✅ 15/15 tests · 13 tools | Streamable HTTP, port 3100 (dev) |
| Web app | ✅ built | Next.js agent desk + admin console, port 3000 |
| WhatsApp | ✅ 22/22 tests · live | Standalone deploy-anywhere bridge (Baileys 7.x), port 3098 |
| Telephony | ✅ 11/11 + live ARI | Dialer + callbacks, live Asterisk ARI wiring (native build) |
| Automation | ✅ 103/103 incl. quota | Rules engine, scheduler, distribution, webhook, quota metering, sequences |
| Mobile app | ✅ M0–M5 shipped | Kotlin native (Compose), offline-first, F-Droid metadata |
| Bruno collection | ✅ 27 reqs, 26 assertions | TeleCRM wire-compatible |

---

## Quick start

```bash
make setup      # provision deps + install + db-init + db-migrate + db-seed
make dev        # API on :3005 (web desk: pnpm --filter @opentelecrm/web dev → :3000)
pnpm test       # 103 API + 15 MCP + 22 whatsapp + 11 telephony tests
```

Or step by step:

```bash
make provision         # system deps (Debian)
make install           # pnpm install
make db-init           # create DB + role
make db-migrate        # Drizzle migrations
make db-seed           # demo enterprise, 5000 leads, 3 users, 2 pipelines
```

### Bruno collection

```bash
cd collections/opentelecrm
bash ../../scripts/bruno-bootstrap-jwt.sh   # inject a dev JWT
npx @usebruno/cli run --env local -r .       # 27 requests, 26 assertions
```

---

## Tunnel mode (route API calls through a Cloudflare tunnel)

The web app can talk to the API through a Cloudflare tunnel instead of the
local `http://localhost:3005` origin. Both modes are configurable via env; the
tunnel hostname is set at runtime and never committed.

| Mode | What it does |
|------|--------------|
| `make tunnel` | Writes `apps/web/.env.local` (`NEXT_PUBLIC_API_ACCESS=tunnel` + the tunnel origin) and points `PUBLIC_BASE_URL` at the tunnel in the root `.env`. Restart the web dev server afterwards. |
| `make untunnel` | Removes `apps/web/.env.local` and restores the previous root `.env` (backed up as `.env.tunnel.bak` by `make tunnel`). |

**Setup (one-time, host-side):**

1. Add the Cloudflare values to your local `.env` (gitignored — never committed):
   - `TUNNEL_BASE_URL` — the tunnel origin, e.g. `https://crm.example.com` (no path)
   - `CLOUDFLARE_API_TOKEN` — API token with `DNS:Edit` + `Cloudflare Tunnel:Write` scope
   - `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_TUNNEL_ID`, `CLOUDFLARE_ZONE_ID` — from your Zero Trust dashboard (zone ID is auto-detected if left blank)
   - `CLOUDFLARE_TUNNEL_TOKEN` — optional; when set, `make tunnel` installs the cloudflared systemd connector with it
2. Run `make tunnel`. It calls the Cloudflare API with your token to ensure the DNS
   CNAME + tunnel ingress rule exist for your hostname (pointing at
   `http://127.0.0.1:3005`), then flips the web app into tunnel mode.
3. Restart the web dev server.

Both the token and the domain come from `.env` — the tunnel never ships with
code files, and `scripts/tunnel.py` contains no hostname, token, or account ID.

**Security notes (read before enabling):**

- While the tunnel is up, the API is reachable from the public internet. JWT /
  API-token auth is still enforced, but the dev-mode surface (dev JWT secret,
  mock drivers, rate limits) is exposed — never run the tunnel with production
  credentials.
- The tunnel origin and any Cloudflare credentials live ONLY in gitignored
  files (`.env`, `.env.local`, `/etc/cloudflared/token`). They
  must never be committed, and this README intentionally shows a placeholder
  hostname. `make tunnel` never prints or stores a token.
- When tunnel mode is on, `NEXT_PUBLIC_*` values are baked into the Next.js
  bundle at build time — do not run `next build` with tunnel mode active (the
  origin would be embedded in the production bundle). Dev mode only needs a
  dev-server restart.
- To expose the API to other clients (Bruno, scripts), paste the tunnel origin
  into their env config; never commit it.

---

## Architecture

A Turborepo monorepo (`pnpm`, `turbo run …`). ESM-only, Node ≥ 22.

```
opentelecrm/
├── services/
│   ├── api/              # NestJS REST API  (Fastify, :3005)
│   ├── mcp/              # JSON-RPC MCP     (:3100 dev)
│   ├── whatsapp/         # WhatsApp drivers (mock / wwebjs / baileys / bridge)
│   ├── whatsapp-bridge/  # STANDALONE deploy-anywhere bridge (Baileys 7.x, :3098)
│   ├── telephony/        # Dialer scoring + Asterisk ARI provider (live)
│   ├── ai/               # (empty scaffold — P7 AI & voice)
│   ├── analytics/        # (empty scaffold — P6 reports)
│   ├── automation/       # (empty scaffold — ADR-0007 Temporal worker home)
│   ├── ingest/           # (empty scaffold — P5 lead capture)
│   ├── notifier/         # (empty scaffold — notifications)
│   └── voice-agent/      # (empty scaffold — P7 voice)
├── packages/
│   ├── db/               # Drizzle schema, RLS, migrations, seed data
│   ├── contracts/        # Shared wire types (WhatsApp/Telephony/Automation)
│   ├── core-domain/      # Domain types mirroring TeleCRM's model
│   ├── rule-engine/      # Pure-TS automation evaluator
│   ├── connectors/       # (empty scaffold — P5 capture connectors)
│   ├── i18n/             # (empty scaffold)
│   ├── phone/            # (empty scaffold)
│   ├── sdk-ts/           # (empty scaffold)
│   ├── testing/          # (empty scaffold)
│   └── ui/               # (empty scaffold)
├── apps/
│   ├── web/              # Next.js agent desk (:3000)
│   ├── mobile/           # Kotlin native Android app (Compose, offline-first)
│   ├── docs/             # (empty scaffold — help center)
│   ├── extension/        # (empty scaffold — A1.4 click-to-call)
│   └── widget/           # (empty scaffold — A2.7 website widget)
├── infra/
│   ├── asterisk/         # Native Asterisk provision (source build on Debian 13)
│   ├── whatsapp-bridge/  # systemd unit for the standalone bridge
│   ├── ansible/          # (empty scaffold — fleet-grade path)
│   ├── helm/             # (empty scaffold)
│   ├── native/           # (empty scaffold — binary installers)
│   ├── observability/    # (empty scaffold — metrics/logs)
│   └── terraform/        # (empty scaffold)
├── collections/          # Bruno API test collection
├── fdroid/               # F-Droid metadata (com.opentelecrm.app)
├── docs/                 # ARCHITECTURE.md, PARITY.md, ROADMAP.md, ADRs, phase records
└── scripts/              # provision/, db/, tunnel, bruno helpers
```

### Live provider wiring (operator env)

- **WhatsApp** — `services/whatsapp-bridge` is a standalone Baileys 7.x bridge with
  its own HTTP API (`/health`, `/send`, `/messages`, `/typing`), own session
  (file-backed creds), own inbound queue. Deploy on any Linux host (Node 18+,
  native, no Docker): see `services/whatsapp-bridge/README.md`. The API's
  `bridge` driver (`WHATSAPP_DRIVER=bridge`, `WHATSAPP_BRIDGE_URL=…`) sends
  outbound + polls inbound for chat sync. Baileys 7.x pairs business/smba
  numbers that 6.x rejects (401). Direct in-process pairing is also supported
  (`pnpm --filter @opentelecrm/whatsapp pair -- --code <phone>`).
- **Asterisk** — Debian 13 ships no asterisk binary package, so the repo
  builds Asterisk 21 LTS from source (`infra/asterisk/provision/build-asterisk-source.sh`),
  configures ARI + Stasis, and the API places real calls
  (`POST /dialer/:leadId/dial` → ARI originate) with a Stasis event bridge
  updating call rows. A real SIP trunk is operator config (`TELEPHONY_ARI_TRUNK`).

### Auth flow

1. **Dev JWT** — HS256 signed with `DEV_JWT_SECRET`, used in local dev + Bruno
2. **API tokens** — `telekrm_async_` / `telekrm_sync_` tokens, stored as SHA-256 hash
3. **Enterprise-secret exchange** — `POST /auth/exchange` mints a sync token from the
   seeded demo secret (mobile onboarding path, migration 0007)
4. **OIDC** — Zitadel id-tokens (future)

All requests route through `AuthGuard` + RLS via `withTenant(eid)` — no row can leak across tenants.

### TeleCRM parity

| Area | Status |
|------|--------|
| Foundation (multi-tenant, RLS, seed data) | ✅ |
| Lead CRUD + search + upsert | ✅ |
| Action logging (note, call, WhatsApp) | ✅ |
| Async autoupdate + validation | ✅ |
| API token management | ✅ |
| Team member list | ✅ |
| Custom actions | ✅ |
| WhatsApp (send, conversations, templates, broadcasts, sequences) | ✅ — live outbound via standalone bridge |
| Telephony (calls, dialer, callbacks, recordings) | ✅ — live Asterisk ARI dialing |
| Automation (rules, schedule, distribution, webhook, quota) | ✅ |
| Web app | ✅ — full agent desk + admin console |
| Mobile app | ✅ — Kotlin native client (M0–M5) |
| Widget / extension / docs | 🚧 — empty scaffolds, not started |

Full detail: [docs/PARITY.md](./docs/PARITY.md) · Roadmap: [docs/ROADMAP.md](./docs/ROADMAP.md)

---

## Test surface

```bash
pnpm test              # all workspace tests (103 API + 15 MCP + 22 whatsapp + 11 telephony)
cd services/api && npx vitest run --config vitest.contract.config.ts  # focused: 103 tests, 13 files
make typecheck         # tsc --noEmit across all workspaces
pnpm lint              # Biome (services + packages; apps/web uses eslint)
```

Tests spin up the real API (dev JWT + seeded DB), hit `authGuard` + RLS — no mocking.

---

## Tech stack

- **Runtime** — Node.js ≥ 22, ESM
- **Package management** — pnpm + Turborepo
- **API** — NestJS 10 + Fastify adapter
- **DB** — PostgreSQL 16 (provisioner) / 17 (host), Drizzle ORM + Drizzle Kit, native RLS
- **Auth** — HS256 JWTs + SHA-256 API tokens + Zitadel OIDC (future)
- **Deps** — TypeScript 5.7, Biome, Vitest
- **WhatsApp** — standalone Baileys 7.x bridge (deploy-anywhere) + drivers
- **Telephony** — native Asterisk 21 LTS + ARI (source-built on Debian 13)
- **Mobile** — Kotlin 2.0, Compose, Room, WorkManager, UnifiedPush (see `apps/mobile/README.md`)
- **Infra** — Native Debian 13, systemd units, no Docker

---

## License

AGPL-3.0 — see [LICENSE](./LICENSE) and [docs/LICENSES.md](./docs/LICENSES.md).

This is not affiliated with TeleCRM. It is an independent, clean-room implementation of the documented API surface for self-hosted use.

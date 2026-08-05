# OpenTeleCRM

**1:1 FOSS clone of TeleCRM** — a telecalling-first sales CRM. Multi-tenant from line one, self-hosted natively (no Docker), PostgreSQL with RLS.

| Surface | Status | Details |
|---------|--------|---------|
| REST API | ✅ 97/97 tests | NestJS + Fastify, /autoupdate/v2, port 3005 |
| JSON-RPC MCP | ✅ 15/15 tests · 13 tools | Streamable HTTP, port 3100 (dev) |
| Web app | ✅ built | Next.js agent desk + admin console, port 3007 |
| WhatsApp | ✅ 22/22 tests · live | Standalone deploy-anywhere bridge (Baileys 7.x), port 3098 |
| Telephony | ✅ 11/11 + live ARI | Dialer + callbacks, live Asterisk ARI wiring (native build) |
| Automation | ✅ 97/97 incl. quota | Rules engine, scheduler, distribution, webhook, quota metering |
| Bruno collection | ✅ 27 reqs, 58 assertions | TeleCRM wire-compatible |

---

## Quick start

```bash
make setup      # provision deps + install + db-init + db-migrate + db-seed
make dev        # API on :3005 (web desk: pnpm --filter @opentelecrm/web dev → :3007)
pnpm test       # 97 API + 15 MCP + 22 whatsapp + 11 telephony tests
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
npx @usebruno/cli run --env local -r .       # 27 requests, 58 assertions
```

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
│   └── telephony/        # Dialer scoring + Asterisk ARI provider
├── packages/
│   ├── db/               # Drizzle schema, RLS, migrations, seed data
│   ├── contracts/        # Shared wire types (WhatsApp/Telephony/Automation)
│   └── rule-engine/      # Pure-TS automation evaluator
├── apps/
│   ├── web/              # Next.js agent desk (dashboard, leads, inbox, dialer,
│   │                     #   automations + visual builder, sequences, webhooks,
│   │                     #   broadcasts, templates, callbacks, settings)
│   ├── widget/           # Embeddable widget (placeholder)
│   ├── extension/        # Browser extension (placeholder)
│   └── mobile/           # Mobile app (placeholder — not started)
├── infra/
│   ├── asterisk/         # Native Asterisk provision (source build on Debian 13)
│   └── whatsapp-bridge/  # systemd unit for the standalone bridge
├── collections/          # Bruno API test collection
├── docs/                 # ARCHITECTURE.md, PARITY.md, ADRs, PLAN-P4.md
└── scripts/              # provision/, db/, bruno helpers
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
3. **OIDC** — Zitadel id-tokens (future)

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
| WhatsApp (send, conversations, templates, broadcasts) | ✅ — live outbound via standalone bridge |
| Telephony (calls, dialer, callbacks, recordings) | ✅ — live Asterisk ARI dialing |
| Automation (rules, schedule, distribution, webhook, quota) | ✅ |
| Web app | ✅ — full agent desk + admin console |
| Widget / extension / mobile | 🚧 — placeholders, not started |

Full detail: [docs/PARITY.md](./docs/PARITY.md)

---

## Test surface

```bash
pnpm test              # all workspace tests (97 API + 15 MCP + 22 whatsapp + 11 telephony)
cd services/api && npx vitest run --config vitest.contract.config.ts  # focused: 97 tests, 12 files
make typecheck         # tsc --noEmit across all workspaces
pnpm lint              # Biome
```

Tests spin up the real API (dev JWT + seeded DB), hit `authGuard` + RLS — no mocking.

---

## Tech stack

- **Runtime** — Node.js ≥ 22, ESM
- **Package management** — pnpm + Turborepo
- **API** — NestJS 10 + Fastify adapter
- **DB** — PostgreSQL 17, Drizzle ORM + Drizzle Kit, native RLS
- **Auth** — HS256 JWTs + SHA-256 API tokens + Zitadel OIDC (future)
- **Deps** — TypeScript 5.7, Biome, Vitest
- **WhatsApp** — standalone Baileys 7.x bridge (deploy-anywhere) + drivers
- **Telephony** — native Asterisk 21 LTS + ARI (source-built on Debian 13)
- **Infra** — Native Debian 13, systemd units, no Docker

---

## License

AGPL-3.0 — see [docs/LICENSES.md](./docs/LICENSES.md).

This is not affiliated with TeleCRM. It is an independent, clean-room implementation of the documented API surface for self-hosted use.

# OpenTeleCRM

**1:1 FOSS clone of TeleCRM** — a telecalling-first sales CRM. Multi-tenant from line one, self-hosted natively (no Docker), PostgreSQL with RLS.

| Surface | Status | Details |
|---------|--------|---------|
| REST API | ✅ 62/62 tests | NestJS + Fastify on port 3005 |
| JSON-RPC MCP | ✅ 13 tools | Streamable HTTP on port 3006 |
| Bruno collection | ✅ 27 reqs, 58 assertions | TeleCRM wire-compatible |
| WhatsApp | ✅ wwebjs driver | Pairing-code auth, templates, broadcasts |
| Telephony | ✅ Dialer + callbacks | OSS provider on Asterisk |

---

## Quick start

```bash
make setup      # provision deps + install + db-init + db-migrate + db-seed
pnpm dev        # API on :3005, MCP on :3006
pnpm test       # 62 contract tests, 7 suites
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

A Turborepo monorepo (`pnpm@9.15.4`, `turbo run …`). ESM-only, Node ≥ 22.

```
opentelecrm/
├── services/
│   ├── api/          # NestJS REST API  (Fastify, port 3005)
│   ├── mcp/          # JSON-RPC MCP     (Express, port 3006)
│   └── whatsapp/     # WhatsApp driver  (whatsapp-web.js, pairing-code)
├── packages/
│   └── db/           # Drizzle schema, RLS, migrations, seed data
├── apps/
│   ├── web/          # Next.js web app  (placeholder)
│   ├── widget/       # Embeddable widget(placeholder)
│   ├── extension/    # Browser extension(placeholder)
│   └── mobile/       # React Native app (placeholder)
├── collections/
│   └── opentelecrm/  # Bruno API test collection
├── docs/             # ARCHITECTURE.md, PARITY.md, ADRs
└── scripts/
    └── provision/    # Native Debian setup (no Docker)
```

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
| WhatsApp (conversations, send, templates) | ✅ |
| Telephony (calls, dialer, callbacks, recordings) | ✅ |
| Web app, widget, extension, mobile | 🚧 — API first, apps deferred |

Full detail: [docs/PARITY.md](./docs/PARITY.md)

---

## Test surface

```bash
pnpm test              # all workspace tests
cd services/api && npx vitest run  # focused: 62 tests, 7 files
make typecheck         # tsc --noEmit across all workspaces
pnpm lint              # Biome
```

Tests spin up the real API (dev JWT + seeded DB), hit `authGuard` + RLS — no mocking.

---

## Tech stack

- **Runtime** — Node.js ≥ 22, ESM
- **Package management** — pnpm + Turborepo
- **API** — NestJS 10 + Fastify adapter
- **DB** — PostgreSQL 16, Drizzle ORM + Drizzle Kit, native RLS
- **Auth** — HS256 JWTs + SHA-256 API tokens + Zitadel OIDC (future)
- **Deps** — TypeScript 5.7, Biome 1.9, Vitest
- **WhatsApp** — whatsapp-web.js (wwebjs), pairing-code auth
- **Infra** — Native Debian 13, systemd units, no Docker

---

## License

AGPL-3.0 — see [docs/LICENSES.md](./docs/LICENSES.md).

This is not affiliated with TeleCRM. It is an independent, clean-room implementation of the documented API surface for self-hosted use.
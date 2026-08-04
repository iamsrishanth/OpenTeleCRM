# OpenTeleCRM — Licenses

License posture for every component in the monorepo plus the planned self-host
stack. Column meanings:

- **SPDX license** — canonical identifier as declared by the project.
- **Copyleft class** — `permissive` (BSD/MIT/Apache), `weak` (LGPL/MPL/Eclipse),
  `strong` (GPL/AGPL), `non-commercial` (fair-code / source-available / model
  license with usage restriction).
- **Commercial self-host verdict** — is it safe to ship in a commercial,
  closed-source OpenTeleCRM deployment without obligation to open your code?
- **Risk note** — anything a legal review should look at first.

This file is a **technical inventory, not legal advice**. Version numbers are
the workspace ranges / declared versions from the five `package.json` files in
the repo at time of writing; they are `^`-ranges, so the lockfile
(`pnpm-lock.yaml`) pins the exact installed patch. Third-party infra components
are planned and not yet vendored; versions shown are target stable series and
must be re-verified on adoption.

---

## 1. First-party workspace packages

All open source at the top level, no bundled binary artifacts.

| Component | Version | SPDX license | Copyleft class | Commercial self-host verdict | Risk note |
|-----------|--------:|--------------|----------------|------------------------------|-----------|
| `opentelecrm` (root, private) | 0.1.0 | *(none declared — needs LICENSE)* | n/a | Safe once a license is declared | No top-level `LICENSE`/`package.json` `license` field in the root or workspace packages yet; add one (recommend MIT/Apache-2.0) before publishing |
| `@opentelecrm/core-domain` (private) | 0.1.0 | *(none declared)* | n/a | Safe once declared | Same as above |
| `@opentelecrm/db` (private) | 0.1.0 | *(none declared)* | n/a | Safe once declared | Same as above |
| `@opentelecrm/api` (private) | 0.1.0 | *(none declared)* | n/a | Safe once declared | Same as above |
| `@opentelecrm/mcp` (private) | 0.1.0 | *(none declared)* | n/a | Safe once declared | Same as above |

> Action item: add a `LICENSE` file and a `license` field to the root and every
> workspace `package.json`. The recommend default for OpenTeleCRM is MIT. Until
> that exists, the "release" it out-grows is technically unlicensed.

---

## 2. JS / TS runtime & tooling dependencies

Deduped union of `dependencies` + `devDependencies` across all five `package.json`
files. Verdict applies to OpenTeleCRM as a self-hosted commercial SaaS.)

| Component | Version (repo) | SPDX license | Copyleft class | Commercial self-host verdict | Risk note |
|-----------|--------------:|--------------|----------------|------------------------------|-----------|
| `@nestjs/common` | ^10.4.15 | MIT | permissive | ✅ | — |
| `@nestjs/core` | ^10.4.15 | MIT | permissive | ✅ | — |
| `@nestjs/platform-fastify` | ^10.4.15 | MIT | permissive | ✅ | — |
| `@modelcontextprotocol/sdk` | ^1.10.2 | MIT | permissive | ✅ | — |
| `drizzle-orm` | ^0.38.4 | Apache-2.0 | permissive | ✅ | — |
| `drizzle-kit` | ^0.30.2 | Apache-2.0 | permissive | ✅ | (dev-time only) |
| `pg` (node-postgres) | ^8.22.0 | MIT | permissive | ✅ | — |
| `postgres` (postgres.js) | ^3.4.5 | MIT | permissive | ✅ | — |
| `@types/pg` | ^8.20.3 | MIT | permissive | ✅ | (dev-time only) |
| `fastify` | ^5.2.0 | MIT | permissive | ✅ | — |
| `jsonwebtoken` | ^9.0.2 | MIT | permissive | ✅ | — |
| `@types/jsonwebtoken` | ^9.0.7 | MIT | permissive | ✅ | (dev-time only) |
| `zod` | ^3.24.1 | MIT | permissive | ✅ | — |
| `dotenv` | ^16.4.7 | BSD-2-Clause | permissive | ✅ | — |
| `reflect-metadata` | ^0.2.2 | Apache-2.0 | permissive | ✅ | — |
| `rxjs` | ^7.8.1 | Apache-2.0 | permissive | ✅ | — |
| `tsx` | ^4.19.2 | MIT | permissive | ✅ | — |
| `typescript` | ^5.7.3 | Apache-2.0 | permissive | ✅ | (dev-time only) |
| `turbo` | ^2.3.3 | MIT | permissive | ✅ | (dev-time only) |
| `@biomejs/biome` | ^1.9.4 | MIT | permissive | ✅ | (dev-time only) |
| `vitest` | ^2.1.8 | MIT | permissive | ✅ | (dev-time only) |
| `@types/node` | ^22.10.5 | MIT | permissive | ✅ | (dev-time only) |

**Verdict:** every committed JS dependency is permissive. OpenTeleCRM can run as
a closed-source commercial SaaS on today's dependency tree without copyleft
obligations. **No switch-outs required** on the JS side.

---

## 3. Planned native / self-host infrastructure

Target stack. `version` is the target stable series — **re-verify exact
releases and re-read `LICENSE` on adoption**; some projects change license terms
between major versions (Redis is the canonical example below).

| Component | Target version | SPDX license | Copyleft class | Commercial self-host verdict | Risk note |
|-----------|--------------:|--------------|----------------|------------------------------|-----------|
| **PostgreSQL** | 16 (→17) | PostgreSQL License | permissive | ✅ | Installed via `apt postgresql-16` today; the reference database. Cleanest license in the stack |
| **Valkey** | 8.x | BSD-3-Clause | permissive | ✅ | Recommended Redis replacement. Repo already plans `valkey-server` for prod (`debian.sh` comment) |
| **Redis** | **7.4+** | **RSALv2 / SSPLv1** | **strong (source-available)** | ⚠️ | **RISKY.** License change at 7.4 makes it non-OSI source-available; bundling/serving to third parties is tightly restricted. **Swap → Valkey (BSD-3)** for cache/pub-sub |
| **MinIO** | RELEASE series | AGPL-3.0 | strong | ⚠️ | **RISKY.** AGPL obligations reach any network users; hard to keep clean in a commercial multi-tenant SaaS. **Swap → SeaweedFS (Apache-2.0) or Garage (AGPL — see below)** depending on preference |
| **Garage** | 1.x | AGPL-3.0 | strong | ⚠️ | S3-compatible object store but AGPL; same class as MinIO. If object storage is needed and AGPL is unacceptable, pick **SeaweedFS (Apache-2.0)** instead |
| **Meilisearch** | 1.x | MIT | permissive | ✅ | Core engine MIT; self-host today. Watch for licensing changes on hosted features |
| **ClickHouse** | 24.x | Apache-2.0 | permissive | ✅ | Analytics store; server Apache-2.0 |
| **NATS** (nats-server) | 2.x | Apache-2.0 | permissive | ✅ | Service messaging |
| **Temporal** (server) | 1.x | MIT | permissive | ✅ | Workflow engine for async jobs / automation |
| **Zitadel** | 2.x | Apache-2.0 | permissive | ✅ | Future OIDC IdP + MCP OAuth2.1/DCR gateway |
| **OpenFGA** | 1.x | Apache-2.0 | permissive | ✅ | Fine-grained authZ over RBAC roles |
| **Caddy** | 2.x | Apache-2.0 | permissive | ✅ | TLS reverse proxy / load balancer |
| **Prometheus** | 2.x | Apache-2.0 | permissive | ✅ | Metrics |
| **Grafana** | 11.x | AGPL-3.0 | strong | ⚠️ | AGPL since v8. Self-host on your own infra is fine; a managed multi-tenant offering must keep it behind the reverse proxy / not expose the UI to end customers. Acceptable for internal ops dashboards |
| **Loki** | 3.x | AGPL-3.0 | strong | ⚠️ | Grafana Labs, AGPL like Grafana. Same caveat: internal logs, not an end-user surface. Alternative: **GlitchTip (BSD-3)** |
| **GlitchTip** | 17.x | BSD-3-Clause | permissive | ✅ | Error tracking; the BSD-3 alternative to Sentry's SSPL |
| **Uptime Kuma** | 1.x | MIT | permissive | ✅ | Status monitoring |
| **Baileys** | latest (6.x) | MIT | permissive | ✅ | WhatsApp library for the `whatsapp` service |
| **faster-whisper** | 1.x | MIT | permissive | ✅ | ASR / transcription for the `ai` service |
| **Piper** | 1.x | MIT | permissive | ✅ | TTS voice generation |
| **LiveKit** | 1.x | Apache-2.0 | permissive | ✅ | WebRTC voice/video if used |
| **Jitsi Meet** | stable | Apache-2.0 | permissive | ✅ | WebRTC alternative |
| **Hyperswitch** | latest | Apache-2.0 | permissive | ✅ | Payments router |

---

## 4. Risky components — must-swap / must-watch

These cannot ship as-is in a commercial closed-source OpenTeleCRM without
review. All five are called out for action.

| Component | License | Class | Why it's risky | Swap / mitigation |
|-----------|---------|-------|----------------|-------------------|
| **Redis ≥ 7.4** | RSALv2 / SSPLv1 | strong (non-OSI) | Restricts how you can offer Redis to third parties; ambiguous in hosted multi-tenant products | **Valkey 8 (BSD-3)**, already the prod plan. No code change if drivers are RESP-compatible |
| **MinIO** | AGPL-3.0 | strong | AGPL network clause reaches end users of the service | **SeaweedFS (Apache-2.0)** or accept AGPL for **Garage** — both S3-compatible |
| **Metabase** | AGPL-3.0 (EE is commercial) | strong / mixed | Starter is AGPL; EE features are commercial-licensed | License-only, AGPL exposure; use **Apache Superset (Apache-2.0)** or Grafana+ClickHouse dashboards as the BI layer |
| **n8n** | Sustainable Use License | non-commercial | Source-available, not OSI; explicitly restricts commercial multi-tenant use of the software itself | Not a hard dependency — drop it from the plan; build automation UI with **Temporal** (MIT) + an internal UI instead |
| **Coqui XTTS** | Coqui Public Model License (non-commercial) | non-commercial | Model weights are restricted to non-commercial use; cannot ship the XTTS model in a commercial product | **Piper (MIT)** for TTS in the `ai` service. (faster-whisper, the ASR half, is already MIT) |

**Bottom line:** the committed JS tree is 100 % permissive and safe. The planned
infra stack is largely permissive (Postgres, Valkey, ClickHouse, NATS, Temporal,
Zitadel, OpenFGA, Caddy, Prometheus, Meilisearch, GlitchTip, Uptime Kuma,
Baileys, faster-whisper, Piper, LiveKit, Jitsi, Hyperswitch). The places to act
before launch:

1. **Swap**: Redis 7.4+ → Valkey; pick SeaweedFS over MinIO (or accept Garage's
   AGPL); use GlitchTip or Superset instead of Metabase; drop n8n → Temporal;
   use Piper instead of Coqui XTTS.
2. **Constrain**: Grafana (AGPL) and Loki (AGPL) are fine for internal
   ops/telemetry surfaces but must not be exposed to end customers as a
   managed feature.
3. **Declare**: add a `LICENSE` + `license` field to the root and all workspace
   `package.json` files (recommend MIT).
4. **Re-verify on adoption**: infra target versions are series-level; re-read
   each project's `LICENSE` when pinning exact releases.
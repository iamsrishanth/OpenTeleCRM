# OpenTeleCRM — Architectural Decision Records

Index and ADR log for the OpenTeleCRM monorepo (1:1 FOSS clone of TeleCRM, telecalling-first sales CRM).

- **Format:** MADR-style (Status / Context / Decision / Alternatives / Consequences).
- **Grounding:** ADRs cite the files that implement them. Where a decision is not yet implemented, the ADR says so explicitly and records the intended path.
- **Overrides:** User directives outrank the original spec. The most consequential override is **ADR-0001 (no Docker)** — the spec originally demanded `docker compose`; it was replaced by native install (`scripts/provision` + systemd).
- **License posture:** OpenTeleCRM is FOSS. Anything AGPL/BSL/other-copyleft-leaky is rejected by default (see ADR-0009, ADR-0010, ADR-0020, ADR-0021, ADR-0022, and RISKS.md).

| ADR | Title | Status |
|-----|-------|--------|
| [ADR-0001](#adr-0001-native-install-no-docker) | Native install, no Docker | Accepted (user directive) |
| [ADR-0002](#adr-0002-monorepo-pnpm--turborepo) | Monorepo: pnpm + Turborepo | Accepted |
| [ADR-0003](#adr-0003-api-nestjs-10-on-fastify) | API: NestJS 10 on Fastify | Accepted (implemented) |
| [ADR-0004](#adr-0004-database-drizzle--postgresql-1617--pgvector) | Database: Drizzle + PostgreSQL 16/17 + pgvector | Accepted (implemented) |
| [ADR-0005](#adr-0005-analytics-clickhouse) | Analytics: ClickHouse | Accepted (planned) |
| [ADR-0006](#adr-0006-queue--cache-valkey--bullmq) | Queue & cache: Valkey + BullMQ | Accepted (planned) |
| [ADR-0007](#adr-0007-automations-temporal-oss) | Automations: Temporal OSS | Accepted (planned) |
| [ADR-0008](#adr-0008-events-nats-jetstream) | Events: NATS JetStream | Accepted (planned) |
| [ADR-0009](#adr-0009-search-meilisearch) | Search: Meilisearch | Accepted (planned) |
| [ADR-0010](#adr-0010-object-storage-garage--seaweedfs-not-minio) | Object storage: Garage/SeaweedFS (MinIO AGPL not default) | Accepted (planned) |
| [ADR-0011](#adr-0011-identity-zitadel-oidc--oauth-21--pkce--dcr) | Identity: Zitadel OIDC (OAuth 2.1 + PKCE + DCR) | Accepted (partial: guard wired) |
| [ADR-0012](#adr-0012-authorization-openfga--postgres-rls) | Authorization: OpenFGA + Postgres RLS | Accepted (RLS implemented) |
| [ADR-0013](#adr-0013-reverse-proxy-caddy) | Reverse proxy: Caddy | Accepted (planned) |
| [ADR-0014](#adr-0014-feature-flags-unleash-all-on-by-default) | Feature flags: Unleash, all-on by default | Accepted (planned) |
| [ADR-0015](#adr-0015-whatsapp-whatsapp-webjs--cloud-api-driver) | WhatsApp: whatsapp-web.js + Cloud API driver | Accepted (planned) |
| [ADR-0016](#adr-0016-speech-to-text-faster-whisper--pyannote) | Speech-to-text: faster-whisper + pyannote | Accepted (planned) |
| [ADR-0017](#adr-0017-voice-agent-livekit) | Voice agent: LiveKit | Accepted (planned) |
| [ADR-0018](#adr-0018-text-to-speech-piper--coqui-xtts-opt-in) | Text-to-speech: Piper (Coqui XTTS opt-in) | Accepted (planned) |
| [ADR-0019](#adr-0019-workflow-builder-react-flow) | Workflow builder: React Flow | Accepted (planned) |
| [ADR-0020](#adr-0020-etl-node-red-optional-n8n-excluded) | ETL: Node-RED optional (n8n excluded) | Accepted (planned) |
| [ADR-0021](#adr-0021-bi-echarts-metabase-excluded) | BI: ECharts (Metabase excluded) | Accepted (planned) |
| [ADR-0022](#adr-0022-payments-hyperswitch) | Payments: Hyperswitch | Accepted (planned) |
| [ADR-0023](#adr-0023-web-nextjs-15--react-19--shadcnui) | Web: Next.js 16 + React 19 + shadcn/ui | Accepted (planned) |
| [ADR-0024](#adr-0024-mobile-react-native--watermelondb--ntfy) | Mobile: React Native + WatermelonDB + ntfy | Accepted (planned) |
| [ADR-0025](#adr-0025-dev-auth-dev-jwt-secret--zitadel-in-prod) | Dev auth: `DEV_JWT_SECRET`, Zitadel in prod | Accepted (implemented) |
| [ADR-0026](#adr-0026-telephony-asterisk--ari) | Telephony: Asterisk + ARI (chan_pjsip, Stasis `opentelecrm`) | Accepted (partial: provider scaffold + PBX config) |
| [ADR-0027](#adr-0027-dialer-queue-scoring-pure-function) | Dialer queue scoring: pure function, weights documented | Accepted (implemented) |
| [ADR-0028](#adr-0028-call-recording-storage-object-storage--signed-urls) | Call recording storage: object storage + signed URLs | Accepted (partial: metadata + signed URLs) |
| [ADR-0029](#adr-0029-trai-calling-window-0900-2100) | TRAI calling window: 09:00–21:00, enforced in dialer | Accepted (implemented) |

---

## ADR-0001: Native install, no Docker

**Status:** Accepted — user directive, overrides spec.

**Context:** The original spec demanded a `docker compose` topology. The user hard directive: **no Docker anywhere** in OpenTeleCRM — no compose files, no images, no containers in the dev or prod path. The repo ships no `compose.yml`, `Dockerfile`, or `docker-compose.*` anywhere.

**Decision:** All components install natively on the host:

- System packages: `scripts/provision/debian.sh` (PostgreSQL 16, Valkey drop-in `redis-server` for dev, build-essential, python3, ffmpeg; optional Asterisk behind `WITH_TELEPHONY=1`).
- Pure-binary components (Meilisearch, Temporal, etc.): installed by their own scripts under `infra/native/` when enabled.
- Database bootstrap: `scripts/db/init.sh` (idempotent role + database + extensions).
- Process supervision: systemd units (`opentelecrm-*`), surfaced by `make status` (`systemctl --user list-units 'opentelecrm-*'`).
- Single-command setup: `make setup` → `provision install db-init db-migrate db-seed`.
- Ansible/Terraform/Helm directories exist under `infra/` for future fleet provisioning but remain **native-host** (no containers).

**Alternatives:** docker compose (spec original, rejected by directive); podman (still container model, rejected); full VM-per-service (too heavy for target 8vCPU air-gapped host).

**Consequences:**

- + No Docker dependency, no image supply-chain surface, works on constrained/air-gapped hosts.
- + `make setup` brings a machine to a seeded, running state in one command.
- − Version pinning is per-OS-package (apt versions for PG/Valkey); component binaries must be pinned in `infra/native/` scripts.
- − Hosts must be provisioned per-OS; Debian/Ubuntu is the supported baseline (documented in `scripts/provision/debian.sh`).
- − All future infra ADRs must default to native install; any new component needs a provision/install path, not a container.

---

## ADR-0002: Monorepo: pnpm + Turborepo

**Status:** Accepted (implemented).

**Context:** OpenTeleCRM spans API, MCP server, DB layer, web, mobile, widget, extension, plus 10 service scaffolds and 10 packages. Shared code (schema, RLS, domain types) must be versioned together with consumers; a polyrepo would drift.

**Decision:** Single monorepo managed by **pnpm 9.15.4** (workspaces: `apps/*`, `services/*`, `packages/*`; `packageManager: pnpm@9.15.4`, `engines.node >= 22`) with **Turborepo 2.x** (`turbo.json` tasks: build, typecheck, lint, test, dev with caching; `dev` is `persistent: true`, cache disabled). Cross-workspace deps are `workspace:*` (e.g. `@opentelecrm/db` from `@opentelecrm/api` and `@opentelecrm/mcp`). Root scripts: `pnpm build|dev|typecheck|lint|test|format`; Biome for lint/format; commitlint + husky for commits; renovate for dependency updates.

**Alternatives:** npm workspaces + Nx (heavier, more config); Bazel (overkill); polyrepo (rejected — schema/RLS drift).

**Consequences:**

- + One `pnpm install`; Turbo task graph orders `^build` deps correctly (`packages/db` builds before `services/api`).
- + `pnpm --filter @opentelecrm/db migrate|seed` targets the DB package directly (see Makefile).
- − pnpm strictness (no phantom deps) is a recurring friction point for new services.
- − Turbo remote caching not configured; local cache only.

---

## ADR-0003: API: NestJS 10 on Fastify

**Status:** Accepted (implemented).

**Context:** The sync API must expose TeleCRM-parity endpoints under a fixed base path (`/autoupdate/v2`) at high throughput (telecalling-first workloads, many concurrent agent calls). Express was the historical NestJS default.

**Decision:** NestJS 10 (`@nestjs/common|core|platform-fastify ^10.4.15`) on **Fastify 5** (`@nestjs/platform-fastify`, `fastify ^5.2.0`), mounted via `NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter(...))` with global prefix `API_BASE_PATH ?? '/autoupdate/v2'` (health excluded). ESM (`"type": "module"`), tsx for dev, tsc build, vitest for unit + contract tests. See `services/api/src/main.ts`.

**Alternatives:** NestJS+Express (slower, bigger default surface); raw Fastify (no DI/module structure); Hono/Fastify standalone (would forfeit NestJS ecosystem parity tooling).

**Consequences:**

- + Fastify throughput and low overhead; request-scoped tenant transactions fit Fastify's lifecycle.
- + NestJS guards/interceptors map cleanly onto TeleCRM auth semantics (global `APP_GUARD`, see ADR-0025).
- − Fastify adapter differences vs Express middleware (e.g. no express-style body parsers) — must be respected in future middleware.
- − ESM + tsx quirks documented in `auth.module.ts` (Reflector instantiation workaround).

---

## ADR-0004: Database: Drizzle + PostgreSQL 16/17 + pgvector

**Status:** Accepted (implemented).

**Context:** Multi-tenant CRM data model (enterprise_id on every table), JSONB custom fields, full-text + trigram search, vector embeddings for AI features, RLS as the tenant-isolation backbone. TypeScript monorepo wants typed SQL.

**Decision:** **PostgreSQL 16** (provisioned by `scripts/provision/debian.sh`; 17 supported — same extensions) with extensions `uuid-ossp`, `pgcrypto`, `pg_trgm`, `vector` (pgvector) created by `scripts/db/init.sh`. **Drizzle ORM** (`drizzle-orm ^0.38.4` + `drizzle-kit`) for schema, migrations (`packages/db/drizzle/0000_peaceful_speedball.sql`), and a hand-rolled RLS layer (`packages/db/src/rls.ts`: `ALTER TABLE ... ENABLE/FORCE ROW LEVEL SECURITY` + single `enterprise_isolation` policy reading `app.enterprise_id` session var; `withTenant()` wraps every request-scoped query). Seed: 1 enterprise, 3 users, 2 pipelines, 20 custom fields, 5,000 leads (`packages/db/src/seed.ts`).

**Alternatives:** Prisma (no RLS ergonomics, migration lock-in); raw pg (no schema typing); MySQL (no pgvector, weaker JSONB/RLS); MongoDB (no joins/RLS for tenancy).

**Consequences:**

- + Typed schema shared via `@opentelecrm/db` workspace package; RLS is defense-in-depth: a missing tenant var yields zero rows, by construction.
- + `FORCE ROW LEVEL SECURITY` means even the owner role obeys the policy — the API role is deliberately not a superuser.
- − Drizzle migration diffs must be reviewed manually (snapshot JSON churn).
- − pgvector tuning (HNSW params) deferred to when embedding features land; `pg_trgm` covers current search needs (see ADR-0009).

---

## ADR-0005: Analytics: ClickHouse

**Status:** Accepted (planned).

**Context:** Telecalling generates high-volume event streams: call records, action logs, conversation transcripts, agent performance metrics. Postgres is the system of record but not an analytics warehouse; running big aggregations there degrades CRM latency.

**Decision:** **ClickHouse** as the analytics store, fed from the event pipeline (see ADR-0008), serving the BI layer (ADR-0021). Operational tables stay in Postgres; analytical materializations (funnel, agent KPIs, call-volume histograms) live in ClickHouse. Apache-2.0 licensed — compatible with the FOSS posture.

**Alternatives:** TimescaleDB (Postgres extension — fine, but couples warehouse to OLTP instance); DuckDB (embedded, wrong for concurrent multi-tenant serving); Elasticsearch aggregations (wrong tool); **Metabase** (rejected separately, ADR-0021).

**Consequences:**

- + Columnar speed for BI and per-enterprise analytics; cheap to keep hot data.
- − Second datastore to provision natively (systemd, `infra/native/`), back up, and secure — RLS does not extend to it; enterprise scoping must be re-applied at query layer.
- − ETL lag: analytics are near-real-time, not synchronous with writes.

---

## ADR-0006: Queue & cache: Valkey + BullMQ

**Status:** Accepted (planned).

**Context:** Async API rate limiting (`ASYNC_RATE_LIMIT_PER_HOUR`), BullMQ job queues (imports, exports, WhatsApp send batches, transcript jobs), and shared caching need a Redis-protocol datastore.

**Decision:** **Valkey** (Linux Foundation fork) as the Redis-protocol server, with **BullMQ** for job queues. Explicitly **not Redis ≥ 7.4**: Redis relicensed to RSALv2/SSPLv1 (source-available, not OSI open source) — incompatible with a FOSS distribution. Dev provisioner already installs `redis-server` as a Valkey drop-in (`scripts/provision/debian.sh`); prod targets `valkey-server` via `infra/native/`.

**Alternatives:** Redis 7.4+ (RSALv2 — excluded); KeyDB (less maintained); Dragonfly (BSL-3.0 — excluded); in-process queues (lost on restart, no visibility).

**Consequences:**

- + Fully open license; drop-in protocol compatibility; BullMQ ecosystem works unchanged.
- + Rate-limit counters + queue broker in one daemon, matching the existing `.env` contract.
- − Valkey version skew vs upstream Redis tooling — pin versions in `infra/native/`.
- − BullMQ job persistence depends on Valkey durability config (AOF) — must be set in systemd unit.

---

## ADR-0007: Automations: Temporal OSS

**Status:** Accepted (planned).

**Context:** TeleCRM automations (call cadences, follow-up sequences, drip campaigns, reminder chains) are long-running, stateful, and must survive process restarts. Cron alone cannot express "call back in 2h unless lead moved stage."

**Decision:** **Temporal OSS** (MIT-licensed server) for durable workflow execution, replacing hand-rolled schedulers. Workflows live in `services/automation`. Provisioned as a native binary per `infra/native/` convention (ADR-0001).

**Alternatives:** BullMQ repeatable jobs (stateless, no saga/compensation model); Airflow (batch-oriented, heavy); n8n (excluded, ADR-0020); custom state machine in Postgres (re-inventing Temporal badly).

**Consequences:**

- + Durable execution: workflows survive crashes; visibility into stuck runs.
- − New runtime to operate (temporal server + UI, systemd units); workflow code is versioned and must be deterministic.
- − RLS doesn't apply inside workflows — every workflow step must carry its enterprise context explicitly.

---

## ADR-0008: Events: NATS JetStream

**Status:** Accepted (planned).

**Context:** Services must react to domain events (lead.created, call.completed, transcript.ready) without direct coupling: ingest → analytics (ADR-0005), whatsapp → notifier, api → automation triggers.

**Decision:** **NATS JetStream** (Apache-2.0) as the event backbone: at-least-once delivery, per-enterprise subject namespaces (`opentelecrm.{enterpriseId}.{entity}.{event}`), stream retention for replay. Serves `services/ingest` and `services/notifier`.

**Alternatives:** Kafka (heavyweight ops for an 8vCPU air-gapped box); RabbitMQ (AMQP complexity, weaker stream semantics); Postgres LISTEN/NOTIFY (no replay, no retention, per-connection limits).

**Consequences:**

- + Lightweight single-binary native install; JetStream gives replay + retention without Kafka's ZooKeeper-era ops burden.
- − No cross-partition ordering guarantees — event consumers must be idempotent (enterprise_id + event id dedupe).
- − New moving part for air-gapped deploy; NATS auth (NKEY/JWT) must be configured per service.

---

## ADR-0009: Search: Meilisearch

**Status:** Accepted (planned).

**Context:** Lead search across identifier, name, custom fields, and tags must be fast and typo-tolerant at enterprise scale. Postgres `pg_trgm` covers prefix/substring needs for now but not fuzzy relevance ranking.

**Decision:** **Meilisearch** (MIT) as the dedicated search engine, indexed from Postgres via CDC-ish jobs (`services/ingest`), scoped per enterprise (tenant-aware index filtering). Native binary install per ADR-0001 (`infra/native/`). Remains optional: `pg_trgm` indexes in `scripts/db/init.sh` are the fallback when Meilisearch is disabled.

**Alternatives:** Elasticsearch/OpenSearch (Apache-2.0 but JVM + ops weight — overkill for this host profile); Typesense (GPL-3.0 — problematic for a FOSS-embedding distribution); Postgres full-text only (no typo tolerance/fuzzy ranking).

**Consequences:**

- + Instant typo-tolerant search; tiny footprint; simple REST API.
- − Index lag behind writes (near-real-time, not transactional) — acceptable for search UX.
- − RLS not enforced by Meilisearch: API must filter results by enterprise_id server-side, never trust client filters.

---

## ADR-0010: Object storage: Garage/SeaweedFS (MinIO AGPL not default)

**Status:** Accepted (planned).

**Context:** Call recordings, transcript artifacts, exported files, avatar media need S3-compatible object storage. MinIO is the obvious default but is AGPL-3.0 — an AGPL network-service dependency contaminates a FOSS distribution (see RISKS.md).

**Decision:** **Garage** (AGPL-3.0 **but** with a linking exception for the S3 API client boundary — acceptable) or **SeaweedFS** (Apache-2.0) as the default object store. **MinIO is explicitly NOT the default**; it is only permitted as a user-chosen alternative for non-distributed single-node deployments where the operator accepts AGPL, and never linked into OpenTeleCRM code — accessed via S3 API only. Provisioning via `infra/native/`.

**Alternatives:** MinIO (AGPL-3.0 — rejected as default); Ceph RGW (heavy); local filesystem (no S3 API for future horizontal scaling).

**Consequences:**

- + FOSS-safe default; S3 API keeps the storage backend swappable per operator preference.
- + SeaweedFS/Garage single-binary native install fits the no-Docker directive.
- − Smaller ecosystems than MinIO; some S3 edge features (bucket policies, replication) differ — pin behavior in a thin storage adapter.
- − Any future MinIO adoption must be documented as operator's own AGPL exposure, not OpenTeleCRM's.

---

## ADR-0011: Identity: Zitadel OIDC (OAuth 2.1 + PKCE + DCR)

**Status:** Accepted (partial — guard wired, IdP not yet provisioned).

**Context:** OpenTeleCRM needs an IdP for human users (web/mobile agents, admins) and for machine clients — notably MCP clients needing OAuth 2.1 + PKCE + Dynamic Client Registration (DCR) per the MCP spec. Self-hosting must work air-gapped with no external SaaS.

**Decision:** **Zitadel** (Apache-2.0) as the OIDC provider:

- Human + machine clients, OAuth 2.1 flows, PKCE enforced, DCR enabled for MCP clients (the MCP gateway lands in the auth phase; the tool surface is transport-agnostic — see `services/mcp/src/index.ts`).
- API validates OIDC id-tokens (`ZITADEL_ISSUER` + `AUTH_JWT_AUDIENCE`), carrying `enterpriseId` in claims (see ADR-0025 and `auth.guard.ts`).
- Provisioned natively (Zitadel ships as a single binary + Postgres) per ADR-0001.

**Alternatives:** Keycloak (larger, older; works but heavier and its admin model is clunkier); Authentik (GPL-3.0); Auth0/Okta SaaS (excluded — air-gap requirement); roll-your-own JWT (rejected — see ADR-0025).

**Consequences:**

- + One IdP covers humans, API tokens, and MCP DCR; multi-tenant org model maps to enterprise.
- − Zitadel is a significant operational component (its own Postgres schema, TLS, backups) — new systemd unit + docs burden.
- − OIDC in `auth.guard.ts` currently decodes without signature verification (dev shim) — **must** be upgraded to JWKS verification when Zitadel is provisioned (tracked in ADR-0025 consequences).

---

## ADR-0012: Authorization: OpenFGA + Postgres RLS

**Status:** Accepted (RLS implemented; OpenFGA planned).

**Context:** Two authorization layers are needed: (1) **row-level tenant isolation** — absolute, by construction, at the database; (2) **relationship-level authorization** — role permissions (owner/admin/manager/team_lead/agent/read_only/custom), team-member scoping, lead ownership, pipeline visibility.

**Decision:**

- **Postgres RLS is the mandatory isolation floor**: every tenanted table (11 today, `TENANT_TABLES` in `packages/db/src/schema.ts`) has `ENABLE` + `FORCE ROW LEVEL SECURITY` and a single `enterprise_isolation` policy keyed on the `app.enterprise_id` session variable set per-request by `withTenant()` (`packages/db/src/rls.ts`). No query reaches the DB without tenant context.
- **OpenFGA** (Apache-2.0, Zanzibar-style) for fine-grained relationship checks (role→permission, user→lead, user→pipeline), called by the API after RLS passes. Role kinds already exist in schema (`role.kind`, `role.permissions` JSONB) as the bootstrap until OpenFGA ships.

**Alternatives:** RLS-only (fine for tenancy, clumsy for cross-object relationships); application-layer checks only (leak-prone); Casbin (in-process, no relationship graph); Auth0 FGA (SaaS — excluded).

**Consequences:**

- + Defense in depth: even a buggy OpenFGA query or a leaked API token cannot cross enterprise boundaries — RLS returns zero rows.
- + OpenFGA model (enterprise/user/lead relations) is declarative and auditable.
- − Two authz systems to reason about; documentation must state the boundary (RLS = tenancy, OpenFGA = within-tenant permissions).
- − OpenFGA adds a datastore (Postgres-backed) — another native service to provision.

---

## ADR-0013: Reverse proxy: Caddy

**Status:** Accepted (planned).

**Context:** Multiple HTTP services (API :3000, MCP :3101, web, Meilisearch, Temporal UI, Zitadel) need a single ingress with automatic TLS, path routing, and sane security headers, on a native host.

**Decision:** **Caddy** (Apache-2.0) as the edge proxy: automatic HTTPS (Let's Encrypt when online; internal CA for air-gapped), path-based routing to services, single binary native install.

**Alternatives:** nginx (fine but manual TLS + config drift); Traefik (container-centric, heavier); HAProxy (L4-focused, no native automatic TLS).

**Consequences:**

- + Zero-config TLS; Caddyfile is small and auditable; single exposed port.
- − Caddy's automatic-HTTPS needs a reachable domain or explicit internal-CA mode — must be decided per deployment (document in infra).
- − WebSocket support is fine but must be verified for LiveKit (ADR-0017) and Streamable HTTP MCP streams.

---

## ADR-0014: Feature flags: Unleash, all-on by default

**Status:** Accepted (planned).

**Context:** TeleCRM-parity features land incrementally (A1–A8 build waves). Operators need kill-switches for risky features (WhatsApp sends, voice agent) without redeploys. The default posture must be **all features on** — OpenTeleCRM is a 1:1 clone, not a staggered rollout.

**Decision:** **Unleash** (Apache-2.0) for feature flags, with the explicit default **all flags enabled** (fallback-on). Flags are kill-switches and rollout controls, never the mechanism for hiding parity features. Flag evaluation cached server-side (Valkey, ADR-0006) to avoid per-request IdP/DB chatter.

**Alternatives:** Flagsmith (BSL-1.1 — excluded); LaunchDarkly SaaS (excluded); env-var flags only (no runtime toggles, no per-enterprise control).

**Consequences:**

- + Runtime kill-switches for risky integrations; per-enterprise flag overrides.
- + FOSS-compatible licensing.
- − Another service + Postgres schema to provision; flag sprawl risk — naming convention and cleanup policy required.

---

## ADR-0015: WhatsApp: whatsapp-web.js + Cloud API driver

**Status:** Accepted (planned).

**Context:** TeleCRM's core channel is WhatsApp messaging. Options for self-hosted WhatsApp integration: unofficial libraries (whatsapp-web.js) vs a gateway (WAHA) vs Meta's official Cloud API. This carries real ToS/ban risk — see RISKS.md.

**Decision:** Dual-driver architecture behind a `services/whatsapp` abstraction:

- **Default driver: Meta Cloud API** (official, ToS-compliant, per-message fees — see RISKS.md) for production.
- **Alternative driver: whatsapp-web.js** (unofficial, self-hosted, Apache-2.0; drives WhatsApp Web through Puppeteer) for low-volume/air-gapped deployments where the operator accepts ToS risk — with a **mandatory consent modal** at first WhatsApp-feature use (per-enterprise acknowledgment of ToS/ban risk, stored in audit log).
- Driver selection is per-enterprise configuration, never baked into business logic.

**Alternatives:** whatsapp-web.js-only (ToS-violating by default — rejected as default); Cloud-API-only (fees + internet dependency conflict with air-gap requirement); twilio WhatsApp (vendor lock + fees); Baileys (WebSocket driver — rejected: heavier ESM interop surface, no maintained Chrome-free deployment story on this stack).

**Consequences:**

- + Operators choose compliance vs cost/air-gap tradeoff explicitly, with consent recorded.
- − Unofficial driver can break without notice (WhatsApp protocol changes); must be pinned and monitored.
- − Meta Cloud API requires phone-number verification and a Meta business setup — deployment prerequisite documented in infra.
- − Legal posture is operator's responsibility; OpenTeleCRM ships the consent machinery but cannot indemnify.

---

## ADR-0016: Speech-to-text: faster-whisper + pyannote

**Status:** Accepted (planned).

**Context:** Call transcripts (from Asterisk/SIP recordings) and voice-agent turns need on-premise STT with speaker diarization, running on an air-gapped 8vCPU host.

**Decision:** **faster-whisper** (MIT, CTranslate2-accelerated Whisper) for STT, with **pyannote.audio** for diarization. Runs as a Python service (`services/ai`) behind the API. Model checkpoints pinned by hash in `infra/native/` for air-gapped install.

**Caution recorded:** pyannote **model checkpoints are MIT** but distributed via HuggingFace with a **gated license (CC-BY-NC-ish terms)** — non-commercial restriction on some checkpoints. Decision: use MIT-licensed community diarization checkpoints by default; if a gated checkpoint is required, that is an operator-level decision documented at install time. Also note Whisper-large checkpoints carry OpenAI's model license (permissive for use) — pinned versions recorded in the provisioning script.

**Alternatives:** OpenAI Whisper API (SaaS — excluded, air-gap); Vosk/Kaldi (lower accuracy); cloud STT (excluded).

**Consequences:**

- + Full on-prem transcription; faster-whisper is CPU-viable at small models on 8vCPU.
- − Diarization accuracy is modest on 2-speaker telephony audio; quality gate documented (see RISKS.md air-gap LLM quality).
- − Python + torch runtime adds native deps (python3-venv in provisioner already present).
- − Checkpoint licensing must be re-verified at every model upgrade (license-leak risk, RISKS.md).

---

## ADR-0017: Voice agent: LiveKit

**Status:** Accepted (planned).

**Context:** AI voice agents (inbound answering, outbound qualification) need real-time audio transport, agent orchestration (STT → LLM → TTS), and call control bridging to Asterisk/SIP.

**Decision:** **LiveKit** (Apache-2.0) as the realtime voice-agent platform: WebRTC transport, `services/voice-agent` implements the agent pipeline (faster-whisper STT → local LLM → Piper TTS, ADR-0016/0018), LiveKit Agents framework for session orchestration. Native install (single binary + optional Redis/Valkey).

**Alternatives:** Daily/OpenAI Realtime (SaaS — excluded); raw WebRTC + custom SFU (re-inventing LiveKit); Twilio Voice (vendor lock).

**Consequences:**

- + Battle-tested WebRTC stack; self-hostable; open license.
- − LiveKit Rooms/Turn server adds ports/STUN-TURN config behind Caddy (ADR-0013) — NAT traversal on customer sites is a support burden.
- − Voice latency budget (STT+LLM+TTS on 8vCPU) needs aggressive model-size tuning; fallback to IVR flows when load is high.

---

## ADR-0018: Text-to-speech: Piper (Coqui XTTS opt-in)

**Status:** Accepted (planned).

**Context:** Voice agent and IVR prompts need on-prem TTS. Quality vs license tradeoff: Coqui XTTS has excellent voice cloning but its model checkpoints are **CPML/non-commercial** (Coqui's license) — unacceptable as a default for a FOSS product.

**Decision:** **Piper** (MIT, VITS-based, voice-format aware) as the default TTS — fast on CPU, permissive license, good telephony voices. **Coqui XTTS is opt-in only**: operator explicitly enables it (config + consent), acknowledging checkpoint license terms; never bundled or default.

**Alternatives:** Coqui XTTS (great quality, license problem — opt-in only); espeak-ng (robotic, fallback only); cloud TTS (excluded — air-gap).

**Consequences:**

- + Default path is license-clean and CPU-fast (RTF ≪ 1 on 8vCPU).
- + Voice-agent latency stays low (Piper is the fastest quality tier available on-prem).
- − Piper voice quality is below XTTS for cloning use-cases; document when opt-in XTTS is justified.
- − License-leak surface (RISKS.md) if XTTS checkpoints get accidentally bundled — CI must exclude them from release artifacts.

---

## ADR-0019: Workflow builder: React Flow

**Status:** Accepted (planned).

**Context:** TeleCRM-parity automation UX (and the admin surface for Temporal workflows, ADR-0007) needs a visual builder: nodes for triggers/conditions/actions, edges for control flow, rendered in the web app.

**Decision:** **React Flow** (MIT, by xyflow) as the workflow canvas in `apps/web` (Next.js, ADR-0023). Node/edge schemas are serialized to a JSON graph stored in Postgres, then compiled to Temporal workflow specs (ADR-0007) for execution.

**Alternatives:** Node-RED editor (rejected as the builder — see ADR-0020 for its ETL-only role); Drawflow (less maintained); custom SVG canvas (re-inventing).

**Consequences:**

- + MIT license; React-native fit; headless mode usable for testing graph compilation.
- + Decouples visual editing (React Flow graph JSON) from execution (Temporal) — testable in isolation.
- − Graph-to-workflow compiler is a real component with its own test suite; unsupported node combos must fail validation at build time, not at runtime.

---

## ADR-0020: ETL: Node-RED optional (n8n excluded)

**Status:** Accepted (planned).

**Context:** Import pipelines (CSV/XLSX lead uploads, third-party integrations) occasionally need operator-authored ETL flows. n8n is the popular default but its **Sustainable Use License (fair-code, BSL-like)** restricts embedding/competition — incompatible with a FOSS product.

**Decision:** **Node-RED** (Apache-2.0) as the **optional, opt-in** ETL/automation runtime, deployed only when an operator enables it (`WITH_NODERED=1` style flag, native install per ADR-0001). It is never a dependency of the core product; it speaks to the API via tokens. **n8n is excluded** on license grounds.

**Alternatives:** n8n (Sustainable Use License — excluded); custom script runners (no visual editing); Windmill (AGPL — excluded).

**Consequences:**

- + License-clean optional integration; operators get a visual ETL without core-product coupling.
- − Node-RED is a second automation paradigm alongside Temporal (ADR-0007) — documented boundary: Temporal = product automations, Node-RED = operator ETL glue.
- − Optionality means it must never be imported into core packages (CI dependency guard).

---

## ADR-0021: BI: ECharts (Metabase excluded)

**Status:** Accepted (planned).

**Context:** Dashboards (funnel, agent performance, call analytics) need charting. Full BI tools like Metabase are AGPL-3.0 — an AGPL service alongside a FOSS product risks license contamination and is heavy for the target host.

**Decision:** **Apache ECharts** (Apache-2.0) as the charting library, rendering dashboards inside `apps/web` from ClickHouse-served aggregates (ADR-0005). **Metabase is excluded** (AGPL-3.0). BI queries go through the API with enterprise scoping re-applied (RLS does not extend to ClickHouse).

**Alternatives:** Metabase (AGPL — excluded); Grafana (AGPL-3.0 since v8 — excluded as embedded; allowed only as operator-installed standalone); Recharts (fine for simple charts, ECharts chosen for heatmaps/Gantt/waterfall BI needs).

**Consequences:**

- + License-clean; dashboards are first-class web UI, no separate BI service to operate.
- + ECharts covers TeleCRM's chart vocabulary (funnel, cohort, geo, Gantt).
- − No ad-hoc SQL explorer for power users (Metabase's strength) — out of scope for a 1:1 clone; custom query builder deferred.

---

## ADR-0022: Payments: Hyperswitch

**Status:** Accepted (planned).

**Context:** The CRM may collect payments (subscriptions, invoice links) and needs a self-hostable payment layer supporting Indian PSPs (Razorpay, PayU, Cashfree) plus international processors.

**Decision:** **Hyperswitch** (Apache-2.0, by Juspay) as the payment orchestration layer: one API over multiple PSPs, router logic, webhooks — self-hosted. Native install (Hyperswitch is a Rust core + Postgres + Redis/Valkey).

**Alternatives:** Stripe Connect (SaaS, not self-hostable — excluded by air-gap posture); direct multi-PSP integration (huge surface, payment-card compliance burden); Braintree (SaaS).

**Consequences:**

- + One integration surface; PSP switching without code changes; PCI scope reduced (cards tokenized by PSP).
- − Hyperswitch is a substantial deployment (multiple services) — provisioned only when payments feature is enabled.
- − Payment data is PII-adjacent: enterprise scoping + audit logging mandatory (schema already has `audit_log`).

---

## ADR-0023: Web: Next.js 16 + React 19 + shadcn/ui

**Status:** Accepted (planned — `apps/web` scaffold exists).

**Context:** The agent/desk web app (leads grid, call pad, dashboards, workflow builder) must match TeleCRM's UX density with a modern, maintainable stack, and share UI primitives with the monorepo.

**Decision:** **Next.js 16 (App Router, actual pinned 16.3.0) + React 19 + TypeScript**, with **shadcn/ui** (MIT, Radix-based, copy-in components) as the component layer, styled via Tailwind. Server Components for read paths, client components for the call pad/workflow canvas. Monorepo UI primitives in `packages/ui`.

**Alternatives:** Vite + React SPA (fine, but loses SSR/SEO and route conventions; API prefix parity is simpler in Next); Remix (React Router-based, smaller ecosystem for this stack); plain shadcn-less Tailwind (reinventing component quality).

**Consequences:**

- + React 19 + Next 15 are current LTS-ish lines; shadcn/ui components are MIT and copy-in — no license risk.
- + RSC keeps payloads small on constrained hosts.
- − React 19 ecosystem churn (some libs lag); Next's server/client boundary needs discipline for the workflow canvas (React Flow is client-only — `"use client"` islands).
- − WebSocket/streaming surfaces (LiveKit preview, MCP playground) need route handlers, not server components.

---

## ADR-0024: Mobile: React Native + WatermelonDB + ntfy

**Status:** Accepted (planned — `apps/mobile` scaffold exists).

**Context:** Field agents need the CRM on Android (telecalling app with call recording, lead updates, WhatsApp deep links). Offline resilience matters on bad networks; push must work without Google Play Services dependency (air-gap/India deployments).

**Decision:** **React Native** (0.7x, TypeScript) for `apps/mobile`; **WatermelonDB** (MIT) for on-device SQLite sync (offline-first lead mutations, sync engine against the API); **ntfy** (Apache-2.0, self-hostable) for push notifications — no FCM dependency. Call recording on Android follows the SIP path (see RISKS.md — Android 10+ blocks SIM-call recording; recordings come from the SIP/Asterisk side, not the handset).

**Alternatives:** Flutter (Dart ecosystem split from TS monorepo); Expo-only (managed workflow conflicts with native call-recording/SIP integrations); FCM push (Google dependency — excluded); bare native (two codebases).

**Consequences:**

- + One TS codebase; WatermelonDB gives offline mutation + sync without a full offline-first rewrite.
- + ntfy self-hosted push is license-clean and air-gap-friendly.
- − WatermelonDB sync engine must be built carefully against the RLS-scoped API (tenant context per sync batch).
- − Native modules (SIP client, call state) are the painful part of RN — kept thin, behind a JS interface.

---

## ADR-0025: Dev auth: DEV_JWT_SECRET (Zitadel in prod)

**Status:** Accepted (implemented).

**Context:** Local development and contract tests need auth without standing up Zitadel. Production needs real OIDC. TeleCRM-parity API tokens (`telekrm_async_*` / `telekrm_sync_*`) must keep working for integrations. The guard must never silently weaken in production.

**Decision:** Three-path auth in the global `AuthGuard` (`services/api/src/auth/auth.guard.ts`, registered via `APP_GUARD` in `auth.module.ts`):

1. **API token** — `Bearer telekrm_async_*|telekrm_sync_*` (TeleCRM parity; token rows in `api_token` table, stored hashed — `tokenHash`/`tokenTail`).
2. **Dev JWT** — HS256 signed with `DEV_JWT_SECRET` env; claims `{ enterpriseId, sub }`; `tokenType: 'dev-jwt'`. **Only honored when `DEV_JWT_SECRET` is set**; the variable must never be set in production (enforced in deploy docs; a future startup guard should refuse `NODE_ENV=production` + `DEV_JWT_SECRET`).
3. **Zitadel OIDC** — RS256 id-token validated against `ZITADEL_ISSUER`, claims carry `enterpriseId`; `tokenType: 'oidc'` (see ADR-0011).

Contract tests (6/6 green: `services/api/src/__tests__/metadata.contract.test.ts`) exercise the guard + tenant-scoped metadata endpoints (`/enterprise/{eid}/metadata`, `/custom-fields`, `/lead-stage-pipeline`) with dev JWTs.

**Known gap (tracked):** the OIDC path currently decodes the token without JWKS signature verification — a dev shim. **Must be replaced with JWKS-based verification before Zitadel is provisioned** (ADR-0011 consequence). Dev JWT and API-token paths are complete.

**Alternatives:** JWT-only everywhere (no TeleCRM token parity); shared static secret header (no per-enterprise scope); skip auth in dev (contract tests would not exercise the guard).

**Consequences:**

- + Developer ergonomics: `DEV_JWT_SECRET` in `.env` unlocks the whole API without an IdP.
- + Production path (OIDC) is exercised in code from day one, even before Zitadel ships.
- − The OIDC shim is a footgun if someone provisions Zitadel and forgets the JWKS upgrade — item is gated in the Zitadel provisioning checklist.
- − `DEV_JWT_SECRET` in `.env.example` is documented as dev-only; `.env` is gitignored.

---

## ADR-0026: Telephony: Asterisk + ARI

**Status:** Accepted (partial — ARI provider scaffold + PBX config shipped; live wiring deferred).

**Context:** The A1.x call surface needs outbound dialing, live call state, recording, and (later) IVR/queues. The candidate PBXes were evaluated against the native-install directive (ADR-0001 — no Docker) and the FOSS license posture. ARI rides Asterisk's HTTP server, so the API service can integrate with plain HTTP + WebSocket — no C libraries, no AMI/AGI scripting.

**Decision:** **Asterisk** (native apt install, systemd) with **ARI** (Asterisk REST Interface) as the integration surface, **chan_pjsip** as the SIP channel driver (trunk template + active `[from-crm]` endpoint), and a **Stasis application named `opentelecrm`**: the dialplan hands channels in via `Dial(Stasis/opentelecrm)` and Asterisk streams Stasis events (`StasisStart`, `ChannelStateChange`, `StasisEnd`) to the API, which maps them to CRM events (call.ringing, call.answered, call.ended, recording.*). ARI binds **127.0.0.1:8088** only (never `0.0.0.0`); credentials come from env (`ARI_PASSWORD`), never committed. The ARI client lives in `services/telephony` behind the `TelephonyProvider` contract (`packages/contracts`): mock provider for tests, `asterisk-ari` provider scaffolded to throw unless `TELEPHONY_ARI_*` env is set (fail loudly, never silent no-op). Implementation: `infra/asterisk/` (`ari.conf`, `pjsip.conf`, `extensions.conf`, systemd unit template, `provision/asterisk.sh` — idempotent, smoke-tests `GET /ari/asterisk/info`), `services/telephony/src/providers/asterisk-ari.provider.ts`.

**Alternatives:** FreeSWITCH (powerful, but ESL/mod_verto integration is less standard and operator burden is heavier) — rejected; Kamailio (pure SIP proxy/router — no media application layer for recording/IVR; still a candidate SBC in front of Asterisk for carrier peering later) — deferred; legacy chan_sip (deprecated channel driver) — rejected in favor of chan_pjsip.

**Consequences:**

- + ARI is HTTP+JSON+WebSocket — standard, scriptable, fits the NestJS service without native deps.
- + chan_pjsip gives modern SIP (transport-udp/tcp/tls) for trunks and endpoints.
- − Live phase still to build: Stasis websocket subscription, channel originate (`POST /ari/channels`), recording control (`POST /ari/channels/{id}/record`), event → CRM mapping.
- − ARI credentials are cleartext basic-auth in `ari.conf` (Asterisk requirement) — env-templated, loopback-bound, and any wider bind must be firewalled (RISKS.md).
- − Supported topology is a single PBX host; multi-node needs the systemd unit template plus ARI over a private network (TLS in front via Caddy, ADR-0013).

---

## ADR-0027: Dialer queue scoring: pure function

**Status:** Accepted (implemented).

**Context:** The smart dialer (A1.1) must decide which lead an agent dials next. Naive FIFO ignores follow-ups, SLA, lead score, and fairness; a Temporal priority queue (ADR-0007) is the eventual home but adds a running dependency for what is currently a read-side ordering problem.

**Decision:** Scoring is a **pure function** in `services/telephony/src/scoring.ts` (`scoreDialerCandidate` / `sortDialerCandidates`) — no I/O, no DB, deterministic under an injected `now`. Priority, highest first (all weights overridable via `DialerScoringConfig`):

1. follow-up overdue — **+1000** (flat)
2. follow-up due within 4h — **+500** (flat)
3. SLA-breach risk — **+0..200** (scaled by overdue fraction past `slaHours`=24, only when no follow-up is scheduled)
4. lead score — **+score × 0.5**
5. freshness — **+0..50** (exponential decay, 48h half-life)
6. round-robin fairness — **−20 per call dialed today**

`services/api` `dialer/next` (dialer.controller.ts) uses the same config and excludes DND-registered numbers at the query (`dnd_registry`, channel `call`/`all`, ADR-0029). Tests inject `now` for determinism (`services/telephony/src/scoring.test.ts`; contract tests assert descending rank + reasons).

**Alternatives:** naive FIFO (ignores all priority signals) — rejected; in-DB composite ORDER BY (weights undocumented, not unit-testable) — rejected; priority queue in Temporal (ADR-0007) — deferred until the automation services land; scoring inline in the API controller (duplicated, untestable) — rejected.

**Consequences:**

- + Unit-testable and deterministic; weights + reasons are first-class output, so the UI can explain rank.
- + One source of truth — controller and any future worker import the same package.
- − Weights are deployment defaults, not yet per-enterprise (config hooks exist; admin surface later).
- − `skip` is a v1 no-op; fairness relies on the callsToday penalty.

---

## ADR-0028: Call recording storage: object storage + signed URLs

**Status:** Accepted (partial — metadata + signed-URL endpoint implemented; storage/ingest pipeline deferred).

**Context:** Recordings (A1.2) are sensitive audio: tenant-isolated, encrypted, and never served as static files. Local disk only was considered, but the stack already plans object storage (ADR-0010: Garage/SeaweedFS default, MinIO rejected — AGPL-3.0).

**Decision:** Recordings live in **object storage** (Garage default per ADR-0010), keyed `recordings/{callId}.{ext}`. The `recording` table (`packages/db/src/telephony-schema.ts`) holds metadata only — `objectKey`, `mimeType`, `sizeBytes`, `durationSec`, `status` — never a long-lived URL. Playback goes through **short-lived signed URLs** issued by `GET /enterprise/{eid}/recordings/{id}` (1h expiry; mock `sig=mock` URL until object storage is wired, ADR-0026 live phase). The MixMonitor (Asterisk side) → object-store upload pipeline and transcripts (faster-whisper, ADR-0016) land later.

**Alternatives:** local disk only — rejected (breaks multi-node, no tenant-isolated serving, no retention story); MinIO — AGPL-3.0, rejected by license posture (ADR-0010); Postgres bytea blobs — bloats the DB, rejected.

**Consequences:**

- + Tenant isolation + expiry by construction (RLS-scoped metadata, expiring signed URL).
- + License-clean, consistent with ADR-0010.
- − Recording privacy is a live risk until encryption-at-rest + per-role access land (RISKS.md).
- − No upload pipeline yet — recordings are metadata-only until the MixMonitor phase.

---

## ADR-0029: TRAI calling window: 09:00-21:00

**Status:** Accepted (implemented).

**Context:** TRAI UCC/DND rules restrict telemarketing calls in India to a calling window; a telecalling CRM that dials outside it invites complaints and regulator action. The broadcast path (A2.4) already keeps a consent/opt-out ledger (`consent_ledger`); the call side needs the same discipline.

**Decision:** Default calling window **09:00–21:00 (Asia/Kolkata)**, configurable via `DialerScoringConfig` (`callingWindowStart`/`callingWindowEnd`/`timezone`). Enforced in two places:

1. `sortDialerCandidates` filters candidates outside the window (explicit `ignoreCallingWindow: true` overrides — tests / operator override).
2. `dialer/next` excludes DND-registered numbers via `dnd_registry` (channel `call`/`all`) at query time.

Window resolution uses `Intl.DateTimeFormat` — no TZ-database dependency. Broadcast throttle/jitter (A2.4) stays the WhatsApp-side guard; the DND registry is the shared call-side suppression list.

**Alternatives:** no enforcement (operator responsibility only) — rejected: compliance posture is a product feature here; hard-coded constant (not configurable) — rejected: deployments outside India or with different hours need the knob; UI-only enforcement — rejected: API clients would bypass it.

**Consequences:**

- + Compliance by default; the override is explicit and auditable.
- + Deterministic and testable (injected `now`, fixed timezone).
- − Window is a deployment-level default, not yet per-enterprise.
- − `dnd_registry` is seeded manually today; TRAI DND-list ingestion is future work (RISKS.md).

---

*Note: services/ai, services/analytics, services/automation, services/ingest, services/notifier, services/voice-agent and packages/connectors, i18n, phone, rule-engine, sdk-ts, testing, ui are scaffold directories — their ADRs land as the A1–A8 build waves execute. Telephony and contracts now carry theirs: ADR-0026–0029 (telephony) and ADR-0015 (WhatsApp provider surface). See RISKS.md for build-surface risk.*

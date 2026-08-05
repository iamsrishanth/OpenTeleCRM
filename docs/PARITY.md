# OpenTeleCRM — TeleCRM Feature-Parity Matrix

Tracking the 1:1 FOSS clone of TeleCRM. Status legend:

- ❌ Not built yet
- 🚧 Partial — foundation/schema exists, full behavior not shipped
- ✅ Implemented and verified in this repo today

Column semantics:

- **Our module** — where the feature lives (or will live) in this monorepo.
- **OSS deps** — the open-source stack used. `—` means not started (no deps picked yet).
- **Divergence note** — deliberate differences from TeleCRM. `—` means 1:1, no divergence.
- **Test IDs** — contract/unit tests that pin the behavior.

---

## F — Foundation (cross-cutting, underpins everything)

| TeleCRM ID | Feature | Our module | OSS deps | Status | Divergence note | Test IDs |
|---|---|---|---|---|---|---|
| F1 | Multi-tenant foundation: every table enterprise-scoped, RLS enabled + FORCEd on all 24 tenant tables, `app.enterprise_id` session-variable policy, `withTenant()` txn wrapper | `packages/db` (`schema.ts`, `whatsapp-schema.ts`, `telephony-schema.ts`, `automation-schema.ts`, `rls.ts`, migrations `drizzle/0000…0003`) | Drizzle ORM, node-postgres, PostgreSQL 16/17 | ✅ | — | `services/api/src/__tests__/metadata.contract.test.ts` (all suites run through RLS); no dedicated RLS unit test yet |
| F2 | Seed data: 1 enterprise, 3 users + team members (owner/admin/agent), 2 pipelines (Default Sales, Support), 20 custom fields (immutable `apiName`), 5,000 deterministic leads, system action types (note/call/whatsapp) | `packages/db` (`seed.ts`, `scripts/db/seed.sh`) | — | ✅ | — | run via `pnpm --filter @opentelecrm/db seed`; asserted by contract tests (custom-fields returns exactly 20) |

---

## A1 — Sales & Call Management

| TeleCRM ID | Feature | Our module | OSS deps | Status | Divergence note | Test IDs |
|---|---|---|---|---|---|---|
| A1.1 | 1-Click Dialer | `services/telephony` (`scoring.ts`, `registry.ts`, providers) + `services/api` (`telephony/dialer.controller.ts`) | Asterisk ARI (scaffold, ADR-0026), mock provider | 🚧 | `dialer/next` returns ranked candidates (score + reasons, TRAI window-filtered, DND-suppressed); disposition logs a call + auto-schedules follow-up callback; `skip` is a no-op v1 (fairness via callsToday penalty). Live Asterisk dialing not wired — needs paired PBX (Stasis-events phase) | `telephony.contract.test.ts` (dialer/next + disposition suites) |
| A1.2 | Call Recording | `packages/db` (`recording` table) + `services/api` (`telephony/recordings.controller.ts`) | Object storage (Garage, ADR-0028 — deferred) | 🚧 | Recording metadata + short-lived signed-URL endpoint green (`GET /recordings/:id`, 1h expiry, mock sig); actual MixMonitor → storage pipeline deferred to Asterisk wiring phase — no recording POST endpoint in this slice | `telephony.contract.test.ts` (recordings suite) |
| A1.3 | Call Tracking | `packages/db` (`call` table) + `services/api` (`telephony/calls.controller.ts`) | Drizzle, NestJS | ✅ | Auto-links lead by identifier = phone; writes timeline `call` action; list filters (direction/status/disposition/leadId/from/to) + `total`; RLS-verified cross-tenant isolation | `telephony.contract.test.ts` (calls suites) |
| A1.4 | Click-to-Call | — (planned: `apps/extension`) | — | ❌ | Browser extension not started | — |
| A1.5 | Follow-up Reminders | `packages/db` (`callback` table) + `services/api` (`telephony/callbacks.controller.ts`, `callback-time.ts`) | Drizzle, NestJS | ✅ | Quick chips `1h`/`3h`/`tomorrow_10am`/`custom` (IST-aware); pending list + `?due=true` overdue subset; PATCH `done`/`cancelled`; dialer wrap-up auto-schedules (source `call_disposition`) | `telephony.contract.test.ts` (callbacks suite) |
| A1.6 | Live Caller ID | `services/api` (`telephony/caller-id.controller.ts`) | Drizzle, NestJS | ✅ | `GET /caller-id/{phone}`: lead resolution (whitespace/dash-normalized identifier) + last 5 calls + last 5 actions + `create-lead` suggestion for unknown numbers (one-tap create flow) | `telephony.contract.test.ts` (caller-id suite) |
| A1.7 | Opportunities / Payments | — (pipeline/stage tables exist as data model only) | — | ❌ | — | — |
| A1.8 | Call widgets / queues / IVR | — (`infra/asterisk` scaffold: `ari.conf`/`pjsip.conf`/`extensions.conf`/systemd) | — | ❌ | infra/asterisk scaffold exists but no IVR builder | — |

---

## A2 — WhatsApp

| TeleCRM ID | Feature | Our module | OSS deps | Status | Divergence note | Test IDs |
|---|---|---|---|---|---|---|
| A2.1 | 1-Click WhatsApp | `services/whatsapp` mock + wwebjs drivers (`sendText`), API `POST /enterprise/{eid}/whatsapp/send` | whatsapp-web.js + Puppeteer, contracts | 🚧 | API + mock driver green; real-number pairing needs CLI (`pnpm --filter @opentelecrm/whatsapp pair`) | `whatsapp-inbox.contract.test.ts` |
| A2.2 | Chat Sync | `wa_session`/`conversation`/`wa_message` tables, `InboxService` (persist + auto lead-attribution), `GET /whatsapp/conversations` + messages | whatsapp-web.js + Puppeteer, Drizzle | 🚧 | Mock path + persistence verified; live chat sync requires paired wwebjs session | `whatsapp-inbox.contract.test.ts` |
| A2.3 | WhatsApp Cloud API | — (Meta Graph API adapter planned) | — | ❌ | Cloud-api driver is a stub in the provider interface; Meta WABA onboarding deferred | — |
| A2.4 | Broadcast | `wa_broadcast` + `consent_ledger` tables, `POST /whatsapp/broadcasts` + `:id/start` + opt-out, recipients from leadIds | Drizzle, mock driver | 🚧 | Mock-driver path green (no throttle/jitter — lives in wwebjs driver); real broadcast needs paired session | `whatsapp-template-broadcast.contract.test.ts` |
| A2.5 | Chatbot | — | — | ❌ | Flow builder + LLM fallback deferred to P2 follow-up / P4 | — |
| A2.6 | Notifications | — | — | ❌ | Agent notification surface deferred (notifier service) | — |
| A2.7 | Website widget | — (`apps/widget` empty placeholder) | — | ❌ | Widget SDK deferred | — |
| A2.8 | Drip / sequences | — | — | ❌ | Sequences deferred to P4 automation | — |

---

## A3 — Lead Capture (26+ sources)

| TeleCRM ID | Feature | Our module | OSS deps | Status | Divergence note | Test IDs |
|---|---|---|---|---|---|---|
| A3.1 | Lead capture sources (26+: Facebook, Google, Instagram, WhatsApp, JustDial, Website, IndiaMART, Referral, …) | — (seed `SOURCES` array covers 8 demo sources on `lead.source`) | — | ❌ | Data model supports arbitrary sources today; ingestion connectors not built | — |
| A3.2 | Inbound capture API / webhooks | `services/api` (`automation/webhook.controller.ts` — public `POST /webhook/:tenantId/:name`, fires matching `webhook_received` automation, writes `automation_run` rows) | Drizzle, NestJS | ✅ | Public webhook surface doubles as the automation inbound trigger; generic capture-connector layer (P5 lead capture) not yet built | `automation.contract.test.ts` (webhook inbound suite) |

---

## A4 — Automation

| TeleCRM ID | Feature | Our module | OSS deps | Status | Divergence note | Test IDs |
|---|---|---|---|---|---|---|
| A4.1 | Workflow builder (visual) | — (`apps/web/automations` — form-based rules UI shipped P4b: create/edit/test/run-history; drag-drop React Flow canvas remains roadmap) | React Flow (ADR-0019) | 🚧 | API-level rules engine + form-based rules UI; visual drag-drop canvas is the remaining roadmap step | `automation.contract.test.ts` + web smoke |
| A4.2 | Trigger rules (field change, stage change, action) | `services/api` (`automation/rules.controller.ts` CRUD + `POST :id/test`, `automation/events.ts` — 9 event kinds: lead_created, lead_updated, lead_stage_changed, lead_field_changed, lead_assigned, call_ended, action_logged, callback_due, inbound_message), `packages/rule-engine` evaluator | Drizzle, NestJS, pure-TS rule-engine | ✅ | — | `automation.contract.test.ts` (CRUD + event fire + stage change suites) |
| A4.3 | Action automation (call/WhatsApp/email tasks) | `services/api` (`automation/dispatcher.ts` — 6 executors: assign_lead, create_callback, send_whatsapp, update_field, move_stage, notify_user; send_email/webhook/branch/delay/http_request declared, `{skipped:true}` stubs) | Drizzle, NestJS | ✅ | Executors dispatch via the same provider abstractions (WhatsApp/telephony) | `automation.contract.test.ts` (event fire + stage change suites assert side effects) |
| A4.4 | Scheduled / recurring automations | `services/api` (`automation/scheduler.ts` 60s cron tick, `automation/cron.ts` 5-field evaluator; `POST /automations/:id/test` fires a schedule) | Drizzle, NestJS | ✅ | In-process scheduler for v1; Temporal durability is the roadmap P4b decision (ADR-0007) | `automation.contract.test.ts` (schedule suite) |
| A4.5 | Lead assignment rules | `services/api` (`automation/distribution.controller.ts` — `POST /lead/:leadId/distribute`, round-robin / least_loaded / skill_match with fair-share assignment counts) | Drizzle, NestJS | ✅ | — | `automation.contract.test.ts` (distribution suite) |
| A4.6 | Workflow templates | — | — | ❌ | Seeded template automations are a roadmap P4b E2E gate | — |
| A4.7 | Automation quota metering | — | — | ❌ | See Divergences §D4 — we ship unlimited + per-tenant rate limiter instead of TeleCRM's ambiguous quota | — |

---

## A5 — Reports

| TeleCRM ID | Feature | Our module | OSS deps | Status | Divergence note | Test IDs |
|---|---|---|---|---|---|---|
| A5.1 | Call reports | — | — | ❌ | — | — |
| A5.2 | Team performance | — | — | ❌ | — | — |
| A5.3 | Lead funnel / pipeline reports | — | — | ❌ | — | — |
| A5.4 | WhatsApp / message reports | — | — | ❌ | — | — |
| A5.5 | Custom report builder | — | — | ❌ | — | — |
| A5.6 | Scheduled report email | — | — | ❌ | — | — |

---

## A6 — Customization & Admin

| TeleCRM ID | Feature | Our module | OSS deps | Status | Divergence note | Test IDs |
|---|---|---|---|---|---|---|
| A6.1 | Custom lead fields (immutable `apiName`) | `packages/db` (`lead_field` table), `services/api` (`GET /enterprise/{eid}/custom-fields`), `services/mcp` (`list_lead_fields`, `get_lead_field_schema`) | Drizzle, NestJS, Fastify, MCP SDK | ✅ | Immutable apiName per enterprise (TeleCRM parity, cf. "Information → API Name") | `metadata.contract.test.ts` → `custom-fields` suite (asserts exactly 20, `apiName` shape) |
| A6.2 | Pipelines, stages, lost reasons | `packages/db` (`pipeline`, `stage`, `lost_reason`), `services/api` (`GET /enterprise/{eid}/lead-stage-pipeline`), `services/mcp` (`get_lead_stages_and_lost_reasons`) | Drizzle, NestJS, Fastify, MCP SDK | ✅ | — | `metadata.contract.test.ts` → `lead-stage-pipeline` suite |
| A6.3 | Roles & permissions | `packages/db` (`role` with `permissions` jsonb, `team_member`); seed creates owner/admin/agent system roles | Drizzle | 🚧 | Schema + seed only; permission enforcement in API not yet wired | — |
| A6.4 | Team management | `packages/db` (`team_member`: availability, shift, skills, capacity), `services/mcp` (`list_team_members`) | Drizzle, MCP SDK | 🚧 | Read surface only; admin CRUD not built | — |
| A6.5 | Workspace settings | `packages/db` (`enterprise`: leadIdentifier, timezone, locale), `services/api` (`GET /enterprise/{eid}/metadata`), `services/mcp` (`get_workspace_identity`) | Drizzle, NestJS, Fastify, MCP SDK | ✅ | — | `metadata.contract.test.ts` → `metadata` suite (asserts `leadIdentifier = 'phone'`) |
| A6.6 | API tokens & webhooks | `packages/db` (`api_token`), `services/api` (`TokenService`, `TokenController`: POST/GET/DELETE `/enterprise/{eid}/api-tokens`, `telekrm_{async|sync}` raw tokens sha256-hashed, verifyType class enforcement, revocation) | Drizzle, NestJS, jsonwebtoken, node:crypto | ✅ | Async/Sync NOT interchangeable (wrong class → 401 `NOT_AUTHORIZED`); token cap 20 configurable (divergence D2). Webhook delivery is a separate surface (see A4/inbound webhook plan) | `services/api/src/__tests__/tokens.contract.test.ts` (10 cases, green) |
| A6.6a | Metadata API (TeleCRM-parity REST): `GET /enterprise/{eid}/metadata`, `/custom-fields`, `/lead-stage-pipeline` (global prefix `/autoupdate/v2`), JWT/OIDC/API-token auth via global AuthGuard | `services/api` (`MetadataController`, `AuthGuard`) | NestJS, Fastify, Drizzle, jsonwebtoken | ✅ | — | `services/api/src/__tests__/metadata.contract.test.ts` (6 cases, green) |
| A6.6c | Sync API (TeleCRM-parity REST): leads CRUD + upsert-by-identifier + search, actions batch CRUD + search (bare-numeric custom codes), team-members + state_change, custom-actions + custom-fields PATCH — all under `/autoupdate/v2/enterprise/{eid}` | `services/api` (`sync/leads.controller.ts`, `actions.controller.ts`, `team.controller.ts`, `meta.controller.ts`) | NestJS, Fastify, Drizzle | ✅ | Per-item status `CREATED|IGNORED|UPDATED|REJECTED` + `remarks[]` on batch; search = POST + 200 (not 201) | `services/api/src/__tests__/sync.contract.test.ts` (10 cases, green) |
| A6.6d | Async API (fire-and-forget): `POST /enterprise/{eid}/autoupdatelead` → 200 + requestId; `?validate=true` dry-run (zero writes); `X-Strict-Mode: true` → 422; `ACTION_`-prefix normalization; `GET /enterprise/{eid}/ingest/:requestId` | `services/api` (`async/async.controller.ts`) | NestJS, Fastify, Drizzle | ✅ | Fixes TeleCRM silent-drop defect (divergence D1): dry-run + per-field outcomes; in-memory ingest log for now (queue persistence later) | `services/api/src/__tests__/async.contract.test.ts` (10 cases, green) |
| A6.6b | MCP tool surface — 13 TeleCRM-parity tools: `get_workspace_identity`, `list_lead_fields`, `get_lead_field_schema`, `list_actions`, `get_action_schema`, `get_lead_stages_and_lost_reasons`, `list_team_members`, `fetch_lead`, `query_leads`, `fetch_lead_action`, `query_lead_actions`, `get_current_date`, `get_workspace_context`; Streamable HTTP transport (`POST /mcp`), all queries RLS-scoped | `services/mcp` | MCP TypeScript SDK, zod, Drizzle | ✅ | Dev mode reads enterprise from `MCP_ENTERPRISE_ID` env; OAuth 2.1 + PKCE + DCR gateway (Zitadel) lands in auth phase — tool surface is transport-agnostic. See Divergences §D3 | `services/mcp/src/__tests__/mcp.contract.test.ts` (15 cases, green) |
| A6.7 | Audit log | `packages/db` (`audit_log`: actor, action, resource, before/after, ip), `services/api` (`audit/audit.service.ts` — B5 write path, event hooks fire automation triggers after every audit write) | Drizzle, NestJS | ✅ | Write path landed; admin read/export UI deferred | `audit.contract.test.ts` (4 cases) |

---

## A7 — AI & Voice

| TeleCRM ID | Feature | Our module | OSS deps | Status | Divergence note | Test IDs |
|---|---|---|---|---|---|---|
| A7.1 | AI voice assistant | — | — | ❌ | — | — |
| A7.2 | AI call summary / notes | — | — | ❌ | — | — |
| A7.3 | AI lead scoring | — (`lead.score` column exists in schema) | — | ❌ | Data model ready; scoring engine not built | — |
| A7.4 | AI chatbot | — | — | ❌ | — | — |
| A7.5 | Voice recording transcription | — | — | ❌ | — | — |

---

## A8 — Support & Onboarding

| TeleCRM ID | Feature | Our module | OSS deps | Status | Divergence note | Test IDs |
|---|---|---|---|---|---|---|
| A8.1 | In-app support / help center | — (`apps/docs` empty placeholder) | — | ❌ | — | — |
| A8.2 | Onboarding wizard / walkthrough | — | — | ❌ | — | — |
| A8.3 | Migration tooling from TeleCRM export | — | — | ❌ | — | — |

---

## B — Plans & Billing

| TeleCRM ID | Feature | Our module | OSS deps | Status | Divergence note | Test IDs |
|---|---|---|---|---|---|---|
| B1 | Plans & pricing tiers | — | — | ❌ | See Divergences §D5 (refund window) & §D6 (seat minimum) | — |
| B2 | Billing / invoicing | — | — | ❌ | — | — |
| B3 | Community mode (self-hosted, free) | — | — | ❌ | See Divergences §D6 — community mode has no seat minimum by design | — |

---

## Divergences — TeleCRM defects we fix deliberately

TeleCRM parity means compatible surface, not bug-compatible behavior. These are known TeleCRM defects we deliberately fix in OpenTeleCRM:

| ID | TeleCRM defect | Our fix | Status |
|---|---|---|---|
| D1 | **Silent async drop** — async API writes are fire-and-forget; failures are dropped silently, no trace, no retry, operator unaware | We add a `validate=true` dry-run mode (payload validated before enqueue) plus a persistent **ingestion log**; every async write is recorded, failures are visible and replayable | Planned — validation/logging layer not yet built |
| D2 | **3-token cap** — TeleCRM hard-caps API tokens at 3 per workspace, arbitrary for self-hosted use | We allow **20 tokens per enterprise, configurable** via enterprise settings | Planned — `api_token` table exists, issuance not built |
| D3 | **30-day non-refreshable MCP token** — TeleCRM MCP tokens expire in 30 days with no renewal path, breaking connected clients | We issue **refresh tokens**; long-lived sessions survive token rotation instead of hard-failing | Planned — token service lands with the auth phase (Zitadel OAuth 2.1 + PKCE + DCR) |
| D4 | **Automation quota ambiguity** — TeleCRM plan docs state automation quotas inconsistently across surfaces; unclear what counts | We ship **unlimited automations** in community mode with a **per-tenant rate limiter** (documented, observable) instead of an opaque quota | Planned |
| D5 | **Refund window inconsistency** — TeleCRM refund policy states different windows in different places | We state **exactly one** refund window (30 days from purchase) in every surface: terms, pricing page, billing portal, support docs | Planned — billing not yet built |
| D6 | **Seat minimum** — TeleCRM enforces a minimum paid seat count even for tiny teams | **No seat minimum in community mode**; self-hosted deployments pay/plan per active user with no floor | Planned — billing not yet built |

---

## Status summary (today)

| Area | ✅ | 🚧 | ❌ |
||---|---|---|---|
| F Foundation | 2 | 0 | 0 |
| A1 Sales & Call | 3 (A1.3, A1.5, A1.6) | 2 (A1.1, A1.2) | 3 (A1.4, A1.7, A1.8) |
| A2 WhatsApp | 3 🚧 (A2.1, A2.2, A2.4) | 0 | 5 |
| A3 Lead Capture | 1 (A3.2 webhook) | 0 | 1 |
| A4 Automation | 4 (A4.2, A4.3, A4.4, A4.5) | 0 | 3 |
| A5 Reports | 0 | 0 | 6 |
| A6 Customization & Admin | 8 (A6.1, A6.2, A6.5, A6.6, A6.6a, A6.6b, A6.6c, A6.6d, A6.7) | 2 (A6.3, A6.4) | 0 |
| A7 AI & Voice | 0 | 0 | 5 |
| A8 Support & Onboarding | 0 | 0 | 3 |
| B Plans & Billing | 0 | 0 | 3 |

**Implemented and verified:** multi-tenant foundation + RLS (F1), seed data (F2), TeleCRM-parity metadata REST surface (A6.6a), 13-tool MCP surface (A6.6b), full Sync API (A6.6c), full Async API (A6.6d), API tokens with class enforcement (A6.6), custom fields / pipeline-stage / workspace settings read paths (A6.1, A6.2, A6.5), audit-log write path (A6.7). **P2 WhatsApp (Partial 🚧):** contracts + provider abstraction, mock + whatsapp-web.js drivers, unified inbox with auto lead-attribution, templates CRUD, broadcasts (create/start/opt-out) via mock driver — 43/43 contract tests + 14/14 whatsapp package unit tests. **P3 Telephony (Partial 🚧):** `TelephonyProvider` contract + call domain types, telephony schema (`call`/`recording`/`callback`/`dnd_registry`, migration 0002, RLS-wired), `services/telephony` mock + asterisk-ari providers + pure dialer scoring, `services/api` telephony module (calls A1.3, caller-id A1.6, dialer A1.1, callbacks A1.5, recordings A1.2 partial) — 11/11 telephony unit tests. **P4 Automation (✅ API-level):** rules engine (`packages/rule-engine` pure evaluator), `automation`/`automation_run`/`automation_step` schema (migration 0003, 24 tenant tables total), rules CRUD + `/:id/test`, 9 event kinds, 6 action executors (assign_lead, create_callback, send_whatsapp, update_field, move_stage, notify_user), lead distribution (round-robin/least_loaded/skill_match), public webhook trigger, 60s in-process scheduler — **75/75 API contract tests total** (9 files) + **15/15 MCP** + 11/11 telephony + 14/14 whatsapp. **Bruno collection (`collections/opentelecrm/`) runs green against the live API.** Real-number pairing is a documented CLI step (`pnpm --filter @opentelecrm/whatsapp pair`). Partial: roles enforcement (A6.3), team read/write admin UI (A6.4), WhatsApp cloud-api/chatbot/widget/notifications (A2.3/A2.5/A2.6/A2.7/A2.8), telephony live-PBX dialing + recording pipeline (A1.1/A1.2), automation visual builder + templates + quota metering (A4.1/A4.6/A4.7). Everything in A1.4, A1.7, A1.8, A3.1, A5, A7, A8, B is not yet built.

_Last updated: 2026-08-05. Keep in sync with `services/api`, `services/mcp`, `packages/db` as features land._

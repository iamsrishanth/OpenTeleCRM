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
| F1 | Multi-tenant foundation: every table enterprise-scoped, RLS enabled + FORCEd on all 11 tenant tables, `app.enterprise_id` session-variable policy, `withTenant()` txn wrapper | `packages/db` (`schema.ts`, `rls.ts`, migration `drizzle/0000_peaceful_speedball.sql`) | Drizzle ORM, node-postgres, PostgreSQL 16 | ✅ | — | `services/api/src/__tests__/metadata.contract.test.ts` (all suites run through RLS); no dedicated RLS unit test yet |
| F2 | Seed data: 1 enterprise, 3 users + team members (owner/admin/agent), 2 pipelines (Default Sales, Support), 20 custom fields (immutable `apiName`), 5,000 deterministic leads, system action types (note/call/whatsapp) | `packages/db` (`seed.ts`, `scripts/db/seed.sh`) | — | ✅ | — | run via `pnpm --filter @opentelecrm/db seed`; asserted by contract tests (custom-fields returns exactly 20) |

---

## A1 — Sales & Call Management

| TeleCRM ID | Feature | Our module | OSS deps | Status | Divergence note | Test IDs |
|---|---|---|---|---|---|---|
| A1.1 | 1-Click Dialer | — (planned: `services/api` + web app) | — | ❌ | — | — |
| A1.2 | Call Recording | — (planned: `infra/asterisk` scaffold only) | — | ❌ | — | — |
| A1.3 | Call Tracking | — | — | ❌ | — | — |
| A1.4 | Click-to-Call | — | — | ❌ | — | — |
| A1.5 | Follow-up Reminders | — | — | ❌ | — | — |
| A1.6 | Live Caller ID | — | — | ❌ | — | — |
| A1.7 | Opportunities / Payments | — (pipeline/stage tables exist as data model only) | — | ❌ | — | — |
| A1.8 | Call widgets / queues / IVR | — (planned: `infra/asterisk`, `infra/helm`) | — | ❌ | — | — |

---

## A2 — WhatsApp

| TeleCRM ID | Feature | Our module | OSS deps | Status | Divergence note | Test IDs |
|---|---|---|---|---|---|---|
| A2.1 | 1-Click WhatsApp | — | — | ❌ | — | — |
| A2.2 | Chat Sync | — | — | ❌ | — | — |
| A2.3 | WhatsApp Cloud API | — | — | ❌ | — | — |
| A2.4 | Broadcast | — | — | ❌ | — | — |
| A2.5 | Chatbot | — | — | ❌ | — | — |
| A2.6 | Notifications | — | — | ❌ | — | — |
| A2.7 | Website widget | — (`apps/widget` empty placeholder) | — | ❌ | — | — |
| A2.8 | Drip / sequences | — | — | ❌ | — | — |

---

## A3 — Lead Capture (26+ sources)

| TeleCRM ID | Feature | Our module | OSS deps | Status | Divergence note | Test IDs |
|---|---|---|---|---|---|---|
| A3.1 | Lead capture sources (26+: Facebook, Google, Instagram, WhatsApp, JustDial, Website, IndiaMART, Referral, …) | — (seed `SOURCES` array covers 8 demo sources on `lead.source`) | — | ❌ | Data model supports arbitrary sources today; ingestion connectors not built | — |
| A3.2 | Inbound capture API / webhooks | — (planned: `services/api`) | — | ❌ | — | — |

---

## A4 — Automation

| TeleCRM ID | Feature | Our module | OSS deps | Status | Divergence note | Test IDs |
|---|---|---|---|---|---|---|
| A4.1 | Workflow builder (visual) | — | — | ❌ | — | — |
| A4.2 | Trigger rules (field change, stage change, action) | — | — | ❌ | — | — |
| A4.3 | Action automation (call/WhatsApp/email tasks) | — | — | ❌ | — | — |
| A4.4 | Scheduled / recurring automations | — | — | ❌ | — | — |
| A4.5 | Lead assignment rules | — (planned: `team_member` availability/capacity fields exist) | — | ❌ | — | — |
| A4.6 | Workflow templates | — | — | ❌ | — | — |
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
| A6.6 | API tokens & webhooks | `packages/db` (`api_token`: type async/sync — not interchangeable, tokenHash, expiresAt, revokedAt), `services/api` AuthGuard accepts `telekrm_async_*` / `telekrm_sync_*` bearer tokens | Drizzle, NestJS, jsonwebtoken | 🚧 | Schema + auth shape done; real token issuance/rotation/revocation and webhook delivery not built. See Divergences §D2 (token cap) & §D3 (MCP token refresh) | `metadata.contract.test.ts` → `Auth enforcement` suite (401 `NOT_AUTHORIZED`, enterprise mismatch) |
| A6.6a | Metadata API (TeleCRM-parity REST): `GET /enterprise/{eid}/metadata`, `/custom-fields`, `/lead-stage-pipeline` (global prefix `/autoupdate/v2`), JWT/OIDC/API-token auth via global AuthGuard | `services/api` (`MetadataController`, `AuthGuard`) | NestJS, Fastify, Drizzle, jsonwebtoken | ✅ | — | `services/api/src/__tests__/metadata.contract.test.ts` (5 suites, 6 cases, all green) |
| A6.6b | MCP tool surface — 13 TeleCRM-parity tools: `get_workspace_identity`, `list_lead_fields`, `get_lead_field_schema`, `list_actions`, `get_action_schema`, `get_lead_stages_and_lost_reasons`, `list_team_members`, `fetch_lead`, `query_leads`, `fetch_lead_action`, `query_lead_actions`, `get_current_date`, `get_workspace_context`; Streamable HTTP transport (`POST /mcp`), all queries RLS-scoped | `services/mcp` | MCP TypeScript SDK, zod, Drizzle | ✅ | Dev mode reads enterprise from `MCP_ENTERPRISE_ID` env; OAuth 2.1 + PKCE + DCR gateway (Zitadel) lands in auth phase — tool surface is transport-agnostic. See Divergences §D3 | No automated tests yet — exercised manually via MCP client |
| A6.7 | Audit log | `packages/db` (`audit_log`: actor, action, resource, before/after, ip) | Drizzle | 🚧 | Table + RLS in place; write path not implemented | — |

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
|---|---|---|---|
| F Foundation | 2 | 0 | 0 |
| A1 Sales & Call | 0 | 0 | 8 |
| A2 WhatsApp | 0 | 0 | 8 |
| A3 Lead Capture | 0 | 0 | 2 |
| A4 Automation | 0 | 0 | 7 |
| A5 Reports | 0 | 0 | 6 |
| A6 Customization & Admin | 3 (A6.1, A6.2, A6.5, A6.6a, A6.6b) | 3 (A6.3, A6.4, A6.6, A6.7) | 0 |
| A7 AI & Voice | 0 | 0 | 5 |
| A8 Support & Onboarding | 0 | 0 | 3 |
| B Plans & Billing | 0 | 0 | 3 |

**Implemented and verified today:** multi-tenant foundation + RLS (F1), seed data (F2), TeleCRM-parity metadata REST surface (A6.6a), 13-tool MCP surface (A6.6b), custom fields / pipeline-stage / workspace settings read paths (A6.1, A6.2, A6.5). Partial: API tokens (A6.6), roles (A6.3), team read (A6.4), audit-log table (A6.7). Everything in A1–A5, A7, A8, B is not yet built.

_Last updated: 2026-08-04. Keep in sync with `services/api`, `services/mcp`, `packages/db` as features land._

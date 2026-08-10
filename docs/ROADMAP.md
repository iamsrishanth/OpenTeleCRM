# OpenTeleCRM — Roadmap

Single source of truth for **what's shipped and what's next** in the
OpenTeleCRM delivery plan (P0 → P10). Phase-by-phase delivery plan; the
TeleCRM parity matrix lives in [docs/PARITY.md](./PARITY.md), architecture in
[docs/ARCHITECTURE.md](./ARCHITECTURE.md), decisions in
[docs/DECISIONS.md](./DECISIONS.md).

**Status legend:** ✅ shipped (with commit evidence) · 🚧 partial · ❌ pending
(no commits).

## Phase map

```
P0 Spine ─► P1 Core CRM ─► P2 WhatsApp ─► P3 Telephony ─► P4 Automation ─► P4b Web desk + live wiring
                                                                              │
P5 Lead capture ◄────────────────────────────────────────────────────────────┘
P6 Analytics ─► P7 AI & Voice ─► P8 Mobile ─► P9 Admin/migration/SaaS ─► P10 Hardening & launch
```

Dependency rule: each phase's exit gate requires `pnpm test` green, `make
typecheck` green, and `docs/PARITY.md` updated for its rows.

## Status table (2026-08-06)

| Phase | Scope | Status | Evidence |
|-------|-------|--------|----------|
| P0 | Spine: RLS, metadata API, 13 MCP tools, seed | ✅ | commits `e6547b7`→`74b0943` |
| P1 | Core CRM: Sync + Async API, tokens, leads/actions/team/meta | ✅ | [docs/PLAN-P1.md](./PLAN-P1.md) |
| P2 | WhatsApp: contracts, drivers, inbox, templates, broadcasts | ✅ (API-level) | whatsapp package + contract suites |
| P3 | Telephony: dialer, calls, caller-id, callbacks, recordings | ✅ | [docs/PLAN-P3.md](./PLAN-P3.md) |
| P4 | Automation: rule-engine, rules CRUD, events, distribution, webhook, scheduler | ✅ | [docs/PLAN-P4.md](./PLAN-P4.md) |
| P4b | Web desk, automation UI, React Flow builder, sequences, quota metering, live Asterisk/WhatsApp wiring | ✅ (Temporal deferred) | commits `9f641e0`→`676549a`; ops hardening `32301db`→`a0733e8` (runtime API-base derivation, tunnel split web/API, systemd + launchd supervision) |
| P5 | Lead capture: connector SDK, ingest log, first connectors | ❌ | `services/ingest`, `packages/connectors` empty |
| P6 | Analytics: ClickHouse, ECharts dashboards, reports | ❌ | `services/analytics`, `infra/native` empty |
| P7 | AI & voice: faster-whisper, Piper, LiveKit voice agent | ❌ | `services/ai`, `services/voice-agent` empty |
| P8 | Mobile | 🚧 (shipped M0–M5 as **Kotlin native**, ahead of plan) | commits `3347608`→`0377300` |
| P9 | Admin, migration, SaaS-mode: roles editor, Lago billing, TeleCRM migrator | ❌ | — |
| P10 | Hardening & launch: pen-test, SBOM, E2E, PARITY 100% | ❌ | — |

## Phase details

### P0 — Spine ✅
Multi-tenant foundation: RLS FORCE on all 28 tenant tables, `withTenant()`
wrapper, metadata REST surface, 13 MCP tools, deterministic seed (5,000 leads).
Enterprise-secret exchange endpoint added later (migration 0007).

### P1 — Core CRM ✅
Token service (async/sync classes enforced), full Sync API (leads/actions/
team/meta under `/autoupdate/v2`), Async API (`autoupdatelead` fire-and-forget +
`?validate=true` dry-run, divergence D1), legacy-compat surface, lead search +
timeline, import/export, Bruno collection. Exit gate: 100% of the spec §4
endpoints contract-tested green.

### P2 — WhatsApp ✅ (API-level)
`WhatsAppProvider` contract, mock + wwebjs + baileys drivers, unified inbox
with auto lead-attribution, templates CRUD, broadcasts with `consent_ledger`
opt-out, sequences/drips (A2.8, landed in P4b). Live outbound: standalone
deploy-anywhere bridge (`services/whatsapp-bridge`, Baileys 7.x).

### P3 — Telephony ✅
`TelephonyProvider` contract, telephony schema (migration 0002), mock +
asterisk-ari providers, pure dialer scoring (TRAI window, DND suppression),
calls/caller-id/dialer/callbacks/recordings API. Live dialing landed in P4b.

### P4 — Automation ✅
Pure-TS rule engine (`packages/rule-engine`), automation schema (migration
0003), rules CRUD + `/:id/test`, 9 event kinds, 10 action executors
(`send_email` stubbed), lead distribution, public webhook trigger, 60s cron
scheduler, 10 seeded templates.

### P4b — Web desk + live wiring ✅
- Web desk: real dashboard stats, lead action bar, templates/broadcast/callbacks
  UI, automation rules UI + test runner + run history, webhook console + replay,
  dialer call pad.
- React Flow visual builder (ADR-0019) + `branch`/`delay`/`http_request`/
  `webhook` executors.
- Sequences/drips (A2.8, migration 0004), one-shot schedules.
- A4.7 quota metering (D4 fix, migration 0005).
- Live WhatsApp: standalone bridge (Baileys 7.x) + `bridge` driver.
- Live Asterisk: source-built Asterisk 21 LTS, ARI originate
  (`POST /dialer/:leadId/dial`, migration 0006 `provider_call_id`), Stasis
  event bridge.
- Deferred: **Temporal durability (ADR-0007)** — in-process scheduler stays for
  v1; the `services/automation` Temporal worker is future work.

### P5 — Lead capture (A3) ❌ next up
1. Connector SDK + **persistent** ingestion log (in-memory today — divergence
   D1 becomes durable) + replay.
2. First connector batch: webhook, CSV recurring import, missed-call,
   email-to-lead (IMAP), FB Lead Ads sandbox.
3. Dedupe/merge by `leadIdentifier`; source-attribution reporting (feeds P6).
4. Exit: FB sandbox → assigned lead + welcome WhatsApp <5s.

### P6 — Analytics (A5, ADR-0005/0021) ❌
1. ClickHouse native install (`infra/native/clickhouse.sh`) + ETL from Postgres
   (leads/actions/calls) with **server-side enterprise filter** (RLS doesn't
   extend to ClickHouse — see RISKS.md).
2. ECharts dashboards in web (replace recharts): leaderboard, hour-by-hour
   heatmap, agents report, funnel/velocity/cohort/source-ROI.
3. Custom report builder + scheduled report delivery.
4. Exit: all reports <2s on 5M-lead / 20M-call dataset.

### P7 — AI & Voice (A7, ADR-0016/17/18) ❌
1. faster-whisper + pyannote transcription/diarization (recordings pipeline
   dependency — PLAN-P3 item 2 must land first).
2. Call summaries/insights/scorecards; explainable lead scoring
   (`lead.score` column exists).
3. NL search copilot, reply drafting; AI voice agent (LiveKit/Pipecat →
   Asterisk SIP) with CRM function calling.
4. Exit: 1,000 recordings transcribed+scored on CPU-only box within SLO; voice
   agent books a meeting end-to-end.

### P8 — Mobile 🚧 (shipped ahead of plan as Kotlin native)
Original roadmap (ADR-0024): React Native + WatermelonDB + ntfy. **Actual
implementation (ADR-0030): Kotlin native + Compose + Room + WorkManager +
UnifiedPush.** M0–M5 shipped 2026-08-06:
- M0 scaffold (8→12 Gradle modules, Hilt, configurable server URL, Keystore session)
- M1 leads read + search + delta sync (Room cache)
- M2 actions + offline (timeline, note/call/WhatsApp composer, outbox + WorkManager flush)
- M3 dialer + caller-ID (call pad, dispositions, CallForegroundService, CallerIdNotifier, TRAI banner)
- M4 WhatsApp inbox + push (conversations, threads, send, templates, UnifiedPush, deep links)
- M5 release polish (R8 minify APK 2.0MB, release signing, F-Droid metadata)
- Remaining: Play publishing (internal track ready), iOS (out of scope for now).

### P9 — Admin, migration, SaaS-mode ❌
Setup wizard, roles editor (A6.3 enforcement + A6.4 admin CRUD), Lago billing
(optional, B rows), GST invoices, backup/restore, sandbox clone, **TeleCRM
migration tool** (pull via their Sync API + MCP → map → import → reconciliation
report), DSR/erasure tooling, status page.

### P10 — Hardening & launch ❌
Pen-test pass, ASVS L2 checklist, k6 + chaos suites, SBOM (CycloneDX),
upgrade/rollback runbooks, complete docs + video scripts, 25-journey E2E green,
**PARITY.md 100% ✅ or explicitly justified**.

---

## Next-up task order (P5 first)

```text
0. (done) Gate green (103 API + 15 MCP + 22 whatsapp + 11 telephony), docs current
1. Persistent ingestion log (make divergence D1 durable) + replay API
2. Connector SDK (`packages/connectors`) — webhook + CSV recurring import first
3. Missed-call connector (telephony events → lead)
4. Email-to-lead (IMAP) + FB Lead Ads sandbox
5. Dedupe/merge by leadIdentifier; source-attribution reporting
6. E2E: FB sandbox → assigned lead → welcome WhatsApp <5s
```

Parallel (operator-driven, non-blocking): live SIP trunk pairing +
`TELEPHONY_ARI_TRUNK` config; WhatsApp number pairing for production sessions.

---

## Historical phase records

- [docs/PLAN-P1.md](./PLAN-P1.md) — P1 execution plan (Core CRM) + P2 status
- [docs/PLAN-P3.md](./PLAN-P3.md) — P3 execution plan (Telephony)
- [docs/PLAN-P4.md](./PLAN-P4.md) — P4 execution plan (Automation) + P4b wave

These are historical records: they describe what shipped and the pitfalls
found per wave. **This ROADMAP.md is the current source of truth for what's
next.**

---

_Last updated: 2026-08-10. Keep in sync with git history + `docs/PARITY.md` as
phases land._

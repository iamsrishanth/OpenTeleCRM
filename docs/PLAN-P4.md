# Phase 4 Execution Plan — Automation (P4)

> **Historical record.** This phase is shipped (P4b wave completed: quota
> metering, live Asterisk/WhatsApp wiring, sequences, React Flow builder).
> Current state + what's next: see [ROADMAP.md](./ROADMAP.md).

Status: shipped (API-level) | Effort: ultrathink | Owner: automation wave | Applies after P3 (committed `7b98961`)

## Goal
P4 lands the A4 automation slice: a pure-TS rule engine, rules CRUD + test runner, event-driven firing on lead/action/call/callback events, scheduled (cron) automations, lead distribution, and a public webhook trigger — plus the `automation`/`automation_run`/`automation_step` persistence with RLS. Exit: contract tests green (75/75 total), every trigger/action verified against the seeded demo DB; the visual React Flow builder + Temporal durability are the roadmap P4b step, not part of this slice.

## Shipped (2026-08-05, commit `526a8d5`)
- **`packages/rule-engine`** — pure-TS evaluator (no I/O, no DB): `AutomationRule`/`TriggerSpec`/`Condition`/`ActionSpec` types (`src/types.ts`), `evaluateRule`/`evaluateConditionGroup`/`applyOp`/`planActions`/`substituteString`/`resolvePath` (`src/evaluator.ts`), in-memory `createRuleRegistry` + `rankCandidates` (`src/registry.ts`).
- **`packages/db`** — automation schema (`automation`, `automation_run`, `automation_step` in `src/automation-schema.ts`), migration `drizzle/0003_mushy_reptil.sql`, RLS wired via `AUTOMATION_TENANT_TABLES` (24 tenant tables total).
- **`packages/contracts`** — automation types (trigger/condition/action/run shapes) moved to the canonical contracts package (rule-engine re-exports).
- **`services/api` automation module**:
  - `rules.controller.ts` — CRUD `POST/GET /enterprise/{eid}/automations`, `GET/PATCH/DELETE /:id`, `POST /:id/test` (fires a schedule rule and writes run/step rows).
  - `events.ts` — 9 event kinds: `lead_created`, `lead_updated`, `lead_stage_changed`, `lead_field_changed`, `lead_assigned`, `call_ended`, `action_logged`, `callback_due`, `inbound_message`; hooks fire after every B5 audit write (leads/actions/calls/callbacks).
  - `dispatcher.ts` — 6 action executors: `assign_lead`, `create_callback`, `send_whatsapp`, `update_field`, `move_stage`, `notify_user` (`send_email`/`webhook`/`branch`/`delay`/`http_request` declared as `{skipped:true}` stubs).
  - `distribution.controller.ts` — `POST /enterprise/{eid}/lead/:leadId/distribute` (round-robin / least_loaded / skill_match with fair-share assignment counts).
  - `webhook.controller.ts` — public `POST /autoupdate/v2/webhook/:tenantId/:name` (two-segment route), fires matching `webhook_received` rule, writes run rows. Since the 2026-08 security audit the endpoint is HMAC-authenticated: every request must carry `X-OT-Timestamp` (unix seconds) and `X-OT-Signature: sha256=<hex>` over `tenantId\nname\n<ts>\n<rawBody>`, where `<rawBody>` is the exact request body bytes. Secrets are minted at rule create, shown once, and rotatable via `POST /enterprise/:eid/automations/:id/webhook-secret`.
  - `scheduler.ts` + `cron.ts` — 60s in-process tick, 5-field cron evaluator.
- **Verification** — `services/api/src/__tests__/automation.contract.test.ts`: 7 tests (rules CRUD, event fire `lead_created` → `update_field`, stage change → `create_callback`, schedule via `/:id/test`, distribution rotation, webhook inbound, tenant isolation). Total contract suite: **75/75** (9 files) + 15/15 MCP + 11/11 telephony + 14/14 whatsapp.

## Pitfalls fixed during the wave (for future waves)
1. **DI injection under tsx/vitest** — esbuild drops `design:paramtypes`; controllers/schedulers relying on type-based injection silently get `undefined`. Fix: explicit `@Inject(AutomationService)` in constructor params.
2. **Dispatcher `withTenant` never passed** — executors got "no dispatcher available". Pass the dispatcher into `evaluateActionConfig`.
3. **Stage-change event only fired on PUT, not POST** — "changed" triggers must fire on both create and update paths.
4. **Distribution never rotated** — round-robin needs assignment-count fairness, not call counts (and unique per-run skill tags in tests to avoid cross-test interference).
5. **Fastify webhook 404** — `@Post(':tenantId/:name')` needs two explicit params; a single `{a}/{b}` slug fails silently (`Cannot POST`).
6. **Port collisions** — audit 3105→3108, automation 3106→3109 (EADDRINUSE shows as an unrelated file failing); grep used ports before picking new ones.

## Remaining (roadmap P4b, dependency order)
```
1. Web desk wiring (real dashboard, lead action bar, templates/broadcast UI)
2. Automation UI (rules forms + test runner + rule-tester page)
3. Call pad (web)
4. React Flow visual builder (ADR-0019) + branch/delay executors
5. Sequences/drips (A2.8) + one-shot schedules (festival/birthday)
6. Webhook 7-step wizard + run log + replay
7. Temporal durability decision (ADR-0007) — keep in-process scheduler for v1
```

## P4b wave — A4.7 quota metering + live Asterisk/WhatsApp wiring (2026-08-05)
```
1. [x] A4.7 automation quota metering (D4 fix): automation_quota table (migration 0005),
      AutomationMeter sliding-window runs/min limiter, 'throttled' run rows,
      GET /automations/usage + GET|PUT /automations/quota — 93/93 contract tests
2. [x] WhatsApp live driver: Baileys restored (pairing-code, native) + env-wired
      WHATSAPP_DRIVER=mock|wwebjs|baileys / WHATSAPP_SESSION_ID=cli; wwebjs
      ESM interop fixed (createRequire); wwebjs pairing-code path is broken vs
      current WA Web — Baileys is the operator driver. Pairing remains the
      operator step: pnpm --filter @opentelecrm/whatsapp pair -- --code <phone>
3. [x] Asterisk live wiring (native, no Docker — Debian 13 has no asterisk pkg):
      source build script (infra/asterisk/provision/build-asterisk-source.sh,
      Asterisk 21 LTS), systemd unit, ARI modules + events websocket, Stasis()
      dialplan (Asterisk 20+ has no Dial(Stasis/) channel tech)
4. [x] API live dial: POST /dialer/:leadId/dial → ARI originate (channel vars
      enterprise_id/lead_id) + call row with provider_call_id (migration 0006);
      CallEventBridge maps StasisStart/ChannelStateChange/ChannelDestroyed →
      call row updates. Smoke-verified end-to-end (Local harness); real SIP
      trunk is operator config (TELEPHONY_ARI_TRUNK)
5. [ ] Temporal durability decision (ADR-0007) — deferred by user directive
      (A4.7 + wiring took priority this wave)
```

## Verification gate
- [x] Contract tests 95/95 green (`pnpm --filter @opentelecrm/api test`)
- [x] Automation surface pinned by `automation.contract.test.ts` + `automation.quota.contract.test.ts` (CRUD, event fire, stage change, schedule, distribution, webhook, quota, tenant isolation)
- [x] Telephony surface pinned by `telephony.contract.test.ts` (dial + call-event bridge suites)
- [x] MCP 15/15, telephony 13/13, whatsapp 14/14 green; root `pnpm test` exits 0
- [x] PARITY.md A4 rows reflect final state (A4.7 ✅, D4 implemented; A1.1 ✅ live dial)

## Rollback
Per-vertical-slice: pg_dump pre-migration backup; additive-only migrations (0003 is additive); automation routes sit behind the normal tenant-scoped guard — disable by not importing `AutomationModule` in `app.module.ts`; `git checkout` previous commit to revert code. No destructive migration merges.

## Dependencies
- P3 spine (committed `7b98961`): telephony module + provider patterns — DONE
- `packages/contracts` + `packages/rule-engine` — DONE in this phase
- `apps/web` scaffold (Next.js + shadcn/ui) — needed for the automation UI (P4b item 2)

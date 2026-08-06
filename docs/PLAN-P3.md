# Phase 3 Execution Plan — Telephony (P3)

> **Historical record.** This phase is shipped (and P4b added live Asterisk ARI
> dialing). Current state + what's next: see [ROADMAP.md](./ROADMAP.md).

Status: shipped (vertical slice) | Effort: think-hard | Owner: telephony wave | Applies after P2 (committed `7b98961`)

## Goal
P3 lands the A1 telephony slice: smart dialer queue, call tracking, live caller ID, follow-up callbacks, recording metadata — plus the Asterisk PBX scaffold the live phase builds on. Exit: contract tests green (62/62 total), dialer/call/caller-id/callback/recording surfaces verified against the seeded demo DB via mock provider; live Asterisk dialing is the next phase, not part of this slice.

## Shipped (2026-08-04, commit `7b98961`)
- **`packages/contracts`** — `TelephonyProvider` interface (dial/hangup/callState/startRecording/stopRecording/on) + call domain types: `CallRecord`, `RecordingRef`, `CallbackRequest`, `DialerCandidate`, `DialerMode`, `DndEntry` (src/index.ts).
- **`packages/db`** — telephony schema (`call`, `recording`, `callback`, `dnd_registry` in `src/telephony-schema.ts`), migration `drizzle/0002_fast_chameleon.sql`, RLS wired via `TELEPHONY_TENANT_TABLES` (tenant-scoped, FORCE).
- **`services/telephony`** — provider registry (`telephonyProviderFor`, lazy ARI import so the API mock path never pulls the ARI client), mock provider, `asterisk-ari` provider scaffold (throws unless `TELEPHONY_ARI_*` env set — fail loudly), pure dialer scoring (`scoring.ts`: `scoreDialerCandidate`, `sortDialerCandidates`, `callingWindowAllowed`).
- **`services/api`** — telephony module (`src/telephony/`):
  - calls (A1.3): `POST/GET /enterprise/{eid}/calls`, `GET /calls/:id` — auto-links lead by identifier=phone, writes timeline `call` action, list filters + `total`.
  - caller-id (A1.6): `GET /enterprise/{eid}/caller-id/{phone}` — lead resolution + last 5 calls/actions + `create-lead` suggestion.
  - dialer (A1.1): `POST /dialer/next` (ranked candidates, TRAI window-filtered, DND-suppressed), `POST /dialer/{leadId}/disposition` (logs call + auto-schedules callback), `POST /dialer/{leadId}/skip` (no-op v1).
  - callbacks (A1.5): `POST/GET /callbacks`, `PATCH /callbacks/:id` — quick chips `1h`/`3h`/`tomorrow_10am`/`custom`, `?due=true` overdue subset.
  - recordings (A1.2 partial): `GET /recordings/:id` — metadata + 1h signed playback URL (mock sig).
- **`infra/asterisk`** — PBX scaffold: `ari.conf` (loopback :8088, user `opentelecrm`, `__ARI_PASSWORD__` placeholder), `pjsip.conf` (transport-udp + `[from-crm]` endpoint), `extensions.conf` (Stasis hook-in comments), `systemd/opentelecrm-asterisk.service` (dedicated-PBX-host template), `provision/asterisk.sh` (native installer + ARI templating + module enablement + smoke test). See `infra/asterisk/README.md`.
- **Verification** — `services/api/src/__tests__/telephony.contract.test.ts`: 19 tests (dialer next/disposition, calls CRUD + auto-link + validation, caller-id found/not-found, callbacks chips/due/done, recordings metadata + 404, cross-tenant RLS isolation). Total contract suite: **62/62** (19 telephony + 8 whatsapp + 6 metadata + 10 tokens + 9 sync + 10 async).

## Remaining (dependency order)
```
1. Live Asterisk wiring ─► 2. Recordings pipeline ─► 3. WebRTC softphone ─►
   4. IVR builder ─► 5. Browser extension (A1.4) ─► 6. Mobile CallLog sync ─► 7. Jitsi meetings
```
1. **Live Asterisk wiring** — Stasis websocket subscription (`on()`), Stasis events → CRM event mapping (call.ringing/answered/ended, recording.*), channel originate via `POST /ari/channels` (dialer `dial()`), recording control, real trunk credentials (replace `[trunk-example]` in pjsip.conf). Depends on: paired PBX + SIP trunk creds. Unblocks: real dialing, real recordings.
2. **Recordings pipeline** — MixMonitor (Asterisk side) → object storage upload (Garage, ADR-0028), retention + encryption-at-rest, `recording` rows populated end-to-end, transcript hook (faster-whisper, ADR-0016). Depends on: 1.
3. **WebRTC softphone** — call pad in `apps/web` (Next.js + shadcn/ui, ADR-0023): dial from lead, in-call controls, live caller-id overlay, disposition wrap-up. Depends on: 1 (media path), API surface (done).
4. **IVR builder (A1.8)** — visual IVR/queue builder (dialplan templates behind the Stasis app). Depends on: 1.
5. **Browser extension click-to-call (A1.4)** — `apps/extension`: highlight phone numbers → dial via API/softphone. Depends on: 3 (or a native URL scheme).
6. **Mobile CallLog sync** — `apps/mobile` (ADR-0024) reads device call log → `POST /calls`; SIP-path recording (Android 10+ SIM limitation, RISKS.md). Depends on: calls API (done), mobile app scaffold.
7. **Jitsi meetings** — video/audio meetings from the CRM (spec A1.x follow-up). Depends on: web app.

## Verification gate
- [x] Contract tests 62/62 green (`pnpm --filter @opentelecrm/api test:contract`)
- [x] Dialer/calls/caller-id/callbacks/recordings surfaces pinned by `telephony.contract.test.ts`
- [ ] Bruno collection (P3 telephony requests) green against live API
- [ ] Live gate (post-wiring): `curl -u opentelecrm:<pw> http://127.0.0.1:8088/ari/asterisk/info` → 200; end-to-end dial → Stasis events → `call` row + timeline action
- [ ] PARITY.md A1 rows reflect final state (A1.1/A1.2 flip to ✅ when live wiring + recording pipeline land)

## Rollback
Per-vertical-slice: pg_dump pre-migration backup; additive-only migrations (0002 is additive); telephony routes sit behind the normal tenant-scoped guard — disable by not importing `TelephonyModule` in `app.module.ts`; `git checkout` previous commit to revert code. No destructive migration merges.

## Dependencies
- P2 spine (committed `85272d1` / `3010d58`): contracts package, tenant-scoped API patterns, Bruno collection — DONE
- Asterisk 21 LTS baseline (Debian 13 ships 22.x via apt — config is version-agnostic across 20–22)
- Paired SIP trunk + `ARI_PASSWORD` (env, never committed) — required for live phase only
- `apps/web` scaffold (Next.js + shadcn/ui) — needed for softphone (item 3)

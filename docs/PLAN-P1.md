# Phase 1 Execution Plan — Core CRM (P1)

Status: plan | Effort: think-hard | Owner: Bulma ⚡ / Shikamaru ♟️ | Applies after P0 (committed at e6547b7)

## Goal
P1 turns the P0 spine into a usable core CRM: leads, custom fields (immutable apiName), pipelines/stages/lost reasons, actions/custom actions, notes, bulk edit, import/export, search, timeline — plus the full **Async + Sync + legacy compat** API surface with contract tests. Exit: a TeleCRM Postman/Bruno collection runs green against us.

## Dependency order
```
core-domain types ─► db schema + migrations ─► token service (Async/Sync) ─►
  Sync API (leads/actions/team/meta) ─► Async API (autoupdatelead) ─► legacy compat router ─►
  lead controller + search + timeline ─► import/export ─► contract tests ─► Postman/Bruno collection
```

## Task breakdown (numbered, dependency-linked)
1. **T1 — Token service & issuance UI.** Verify API tokens against `api_token` table (sha256 hash lookup). Replace the AuthGuard stub (currently returns token string as enterpriseId) with real DB resolution via `withTenant`. Issue `tele_async_/tele_sync_` prefixed tokens, shown once. Enforce Async↔Sync non-interchangeability → wrong class ⇒ 401 `NOT_AUTHORIZED`. Test: token mint + class enforcement.
2. **T2 — Sync API: leads.** `POST /enterprise/{eid}/lead`, `GET|PUT|DELETE /enterprise/{eid}/lead/{leadId}`, `POST .../lead/search` (POST-body, case-insensitive exact match + additive `contains|gt|lt|in|between|isNull|regex` operators). Custom-field validation against `lead_field.apiName`; upsert by enterprise `leadIdentifier` (default phone). Pagination skip/limit (default 0/10) + opt-in `X-Total-Count`. Per-item status `CREATED|IGNORED|UPDATED|REJECTED` + `remarks[]`.
3. **T3 — Sync API: actions.** `POST .../lead/{leadId}/action` (batch), `GET|PATCH|DELETE .../action/{actionId}`, `POST .../action/search`. Sync custom-action type = **bare numeric code** (`"1001"`), per TeleCRM parity.
4. **T4 — Sync API: team + metadata** (complete the surface). `teammember/state_change`, `team-members` CRUD by email, `custom-fields` GET/PATCH by apiName, `custom-actions` GET/POST/PATCH by code. Reuse P0 MetadataController where shapes already match.
5. **T5 — Async API.** `POST /enterprise/{eid}/autoupdatelead` — fire-and-forget, `ACTION_`-prefixed types (+ normalize bare numeric), upsert by identifier. **Divergence (fix TeleCRM defect):** return `requestId` + `traceUrl`, support `?validate=true` dry-run (zero writes), expose `GET /enterprise/{eid}/ingest/{requestId}` per-field/per-action outcomes, add `X-Strict-Mode: true` → 422 on unknown field. Rate limit 18,000 req/hr/token (429 + Retry-After), field in `.env`.
6. **T6 — Legacy compat router.** Mirror old "Custom API" Postman semantics (fields + actions + `SYSTEM_NOTE` source attribution) behind a separate route prefix.
7. **T7 — Live lead surface + search + timeline.** List leads (virtualized), search (pg_trgm fuzzy on name/phone + lead identifier + custom fields), per-lead timeline (actions, notes, calls), bulk edit, import (CSV/Excel streamed + field-map + validation preview + error CSV) and export (CSV/XLSX) — P1 UI in `apps/web` (Next.js).
8. **T8 — Contract tests + collection.** Contract tests for **100% of §4 endpoints** (spec-derived, not implementation-derived — this is the exit gate). Generate a Bruno collection + Postman export from the OpenAPI doc. Re-run P0 6 tests to confirm no regression.

## First contract tests to write (before implementing T2)
- `POST /enterprise/{eid}/lead` returns 201 with TeleCRM envelope; creates a row only for that tenant (RLS check).
- `POST .../lead/search` with `{"filters":[{"field":"identifier","op":"eq","value":"+91900000001"}]}` → exact match, case-insensitive.
- Upsert by identifier: second POST with same phone → `UPDATED`, not duplicate.
- Custom-field `reference error`: unknown `apiName` in payload → per-field `REJECTED` + `remarks[]`, whole row still 200/201 (partial success parity).
- Wrong token class (sync token on async route) → 401 `NOT_AUTHORIZED`.
- Async `?validate=true` with bad field → 422 in strict mode, dry-run (zero rows written).

## Acceptance criteria (stop-the-line if unmet)
- [ ] 100% §4 endpoints contract-tested green; P0 6 tests still green (no regression)
- [ ] Token classes enforced; async rate limit returns 429 + Retry-After
- [ ] Bare-numeric (sync) vs `ACTION_`-prefixed (async) action-type quirk preserved
- [ ] Partial-success per-item statuses + `remarks[]` on every multi-write
- [ ] Postman/Bruno collection in repo runs green against live API
- [ ] Import: 10k-row CSV valid + error CSV; export round-trips
- [ ] Search returns <500 ms on 100k filtered lead rows (budget)
- [ ] PARITY.md updated: A1.x partial, A6.2/A6.3/A6.6 ✅-ish, all others tracked

## Rollback
Per-vertical-slice: pg_dump pre-migration backup; additive-only migrations; feature-flag any risky surface behind Unleash (all-on default); `git checkout` previous commit to revert code. No destructive migration merges.

## Dependencies
- P0 spine (committed): RLS, metadata endpoints, MCP 13 tools, seed data — DONE
- `apps/web` scaffold (Next.js + shadcn/ui) — new workstream, can start in parallel
- pkgs `contracts`, `rule-engine`, `connectors` — create empty shells in this phase

## Next 5 tasks (after P1 plan approved)
1. T1 token service (unblocks every authed route) — start here
2. T2 leads Sync API + first contract tests (exit gate foundation)
3. `apps/web` shell: Next.js 15 + shadcn/ui + TanStack, login → workspace
4. T5 Async API + ingest log + validate=true
5. T7 lead list + search + import/export UI
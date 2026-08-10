# ADR-0030: Workforce Management Module (ByteCodeEMS port)

- **Status:** Accepted (2026-08-10)
- **Scope:** `packages/db` (workforce-schema), `services/api/src/workforce`,
  `apps/web` (workforce pages), `apps/mobile` (feature:attendance/eod/tasks/calls),
  `services/api/src/automation` (system jobs + event kinds)
- **Companion:** docs/PARITY.md §A9, docs/ROADMAP.md §W1

## Context

ByteCode operates two internal platforms: the workforce tool (ByteCodeEMS —
attendance with GPS, EOD reports with a 6 PM cutoff, task assignment,
department metrics vs targets, weekly reports, device call tracking) and the
sales CRM (OpenTeleCRM — leads, dialer, WhatsApp, automation). The workforce
platform was serverless (Next.js on Vercel + managed Supabase) with no tests
and no license; the CRM is a self-hosted, RLS-FORCEd, fully-tested monorepo.
Decision: port the whole workforce surface into OpenTeleCRM instead of
maintaining two stacks.

## Decisions

1. **Reuse the tenant identity layer.** `team_member` is the employee
   (`app_user`); `role` is the role system. Extension is an additive ALTER
   (`department_id`, `manager_id`, `join_date`, `employment_status`) — no new
   identity tables. A new `employee` role with `attendance:eod:task:metric:
   report:device-call` permissions is seeded.
2. **New domain schema file** (`workforce-schema.ts`, following
   `telephony-schema.ts`): 9 tables, all enterprise-scoped, registered in
   `ALL_TENANT_TABLES` so RLS + FORCE apply automatically (37 tenant tables).
3. **One API module** (`services/api/src/workforce/`): controllers follow the
   proven callbacks pattern — `assertTenant`, `withTenant` transaction wrapper,
   manual DTO validation → `{error:{code:'VALIDATION_ERROR'}}`, audit row after
   every mutation. Role gating via a contained `requireRole()` helper (no global
   AuthGuard change; tenant scoping remains the auth layer's job).
4. **Scheduling is code-driven, not data-driven.** EMS's Vercel cron becomes
   `WorkforceJobsService.processEodCutoff/processWeeklyRollup/
   processOverdueTasks` hooked into the existing 60s scheduler tick behind
   `isCronMatch` guards. **UTC handling:** `cron.ts` evaluates server-local
   time and the stored `schedule.timezone` is never consulted — the scheduler
   shifts `now` to its UTC wall-clock before matching so the 12:30 UTC cutoff
   (= 6 PM IST) is exact.
5. **Automation integration.** Six new trigger kinds
   (`attendance_checked_in/out`, `eod_submitted/missed`, `task_assigned/
   overdue`) with emitters in `workforce/events.ts`; controllers emit
   mutation → audit → fire. The EOD cutoff creates `missed` rows; a late
   submission upgrades them to `late` instead of 400.
6. **Mobile uses the platform LocationManager** (zero new dependencies) for
   GPS punches and a port of the EMS CallLog reader (ContentResolver +
   PHONE_ACCOUNT_ID → SIM slot/carrier) for device call tracking, cached in
   Room with a manual sync to `POST /device-calls`.
7. **Out of scope for this wave:** APK self-update (F-Droid replaces it),
   SIM auto-registration of team_members, real push/email notifications
   (`services/notifier` is an empty stub), MCP workforce tools.

## Consequences

- 37 tenant tables (28 + 9), migrations 0008/0009, contract suite 119/119.
- The operator gets attendance/EOD/task/metrics/reports on the same RLS,
  audit, automation, and deployment rails as the CRM.
- Known tradeoffs: web role-gating is client-side for nav + server-side in the
  workforce controllers (the global AuthGuard does not resolve roles yet);
  device-call dedupe relies on the client's Room cache, not a DB unique index.

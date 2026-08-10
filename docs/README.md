# OpenTeleCRM — Documentation Index

Navigation map for the OpenTeleCRM monorepo. Read in this order depending on
what you're doing:

## New here? Start with

| Doc | What it is |
|-----|------------|
| [../README.md](../README.md) | Project intro, status table, quick start, tunnel mode, parity summary, license |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | C4 architecture: containers, components, data flow, RLS, ports |
| [ROADMAP.md](./ROADMAP.md) | **What's shipped and what's next** (P0–P10) — read before planning work |

## Building / contributing

| Doc | What it is |
|-----|------------|
| [PARITY.md](./PARITY.md) | TeleCRM feature-parity matrix (A1–A8, B, divergences D1–D6) — update on every feature landing |
| [DECISIONS.md](./DECISIONS.md) | ADR log (ADR-0001 → ADR-0031) — read before changing stack/infra choices |
| [RISKS.md](./RISKS.md) | Risk register (WhatsApp ToS, recording privacy, RLS, license leaks, mobile keystore) — review per wave |
| [LICENSES.md](./LICENSES.md) | License posture for every component (project = AGPL-3.0) |

## Historical phase records

| Doc | What it is |
|-----|------------|
| [PLAN-P1.md](./PLAN-P1.md) | P1 execution plan (Core CRM) + P2 status |
| [PLAN-P3.md](./PLAN-P3.md) | P3 execution plan (Telephony) |
| [PLAN-P4.md](./PLAN-P4.md) | P4 execution plan (Automation) + P4b wave |

These describe what shipped per wave and the pitfalls found. **ROADMAP.md is
the current source of truth for what's next.**

## Sub-project READMEs

| Doc | What it is |
|-----|------------|
| [../services/whatsapp-bridge/README.md](../services/whatsapp-bridge/README.md) | Standalone Baileys bridge — deploy-anywhere WhatsApp |
| [../packages/rule-engine/README.md](../packages/rule-engine/README.md) | Pure-TS automation evaluator |
| [../infra/asterisk/README.md](../infra/asterisk/README.md) | Asterisk 21 LTS PBX scaffold (source build, ARI) |
| [../infra/macos/README.md](../infra/macos/README.md) | Cross-platform runbook: portable launchers, systemd + launchd, brew provisioning |
| [../apps/mobile/README.md](../apps/mobile/README.md) | Kotlin-native Android client (modules, build, F-Droid) |

## Doc conventions

- **One fact, one number** — test counts, table counts, and ports appear once
  as the canonical value and are referenced elsewhere; re-verify with
  `pnpm test` + grep before updating.
- **Docs update in the same commit as the feature** — if a PR changes tests,
  tables, ports, or statuses, update README/PARITY/ROADMAP in that PR.
- **Counts are live-verified, not copied** — `pnpm test` at execution time is
  the source for test numbers; `packages/db/src/rls.ts` registries for table
  counts; `packages/db/drizzle/` for migration counts.
- **Secrets never appear** — `.env`, `.env.local`, tunnel hostnames, keystore
  files, and `*.mcp` tokens are gitignored; docs show placeholders only.

# Graph Report - /mnt/data/Projects/ByteCodeCRM  (2026-08-04)

## Corpus Check
- Corpus is ~45,259 words - fits in a single context window. You may not need a graph.

## Summary
- 684 nodes · 927 edges · 41 communities (32 shown, 9 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 15 edges (avg confidence: 0.79)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Tenant-Scoped RLS Access|Tenant-Scoped RLS Access]]
- [[_COMMUNITY_Auth & Token Classes|Auth & Token Classes]]
- [[_COMMUNITY_Baileys WhatsApp Driver|Baileys WhatsApp Driver]]
- [[_COMMUNITY_Root Workspace Config|Root Workspace Config]]
- [[_COMMUNITY_API Service Dependencies|API Service Dependencies]]
- [[_COMMUNITY_WhatsApp Inbox Layer|WhatsApp Inbox Layer]]
- [[_COMMUNITY_Contracts Broadcast & Provider|Contracts: Broadcast & Provider]]
- [[_COMMUNITY_DB Package Dependencies|DB Package Dependencies]]
- [[_COMMUNITY_Biome Tooling Config|Biome Tooling Config]]
- [[_COMMUNITY_WhatsApp Service Dependencies|WhatsApp Service Dependencies]]
- [[_COMMUNITY_DB Schema Core Tables|DB Schema Core Tables]]
- [[_COMMUNITY_MCP Service Dependencies|MCP Service Dependencies]]
- [[_COMMUNITY_Core Domain Types|Core Domain Types]]
- [[_COMMUNITY_TSConfig Base|TSConfig Base]]
- [[_COMMUNITY_DB Connection & Migration|DB Connection & Migration]]
- [[_COMMUNITY_Contracts Package Config|Contracts Package Config]]
- [[_COMMUNITY_Core Domain Package Config|Core Domain Package Config]]
- [[_COMMUNITY_Lead & Pipeline Domain|Lead & Pipeline Domain]]
- [[_COMMUNITY_Team Controller|Team Controller]]
- [[_COMMUNITY_Leads Controller|Leads Controller]]
- [[_COMMUNITY_Actions Controller|Actions Controller]]
- [[_COMMUNITY_Broadcasts Controller|Broadcasts Controller]]
- [[_COMMUNITY_WhatsApp Schema Tables|WhatsApp Schema Tables]]
- [[_COMMUNITY_MCP Server Surface|MCP Server Surface]]
- [[_COMMUNITY_API Tsconfig|API Tsconfig]]
- [[_COMMUNITY_Async Ingest Controller|Async Ingest Controller]]
- [[_COMMUNITY_Templates Controller|Templates Controller]]
- [[_COMMUNITY_Meta Controller|Meta Controller]]
- [[_COMMUNITY_MCP Tsconfig|MCP Tsconfig]]
- [[_COMMUNITY_DB Tsconfig|DB Tsconfig]]
- [[_COMMUNITY_WhatsApp Tsconfig|WhatsApp Tsconfig]]
- [[_COMMUNITY_Contracts Tsconfig|Contracts Tsconfig]]
- [[_COMMUNITY_Core Domain Tsconfig|Core Domain Tsconfig]]
- [[_COMMUNITY_Renovate Config|Renovate Config]]
- [[_COMMUNITY_API Debug Script|API Debug Script]]
- [[_COMMUNITY_MCP Dev Script|MCP Dev Script]]
- [[_COMMUNITY_API Dev Script|API Dev Script]]
- [[_COMMUNITY_DB Init Script|DB Init Script]]
- [[_COMMUNITY_DB Seed Script|DB Seed Script]]
- [[_COMMUNITY_Debian Provision Script|Debian Provision Script]]

## God Nodes (most connected - your core abstractions)
1. `withTenant()` - 19 edges
2. `AuthContext` - 19 edges
3. `BaileysWhatsAppProvider` - 18 edges
4. `compilerOptions` - 17 edges
5. `LeadsController` - 14 edges
6. `ActionsController` - 13 edges
7. `TeamController` - 13 edges
8. `BroadcastsController` - 13 edges
9. `MockWhatsAppProvider` - 13 edges
10. `WhatsAppProvider` - 12 edges

## Surprising Connections (you probably didn't know these)
- `Zitadel OIDC future IdP` --conceptually_related_to--> `AuthGuard (global APP_GUARD)`  [INFERRED]
  docs/DECISIONS.md → services/api/src/auth/auth.guard.ts
- `tenant()` --calls--> `withTenant()`  [INFERRED]
  services/mcp/src/index.ts → packages/db/src/index.ts
- `TeleCRM 1:1 wire parity` --conceptually_related_to--> `NestJS API service (services/api :3005)`  [EXTRACTED]
  docs/PARITY.md → services/api/src/app.module.ts
- `License posture: permissive-only stack` --conceptually_related_to--> `contracts: provider adapters`  [INFERRED]
  docs/LICENSES.md → packages/contracts/src/index.ts
- `TeleCRM defects fixed deliberately (D1-D6)` --conceptually_related_to--> `TokenService: async/sync class enforcement`  [INFERRED]
  docs/PARITY.md → services/api/src/auth/token.service.ts

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Tenant-scoped request flow** — sem_auth_guard, services_api_src_db_database_module, packages_db_src_index_withtenant, packages_db_src_rls_enablerls, sem_rls_boundary [EXTRACTED 0.90]
- **WhatsApp inbound → inbox → lead attribution** — packages_contracts_src_index_whatsappprovider, services_whatsapp_src_inbox_service_inboxservice, packages_db_src_whatsapp_schema_conversation, packages_db_src_whatsapp_schema_wamessage, packages_db_src_schema_lead, services_api_src_whatsapp_inbox_controller [EXTRACTED 0.85]
- **Auth token resolution (async/sync class enforcement)** — sem_auth_guard, sem_token_service, packages_db_src_schema_apitoken, sem_arch_parity [EXTRACTED 0.85]

## Communities (41 total, 9 thin omitted)

### Community 0 - "Tenant-Scoped RLS Access"
Cohesion: 0.07
Nodes (38): withTenant(), Multi-tenant from line one (RLS), RLS enterprise_isolation policy, withTenant() txn wrapper, IngestAction, IngestField, ingestLedger, IngestPayload (+30 more)

### Community 1 - "Auth & Token Classes"
Cohesion: 0.06
Nodes (30): P1 execution plan: leads/actions/async/sync API, Zitadel OIDC future IdP, AuthGuard (global APP_GUARD), TeleCRM defects fixed deliberately (D1-D6), NestJS API service (services/api :3005), TokenService: async/sync class enforcement, AppModule, AsyncModule (+22 more)

### Community 2 - "Baileys WhatsApp Driver"
Cohesion: 0.07
Nodes (19): argValue(), main(), AuthenticationCreds, BaileysSessionRecord, BaileysWhatsAppProvider, epochMs(), extractBody(), inferType() (+11 more)

### Community 3 - "Root Workspace Config"
Cohesion: 0.06
Nodes (33): description, devDependencies, @biomejs/biome, turbo, typescript, engines, node, name (+25 more)

### Community 4 - "API Service Dependencies"
Cohesion: 0.06
Nodes (32): dependencies, dotenv, drizzle-orm, fastify, jsonwebtoken, @nestjs/common, @nestjs/core, @nestjs/platform-fastify (+24 more)

### Community 5 - "WhatsApp Inbox Layer"
Cohesion: 0.07
Nodes (10): Risk register: WhatsApp ToS, RLS, license leaks, WhatsApp layer (P2), WhatsApp service (services/whatsapp), InboxController, InboxConfig, EventCb, MockWhatsAppProvider, StatusCb (+2 more)

### Community 6 - "Contracts: Broadcast & Provider"
Cohesion: 0.07
Nodes (16): BroadcastChannel, BroadcastJob, BroadcastRecipientStatus, BroadcastStatus, ConsentRecord, SendTextOptions, WhatsAppContact, WhatsAppContactId (+8 more)

### Community 7 - "DB Package Dependencies"
Cohesion: 0.07
Nodes (28): dependencies, drizzle-kit, drizzle-orm, @opentelecrm/core-domain, pg, postgres, tsx, @types/pg (+20 more)

### Community 8 - "Biome Tooling Config"
Cohesion: 0.07
Nodes (26): files, ignore, ignoreUnknown, formatter, enabled, indentStyle, indentWidth, lineWidth (+18 more)

### Community 9 - "WhatsApp Service Dependencies"
Cohesion: 0.08
Nodes (26): dependencies, dotenv, drizzle-orm, @opentelecrm/contracts, @opentelecrm/db, tsx, @whiskeysockets/baileys, zod (+18 more)

### Community 10 - "DB Schema Core Tables"
Cohesion: 0.09
Nodes (20): action, ActionRow, ActionTypeRow, ApiTokenRow, auditLog, AuditLogRow, EnterpriseRow, LeadFieldRow (+12 more)

### Community 11 - "MCP Service Dependencies"
Cohesion: 0.10
Nodes (20): dependencies, dotenv, drizzle-orm, @modelcontextprotocol/sdk, @opentelecrm/db, zod, devDependencies, @types/node (+12 more)

### Community 12 - "Core Domain Types"
Cohesion: 0.11
Nodes (18): Action, ActionType, ApiToken, AuditLog, Enterprise, LeadField, LostReason, Pipeline (+10 more)

### Community 13 - "TSConfig Base"
Cohesion: 0.11
Nodes (18): compilerOptions, baseUrl, declaration, declarationMap, esModuleInterop, exactOptionalPropertyTypes, forceConsistentCasingInFileNames, lib (+10 more)

### Community 14 - "DB Connection & Migration"
Cohesion: 0.22
Nodes (14): DbSchema, getConnectionString(), getDb(), getPool(), main(), ALL_TENANT_TABLES, DRIZZLE_NAME, enableRls() (+6 more)

### Community 15 - "Contracts Package Config"
Cohesion: 0.13
Nodes (15): devDependencies, typescript, exports, import, main, name, private, scripts (+7 more)

### Community 16 - "Core Domain Package Config"
Cohesion: 0.13
Nodes (15): devDependencies, typescript, exports, import, main, name, private, scripts (+7 more)

### Community 17 - "Lead & Pipeline Domain"
Cohesion: 0.20
Nodes (13): Lead, actionType, enterprise, lead, pipeline, stage, FIRST, LAST (+5 more)

### Community 18 - "Team Controller"
Cohesion: 0.23
Nodes (3): DbClient, isAvailabilityState(), TeamController

### Community 22 - "WhatsApp Schema Tables"
Cohesion: 0.20
Nodes (10): consentLedger, ConsentLedgerRow, ConversationRow, waBroadcast, WaBroadcastRow, WaMessageRow, WaSessionRow, waTemplate (+2 more)

### Community 23 - "MCP Server Surface"
Cohesion: 0.18
Nodes (7): TeleCRM 1:1 wire parity, MCP server (services/mcp :3100), httpServer, PORT, server, tenant(), ToolResult

### Community 24 - "API Tsconfig"
Cohesion: 0.18
Nodes (10): compilerOptions, emitDecoratorMetadata, experimentalDecorators, lib, outDir, rootDir, strictPropertyInitialization, types (+2 more)

### Community 28 - "MCP Tsconfig"
Cohesion: 0.25
Nodes (7): compilerOptions, lib, outDir, rootDir, types, extends, include

### Community 29 - "DB Tsconfig"
Cohesion: 0.29
Nodes (6): compilerOptions, outDir, rootDir, types, extends, include

### Community 30 - "WhatsApp Tsconfig"
Cohesion: 0.29
Nodes (6): compilerOptions, outDir, rootDir, types, extends, include

### Community 31 - "Contracts Tsconfig"
Cohesion: 0.33
Nodes (5): compilerOptions, outDir, rootDir, extends, include

### Community 32 - "Core Domain Tsconfig"
Cohesion: 0.33
Nodes (5): compilerOptions, outDir, rootDir, extends, include

### Community 33 - "Renovate Config"
Cohesion: 0.33
Nodes (5): extends, packageRules, prConcurrentLimit, schedule, $schema

### Community 34 - "API Debug Script"
Cohesion: 0.40
Nodes (4): LOG_LEVEL, PATH, PORT, dev-debug.sh script

### Community 35 - "MCP Dev Script"
Cohesion: 0.40
Nodes (4): MCP_ENTERPRISE_ID, MCP_PORT, PATH, dev.sh script

### Community 36 - "API Dev Script"
Cohesion: 0.50
Nodes (3): PATH, PORT, dev.sh script

## Knowledge Gaps
- **329 isolated node(s):** `$schema`, `enabled`, `clientKind`, `useIgnoreFile`, `ignoreUnknown` (+324 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **9 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `withTenant()` connect `Tenant-Scoped RLS Access` to `Lead & Pipeline Domain`, `Contracts: Broadcast & Provider`, `DB Connection & Migration`, `MCP Server Surface`?**
  _High betweenness centrality (0.128) - this node is a cross-community bridge._
- **Why does `InboxService` connect `Contracts: Broadcast & Provider` to `Tenant-Scoped RLS Access`, `Lead & Pipeline Domain`, `WhatsApp Inbox Layer`?**
  _High betweenness centrality (0.118) - this node is a cross-community bridge._
- **Why does `WhatsAppProvider` connect `Contracts: Broadcast & Provider` to `Baileys WhatsApp Driver`, `WhatsApp Inbox Layer`?**
  _High betweenness centrality (0.105) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `withTenant()` (e.g. with `tenant()` and `.persist()`) actually correct?**
  _`withTenant()` has 2 INFERRED edges - model-reasoned connections that need verification._
- **What connects `$schema`, `enabled`, `clientKind` to the rest of the system?**
  _330 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Tenant-Scoped RLS Access` be split into smaller, more focused modules?**
  _Cohesion score 0.06936026936026936 - nodes in this community are weakly interconnected._
- **Should `Auth & Token Classes` be split into smaller, more focused modules?**
  _Cohesion score 0.05656108597285068 - nodes in this community are weakly interconnected._
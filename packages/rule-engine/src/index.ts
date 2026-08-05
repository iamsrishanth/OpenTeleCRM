/**
 * OpenTeleCRM rule engine — public surface.
 *
 * Pure-TS evaluator for the P4 (A4.x) automation layer. No I/O, no DB, no
 * provider references. The automation service in `services/automation` is
 * the only thing that should import this — the API / MCP surfaces stay
 * thin and call into that service.
 *
 * Two layers of API:
 *   - evaluator + types  — what the caller (or a test) uses to run a rule
 *   - registry           — in-memory rule cache, the only stateful piece
 */
export * from './types.js';
export * from './evaluator.js';
export * from './registry.js';

# `@opentelecrm/rule-engine`

Pure-TS rule evaluator for the **P4 automation layer** (A2.5 chatbot, A2.8
drip/sequences, A4 automation — see `docs/PARITY.md`).

No I/O. No DB. No provider references. The automation service in
`services/automation` is the only thing that should import this package.

## Surface

```ts
import {
  // types — the P4 rule shape
  type AutomationRule,
  type TriggerSpec,
  type Condition,
  type ConditionGroup,
  type ConditionOp,
  type ActionSpec,
  type FactMap,
  type AutomationEvent,
  // evaluator
  evaluateRule,
  evaluateConditionGroup,
  evaluateCondition,
  applyOp,
  planActions,
  substituteString,
  substituteAction,
  resolvePath,
  // registry — in-memory cache
  createRuleRegistry,
  rankCandidates,
  type RuleRegistry,
  type RulePlan,
  type PlannedAction,
  type EvaluationContext,
} from '@opentelecrm/rule-engine'
```

## Pipeline

```
event  +  rule registry  +  facts  →
  rankCandidates()     (priority, enabled, scope)
  evaluateRule()       (trigger match, root guard, per-action when)
  RulePlan[]           (caller dispatches)
```

## Why a separate package

Three consumers, one implementation:

- `services/api` — live event evaluation on `lead.created`,
  `call.completed`, etc.
- `services/automation` worker — scheduled drips (`time.scheduled`).
- `apps/web` rule-tester — "what would this rule do on this lead?".

Keeping it pure means the same code path runs in all three with identical
behavior, and snapshot tests can pin every operator / action kind without
spinning up Postgres or a queue.

## Type provenance

`TriggerSpec`, `ConditionOp`, `ActionSpec`, `AutomationRule` (and friends)
are defined in `src/types.ts` because the P4 slice is the first consumer.
When the contracts team is ready, the canonical copies move to
`@opentelecrm/contracts` and `rule-engine` re-exports them. Consumers
keep importing from `@opentelecrm/rule-engine` either way.

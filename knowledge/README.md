# Knowledge Base

The growing store of concrete patterns and worked examples that back the
guidelines. Distinct from `skills/` (which agents *load*) — this is reference
material humans and agents *read* and *promote from*.

## Contents

| Path                     | What                                                                 |
| ------------------------ | ------------------------------------------------------------------- |
| `instincts/`      | Seed "instincts" — short, concrete patterns extracted from real projects. Project-flavored; generalize before promoting. Full list below. |
| `examples/`              | Worked artifacts: real module `README`s (resilience, external service). Use as the bar for [documentation](../docs/guidelines/documentation.md). |
| `incoming/`              | *Gitignored.* Staging for `pull-knowledge.mjs` output, awaiting review. |

### Instincts by domain

- **Backend structure:**
  [`nestjs-module-structure`](instincts/nestjs-module-structure.md),
  [`drizzle-repository-pattern`](instincts/drizzle-repository-pattern.md),
  [`mapper-pattern`](instincts/mapper-pattern.md),
  [`shared-types-pattern`](instincts/shared-types-pattern.md),
  [`payment-module-pattern`](instincts/payment-module-pattern.md).
- **Dependency boundaries:**
  [`untyped-dependency-adapter`](instincts/untyped-dependency-adapter.md).
- **Async & pipelines:**
  [`bullmq-processor-pattern`](instincts/bullmq-processor-pattern.md),
  [`async-external-pipeline`](instincts/async-external-pipeline.md).
- **Resilience & observability:**
  [`resilience-policy-pattern`](instincts/resilience-policy-pattern.md),
  [`otel-logger-pattern`](instincts/otel-logger-pattern.md).
- **API contract & security:**
  [`api-security-edge-cases`](instincts/api-security-edge-cases.md),
  [`credential-host-scoping`](instincts/credential-host-scoping.md),
  [`scalar-bruno-gherkin-sync`](instincts/scalar-bruno-gherkin-sync.md).
- **Config & environment:**
  [`env-var-sync`](instincts/env-var-sync.md).
- **Frontend:**
  [`angular-ai-assets`](instincts/angular-ai-assets.md),
  [`react-query-bulk-mutation-reconcile`](instincts/react-query-bulk-mutation-reconcile.md),
  [`entity-picker-label-source`](instincts/entity-picker-label-source.md),
  [`frontend-shared-layer-escapes`](instincts/frontend-shared-layer-escapes.md),
  [`dev-server-route-warmup`](instincts/dev-server-route-warmup.md),
  [`keyboard-path-before-done`](instincts/keyboard-path-before-done.md).
- **Workflow & process:**
  [`mr-scope-and-green-pipeline`](instincts/mr-scope-and-green-pipeline.md),
  [`commit-convention`](instincts/commit-convention.md),
  [`plan-before-operational-change`](instincts/plan-before-operational-change.md),
  [`spec-kit-workflow`](instincts/spec-kit-workflow.md),
  [`self-review-before-done`](instincts/self-review-before-done.md),
  [`verified-progress-signal`](instincts/verified-progress-signal.md),
  [`spec-status-sync`](instincts/spec-status-sync.md),
  [`provisioning-state-registry`](instincts/provisioning-state-registry.md),
  [`one-artifact-root`](instincts/one-artifact-root.md),
  [`documentation-chain-followthrough`](instincts/documentation-chain-followthrough.md).
- **Testing:**
  [`testing-pattern`](instincts/testing-pattern.md),
  [`negative-assertion-precondition`](instincts/negative-assertion-precondition.md),
  [`ui-change-needs-visual-proof`](instincts/ui-change-needs-visual-proof.md),
  [`e2e-gate-budget`](instincts/e2e-gate-budget.md),
  [`evidence-outlives-the-claim`](instincts/evidence-outlives-the-claim.md).
- **Build & packaging:**
  [`vendored-corpus-manifest`](instincts/vendored-corpus-manifest.md),
  [`embedded-tree-lifecycle`](instincts/embedded-tree-lifecycle.md).

## What an "instinct" is

A tiny, high-signal note that captures one pattern an agent should reach for
automatically: the shape, the gotcha, the rule. They're the raw material for
`skills/` and `docs/`. When an instinct proves generic and reusable, promote it
(see [knowledge-capture](../docs/workflows/knowledge-capture.md)) — rewriting away
project-specific names.

## Adding knowledge

Prefer `scripts/pull-knowledge.mjs` to harvest from a project, then promote the
keepers. Hand-authored notes are welcome too — keep them short and concrete, and
link related ones.

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
  `payment-module-pattern`.
- **Dependency boundaries:**
  `untyped-dependency-adapter`.
- **Async & pipelines:**
  [`bullmq-processor-pattern`](instincts/bullmq-processor-pattern.md),
  `async-external-pipeline`.
- **Resilience & observability:**
  [`resilience-policy-pattern`](instincts/resilience-policy-pattern.md),
  [`otel-logger-pattern`](instincts/otel-logger-pattern.md).
- **API contract & security:**
  [`api-security-edge-cases`](instincts/api-security-edge-cases.md),
  [`credential-host-scoping`](instincts/credential-host-scoping.md),
  [`scalar-bruno-gherkin-sync`](instincts/scalar-bruno-gherkin-sync.md),
  [`untrusted-text-inside-a-fence`](instincts/untrusted-text-inside-a-fence.md),
  [`no-undo-write-needs-a-receipt`](instincts/no-undo-write-needs-a-receipt.md).
- **Config & environment:**
  [`env-var-sync`](instincts/env-var-sync.md).
- **Platform & SDK freshness:**
  `platform-skill-before-memory`.
- **Frontend:**
  `angular-ai-assets`,
  `react-query-bulk-mutation-reconcile`,
  `entity-picker-label-source`,
  `frontend-shared-layer-escapes`,
  `dev-server-route-warmup`,
  [`keyboard-path-before-done`](instincts/keyboard-path-before-done.md),
  [`hit-region-keeps-drawn-size`](instincts/hit-region-keeps-drawn-size.md).
- **Workflow & process:**
  [`mr-scope-and-green-pipeline`](instincts/mr-scope-and-green-pipeline.md),
  [`commit-convention`](instincts/commit-convention.md),
  [`plan-before-operational-change`](instincts/plan-before-operational-change.md),
  `spec-kit-workflow`,
  [`self-review-before-done`](instincts/self-review-before-done.md),
  [`verified-progress-signal`](instincts/verified-progress-signal.md),
  `spec-status-sync`,
  `provisioning-state-registry`,
  `one-artifact-root`,
  `openspec-artifact-chain`,
  [`cap-as-ratchet-with-baseline`](instincts/cap-as-ratchet-with-baseline.md),
  [`worktree-base-before-work`](instincts/worktree-base-before-work.md),
  [`changelog-entry-in-the-same-task`](instincts/changelog-entry-in-the-same-task.md),
  `parallel-locale-artifacts`,
  [`documentation-chain-followthrough`](instincts/documentation-chain-followthrough.md),
  [`subagent-worktree-fence`](instincts/subagent-worktree-fence.md).
- **Testing:**
  [`testing-pattern`](instincts/testing-pattern.md),
  [`negative-assertion-precondition`](instincts/negative-assertion-precondition.md),
  [`ui-change-needs-visual-proof`](instincts/ui-change-needs-visual-proof.md),
  [`e2e-gate-budget`](instincts/e2e-gate-budget.md),
  [`evidence-outlives-the-claim`](instincts/evidence-outlives-the-claim.md),
  [`evidence-needs-a-control`](instincts/evidence-needs-a-control.md),
  [`test-proves-presence-not-truth`](instincts/test-proves-presence-not-truth.md),
  [`platform-a11y-audit-is-lenient`](instincts/platform-a11y-audit-is-lenient.md),
  [`snapshot-references-are-os-bound`](instincts/snapshot-references-are-os-bound.md),
  `shell-refusal-goes-to-stderr`.
- **Build & packaging:**
  `vendored-corpus-manifest`,
  `embedded-tree-lifecycle`,
  [`generated-file-whole-run`](instincts/generated-file-whole-run.md),
  [`build-success-needs-an-artifact`](instincts/build-success-needs-an-artifact.md),
  `declare-every-imported-module`,
  [`swift-type-check-budget`](instincts/swift-type-check-budget.md).

## What an "instinct" is

A tiny, high-signal note that captures one pattern an agent should reach for
automatically: the shape, the gotcha, the rule. They're the raw material for
`skills/` and `docs/`. When an instinct proves generic and reusable, promote it
(see knowledge-capture) — rewriting away
project-specific names.

## Adding knowledge

Prefer `scripts/pull-knowledge.mjs` to harvest from a project, then promote the
keepers. Hand-authored notes are welcome too — keep them short and concrete, and
link related ones.

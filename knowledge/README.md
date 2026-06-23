# Knowledge Base

The growing store of concrete patterns and worked examples that back the
guidelines. Distinct from `skills/` (which agents *load*) — this is reference
material humans and agents *read* and *promote from*.

## Contents

| Path                     | What                                                                 |
| ------------------------ | ------------------------------------------------------------------- |
| `instincts/`      | Seed "instincts" — short, concrete patterns extracted from a real project (module structure, repository, mapper, BullMQ processor, OTel logger, resilience policy, shared types, commit convention, Scalar/Bruno/Gherkin sync, payment module). Project-flavored; generalize before promoting. |
| `examples/`              | Worked artifacts: real module `README`s (resilience, acme) and a per-path Copilot instructions example. Use as the bar for [documentation](../docs/guidelines/documentation.md). |
| `incoming/`              | *Gitignored.* Staging for `pull-knowledge.mjs` output, awaiting review. |

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

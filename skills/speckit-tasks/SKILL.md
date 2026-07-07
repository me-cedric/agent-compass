---
name: speckit-tasks
description: >
  Use when generating Spec Kit implementation tasks from an approved plan and
  design artifacts.
risk_level: medium
writes_files: true
requires_tools: []
---

# Spec Kit Tasks

Read `AGENTS.md`, `spec.md`, `plan.md`, `research.md`, contracts, and data model
before writing tasks.

## Do

1. Generate ordered, test-first tasks.
2. Mark independent tasks with `[P]` only when they touch separate files and can
   truly run in parallel.
3. Include docs, contracts, env examples, migrations, and validation tasks when
   affected.
4. Keep tasks small enough to review and validate.

## Done

- `tasks.md` can be executed top to bottom.
- Each behavior change has a nearby test or an explicit no-test reason.
- No task depends on hidden context outside the artifacts.

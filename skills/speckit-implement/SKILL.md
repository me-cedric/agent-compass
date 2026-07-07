---
name: speckit-implement
description: >
  Use when executing approved Spec Kit tasks after spec, plan, tasks, and
  checklists are ready.
risk_level: high
writes_files: true
requires_tools: []
---

# Spec Kit Implement

Use only after the user approved implementation.

## Do

1. Read `AGENTS.md`, `spec.md`, `plan.md`, `tasks.md`, checklists, and command
   registry.
2. Stop if required checklists are incomplete unless the user explicitly says to
   proceed.
3. Execute tasks in order; keep the diff scoped.
4. Update specs/tasks/status/docs/contracts/env files in the same change when
   behavior changes.
5. Run the smallest validation set that covers touched files.

## Done

- Tasks are checked off only when code, tests, docs, and validation support it.
- Completion Gate reports files, commands, results, failures, and risks.

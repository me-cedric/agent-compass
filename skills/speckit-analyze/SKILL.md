---
name: speckit-analyze
description: >
  Use when checking Spec Kit artifacts for inconsistencies across spec, plan,
  tasks, contracts, docs, and validation.
risk_level: low
writes_files: false
requires_tools: []
---

# Spec Kit Analyze

Read `AGENTS.md` plus the target feature's `spec.md`, `plan.md`, `tasks.md`,
checklists, contracts, and docs.

## Check

- Requirements missing from plan/tasks.
- Tasks that implement behavior not in the spec.
- API/env/docs/security changes without companion tasks.
- Unresolved clarifications that reached implementation.
- Validation commands that are invented or too broad.
- Completed status that does not match code/tests/docs.

## Done

Return findings ordered by severity with file references and exact fix actions.
Do not edit files unless the user explicitly asks.

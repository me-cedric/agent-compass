---
name: speckit-converge
description: >
  Use after implementation to reconcile Spec Kit artifacts, code, tests, docs,
  and implementation status.
risk_level: medium
writes_files: true
requires_tools: []
---

# Spec Kit Converge

Read `AGENTS.md`, changed code, tests, docs, and the feature's spec artifacts.

## Do

1. Compare implemented behavior against the spec and tasks.
2. Update stale artifacts or report code gaps; do not let them diverge silently.
3. Check docs, API contracts, env examples, migrations, and validation status.
4. Record remaining work as explicit tasks, not vague TODOs.

## Done

- Artifacts reflect current code.
- Remaining gaps are listed with concrete next steps.
- Validation status is honest.

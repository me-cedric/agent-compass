---
name: speckit-specify
description: >
  Use when running a Spec Kit specify step to create or update a feature
  specification from a natural-language feature request.
risk_level: medium
writes_files: true
requires_tools: []
---

# Spec Kit Specify

Read `AGENTS.md`, existing `specs/`, `.specify/README.md` if present, and the
active spec template.

## Do

1. Reuse an existing spec when the feature already exists.
2. Create one feature spec at a time under `specs/FEATURE_ID/`.
3. Write user value, actors, scenarios, requirements, non-goals, edge cases, and
   measurable success criteria.
4. Keep technology choices and implementation details out of the spec.
5. Use at most three `[NEEDS CLARIFICATION]` markers, only for blocking choices.

## Done

- `spec.md` is behavior-focused and testable.
- Assumptions and open questions are explicit.
- Agent stops before plan unless user asked to continue.

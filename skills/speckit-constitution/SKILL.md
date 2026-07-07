---
name: speckit-constitution
description: >
  Use when creating or updating a Spec Kit project constitution, governance
  rules, principles, or non-negotiable constraints.
risk_level: medium
writes_files: true
requires_tools: []
---

# Spec Kit Constitution

Read `AGENTS.md`, `.specify/memory/constitution.md` if present, and
`docs/workflows/spec-driven-development.md`.

## Do

1. Capture durable principles only: product boundaries, security rules, quality
   gates, documentation rules, and decision ownership.
2. Keep implementation details out unless they are true governance constraints.
3. Mark unresolved governance choices as open questions.
4. Update downstream specs/plans only when the constitution change affects them.

## Done

- Constitution is updated or reviewed.
- Conflicts with `AGENTS.md` are called out.
- Open questions and validation impact are listed.

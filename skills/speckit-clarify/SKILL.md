---
name: speckit-clarify
description: >
  Use when resolving Spec Kit open questions, NEEDS CLARIFICATION markers, or
  ambiguous feature requirements before planning.
risk_level: medium
writes_files: true
requires_tools: []
---

# Spec Kit Clarify

Read `AGENTS.md`, the target `spec.md`, and any checklist or product source the
spec references.

## Do

1. Find every `[NEEDS CLARIFICATION]` marker and ambiguous requirement.
2. Ask only questions that change scope, security/privacy, user experience, or
   acceptance criteria.
3. Use sensible defaults for low-impact gaps and document them as assumptions.
4. Update the spec with answers; do not hide unresolved blockers.

## Done

- No blocking ambiguity remains.
- Updated spec records decisions and assumptions.
- Planning can proceed or blockers are clearly listed.

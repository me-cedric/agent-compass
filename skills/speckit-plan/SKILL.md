---
name: speckit-plan
description: >
  Use when creating a Spec Kit technical plan, research notes, data model,
  contracts, quickstart, or validation plan from an approved spec.
risk_level: medium
writes_files: true
requires_tools: []
---

# Spec Kit Plan

Read `AGENTS.md`, the approved `spec.md`, `.specify/memory/constitution.md` if
present, and existing architecture/module docs.

## Do

1. Convert behavior into technical approach, affected files, data model,
   contracts, risks, and validation commands.
2. Put implementation decisions here, not in the spec.
3. Resolve unknowns in `research.md` before tasks are generated.
4. Keep API contracts, env vars, docs, security, migrations, and shared package
   consumers in the validation map when affected.

## Done

- `plan.md` is executable and traceable to the spec.
- Research/open questions are resolved or marked blocking.
- Validation commands come from the host command registry or package scripts.

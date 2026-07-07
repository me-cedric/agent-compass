---
name: speckit-agent-context-update
description: >
  Use when refreshing AGENTS.md or provider context markers from current Spec Kit
  artifacts without overwriting host-owned guidance.
risk_level: medium
writes_files: true
requires_tools: []
---

# Spec Kit Agent Context Update

Read `AGENTS.md`, `.specify/extensions.yml`, `.specify/feature.json`, and the
current feature artifacts.

## Do

1. Update only the block between configured Spec Kit markers.
2. Preserve all host-owned text outside the markers.
3. Summarize active feature directory, spec/plan/tasks status, and required
   validation.
4. If markers are missing, create a small proposed block or report the exact
   missing marker instead of rewriting the whole file.

## Done

- Agent context points at current artifacts.
- No unrelated guidance changed.

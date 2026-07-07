---
name: speckit-taskstoissues
description: >
  Use when converting Spec Kit tasks.md items into deduplicated GitHub issues
  tied to the current repository.
risk_level: high
writes_files: false
requires_tools: [github]
---

# Spec Kit Tasks To Issues

Use only when the user explicitly asks to create issues.

## Do

1. Read `AGENTS.md`, `tasks.md`, and the git remote.
2. Proceed only if the remote is a GitHub repository and the available GitHub
   tool targets that same repository.
3. Extract task IDs like `T001` from unchecked tasks.
4. Search existing open and closed issues for those task IDs before creating
   anything.
5. Create one issue per missing task with title `T001: task description`.

## Stop

- Remote is not GitHub.
- GitHub tool repo does not match the remote.
- User did not explicitly approve issue creation.

## Done

Report created, skipped, and blocked task IDs.

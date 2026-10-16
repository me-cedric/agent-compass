---
name: project-memory
description: Read and write durable project memory with projectmem. Use before non-trivial work, and after a decision, a failed attempt, a fix or a finding.
risk_level: medium
writes_files: false
requires_tools: [pjm]
---

# project-memory

## Before work

```bash
pjm regenerate   # after a pull or merge: fold the shared events of teammates into the log
pjm brief
pjm precheck
```

For a non-trivial task, also search the memory for the files, modules, libraries and errors that the task touches.

## Shared and local

`events.jsonl` is the committed source of truth. It merges as a union.
The projections (`summary.md`, `PROJECT_MAP.md`, `AI_INSTRUCTIONS.md`, `issues/`) are git-ignored. `pjm regenerate` rebuilds them.
Never commit a projection. A committed summary overwrites the work of teammates.

## During work

Log each of these when it happens:

- A failed attempt.
- An important finding.
- A fragile file or a risky area.
- A library or tooling gotcha that other people can reuse.

## After work

Log these items:

- Decisions and fixes.
- Files changed.
- Validation commands and their results.
- Remaining risks.

Write a committed ADR in `{{ADR_DIR}}` for each durable architecture decision. Use the skill `adr`. One file for each decision merges cleanly.

## Never log

- Secrets, tokens or credentials.
- Personal data or raw customer data.
- Temporary brainstorming.

If projectmem is not available, continue the task. Report memory logging as `not run`, with the reason.

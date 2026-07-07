# Project Memory

Use this workflow when a host project uses `projectmem` or another durable memory
tool.

## Before starting

1. If you just pulled/merged, run `pjm regenerate` to fold teammates' shared
   events into your local summary (the `post-merge` hook does this automatically).
2. Read relevant memory summaries, usually with `pjm brief` or MCP summary tools.
3. Check pre-action warnings before editing fragile areas, usually with
   `pjm precheck`.
4. Search memory for the files, modules, libraries, or error strings involved.

## During work

Log durable facts as they happen:

- failed attempts immediately, with the exact reason they failed
- important findings when discovered
- fragile files or risky areas when identified
- cross-project library gotchas that could help future work

Keep entries short and factual. Do not log speculation.

## After work

Log:

- decisions made and why
- fixes shipped
- files changed
- validation commands and results
- remaining risks or follow-up work

## Do not log

- secrets, tokens, credentials, or private keys
- personal data
- raw customer data
- temporary brainstorming
- noisy todo lists that will be stale tomorrow

## Sharing across a team

projectmem is event-sourced: `events.jsonl` is the append-only source of truth and
every other file is a projection rebuilt by `pjm regenerate`. Share the log, not
the projections.

- Commit `.projectmem/events.jsonl` (union-merged via `.gitattributes`); gitignore
  the regenerated `summary.md`, `PROJECT_MAP.md`, `AI_INSTRUCTIONS.md`, `issues/`.
- Run `pjm regenerate` after every pull/merge.
- High-churn running record (attempts, findings, fixes) lives in the log. Durable
  architecture/design decisions go in a committed ADR (`docs/decisions/NNN-*.md`) —
  one file per decision merges cleanly and survives regeneration.

See `docs/tooling/projectmem.md` for the full collaboration model, the one-time
migration, and the sequential-issue-id caveat.

## If projectmem is unavailable

Continue the task, then report memory logging as `not run` with the reason. Do
not invent a substitute memory store unless the user asks.

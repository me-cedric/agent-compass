# Project Memory Policy

Use `projectmem` for durable project memory when available.

## Shared Vs Local

- `.projectmem/summary.md` is generated shared context. It may be committed after
  review for secrets, personal data, and local absolute paths.
- Raw runtime data stays local by default: `events.jsonl`, `issues/`, watch
  files, data directories, and DB files.
- Backfill is opt-in. It can create many legacy issue files.

## Before Starting

- Read relevant projectmem summaries.
- Check pre-action warnings before editing fragile areas.
- Search memory for related files, modules, libraries, and previous errors.

## During Work

- Log failed attempts immediately.
- Log important findings when discovered.
- Log fragile files or risky areas when discovered.

## After Work

- Log decisions.
- Log fixes.
- Log files changed.
- Log validation commands and results.
- Log remaining risks.

## Never Log

- secrets
- tokens
- credentials
- private keys
- personal data
- temporary brainstorming
- stale todo noise

Keep entries concise, factual, and useful for future agents.

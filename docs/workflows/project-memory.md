# Project Memory

Use this workflow when a host project uses `projectmem` or another durable memory
tool.

## Before starting

1. Read relevant memory summaries, usually with `pjm brief` or MCP summary tools.
2. Check pre-action warnings before editing fragile areas, usually with
   `pjm precheck`.
3. Search memory for the files, modules, libraries, or error strings involved.

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

## If projectmem is unavailable

Continue the task, then report memory logging as `not run` with the reason. Do
not invent a substitute memory store unless the user asks.

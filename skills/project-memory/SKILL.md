---
name: project-memory
description: >
  Use when a project has projectmem or durable agent memory. Reads memory before
  work, checks pre-action warnings, and records durable findings, failed
  attempts, decisions, fixes, validation, and risks.
license: MIT
compatibility: projectmem
user-invocable: true
disable-model-invocation: false
allowed-tools: Bash, Read, Grep
argument-hint: "[before|during|after]"
risk_level: medium
writes_files: false
requires_tools: []
---

# Project Memory

Use projectmem for durable project memory when available.

## Before Starting

Run or request the projectmem equivalent:

```bash
pjm brief
pjm precheck
```

Also search memory for relevant files, modules, libraries, and errors when the
task is non-trivial.

## During Work

Log:

- failed attempts immediately
- important findings when discovered
- fragile files or risky areas
- reusable library or tooling gotchas

## After Work

Log:

- decisions
- fixes
- files changed
- validation commands and results
- remaining risks

## Never Log

Do not log secrets, tokens, credentials, personal data, raw customer data, or
temporary brainstorming.

If projectmem is unavailable, continue the task and report memory logging as
`not run` with the reason.

---
status: accepted
date: 2026-10-16
decision-makers: [Cédric Meyer]
---

# Zero-dependency local UI, age secret bundles, process-compose runner

## Context and problem statement

Developers and agents need one place to manage env values, start the local stack, run e2e suites,
and see token cost per project. Konvoy is a desktop app with its own release cycle.

## Considered options

1. UI: zero-dep Node server, module inside Konvoy, or a standalone Tauri app.
2. Secret sharing: age bundle, SOPS file in repo, password manager CLI, dotenvx.
3. Runner: process-compose or a compass-native Node runner.

## Decision outcome

- UI: `ac ui` starts a Node server on 127.0.0.1 with a random port and a URL token. One static page. It includes a delivery tab over Konvoy files.
- Secrets: `ac env export` encrypts with `age -R` to teammates' SSH public keys. No plaintext in git.
- Runner: process-compose for app processes with health probes and logs. Infra runs in docker compose profiles.

## Consequences

- Good: runs in any repo without install; secrets never touch git; agents get `is_ready` and logs through MCP.
- Bad: developers install `age` and `process-compose` (single binaries).

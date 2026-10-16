---
status: accepted
date: 2026-10-16
decision-makers: [Cédric Meyer]
---

# Compass and Konvoy split ownership by path

## Context and problem statement

Konvoy and compass both write `.agents/skills`, `AGENTS.md`, `CLAUDE.md` and `.mcp.json`, and each keeps its own ledger.
Two writers of one file cause silent overwrites.

## Considered options

1. Compass engine owns all agent assets; Konvoy calls it.
2. Konvoy is the only installer.
3. Both write, each to a fixed set of paths.

## Decision outcome

Chosen: option 3.

- Files: each writer owns named files. `.agents/konvoy.json` and `docs/delivery/**` belong to Konvoy. `.agents/compass.lock.json` belongs to compass.
- Skill dirs: each ledger lists the skill directories it owns. A name in both ledgers is an error.
- JSON and TOML files: each writer owns named top-level keys (for example `mcpServers.konvoy`).
- Markdown files: each writer owns one delimited block (`<!-- compass:begin -->` … `<!-- compass:end -->`).
- Path keys: compass reads Konvoy `paths` from `.agents/konvoy.json` when it exists. Else it uses the same 14 keys and defaults from its own config.

## Consequences

- Good: no silent overwrite; both tools can run in any order.
- Bad: Konvoy must change to respect the contract (follow-up in the Konvoy repo).

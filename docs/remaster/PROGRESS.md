# Remaster progress

Plan: `docs/remaster/plan.md`. Evidence: `inventory.md`, `keep-cut.md`, `research.md`. Decisions: `docs/decisions/0001`–`0006`.
Rule: one phase is one goal with a check. Update `passes` only after the check runs green.

| # | Phase | passes | Check | Notes |
|---|---|---|---|---|
| 0 | Evidence | true | files exist; ADRs have MADR frontmatter | 2026-10-16 |
| 1 | Cut | true | `npm test` green; `git grep -il gemini` only in CHANGELOG; ≤260 tracked files | 2026-10-16: 260 tracked + 14 new evidence files; `npm run check` green. The final budget (≤220) applies at phase 10. |
| 2 | Engine | true | fixture tests: idempotent sync, edits kept, Konvoy bytes unchanged, `check --frozen` fails on drift | 2026-10-16: `npm run check` green (74 tests); engine + CLI 1,019 lines. |
| 3 | Harness | false | `ac doctor --tokens` within budget; TOML/JSON parse; `cat .env` blocked | |
| 4 | Skills and rules | false | naming lint; listing ≤3,000 chars; no hard-coded `docs/delivery` | |
| 5 | Konvoy and specs | false | `ac check` docs layout on StoryArc and Konvoy copies; NE `migrate --docs --dry` | |
| 6 | Dev-loop packs | false | NE `env check` findings; PP `ac dev up --dry`; age round trip | |
| 7 | Quality packs | false | CI template lint; SARIF merge self-test | |
| 8 | UI | false | screenshot per tab; usage within 1% of ccusage | |
| 9 | Migration | false | dry run and apply on PP, NE, StoryArc, Konvoy copies; no edit lost | |
| 10 | User level and release | false | plugin installs from a local path in Claude and Codex | |
| 11 | Graph (later) | false | KPI before/after report | |

## Log

- 2026-10-16: phase 0 done. Old ADRs 001–002 and the old template removed; MADR 4 template is `adr-template.md`.
- 2026-10-16: phase 1 done. Sequencing change: the whole 0.9 engine (install, sync, manifest, doctor, skills-sync, upstream, global-setup, code-intel, CLI) was removed in phase 1, not phase 2, because its tests only guarded code that phase 2 replaces. Stack detection moved to `engine/detect.mjs`. Broken links in legacy docs were unlinked; legacy docs stay as source material for phases 3–4 and go in phase 10.
- Konvoy is no longer a denied name in `check-naming`; `docs/remaster/` is exempt from the naming check.
- Review round 1 (phase 0–1): fixed stale registry and npm scripts, OpenSpec detection (directory only, declared path), naming-check scope (`docs/remaster` only), restored `paag` deny. `release` and `lint:release` npm scripts return in phase 10.
- Open for owner: LICENSE holder is "CGI" (taken from the old notices). Trackers decision has no ADR; it is a scope choice recorded in the plan.
- 2026-10-16: phase 2 done. `bin/ac.mjs` has `init`, `sync`, `check`, `doctor`, each with `--dry` and `--json`. Exit 0 is success, 1 is errors or drift, 2 is a usage error.
- Engine layout: `util`, `config` (compass.json, Konvoy ledger, 14 path keys), `merge` (block, JSON splice, TOML line or table), `plan` (layers), `sync` (reconcile and lock), `git` (tag pin), `doctor`, `detect`.
- Source layers have one layout: `skills/<n>/`, `agents/*.md`, `rules/**/*.md`, `files/**`, `seed/**`, `blocks/<path>`, `keys.json`. Layers are the compass root, `core/`, then `packs/<p>`. Phases 3–6 only add files there.
- Lock `.agents/compass.lock.json` has `lockVersion: 2`, `version`, `tag`, `skills`, `files` (sha + owner), `keys` (file → key → sha) and `blocks` (file → sha). It has no timestamp, so two syncs give no diff.
- Konvoy ownership is read from `.agents/konvoy.json`: `paths`, `compass_skills`, `taste_skills`, `host_files`, the `*.konvoy` MCP keys, and a new `owns` object (`files`, `skills`, `keys`). Phase 5 writes `owns` into the ownership contract; Konvoy must write it (follow-up).
- Deferred on purpose: `{{DELIVERY_DIR}}`-style placeholders (phase 4), MCP catalog fan-out to `.mcp.json`, `.codex/config.toml` and `.vscode/mcp.json` (phase 6). Legacy `skills/*` install until phase 4 replaces them.
- Review round 1 (Sonnet, fresh context) found 6 defects; all fixed: JSON edits now splice text (no reformat, no number change); the TOML scan skips multi-line strings and arrays; `--to` refuses a tag without `bin/ac.mjs`; a path that moves between mechanisms is not deleted; no write through a symlink; a directory at a file path is an error.
- Review round 2 found 2 low defects; both fixed: `--to --dry` also refuses a tag without `bin/ac.mjs`; a lock entry that moves to another mechanism is reported as `release`. Stop after round 2, as the plan says. Nothing is committed.

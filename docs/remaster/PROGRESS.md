# Remaster progress

Plan: `docs/remaster/plan.md`. Evidence: `inventory.md`, `keep-cut.md`, `research.md`. Decisions: `docs/decisions/0001`–`0006`.
Rule: one phase is one goal with a check. Update `passes` only after the check runs green.

| # | Phase | passes | Check | Notes |
|---|---|---|---|---|
| 0 | Evidence | true | files exist; ADRs have MADR frontmatter | 2026-10-16 |
| 1 | Cut | true | `npm test` green; `git grep -il gemini` only in CHANGELOG; ≤260 tracked files | 2026-10-16: 260 tracked + 14 new evidence files; `npm run check` green. The final budget (≤220) applies at phase 10. |
| 2 | Engine | true | fixture tests: idempotent sync, edits kept, Konvoy bytes unchanged, `check --frozen` fails on drift | 2026-10-16: `npm run check` green (74 tests); engine + CLI 1,019 lines. |
| 3 | Harness | true | `ac doctor --tokens` within budget; TOML/JSON parse; `cat .env` blocked | 2026-10-16: `npm run check` green (88 tests). Fresh host: about 1,183 of 2,000 tokens; SessionStart 276 of 1,000 chars. |
| 4 | Skills and rules | true | naming lint; listing ≤3,000 chars; no hard-coded `docs/delivery` | 2026-10-16: `npm run check` green (101 tests). Fresh NestJS host: about 1,524 of 2,000 tokens. Model-invoked listing 1,916 of 3,000 chars. 253 files. |
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
- 2026-10-16: phase 3 done. `core/` holds the contract block (58 lines), the CLAUDE.md block, the `compass` output style, the role agents `scout`, `worker`, `reviewer`, the hook script `.agents/hooks/compass.mjs` (`guard`, `gate`, `start`) and the `deliver` workflow.
- Owned keys: `.claude/settings.json` (`outputStyle`, `hooks.PreToolUse`, `hooks.Stop`, `hooks.SessionStart`, `permissions.deny`, `permissions.ask`), `.codex/config.toml` (`model_verbosity`, `model_reasoning_summary`), `.codex/hooks.json` (the same three hooks).
- Engine: role agents with `copilot-model` also write `.github/agents/<n>.agent.md`. `ac doctor --tokens` measures blocks, skill and agent listings, the output style and the SessionStart and UserPromptSubmit hook output. `ac doctor` warns for each owned item that the project edited ("kept").
- Copilot answer and provider facts: `research.md` section 8.
- Open for phase 4: the legacy root `skills/` still install and give a 4,089-character listing, so `ac doctor --tokens` on the real tree is over budget (about 2,206 tokens). The phase 4 listing can use about 800 tokens.
- Open for phase 9: an owned key is one whole value. A host that already has `hooks.PreToolUse` or `permissions.deny` keeps its value, and compass does not install its hooks or guards there (doctor warns). Array merge is a migration task.
- Open: Codex has no tracker guard yet (phase 6 MCP catalog sets read-only servers). No `.github/hooks` for the Copilot cloud agent yet.
- 2026-10-16: phase 4 done. 19 own skills in `skills/`. Nine skills that the user starts set `disable-model-invocation: true`: compass, grill, adr, task-flow, remaining-work, delivery-digest, impact-analysis, harness-loop, architecture-advisor. The 10 others are in the listing. 29 old skill dirs, `stacks/`, `knowledge/examples/` and 25 instincts are folded and deleted. Broken links in legacy docs were unlinked.
- Placeholders: `{{<KEY>_DIR}}` or `{{<KEY>_FILE}}` for the 14 path keys. The engine fills skill, rule and block text from the resolved paths. An unknown `{{UPPER}}` token is an install error. Upstream text is not filled. `test/skills.test.mjs` fails when a skill or rule holds a default path such as `docs/delivery`.
- Rules: 10 `rules/stack-*.md` with `description`, `paths` and `stacks`. Each also installs as the Codex skill `.agents/skills/stack-<n>` (not in `.claude/skills`). Stack packs are the frontmatter `stacks` lists; there is no separate map file. New stack ids: `gtk-desktop`, `winui-desktop`, `macos-desktop`. `STACK_IDS` in `engine/detect.mjs` lists every id, and a test checks the assets against it.
- Upstream: `upstream.json` pins 13 sources by sha. A host opts in with `"upstream": ["<id>"]` in `.agents/compass.json`. Only `ac sync` and `ac init` fetch, into `$AC_CACHE` or `$XDG_CACHE_HOME/agent-compass/upstream`. Offline gives a warning, and the installed copy stays. The source licence file goes beside each skill; a source without one is an error. A real sync of all 13 sources installed 148 skills.
- Review round 1 (phase 4): fixed two upstream name collisions, the dot-dir name search, the licence lookup (symlinks, `LICENSE-MIT`, missing file), a placeholder example that the engine filled, macOS detection for Swift libraries and Flutter, prototype-key source ids, rule exclusion, and a doctor warning for held upstream skills.
- Review round 2 (phase 4): every root licence file is copied (dual licences); `macos-desktop` comes only from `SDKROOT = macosx` in an Xcode project, so a SwiftPM-only macOS app is not detected. Stop after 2 rounds.
- Open for phase 5: skills assume `ac init --from-specs`, `ac migrate` and `ac promote`; each tells the agent to stop on "Unknown command". Confirm the Konvoy paths that skills write: `{{DELIVERY_DIR}}/questions/Q-NNN.md`, `drift/`, `visual/`, `{{PLANNING_DIR}}/audit/` and `completion-plan.md`, and `.agents/progress/<slug>.md`.
- Open for the owner: review the desktop rules (`stack-gtk`, `stack-winui`, `stack-macos`), written from general practice. Verify the Mockoon and Bruno CLI flags in `api-contract-sync`. `spec-flow` runs `npx @firecrawl/anydoc@0.2.3` for document conversion. Seven taste skills install under dir names that differ from their frontmatter `name`.
- Open: Copilot reads `.claude/rules` and `.agents/skills`, so it sees each stack rule twice. `ac doctor --tokens` measures the Claude listing only; the Codex listing adds the `stack-*` skills.

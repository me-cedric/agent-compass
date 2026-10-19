# agent-compass 1.0 — remaster plan

## Context

Compass 0.9.6 is too big and too flaky to install and update.
- Size: 508 files, 2.5 MB, 55 CLI commands, 65 skills, 56 instincts, 83 docs. AGENTS.md is 27 KB.
- Hosts drift. NE runs 0.7.0 (vendored, 198 skills, 157 unused). PP runs 0.9.4 (hooks installed but not wired). StoryArc runs 0.9.6, but its Konvoy ledger says 0.9.1.
- Konvoy and compass both write `.agents/skills`, `AGENTS.md` and `.mcp.json`, with two ledgers.
- Three spec dialects exist: spec-kit (NE), native OpenSpec (StoryArc), konvoy-delivery OpenSpec (Konvoy).
- Style and token rules are advisory text. No output style is set, no hook enforces them, and nothing measures cost.
- Missing: env catalog, local run, e2e launcher, cost KPIs, infra debug MCPs, CI for GitLab, tracker guardrails.

Outcome: a small 1.0 that installs few files, updates deterministically, and covers Claude Code, Codex and Copilot end to end. It also ships a zero-dep local UI. Host repos are NOT migrated in this work.

## Decisions (confirmed with user)

| Topic | Decision |
|---|---|
| Providers | Claude Code, Codex, Copilot. Drop Gemini, CODEX.md, GEMINI.md. |
| Engine | Own lean zero-dep Node engine. APM-style semantics: per-file hash lock, stale cleanup, keep edited files, `--frozen` check. |
| Channel | Git submodule `docs/agent-compass`, pinned to a release tag. No vendoring. |
| Konvoy | Split by path. Each writer owns named files, skill dirs, JSON keys and Markdown blocks. |
| Specs | OpenSpec at `docs/openspec` with the konvoy-delivery schema. |
| UI | `ac ui`: zero-dep Node server on localhost, one static page. Includes a delivery tab. |
| Secrets sharing | age-encrypted bundle to teammates' SSH public keys. |
| Trackers | Jira Cloud, Jira Server/DC, GitLab issues, GitHub issues. |
| Local runner | process-compose. Infra in docker compose profiles. |
| Licence | MIT. |
| "numeum" | numeric-emploi. |

## Target shape

### Host repo after `ac sync`

| Path | Owner | Content |
|---|---|---|
| `AGENTS.md` | project + `compass` block + `konvoy` block | Compass block ≤120 lines: core contract, style contract, routing to skills. |
| `CLAUDE.md` | project + `compass` block | `@AGENTS.md` plus ≤15 Claude lines. |
| `.agents/compass.json` | project | Version, packs, paths (when no Konvoy), exclude list, MCP picks, tracker, env. |
| `.agents/compass.lock.json` | engine | Version, tag, per-file sha + owner, owned JSON/TOML keys, owned blocks. |
| `.agents/skills/<n>`, `.claude/skills/<n>` | engine (per skill dir) | Same bytes in both dirs. Project skills use `<project>-<n>` and `metadata.owner: project`. |
| `.claude/agents/*.md`, `.codex/agents/*.toml` | engine | Roles `scout` (Haiku / Luna), `worker` (Sonnet / Sol), `reviewer` (fresh context). |
| `.claude/rules/stack-*.md` | engine | Path-scoped stack rules. Copilot reads `.claude/rules` too. |
| `.claude/output-styles/compass.md` + `outputStyle` | engine | One-line ack, no mid-task narration, end summary only. |
| `.claude/settings.json`, `.codex/config.toml`, `.codex/hooks.json`, `.mcp.json`, `.vscode/mcp.json` | engine owns named keys only | Hooks, deny/ask permissions, `model_verbosity="low"`, MCP servers. |
| Pack files (seed) | project after first write | `process-compose.yaml`, `env.catalog.json`, `docs/designs/screens.json`, CI files. |

Removed from hosts: `.agent/` report dir, `CODEX.md`, `GEMINI.md`, `.gemini/`, 13 `.mcp/*.example.json`, instincts, stack-blind seeds (`tsconfig.base.json`, `.npmrc`, `.prettierrc`, sample `.env.example`), pnpm-only husky hooks.

### Compass repo

```
bin/ac.mjs            ~11 commands: init sync check doctor migrate env dev run usage promote ui
engine/               lock, render (blocks, json/toml keys), providers, detect, konvoy, migrate/
ui/                   server.mjs, api/*.mjs, public/{index.html,app.js,style.css}
core/                 host block, output style, hook scripts, settings/codex fragments
skills/ (~20)  agents/  rules/  mcp/catalog.json  packs/  upstream.json
.claude-plugin/       marketplace.json + plugins/compass-user (user-level assets)
docs/ (≤12)  test/
```

Budgets: AGENTS.md and README ≤150 lines each. The file and code-line budgets are gone (owner decision, 2026-10-16: features first). Host always-on context ≤2,000 tokens. SessionStart injection ≤1,000 chars.

## Keep / cut summary

| Cut | Merge or rewrite | Keep |
|---|---|---|
| Gemini everywhere; adopt/wizard/setup-host/doctor-fix/apply-recommendations/policy-pack/upgrade-host chain; vendor.mjs; `.agent` reports and dashboard; task-log/trace/evals/conformance/drift loop; openspec-guard; pull-knowledge; migrations 0.x; `lib/tui`; pr.mjs, pr-review.mjs; design-importer, gen-depgraph; check-indexes/skill-docs/catalog; speckit-* (11); CCG gates (5, remain user-global); niche skills (likec4 ×2, dbml, figma-tokens, ai-native-ui, bullmq, external-service); operational-skills pack; ~35 instincts; docs/delivery, ADRs 001-002, specs/001-003; CHANGELOG history (git tags keep it). | install+sync+manifest → engine; skills-sync+external-skills+global-setup → `ac sync` / plugin; doctor-* + mcp-probe + provider-verify → `ac doctor`; stack skills → `rules/`; 5 planners → `remaining-work`; pr-review-governance + qa-review-pass → `review`; code-intel → `project-memory` pack with timeouts and pinned installer. | `lib/profiles.mjs` (detection), `lib/args.mjs`, `manifest.mjs` sha/render helpers, `sync.mjs` ownership semantics, `redact`, `run-command` registry, `evidence`, `api-contract-sync`, delivery skills (`delivery-digest`, `impact-analysis`, harvest → `grill`), native-mobile router, style pins, Sonar/Checkmarx/osv templates. |

## Skill set (≈20 own + pinned routers)

`compass` (init, update, migrate, extend, promote) · `spec-flow` (OpenSpec konvoy schema, init from specs, screens) · `grill` (wraps mattpocock grill-me/grilling; writes RAID `Q-NNN` and ADRs) · `adr` · `task-flow` (NE jira-ticket generalized; Jira Cloud/DC via mcp-atlassian, GitLab via glab, GitHub via gh) · `remaining-work` (CP view, Konvoy files) · `delivery-digest` · `impact-analysis` · `review` (spec and standards axes, fresh context, max 2 fix rounds) · `ui-conformance` (Figma tokens vs computed style, structure, screenshot, then `toHaveScreenshot`; Storybook MCP reuse check) · `local-run` · `env` · `e2e` (Playwright and its test agents, Maestro, agent-device) · `api-contract-sync` (+ Mockoon, `bru run`) · `vuln-triage` (osv + Sonar + Checkmarx via SARIF) · `debug` (local loop + read-only Grafana/ArgoCD/k8s) · `ci-triage` · `harness-loop` (goal, progress file, deliver workflow) · `project-memory` · `architecture-advisor`.

Pinned upstream: 4 style skills; mattpocock/skills (MIT: grill-me, grilling, grill-with-docs, to-questionnaire, wayfinder, handoff, tdd); android, swift-ios, dimillian, agent-device; StoryArc desktop sets (ui-review-tahoe, macos-capabilities, winui-*, developing-gtk-apps). User-only skills set `disable-model-invocation: true`.

## Phases

Each phase runs as one `/goal` with a stated check and a turn cap. State lives in `docs/remaster/PROGRESS.md`. A phase ends with a fresh-context review (`/code-review medium`), at most 2 fix rounds, `npm run check`, then a commit only on user approval.

| # | Phase | Deliverables | Done check |
|---|---|---|---|
| 0 | Evidence | `docs/remaster/{inventory,keep-cut,research}.md` from the 6 scout reports. ADRs for the decisions above. PROGRESS.md. | Files exist. ADRs pass the MADR frontmatter check. |
| 1 | Cut | Delete the "Cut" column. Trim tests to kept code. Remove Gemini. MIT `LICENSE`. | `npm test` green. `git grep -il gemini` empty. File count ≤260. |
| 2 | Engine | `bin/ac.mjs`; `engine/` lock v2 (sha, owner, keys, blocks); Markdown block and JSON/TOML key merge; provider generation; Konvoy path keys read from `.agents/konvoy.json` (14 `RepoPaths` keys and defaults); submodule tag pin and `ac sync --to <tag>`; `init`, `sync`, `check --frozen`, `doctor`. No prompts. Every network call has a timeout and `GIT_TERMINAL_PROMPT=0`. Honest exit codes. | Fixture tests: sync twice gives no diff; an edited managed file is kept and reported; Konvoy-owned files and keys are byte-identical after sync; `check --frozen` fails on drift. |
| 3 | Harness | Contract block ≤120 lines. Output style. Codex `model_verbosity="low"`, reasoning summary off. Role agents with model pins for Claude and Codex. Copilot agent and hook files (verify Copilot reads `.claude/agents` and `.claude/rules`; else generate `.github/*`). Hooks: deny `.env` reads in Read and Bash, completion-gate Stop check, small style injection. Permission guards: deny tracker worklog and delete; ask for transition, comment, create. One Claude workflow `deliver`: plan, split, workers, review, fix. | `ac doctor --tokens` meets budgets. Generated TOML and JSON parse. A blocked `cat .env` test passes. |
| 4 | Skills and rules | The ≈20 skills, `rules/stack-*` for NestJS, Drizzle, React, Angular, Expo, Swift, Android, desktop. Konvoy placeholders (`{{DELIVERY_DIR}}` etc.) resolved by the engine. `upstream.json` pins. Two Sonnet workers on disjoint dirs. | Naming lint passes. Compass skill listing ≤3,000 chars. No skill hard-codes `docs/delivery`. |
| 5 | Konvoy and specs | `docs/contract/ownership.md` + engine enforcement. OpenSpec konvoy schema. `screens.json` registry (`SCR-id`, aliases, route, Figma `fileKey` + `node-id`, stories) and its lint. RAID and ADR checks in `ac check`. `ac init --from-specs`. `ac migrate --docs` plan for spec-kit `.specify`, root `specs/`, single-file question registers. | On scratch copies of StoryArc and Konvoy, `ac check` passes the docs layout. On an NE copy, `migrate --docs --dry` lists every spec-kit artifact. |
| 6 | Dev-loop packs | **env**: Zod `.meta()` → `z.toJSONSchema` → `env.catalog.json`; generic catalog for non-TS; `ac env check` (catalog vs `.env.example` vs code reads vs local files); `ac env export/import` with `age -R <USER.keys>`; `ac env run` loads values in memory (`--env-file`). **local-run**: interview for missing inputs, `process-compose.yaml` + compose profiles, `ac dev up/down/status/logs`. **e2e**: registry runner, results in `.agents/runs/<ts>/`. **MCP catalog**, read-only defaults: mcp-grafana `--disable-write`, argocd `MCP_READ_ONLY`, kubernetes-mcp-server `read_only` + Secret denied, scw `--read-only` (trial), mcp-atlassian `READ_ONLY_MODE`, GitHub MCP `--read-only`, glab CLI, SonarQube MCP read-only, DBHub `readonly`, Playwright, Chrome DevTools (telemetry off), Figma remote (write tools denied), Storybook, Maestro, agent-device, XcodeBuildMCP, process-compose, codebase-memory, context7. Secrets only as `${VAR}`. | NE copy: `env check` flags the 3 overlapping templates and the `VITE_*SECRET` name. PP copy: `ac dev up --dry` gives a valid file. age round trip with 2 test keys. |
| 7 | Quality packs | `vuln-triage` + SARIF merge script (fingerprint = ruleId + path + snippet hash). CI packs for GitHub and GitLab: `compass-check`, security (osv offline DB, CVSS ≥9 gate), Playwright shards + junit + HTML report, helm bump (from PP `create-helm-pr` and NE `.helm-git-setup`), migration regen and immutability checks. Renovate preset with the git-submodule manager. `eslint-plugin-boundaries` atomic-design template. | Templates lint (actionlint, GitLab CI lint via glab). Merge script self-test. |
| 8 | UI | `ac ui`: 127.0.0.1, random port, URL token, Host-header check, POST needs token. Tabs: Projects (version, drift, sync diff), Env (catalog, masked editor, validate, export/import), Run (process-compose status and logs over SSE), Tests (run, history, open reports), Usage (tokens and cost by project/day/model, cache hit %, sub-agent share; CodexBar quota if installed; Copilot billing API optional), Plugins and MCP (recommended per stack, enable writes `compass.json` then shows the sync diff), Delivery (RAID, tickets, remaining from Konvoy files), Promote. Allowlisted commands only, no shell, timeout, capped output. | Browser-pane screenshot of each tab. Usage totals within 1% of `ccusage --json` on the same day. Claude lines deduped on `(message.id, requestId)`. Worktrees map to the repo root. |
| 9 | Migration | `ac migrate`: detect 0.4–0.9 submodule, vendored copy (`.vendor.json`), `.agent/agent-compass.lock`, double skill copies, Gemini files, instincts, Konvoy ledger. Remove only compass-placed files with matching hashes. Keep and list edited ones. Convert `agent-compass.answers.json` to `compass.json`. | Dry run, then apply, on scratch copies of PP, NE, StoryArc and Konvoy. Zero errors. No edited file lost. `ac check --frozen` green after. |
| 10 | User level and release | Plugin `compass-user` in `.claude-plugin/marketplace.json` (style skills, output style, statusline with cache %, hygiene hooks), read by Claude, Codex and Copilot CLI. `ac doctor --global`: enabled plugin count, hook injection sizes, MCP count, recommended set. README, CHANGELOG 1.0.0, release script. | Plugin installs in Claude and Codex from a local path. No push or tag without user approval. |
| 11 | Later: graph | codebase-memory-mcp + LSP plugins as default. Decisions stay in repo files (OpenSpec archive, ADR, RAID). projectmem as trial. Drop Dual Graph. claude-mem stays personal. Measure tokens per task for 2 weeks with and without the graph. Tracker live pull for the Delivery tab. | KPI report before and after. |
| 12 | Reflect loop | `ac reflect` with `owner` and `lesson`, skill `harness-improve`, ADR 0007. See "Phase 12 design". | See "Phase 12 check". |
| 13 | Hint hook | `compass.mjs hint` on tool failures, fed by `.agents/hints.json`; `--no-verify` in the guard. See "Phase 13 design". | See "Phase 13 check". |
| 14 | Forge flow | `review` posts PR/MR reviews (recap, then summary, inline comments, verdict) with `post-review.mjs`; skill `pr-flow`; PR/MR template seeds; rebase-only and protected-dir guard rules; Jira states in `task-flow`. | `test/post-review.test.mjs` and `test/hooks.test.mjs` green; listing at most 3,000 characters; `npm run check` green. |

## Phase 12 design: reflect loop

Decision: [ADR 0007](../decisions/0007-reflect-loop.md). Source of the method: google-research/harness2 (Apache-2.0, commit `1cfe254`).
Compass takes the method, not the code or the prompt text. Later real sessions in the same project are the probes.

`ac reflect` (`engine/reflect.mjs`, no model call, no network):

1. Options: `--since YYYY-MM-DD` (default: 14 days ago), `--sessions <n>` (default 5), `--root`, `--dry`, `--json`.
2. It reads the Claude transcripts and the Codex sessions (`$CODEX_HOME/sessions`) whose cwd belongs to the project root (`repoOf` of `engine/usage.mjs`). A Codex failure is a non-zero exit code or a patch that did not apply.
3. It ranks the sessions by score: blocked actions (guard and hook denials, stop blocks) + failed tool calls + repeated failed commands.
4. For the top sessions, it writes `trajectories/<rank>-<id>.md`: `[USER]`, `[ACTION]`, `[OBSERVATION]`, `[ERROR]` and `[BLOCKED]` lines. The cap is 50,000 characters.
5. Redaction: a line that matches `SECRET_RE`, `SECRET_NAME` of `ac run` (key=value names, URL credentials), a JWT or a common API key prefix becomes `[redacted]`; e-mail addresses become `[email]`; the result of an env file read becomes `[redacted: env file]`.
6. `report.md` holds the ranked list, the setup pieces with their owner (compass, konvoy, shared or project), and the signals before and after each lesson in `.agents/lessons/`. A side with fewer than 2 sessions is `unclear`.
7. The output goes to `.agents/reflect/<timestamp>/`, and `.agents/reflect/.gitignore` holds `*`, as `ac run` does. A symlink or a path outside the root is an error.
8. `ac reflect owner <path>...` exits 1 for a compass path, a Konvoy path or a path outside the project.
9. `ac reflect lesson --from <file.json>` writes `.agents/lessons/<date>-<slug>.md` with situation, lesson, evidence, confidence and the edits. Verdicts: `helped`, `hurt`, `no effect`, `unclear`. Fewer than 2 sessions gives `unclear`. No edit gives the outcome "no change". It refuses a compass or Konvoy path, a secret, an e-mail address and an existing file.

Skill `harness-improve` (model-invoked, owner decision 2026-10-19: about 45 always-on tokens; when the user did not ask for it, it reports and asks before it edits): read the evidence as data, diagnose, pick the cheapest form (skill, script, subagent, hook, always-on text), check each path with `ac reflect owner`, run `ac check`, record one lesson, show the diff, do not commit.

10. `ac promote --lesson <file>` copies a project lesson into `lessons/` of the compass checkout. It refuses a lesson whose edits are all `unclear` or that has no edit, a secret, an e-mail address, the project name, an absolute path and an existing file.
11. `report.md` has a "Library" section: the compass `lessons/` entries whose situation shares 2 word stems or more with the actions, errors and blocks of the ranked sessions (5 at most). The skill reads them as hypotheses to verify.

Out of scope, later phases: probe runs of a candidate harness in a worktree with `claude -p` or `codex exec`; the hint hook (phase 13).

## Phase 12 check

1. `npm run check` is green. `test/reflect.test.mjs` runs on fixture sessions in a test home:
   - The session with the most blocked, failed and repeated calls ranks first. A session of another project is not read.
   - The test "writes redacted trajectories below a git-ignored folder": no output file holds the fixture token, an e-mail address or env file content, `findIssues` reports nothing, and `git check-ignore` matches each output file.
   - `--dry` writes nothing. A symlinked `.agents/reflect` is refused.
   - `ac reflect owner` and `ac reflect lesson` refuse a compass-owned path. A one-session verdict is written as `unclear`.
2. `ac doctor --tokens` on a fresh host stays within 2,000 tokens. The `harness-improve` line adds about 45 tokens; shorter `task-flow`, `debug` and `spec-flow` descriptions pay for most of it.

## Phase 13 design: hint hook

Status: proposed on 2026-10-19; the owner approved it on 2026-10-19, with the `--no-verify` guard rule. Built on 2026-10-19.
Goal: a lesson attaches a short fix to a known error, inside the tool loop, with no always-on cost.
Source: the hook lever of google-research/harness2 (a targeted hint after an error that recurs). Hook facts: code.claude.com/docs/en/hooks, learn.chatgpt.com/docs/hooks, docs.github.com/en/copilot/reference/hooks-reference (2026-10-19).

Data: `.agents/hints.json`, owned and committed by the project.

```json
{ "version": 1, "hints": [
  { "tool": "Bash", "match": "ECONNREFUSED 127.0.0.1:5432", "hint": "Start the database with ac dev up first.", "lesson": ".agents/lessons/2026-10-19-db-first.md" }
] }
```

1. `match` is a plain substring, not a regex: no slow pattern, no escape errors. `tool` is an exact tool name; without it, the hint applies to each tool.
2. Caps: 50 hints, `match` 200 characters, `hint` 300 characters. The hook reads the first 20,000 characters of the error. The first hit wins: one hint for each call.
3. The hook prints the hint and the lesson path only. It never prints the error text back.

Hook: `.agents/hooks/compass.mjs hint`.

| Provider | Event and key | Failure input | Output |
|---|---|---|---|
| Claude Code | `PostToolUseFailure`, key `hooks.PostToolUseFailure` in `.claude/settings.json` | `error` (Bash starts with `Exit code N`) | `hookSpecificOutput.additionalContext` |
| Codex | `PostToolUse`, key `hooks.PostToolUse` in `.codex/hooks.json` (it fires for non-zero exits too) | `tool_response`, only with a non-zero exit code or a failed patch | `hookSpecificOutput.additionalContext` |
| Copilot cloud agent | `postToolUseFailure` in `.github/hooks/compass.json` (`--copilot`) | `error` | `{ "additionalContext": ... }` |

4. Without `.agents/hints.json`, the hook exits 0 with no output after one file check.
5. The hook fails open: it only adds context, so an error in it prints nothing. The `guard` still fails closed.
6. The array keys merge per entry (ownership rule 12). The user plugin copy steps back with the same `deferred()` rule.
7. `ac reflect lesson` takes an optional `"hint": { "tool", "match", "hint" }`. It appends the entry to `.agents/hints.json` with the lesson path, and it refuses a duplicate `match`, an entry over a cap, a secret and an e-mail address.
8. `ac reflect` lists each hint whose lesson now has a `hurt` verdict, so a stale hint can go.

`--no-verify`: a guard rule, not a skill. The guard blocks `git commit --no-verify`, `git commit -n` and `git push --no-verify`, with the reason "Fix the hook failure, or ask the user to skip it." `git log -n 5` still passes.

## Phase 13 check

1. `test/hooks.test.mjs`: a hint for a matching Claude `PostToolUseFailure` input, a Codex `PostToolUse` input with a non-zero exit and a Copilot `postToolUseFailure` input. No output without the file, for an error that does not match, or for a Codex call that passed. The caps hold. A secret in the error text never appears in the output.
2. The guard blocks the three `--no-verify` forms and passes `git log -n 5`.
3. `ac reflect lesson` with a hint writes `.agents/hints.json`; a duplicate `match` is refused.
4. `ac doctor --tokens` gives the same always-on tokens. `ac sync` on a fresh host writes the new keys, and `ac check --frozen` exits 0. `npm run check` is green.

Open: the minimum Claude Code version with `PostToolUseFailure` is not known; an older CLI ignores the key, so the hint does not run there. Codex loads the hooks only after the user trusts them in `/hooks`.

## Phase 14 design: forge flow

Source: the PR/MR rules of parcus-plus, numeric-emploi and StoryArc, and the 0.9.6 `pr-review-governance` and `pr-workflow` skills (read on 2026-10-19).
Owner choices (2026-10-19): a recap and a yes before a review is posted; draft by default for PRs and MRs; the rebase-only guard in every project; the self-review stays local, before the PR or MR opens.

1. `review`: "review PR N" or "review MR N" ends with a posted review after the recap. Verdict: request changes with a `P0` or `P1`, approve when none is left and the checks have evidence, else comment. The author's own request gets a comment.
2. `skills/review/scripts/post-review.mjs`: the forge comes from the `origin` remote (github.com, a host with "gitlab", else `glab` then `gh` probes). GitHub: one review call with `commit_id`, `event` and `comments[]` (`side: RIGHT`). GitLab: the summary note, then one discussion for each comment with a JSON `position` (`old_line` too for a context line), then `glab mr approve --sha`, or `glab mr revoke` and the `mergeRequestRequestChanges` GraphQL mutation (Premium, 17.2 and later). A comment outside the diff goes into the summary; a duplicate of an existing thread is skipped; a lost anchor fails the run.
3. `pr-flow`: base, draft, labels (type from the commit type, area from the paths, no judgement label), assignee and reviewer, the body contract in `references/body.md`, add-only updates (`--assignee "+$me"` on GitLab), ready and merge on a yes with `--squash` and the head SHA, delivery checked by tree.
4. Guard: `git merge` (except `--abort`, `--continue`, `--quit`, `--ff-only`) and `git pull` without `--rebase`, `-r` or `--ff-only`; an edit under `.git/`, `secrets/` or `credentials/`. The guard asks before `git push --force-with-lease` (a `permissionDecision` of `ask` in Claude Code and Copilot; Codex runs it after the agent asks in chat). A bare `--force`, `-f` or a `+` refspec stays blocked.
5. Project-local, not in compass: StoryArc `preview-proof`, `delta-drop` and `line-cap`; the numeric-emploi e2e shard budget and ERD sync; the 800-line file cap.

## Execution method (token economy)

1. Opus orchestrates, reviews and verifies. Sonnet workers implement. Haiku scouts do lookups.
2. Max 2 parallel workers, only in phases 4 and 6, on disjoint directories.
3. Every delegation prompt states the style contract and returns a ≤400-word report.
4. One new session every 2–3 phases. The handoff is PROGRESS.md, not chat history.
5. Prompt cache: fixed model and effort per phase. No mid-phase model switch.
6. Codex rescue is available for one large self-contained chunk, for example the UI server.

## Critical files

- Reuse: `scripts/manifest.mjs` (sha, renderSource, loadSubst), `scripts/sync.mjs` (seed vs managed, `.acnew` logic becomes "keep and report"), `scripts/lib/profiles.mjs` (`detectStacks`, `selectAssets`), `scripts/lib/args.mjs`, `scripts/redact.mjs`, `scripts/run-command.mjs`, `scripts/evidence.mjs`, `agent-compass.commands.json`.
- Port patterns from: NE `apps/api/src/config/env.{schema,cross-checks,validation}.ts` and `.claude/skills/jira-ticket`; PP `.github/workflows/security-scan.yml`, `.github/actions/create-helm-pr`, `.claude/hooks/block-git-merge.sh`, `scripts/e2e/local-mobile-orchestrator.sh`; NE `.gitlab/_common.yml`; Konvoy `src-tauri/src/infrastructure/{config,repo,raid,qa}.rs`, `src-tauri/skills/STYLE-CONTRACT.md`, `src-tauri/resources/catalog/openspec/konvoy-delivery/schema.yaml`; StoryArc `scripts/{preview-proof-check,delta-drop-check,line-cap}.mjs`.

## Verification (end to end)

1. `npm run check` in compass: unit tests and engine fixture tests.
2. Fixture matrix on scratch copies (`git clone --local`) of PP, NE, StoryArc and Konvoy: `ac migrate --dry`, `ac migrate`, `ac check --frozen`, `ac doctor --tokens`. Compare Konvoy-owned file hashes before and after.
3. Provider smoke on one fixture: `claude -p` lists skills and output style; `codex exec` in read-only mode loads the config; `copilot -p` if installed.
4. UI: start `ac ui`, screenshot each tab in the browser pane, cross-check usage with ccusage.
5. Real host repos stay untouched in this work.

## Follow-ups outside this repo (later)

- Konvoy: read the compass lock, stop vendoring the compass manifest, stop writing CODEX.md and GEMINI.md, merge MCP files per key, add a `screens` path key, skip `000-template.md` in ADR lists.
- Host migrations: PP, NE, StoryArc, Konvoy. NE first (largest drift).
- User-global hygiene, report only until approved: 40 enabled plugins, claude-mem SessionStart injection (~26k tokens), SubagentStart injections.

## Appendix — technology inventory (6 repos + compass hosts)

| Area | Items |
|---|---|
| Languages and runtimes | TypeScript 5.9–6.0, Node 22–26, Rust 1.92–1.97, Swift 6.2, Kotlin 2.4, C# .NET 10, Ruby 3.4 (fastlane), Java 21, Python (projectmem venv) |
| Backend | NestJS 11 + Fastify 5, Drizzle 0.45 + drizzle-kit, PostgreSQL 15/16 (+ pgvector), Redis 8, BullMQ 5 + bull-board, Keycloak 26 + keycloakify, Zod 4, OpenTelemetry, cockatiel, Scalar |
| Frontend | React 19, Vite 7–8, TanStack Router/Query/Form/Table, react-router 7, Tailwind 4, Radix/shadcn, Storybook 9–10, Tauri 2 |
| Mobile and desktop | Expo 55, RN 0.83, Zustand, Firebase, Monetico SDK; SwiftUI, XcodeGen, SPM, Readium; Jetpack Compose, Room, Gradle 9, AGP 9; GTK4/libadwaita, Flatpak; WinUI 3 |
| Tests | Jest 29–30, Vitest 4, Playwright 1.62, Maestro, k6, swift-snapshot-testing, Swift Testing, XCTest, JUnit, Robolectric, Roborazzi, Turbine, Gherkin (no runner) |
| Build and lint | pnpm 11, Turbo 2.10, ESLint 9–10, Prettier 3, husky, lint-staged, commitlint, Vale, SwiftLint, clippy, Android Lint, fastlane + Match |
| API, mocks, data tools | Bruno (350–396 .bru), Mockoon CLI 9.9, nock, axios-mock-adapter, provider fakes, Mailpit, MinIO, Drizzle Studio, Beekeeper (docs), DBML, ERD check |
| Security | osv-scanner 2.x, SonarQube (local), Checkmarx (zip export), pnpm overrides, KeePass, Yopass |
| CI/CD | GitHub Actions (self-hosted macOS ARM64), GitLab CI (CGI Forge, Nexus, buildah), helm bump PR flows |
| Infra and ops | Scaleway (Kapsule, managed PG, Secret Manager, registry), Terraform 1.15, Helm, ArgoCD (own and CGI Forge), Kong, External Secrets Operator, cert-manager, Grafana LGTM (Loki, Tempo, Mimir) + Alloy + Prometheus, Blackbox probes, Langfuse, Presidio, HAProxy |
| Agent tooling | Claude Code, Codex, Copilot, Konvoy, spec-kit 0.11, OpenSpec 1.x, codebase-memory-mcp, projectmem, Dual Graph (PP), claude-mem, rtk, CodexBar, ccusage (Konvoy FinOps), mcp-grafana, Maestro MCP, agent-device, Figma MCP, Playwright MCP, context7, sequential-thinking, mcp-atlassian |

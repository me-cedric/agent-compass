# Compass Map — self-map of this repository

agent-compass is an importable operating manual for AI coding agents: one
canonical contract plus scripts that wire skills, templates, hooks, and MCP
config into host projects (as a submodule or vendored copy). This map exists so
an agent landing here never re-explores the tree from scratch. Route yourself
first: mission requests (adopt / bootstrap / extend / global) go through
[MISSIONS.md](../../MISSIONS.md); [AGENTS.md](../../AGENTS.md) is the canonical
contract for *how* to work; provider front doors —
[CLAUDE.md](../../CLAUDE.md), [CODEX.md](../../CODEX.md),
[GEMINI.md](../../GEMINI.md), `.github/copilot-instructions.md` — all point
back to AGENTS.md. For asset lists (skills, stacks, templates, docs, CLI
commands) do not read this file or crawl the tree: run
`node scripts/catalog.mjs` or `agent-compass help`; they are generated from the
source of truth and never drift.

## Top-level layout

| Path | What it is |
| ---- | ---------- |
| `AGENTS.md` | Canonical agent contract: workflow, validation, completion gate, safety. |
| `CLAUDE.md` / `CODEX.md` / `GEMINI.md` | Provider front doors; provider-specific notes + pointer to AGENTS.md. |
| `MISSIONS.md` | Routes mission requests to the executable playbook skills. |
| `README.md` | Human-facing overview, install and usage instructions. |
| `CHANGELOG.md` | Release history; consistency enforced by `check-release`. |
| `CONTRIBUTING.md` | Contributor rules: generic naming, index freshness, change companions. |
| `package.json` | npm script surface; `bin: agent-compass` → `scripts/cli.mjs`. |
| `agent-compass.commands.json` | Command registry agents execute from (via `run-command`); never invent commands. |
| `.mcp.json` | MCP servers for working in this repo (context7, sequential-thinking). |
| `.agent/` | Generated agent state/reports (update cache here; full report suite in hosts). |
| `.github/` | `copilot-instructions.md` front door + CI workflows (`ci.yml`, `agent-drift.yml`). |
| `docs/` | `architecture/`, `decisions/` (ADRs), `guidelines/`, `tooling/`, `workflows/`, `agent-setup.md`. |
| `knowledge/` | `instincts/` (distilled reusable patterns), `examples/`, `incoming/` (staging from `pull-knowledge`). |
| `migrations/` | Ordered per-version host migrations, applied by `sync` (see Stay current). |
| `scripts/` | All executable tooling; `cli.mjs` dispatches 46 commands in 6 groups (Setup, Health, Context, Build, Learning, Git) with `COMMANDS` exported as data; `lib/` shared libs (`args`, `tui`, `profiles`, `redact`). |
| `skills/` | Provider-portable skills (one folder per skill with `SKILL.md`). |
| `stacks/` | Stack presets mapping a detected stack to fitting skills/templates/docs. |
| `templates/` | Everything installable into hosts; `scripts/manifest.mjs` defines each file's destination and `seed` vs `managed` mode. |
| `test/` | `node --test` suites (36+ files), roughly one per script area. |

## The four flows

**Adopt** (wire compass into an existing project) — `agent-compass adopt <host>`:

1. `adopt.mjs` chains `setup-wizard.mjs --yes`: detect stacks/package manager, write `agent-compass.answers.json` + setup plan.
2. Wizard runs `setup-host.mjs --strict`: `install.mjs` (create missing files only) → `install --fix` → `doctor --deep`.
3. Report suite written to host `.agent/`: context-pack, doctor-report, runbook, provider-verify, recommend, quality-gates, migration-plan, spec-validation-map, mcp-probe, failure-mine, dashboard.
4. `spec-kit-bridge.mjs` (when answered yes).
5. Fit-based `skills-sync.mjs`: core + detected-stack + working-style skills (selection in `scripts/lib/profiles.mjs`), copy or symlink.
6. Optional `--policy <pack>` applies a policy via `apply-recommendations.mjs`; `agent-onboard.mjs` gates readiness. Nothing is ever overwritten or committed.

**Stay current** (host follows a moving submodule):

1. `check-update.mjs` — cached 24h, offline by default (`--remote` compares upstream tags); safe in git hooks.
2. `sync.mjs` reconciles the `FILE_MANIFEST`: managed + host-unchanged → fast-forward; managed + host-edited → writes `<file>.acnew` beside it (review, merge, delete); seed files are created only if missing.
3. Migrations in `migrations/` with version in `(lock.version, current]` run in order; `.agent/agent-compass.lock` is updated.
4. `upgrade-host.mjs` = bump submodule + sync + doctor in one command.

**Bootstrap** (new project from guidelines or an idea):

1. `bootstrap.mjs` — interactive Q&A, or `--answers <file>` for agents (derive answers from architecture guidelines first).
2. Outputs `BOOTSTRAP_PROMPT.md` (paste into the agent, execute spec-first) + replayable `agent-compass.answers.json`.
3. Once the project exists, the Adopt flow wires compass in.

**Global** (user-level machine setup):

1. `global-setup.mjs [home]` — writes `~/.agent-compass/manifest.json` and pointer files `~/.codex/AGENTS.md`, `~/.claude/CLAUDE.md` (never replaces existing entries).
2. Copies or symlinks skills into `~/.agents/skills`, `~/.codex/skills`, `~/.claude/skills`.
3. Optional `--jira` configures the Atlassian MCP for Codex + Claude; verify with `provider-verify --global`.

## Per-provider integration

Compass targets four providers. Front doors live in this repo; the config
column is what `install.mjs` places into a *host* (see `scripts/manifest.mjs`).

| Provider | Front door | Host receives | Enforcement | Verified by |
| -------- | ---------- | ------------- | ----------- | ----------- |
| Claude | `CLAUDE.md` | `.claude/agents/*` (reviewer, security, docs-teacher, architecture-advisor), `.claude/hooks/*.sh`, `.claude/settings.example.json` | Claude hooks (protect-agent-files, remind-completion-gate) | `provider-verify.mjs`, `doctor --deep` |
| Codex | `CODEX.md` | `.codex/config.toml`, `.codex/hooks.json` | Codex hooks | `provider-verify.mjs`, `doctor --deep` |
| Gemini | `GEMINI.md` | `.gemini/settings.example.json` | husky hooks + CI (no native hook mechanism) | `provider-verify.mjs`, `doctor --deep` |
| GitHub Copilot | `.github/copilot-instructions.md` | `.github/instructions/*`, `.github/prompts/*`, `.github/agents/*` | CI | `provider-verify.mjs`, `doctor --deep` |

## Validation matrix — which guard catches which drift

| Guard | Catches |
| ----- | ------- |
| `npm test` | Behavior regressions in `scripts/` (36+ test files under `test/`). |
| `check-naming` | Project/client/domain names leaking into generic files; invalid `SKILL.md` frontmatter (name, description, risk_level, writes_files, requires_tools). |
| `check-indexes` | Index drift: skills / stacks / workflows / tooling / guidelines / architecture READMEs, knowledge instincts, template groups + loose files, bootstrap stack mappings, CLI doc coverage. |
| `check-docs` | Broken local Markdown links and anchors; unknown template placeholders; local paths in templates. |
| `check-release` | package.json version vs CHANGELOG vs git tag vs README disagreeing. |
| `agent-conformance` | Provider customization wiring gaps; generates provider smoke prompts. |
| `agent-evals` | Invalid teaching / tool-offer eval fixtures. |
| `check-actions` | Unsupported GitHub Action major versions. |
| `check-change-companions` | Source change shipped without its test companion (host-facing gate). |
| `ci.yml` | Runs script syntax check + tests + the lint guards on every push/PR. |
| `agent-drift.yml` | Weekly read-only drift dashboard (`agent-drift --strict`) across all validators. |

`npm run check` bundles tests + conformance + evals + the lint guards locally.

## Where to add things

| You want to add… | Go to |
| ---------------- | ----- |
| A skill, knowledge instinct, template, stack preset, doc, or script | `skills/compass-extend/SKILL.md` — the end-to-end playbook (frontmatter, index wiring, tests, validation). |
| A scaffold to start from | `scripts/new.mjs` (`agent-compass new skill|adr|spec|instinct …`). |
| Anything else / ground rules | `CONTRIBUTING.md`. |

Keep this map current when top-level layout, the four flows, providers, or
validators change; `check-docs` and `check-indexes` catch the mechanical drift,
the prose is on you.

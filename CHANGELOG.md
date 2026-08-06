# Changelog

All notable changes to agent-compass are documented here. Keep entries short.
Format loosely follows [Keep a Changelog](https://keepachangelog.com/).

## [Unreleased]

### Added

- Prose and terminology linting: `docs/tooling/vale.md` (what Vale is worth in a
  specification repo — imposed vocabulary, required sections, identifier formats
  — and the measure-the-corpus-first rule for structural checks), and
  `templates/docs-lint/` with a runnable `.vale.ini` and a starting `House`
  style (substitution, forbidden terms, single `H1`, one required section).
- `docs/guidelines/documentation.md` now states that vocabulary fixed outside the
  codebase is enforced mechanically; `docs/workflows/validation-defaults.md` now
  requires a declared documentation check to run on docs-only changes.

### Fixed

- `sonar:setup` now reuses valid tokens through the current `issueadmin` API,
  ignores pre-scan CSV drift that its scan will refresh, and delegates to the
  complete `sonar:do` scan/close/report cycle instead of duplicating scans.
  `sonar:do` now waits for Compute Engine success before reading issue state.

## [0.7.1] - 2026-07-31

### Added

- Decision Records (ADR) support: a fuller `docs/decisions/` template (context,
  alternatives with pros & cons, decision, consequences), the `adr-from-meeting`
  skill (draft an ADR from a meeting transcript, rejected paths and their reasons
  preserved), and the `decision-records` workflow. Wired into `CORE_PROFILE` and
  `AGENTS.md`.
- Four review instincts: `react-query-bulk-mutation-reconcile`,
  `entity-picker-label-source`, `frontend-shared-layer-escapes`, and
  `mr-scope-and-green-pipeline`.

### Fixed

- projectmem MCP: pin `mcp<2` in every launch template and the docs so `pjm-mcp`
  starts — `mcp` 2.0.0 relocated FastMCP and broke the import. Added a
  Troubleshooting section to `docs/tooling/projectmem.md`.

## [0.7.0] - 2026-07-29

### Added

- 146 opt-in operational skills adapted from
  `BagelHole/DevOps-Security-Agent-Skills`: 22 requested DevOps platform skills,
  all 35 security skills, all 70 infrastructure skills, and all 19 compliance
  skills. Every skill has pinned MIT provenance and an Agent Compass
  authorization/dry-run/rollback safety gate; upstream executable scripts and
  assets are excluded.
- CLI-integrated capability packs: `skills-sync --list-packs`,
  `skills-sync --pack`, `skills-sync --all`, and
  `catalog --type capability-pack`, plus command-registry entries. Default
  project/global sync excludes broad packs; explicit `--all` includes them.
  Backed by focused inventory/content/sync/dispatch tests.
- Ten focused operational subpacks for AWS, Azure, GCP, Kubernetes,
  observability, AI operations, security scanning, secrets, hardening, and
  compliance frameworks.
- Local-only upstream lifecycle tooling: deterministic pinned lock, dry-run
  comparison, reviewed-risk refresh gate, and lock verification. It never
  fetches or monitors remote state.
- Imported-skill quality and generated-documentation gates, plus unified CLI
  skill search, pack filtering, exact metadata, and provenance details.
- Operational safety contract and `plan-before-operational-change` instinct for
  production changes, incident evidence, least privilege, rollback, and
  compliance limitations.

### Changed

- README now uses a scan-friendly hero, capability map, quick route, pack
  counts, and activation flow inspired by the upstream skills repository.

## [0.6.0] - 2026-07-28

### Changed

- **Provider consolidation: Claude, Codex, Gemini, GitHub Copilot only.**
  Cursor and Windsurf integrations removed (repo rule files, host pointers,
  MCP example, verify/doctor checks, docs). `migrations/0.6.0.mjs` cleans
  compass-authored Cursor/Windsurf pointers out of existing hosts on `sync`
  (user-edited files are never touched). `install` now respects a
  `providers` list from `agent-compass.answers.json`.

- **CLI modernization (still zero-dependency).** New shared strict flag
  parser (`scripts/lib/args.mjs`, on `node:util` `parseArgs`): unknown flags
  error instead of being ignored, `--flag=value` works, `-h` can no longer be
  swallowed as a positional. New terminal UX lib (`scripts/lib/tui.mjs`):
  colors (NO_COLOR-aware), arrow-key select/multi-select, confirm, spinner.
  `wizard` and `bootstrap` are interactive with real menus and no longer hang
  in non-TTY contexts; `cli.mjs` exports `COMMANDS` as data (catalog imports
  it instead of regex-parsing), shows aliases in help, and reports spawn
  failures properly.

### Added

- Gemini parity: `templates/gemini/.gemini/settings.example.json` (recommended
  MCP servers) installed to hosts, enriched `GEMINI.md`, and `provider-verify`
  now checks the Gemini pointer + settings example.

- `docs/architecture/compass-map.md`: a maintained self-map of the repo
  (layout, flows, provider matrix, validation matrix) so agents stop
  re-exploring from scratch.

- Planning skills (`progress-audit`, `completion-plan`, `work-splitting`,
  `implementation-planning`) added to the core fit profile so fit-based
  adoption actually delivers them.

- `spec-status-sync` instinct: when you ship a feature covered by a spec-kit
  spec, sync its status in the same task — update the global
  `implementation-status.md` and the spec's own `## Implementation Status`
  (a verified one-line status + pointer, checked against wired code, not labels)
  — never leave a shipped feature's spec reading "Not implemented".

- `self-review-before-done` instinct: review your own change like an MR before
  calling it done — target the runtime blind spots typecheck and unit mocks miss
  (DI/boot wiring, whether input validation actually runs, response-shape leaks,
  by-id scope), run the fuller checks (full build, whole suite, pre-commit lint),
  and fix findings inline rather than enumerating them.

- `pr-review-governance` skill: a "GitLab MR posting (`glab`)" section
  documenting the two silent `glab api` traps — `-f "body=@file"` posts the
  literal `@path` instead of the file, and inline comments need a JSON body with
  an explicit `Content-Type: application/json` header and a `position` object
  (nested `-f "position[...]"` form fields are dropped, degrading the comment to
  a general thread) — plus the post-hoc anchoring verification step.

### Fixed

- README version drift (badge and "Current version" said 0.4.0);
  `check-release` now guards README against `package.json`.
- `.mcp/angular-cli.example.json` is now installed (hosts previously received
  a README pointing at a file the manifest never placed).
- `docs/tooling/cli.md` documents all CLI commands; `check-indexes` now fails
  on missing command docs, knowledge-index drift, stale skill rows,
  unindexed template files, and unindexed guideline/architecture docs.
- `knowledge/README.md` lists all instincts; host `AGENTS.md` pointer now
  mentions `knowledge/`; `recommend` path-instruction advice includes the
  exact copy command; `mcp-probe` probes all shipped MCP examples.

## [0.5.0] - 2026-07-10

### Added

- Angular AI integration: `stacks/angular-web.md` preset (detected via
  `@angular/*` deps or `angular.json`, offered by bootstrap), the `angular-cli`
  MCP server as template/catalog/tool-contract entries (read-only by default),
  an `angular-patterns` skill with a vendored copy of Angular's official
  best-practices context file (MIT, provenance header) as offline fallback to
  the live MCP tools, and an `angular-ai-assets` instinct preferring live
  sources over training-data recall.

- Project progression pack: `completion-plan`, `implementation-planning`,
  `progress-audit`, and `work-splitting` skills plus a
  `verified-progress-signal` instinct.

- Spec Kit bridge pack: `speckit-*` skills wrapping the Spec Kit
  slash-command flow with a hard stop before implement, a `spec-kit` profile
  (detected via `.specify`), and `spec-kit-bridge` wiring. Security instincts
  `api-security-edge-cases` and `async-external-pipeline`, promoted from a
  real host project.

- `env-var-sync` instinct plus env-management rules in `AGENTS.md` and the
  env tooling doc.

- `pr-review-governance` skill (deep PR review against specs, security, and
  repo rules) and tightened `pr-workflow` guidance.

- `figma-mcp-go` plugin-bridge integration (templates, setup guide,
  `mcp-probe` support): free/local Figma design reads when official Figma
  MCP/API limits block.

- Validation-defaults and long-running-task workflow docs, plus projectmem
  guideline gaps closed across doctor/global-setup.

- `vendor` command (`scripts/vendor.mjs`): create/refresh a plain-copy
  vendoring (the non-submodule path) with `.vendor.json` provenance
  (version/ref/commit), replacing manual `git archive` surgery.

- `spec-kit-workflow` knowledge instinct (Spec Kit slash-command sequence with
  a hard stop before implement) and richer Drizzle-typed mapper instinct, both
  promoted from a real host project.

### Changed

- projectmem is now set up collaboration-safe: commit the append-only
  `events.jsonl` (the source of truth) with a `.gitattributes merge=union`
  driver, and gitignore the regenerated projections (`summary.md`,
  `PROJECT_MAP.md`, `AI_INSTRUCTIONS.md`, `issues/`) — the reverse of the old
  default that committed the regenerated `summary.md` and let the last writer
  overwrite teammates. The `post-merge` hook runs `pjm regenerate` after a pull;
  durable decisions go in committed ADRs. Touches `scripts/doctor-checks.mjs`
  ignore/attribute defaults, `scripts/install.mjs`, `templates/monorepo/`,
  `templates/memory/`, the project-memory skill, and the tooling/workflow docs.

- The five CCG quality-gate skills (`gen-docs`, `verify-module`,
  `verify-quality`, `verify-change`, `verify-security`) are now fully in
  English — SKILL.md docs, script comments, and report output. The `caveman`
  skill's wenyan variants keep their intentional classical-Chinese examples.

### Fixed

- Quality-gate skill scripts are now runnable: they were CommonJS `.js` files
  inside an ESM package (`require is not defined`) and depended on a
  `skills/lib/shared.js` lost in the original import — and unreachable anyway
  once skills sync into hosts as independent folders. Rewritten as
  self-contained `.cjs` with helpers inlined; `.cjs`/`.mjs` now count as code
  in the quality/security scanners.
- Stack detection now aggregates workspace packages (`apps/*`, `packages/*`)
  instead of only the monorepo root, and matches exact dependency names —
  a turbo monorepo with a NestJS API and React app previously detected as
  "Turborepo" only, and `@next/eslint-plugin-next` no longer counts as Next.js.
  Found by upgrading a real host.
- Redaction screens no longer flag RFC-reserved documentation emails
  (`user@example.test`) or bare ISO dates (osv-scanner `ignoreUntil`) as
  personal data — compass's own shipped template previously failed its own
  knowledge-capture screen. Real emails and long digit runs still refuse.
- `pull-knowledge` INDEX status is content-aware (`new` / `differs` /
  `identical`) and staged files no longer match themselves via
  `knowledge/incoming`, which previously reported every pull as "0 new".

## [0.4.0] - 2026-07-01

### Added

- Mission router `MISSIONS.md` plus `compass-adopt`, `compass-bootstrap`, and
  `compass-extend` skills so any agent CLI spawned in this repo can set up an
  existing project, bootstrap a new one from architecture guidelines, or extend
  compass with minimal guidance. Cursor/Windsurf/Gemini pointer files now route
  through the missions in this repo too (previously host-only).
- `adopt` command (`scripts/adopt.mjs`): one-command host adoption — detection,
  non-interactive setup, fit-based skill sync, optional `--policy <pack>`,
  readiness verification, next steps.
- `runbook` and `context-pack` now include detected stacks and fit-based
  compass assets, so host agents see what fits at startup without re-deriving
  it. MISSIONS.md also routes the user-level global setup mission.
- Machine-readable asset catalog (`scripts/catalog.mjs`, `agent-compass catalog`)
  covering skills, stacks, templates, docs, instincts, and CLI commands with
  `--type` / `--grep` / `--md` filters.
- Non-interactive bootstrap: `bootstrap.mjs --answers <file> --out <dir>` with
  `--schema` contract output and validated answers, so agents can drive project
  bootstrap from architecture guidelines.
- Fit-based asset selection as data: `scripts/lib/profiles.mjs` (stack detection
  + per-stack asset profiles), `recommend.mjs` fit-based assets output, and
  `skills-sync.mjs --only a,b,c` subset sync. `setup-wizard` now syncs the
  fit-based subset by default (`skillScope: fit|all`).
- `new.mjs` scaffolds for every extensible asset: `instinct`, `stack`,
  `workflow`, and `tooling` kinds join `skill`/`adr`/`spec`/`arch`, each with a
  post-scaffold wiring checklist.
- Mission-routing guard test: every provider entry file must route through
  `MISSIONS.md`, and every mission playbook/command it references must exist.
- GitHub Actions version guard (`check-actions.mjs`) and CI/tooling guidance for
  required action majors.
- Helper scripts for PR creation/review packets, host readiness reports, agent
  runbooks, release prep, and host submodule upgrades.
- Design-system extraction template for Figma/design-token workflows.

### Changed

- CI and CI templates now use current action majors and the repo now includes
  `.nvmrc` for `actions/setup-node`.
- `setup-wizard.mjs` and `recommend.mjs` share one stack-detection source
  (`scripts/lib/profiles.mjs`); Expo/React Native projects no longer classify
  as React web apps.

### Fixed

- `new.mjs skill` now emits the full required frontmatter
  (`risk_level`, `writes_files`, `requires_tools`) so freshly scaffolded skills
  pass `npm run check` instead of failing `lint:naming`.

## [0.3.0] - 2026-06-23

### Added

- Docs/template guard that checks local Markdown links and catches unknown
  placeholder tokens under `templates/`.
- Release guard that checks `package.json`, `CHANGELOG.md`, and the local
  `v<version>` tag agree before publishing.
- Lightweight native spec workflow: `specs/` templates, workflow doc,
  `spec-workflow` skill, bootstrap prompt support, and install-created
  `specs/README.md` / `specs/constitution.md`.
- Project memory support: projectmem tooling/workflow docs, install-created
  `.projectmem/README.md` / `.projectmem/projectmem-policy.md`, and
  `project-memory` skill.
- Command registry, repo context snapshot script, repo-map/ADR/handoff templates,
  and lightweight conformance smoke template for faster cross-project starts.
- MCP setup guidance and examples, including projectmem and Figma design-context
  flows plus `figma-mcp-frontend` skill.
- PR creation/review workflows and `pr-workflow` skill covering default
  `develop` base, self-assignment, real labels, reviewers, GitHub reviews, and
  implementing submitted review fixes.
- Copilot `.github/instructions/*.instructions.md` templates and PR template.

### Changed

- Installer now copies optional agent workflow templates and supports
  `--doctor --deep` advisory checks.

## [0.2.0] - 2026-06-23

### Added

- Stdlib `node:test` coverage for bootstrap, installer, knowledge-pull, and
  naming/frontmatter checks.
- Bootstrap smoke matrix coverage for API-only, full app, and Next.js-only
  prompts.
- `next-web` stack preset and correct bootstrap mapping.
- Installer `--doctor` verification plus non-destructive front-door pointers for
  Claude, Codex, Copilot, Cursor, Windsurf, and Gemini.
- Index drift guard for stack, workflow, and skill README catalogs.
- Release and upgrade workflows for tagged agent-compass bumps in host projects.

### Changed

- SonarQube tooling overhauled to the consolidated `sonar:do` runner (scan +
  bulk-close stale issues + patched HTML report), gated by a read-only
  `sonar:doctor` preflight. Added `sonar-do.sh`, `sonar-doctor.sh`,
  `bulk-close-stale-issues.mjs`, `patch-sonar-summary.mjs`; `sonar-setup.sh` now
  mints a scoped USER_TOKEN and sets per-project `sonar.scm.provider=git`.
  Replaces the old `sonar:scan` / `sonar:report` scripts.

## [0.1.0] - 2026-06-23

### Added

- Initial extraction from a production monorepo and global agent config.
- Tool-agnostic agent contract (`AGENTS.md`) with thin pointers for Claude, Codex, Copilot.
- Guidelines (`docs/guidelines/`): coding style, TypeScript, TDD/testing, security,
  git workflow, development workflow, documentation, agent behavior.
- Architecture principles (`docs/architecture/`): monorepo, resilience, observability,
  feature flags, API design, shared types.
- Tooling guides (`docs/tooling/`): rtk, pnpm, turbo, sonarqube, docker, husky,
  env management, API contract sync, security scanning, version pinning.
- Portable skills (`skills/`): caveman, ponytail, gen-docs, verify-*, plus
  NestJS / Drizzle / BullMQ / resilience / React-admin / Expo pattern skills.
- Real config templates (`templates/`): turbo, pnpm, tsconfig, prettier, commitlint,
  husky hooks, eslint, docker, sonar, OSV, CI, env.
- Stack presets (`stacks/`) and workflow playbooks (`docs/workflows/`).
- Bootstrap tooling (`scripts/`): interactive `bootstrap`, `pull-knowledge`, `install-into`.

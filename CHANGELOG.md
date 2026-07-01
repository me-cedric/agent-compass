# Changelog

All notable changes to agent-compass are documented here. Keep entries short.
Format loosely follows [Keep a Changelog](https://keepachangelog.com/).

## [Unreleased]

### Added

- `vendor` command (`scripts/vendor.mjs`): create/refresh a plain-copy
  vendoring (the non-submodule path) with `.vendor.json` provenance
  (version/ref/commit), replacing manual `git archive` surgery.

- `spec-kit-workflow` knowledge instinct (Spec Kit slash-command sequence with
  a hard stop before implement) and richer Drizzle-typed mapper instinct, both
  promoted from a real host project.

### Fixed

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

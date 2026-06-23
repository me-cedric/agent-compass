# Changelog

All notable changes to agent-compass are documented here. Keep entries short.
Format loosely follows [Keep a Changelog](https://keepachangelog.com/).

## [Unreleased]

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

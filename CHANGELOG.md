# Changelog

All notable changes to agent-compass are documented here. Keep entries short.
Format loosely follows [Keep a Changelog](https://keepachangelog.com/).

## [Unreleased]

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

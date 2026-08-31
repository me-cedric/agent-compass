# Templates

Real, runnable configuration. Drop a file into a project, substitute the
placeholders, and it works. These are the "molds" that make bootstrapped projects
consistent.

## Placeholder conventions

| Placeholder   | Means                          | Example                |
| ------------- | ------------------------------ | ---------------------- |
| `<project>`   | project / repo name            | `<project>`          |
| `@scope`      | npm scope for internal pkgs    | `@scope`              |
| `<app>`       | an app/package name            | `api`, `backoffice`    |
| `<PM>`        | package manager                | `pnpm`                 |

Files ending `.tpl` / `.example.*` are meant to be copied and renamed (e.g.
`env.example.tpl` → `.env.example`, `gitignore.tpl` → `.gitignore`).

## Index

| Group             | Files                                                                          | Guide                                                |
| ----------------- | ------------------------------------------------------------------------------ | ---------------------------------------------------- |
| `agent-tools/`    | Index for provider-specific Codex, Claude, MCP, conformance, and eval templates | [agent-provider-capabilities](../docs/tooling/agent-provider-capabilities.md) |
| `monorepo/`       | `README.md`, `turbo.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`, `.prettierrc`, `.prettierignore`, `commitlint.config.js`, `.nvmrc`, `.npmrc`, `env.example.tpl`, `gitignore.tpl`, `gitattributes.tpl`, `husky/{pre-commit,pre-push,commit-msg,post-merge}` | [monorepo/README](monorepo/README.md), [pnpm](../docs/tooling/pnpm.md), [turbo](../docs/tooling/turbo.md), [husky](../docs/tooling/husky.md), [version-pinning](../docs/tooling/version-pinning.md) |
| `eslint/`         | `eslint.config.{nestjs,react,expo}.mjs`                                         | per-stack lint                                       |
| `docker/`         | `Dockerfile.{nestjs,web}`, `.dockerignore`, `docker-compose.local.example.yml`  | [docker](../docs/tooling/docker.md)                  |
| `sonar/`          | `sonar-project.{api,web}.properties`                                            | [sonarqube](../docs/tooling/sonarqube.md)            |
| `security/`       | `.osv-scanner.toml`                                                              | [security-scanning](../docs/tooling/security-scanning.md) |
| `docs-lint/`      | `.vale.ini`, `.vale/styles/House/{Terminology,NoPlaceholders,SingleH1,RequiredSectionIntent}.yml` | [vale](../docs/tooling/vale.md)                      |
| `scripts/`        | `checkmarx-package.sh`, `sonar-setup.sh`, `sonar-do.sh`, `sonar-doctor.sh`, `bulk-close-stale-issues.mjs`, `patch-sonar-summary.mjs` | [security-scanning](../docs/tooling/security-scanning.md), [sonarqube](../docs/tooling/sonarqube.md) |
| `ci/`             | `ci-backend.example.yml`, `security-scan.example.yml`, `agent-drift.example.yml` | CI starting points (GitHub Actions)                  |
| `commands/`       | `agent-compass.commands.json`                                                    | command registry for agents                          |
| `intake/`         | `work-intake.md`, `README.md`                                                    | force agent-ready Goal/Context/Constraints/Done/Validation |
| `architecture/`   | `architecture-intake.md`, `architecture-decision.md`, `decision-matrix.md`, `diagrams.md`, `tech-backlog.md`, `technical-meetings.md` | new-project architecture decisions (scaffold with `new arch`) |
| `context/`        | `repo-map.md`                                                                    | active repo surface map + task routing               |
| `conformance/`    | `agent-smoke-test.md`, `provider-discovery-smoke.md`                             | lightweight agent behavior + provider discovery smoke tests |
| `codex/`          | `.codex/config.toml`, `.codex/hooks.json`                                        | Codex repo config, goals, hooks, MCP, sandbox profile |
| `claude/`         | `.claude/agents/*`, `.claude/hooks/*`, `.claude/settings.example.json`           | Claude subagents and hook templates                  |
| `gemini/`         | `.gemini/settings.example.json`                                                  | Gemini CLI settings with recommended MCP servers (installed as host `.gemini/settings.example.json`) |
| `handoff.md`      | loose file — agent handoff report (goal, files, validation, decisions)           | Completion Gate handoff (`AGENTS.md §4`)             |
| `design-system/`  | `README.md`                                                                      | Figma/design-system extraction worksheet            |
| `policies/`       | setup policy packs (`safe-local-work`, `solo-dev`, `startup-fast`, `strict-enterprise`, `regulated-api`) | `policy-pack.mjs` |
| `agent/`          | `.github/PULL_REQUEST_TEMPLATE.md`, `.github/instructions/*.instructions.md`, `.github/prompts/*.prompt.md`, `.github/agents/*.agent.md`, `.github/ISSUE_TEMPLATE/agent-ready-task.yml` | agent rules, prompts, custom agents, intake form, PR template |
| `mcp/`            | `README.md`, `tool-contract.md`, `figma.example.json`, `figma-mcp-go.*`, `projectmem.example.json`, `codebase-memory.example.json`, provider allowlist examples | MCP setup + per-tool contracts                       |
| `evals/`          | `agent-teaching-evals.json`                                                      | teaching and provider-tool offer eval fixtures       |
| `trace/`          | `README.md`, `agent-trace.example.jsonl`                                         | agent trace/outcome log schema (no secrets)          |
| `specs/`          | `constitution-template.md`, `spec-template.md`, `plan-template.md`, `tasks-template.md`, `checklist-template.md`, `change-spec-template.md`, `specs-readme.md`, `openspec-config.example.yaml` | [spec-driven-development](../docs/workflows/spec-driven-development.md), [openspec](../docs/workflows/openspec.md) |
| `spec-kit/`       | `README.md`                                                                      | optional Spec Kit bridge/provider pack generated by `spec-kit-bridge` |
| `memory/`         | `projectmem-readme.md`, `projectmem-policy.md`                                  | [projectmem](../docs/tooling/projectmem.md), [project-memory](../docs/workflows/project-memory.md) |

## Notes

- These come from a real monorepo; scan for project-specific names before reuse
  (`grep -ri <project> templates/`). `install.mjs` does the common substitutions for
  you when wiring into a host project.
- CI files are `.example.yml` so they don't run if copied verbatim — adapt and
  rename to activate.
- Never add real secrets. Env templates ship placeholders only.

## Strip OS metadata before packaging

A packaging step copies the working tree as it is on disk. `.gitignore` hides OS
metadata from git, but it does not remove the file, so `.DS_Store`, `._*`
AppleDouble sidecars, `Thumbs.db` and `desktop.ini` still reach the artifact. One
Linux package build already contained a `.DS_Store` for exactly this reason.

- Ignore the set in [`monorepo/gitignore.tpl`](monorepo/gitignore.tpl), and strip
  the same set in every step that copies files into an artifact: the archive
  step ([`scripts/checkmarx-package.sh`](scripts/checkmarx-package.sh)), the
  image build context ([`docker/.dockerignore`](docker/.dockerignore)), and any
  bundler that copies a resource directory.
- Keep the lists aligned, and say so in a comment on both sides. A packaging step
  that archives a subtree can drop `.Spotlight-V100` and `.Trashes`: macOS writes
  those two at a volume root only. A drift in the other four is invisible until
  someone unpacks the artifact.
- Review hides the problem: the junk files are ignored, so no diff shows them.

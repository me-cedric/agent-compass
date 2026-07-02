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
| `monorepo/`       | `turbo.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`, `.prettierrc`, `.prettierignore`, `commitlint.config.js`, `.nvmrc`, `.npmrc`, `env.example.tpl`, `gitignore.tpl`, `husky/{pre-commit,pre-push,commit-msg,post-merge}` | [pnpm](../docs/tooling/pnpm.md), [turbo](../docs/tooling/turbo.md), [husky](../docs/tooling/husky.md), [version-pinning](../docs/tooling/version-pinning.md) |
| `eslint/`         | `eslint.config.{nestjs,react,expo}.mjs`                                         | per-stack lint                                       |
| `docker/`         | `Dockerfile.{nestjs,web}`, `.dockerignore`, `docker-compose.local.example.yml`  | [docker](../docs/tooling/docker.md)                  |
| `sonar/`          | `sonar-project.{api,web}.properties`                                            | [sonarqube](../docs/tooling/sonarqube.md)            |
| `security/`       | `.osv-scanner.toml`                                                              | [security-scanning](../docs/tooling/security-scanning.md) |
| `scripts/`        | `checkmarx-package.sh`, `sonar-setup.sh`                                         | [security-scanning](../docs/tooling/security-scanning.md), [sonarqube](../docs/tooling/sonarqube.md) |
| `ci/`             | `ci-backend.example.yml`, `security-scan.example.yml`, `agent-drift.example.yml` | CI starting points (GitHub Actions)                  |
| `commands/`       | `agent-compass.commands.json`                                                    | command registry for agents                          |
| `intake/`         | `work-intake.md`, `README.md`                                                    | force agent-ready Goal/Context/Constraints/Done/Validation |
| `architecture/`   | `architecture-intake.md`, `architecture-decision.md`, `decision-matrix.md`, `diagrams.md`, `tech-backlog.md`, `technical-meetings.md` | new-project architecture decisions (scaffold with `new arch`) |
| `context/`        | `repo-map.md`                                                                    | active repo surface map + task routing               |
| `conformance/`    | `agent-smoke-test.md`                                                            | lightweight agent behavior smoke test                |
| `codex/`          | `.codex/config.toml`, `.codex/hooks.json`                                        | Codex repo config, goals, hooks, MCP, sandbox profile |
| `claude/`         | `.claude/agents/*`, `.claude/hooks/*`, `.claude/settings.example.json`           | Claude subagents and hook templates                  |
| `design-system/`  | `README.md`                                                                      | Figma/design-system extraction worksheet            |
| `policies/`       | setup policy packs (`solo-dev`, `startup-fast`, `strict-enterprise`, `regulated-api`) | `policy-pack.mjs` |
| `agent/`          | `.github/PULL_REQUEST_TEMPLATE.md`, `.github/instructions/*.instructions.md`, `.github/prompts/*.prompt.md`, `.github/agents/*.agent.md`, `.github/ISSUE_TEMPLATE/agent-ready-task.yml` | agent rules, prompts, custom agents, intake form, PR template |
| `mcp/`            | `README.md`, `tool-contract.md`, `figma.example.json`, `figma-mcp-go.*`, `projectmem.example.json`, provider allowlist examples | MCP setup + per-tool contracts                       |
| `evals/`          | `agent-teaching-evals.json`                                                      | teaching and provider-tool offer eval fixtures       |
| `trace/`          | `README.md`, `agent-trace.example.jsonl`                                         | agent trace/outcome log schema (no secrets)          |
| `specs/`          | `constitution-template.md`, `spec-template.md`, `plan-template.md`, `tasks-template.md`, `checklist-template.md`, `specs-readme.md` | [spec-driven-development](../docs/workflows/spec-driven-development.md) |
| `memory/`         | `projectmem-readme.md`, `projectmem-policy.md`                                  | [projectmem](../docs/tooling/projectmem.md), [project-memory](../docs/workflows/project-memory.md) |

## Notes

- These come from a real monorepo; scan for project-specific names before reuse
  (`grep -ri <project> templates/`). `install.mjs` does the common substitutions for
  you when wiring into a host project.
- CI files are `.example.yml` so they don't run if copied verbatim — adapt and
  rename to activate.
- Never add real secrets. Env templates ship placeholders only.

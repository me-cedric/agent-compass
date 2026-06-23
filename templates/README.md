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
| `monorepo/`       | `turbo.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`, `.prettierrc`, `.prettierignore`, `commitlint.config.js`, `.nvmrc`, `.npmrc`, `env.example.tpl`, `gitignore.tpl`, `husky/{pre-commit,pre-push,commit-msg}` | [pnpm](../docs/tooling/pnpm.md), [turbo](../docs/tooling/turbo.md), [husky](../docs/tooling/husky.md), [version-pinning](../docs/tooling/version-pinning.md) |
| `eslint/`         | `eslint.config.{nestjs,react,expo}.mjs`                                         | per-stack lint                                       |
| `docker/`         | `Dockerfile.{nestjs,web}`, `.dockerignore`, `docker-compose.local.example.yml`  | [docker](../docs/tooling/docker.md)                  |
| `sonar/`          | `sonar-project.{api,web}.properties`                                            | [sonarqube](../docs/tooling/sonarqube.md)            |
| `security/`       | `.osv-scanner.toml`                                                              | [security-scanning](../docs/tooling/security-scanning.md) |
| `scripts/`        | `checkmarx-package.sh`, `sonar-setup.sh`                                         | [security-scanning](../docs/tooling/security-scanning.md), [sonarqube](../docs/tooling/sonarqube.md) |
| `ci/`             | `ci-backend.example.yml`, `security-scan.example.yml`                            | CI starting points (GitHub Actions)                  |
| `commands/`       | `agent-compass.commands.json`                                                    | command registry for agents                          |
| `context/`        | `repo-map.md`                                                                    | active repo surface map                              |
| `conformance/`    | `agent-smoke-test.md`                                                            | lightweight agent behavior smoke test                |
| `agent/`          | `.github/PULL_REQUEST_TEMPLATE.md`, `.github/instructions/*.instructions.md`     | per-path agent rules + PR template                   |
| `mcp/`            | `README.md`, `figma.example.json`, `projectmem.example.json`                     | MCP setup examples                                   |
| `specs/`          | `constitution-template.md`, `spec-template.md`, `plan-template.md`, `tasks-template.md`, `checklist-template.md`, `specs-readme.md` | [spec-driven-development](../docs/workflows/spec-driven-development.md) |
| `memory/`         | `projectmem-readme.md`, `projectmem-policy.md`                                  | [projectmem](../docs/tooling/projectmem.md), [project-memory](../docs/workflows/project-memory.md) |

## Notes

- These come from a real monorepo; scan for project-specific names before reuse
  (`grep -ri <project> templates/`). `install.mjs` does the common substitutions for
  you when wiring into a host project.
- CI files are `.example.yml` so they don't run if copied verbatim — adapt and
  rename to activate.
- Never add real secrets. Env templates ship placeholders only.

# Prerequisites — Toolchain Setup

The tools agent-compass workflows assume. Install what your project actually
uses; verify each with its `--version`. Commands are macOS/Homebrew-first with a
cross-platform note where it matters.

## Core (always)

| Tool   | Install                                              | Verify            |
| ------ | --------------------------------------------------- | ----------------- |
| Node   | `nvm install` (reads `.nvmrc`) — [nvm](https://github.com/nvm-sh/nvm) | `node -v` |
| pnpm   | `corepack enable && corepack prepare pnpm@<pinned> --activate` | `pnpm -v` |
| git    | preinstalled / `brew install git`                   | `git --version`   |
| gh CLI | `brew install gh` then `gh auth login`              | `gh --version`    |

Node is pinned by `.nvmrc`; pnpm by `packageManager` in `package.json`
(Corepack activates it automatically). See
[version-pinning.md](version-pinning.md).

## Agent productivity

| Tool         | Purpose                                  | Install                                                        |
| ------------ | ---------------------------------------- | ------------------------------------------------------------- |
| `rtk`        | Compact wrappers for noisy shell output  | Install the `rtk` binary from its distribution (Homebrew tap / cargo / release archive), then `rtk --version`. Reference: [rtk.md](rtk.md). |
| `skillshare` | Sync skills/agents across AI CLIs        | `npm i -g skillshare` (or per its README); `skillshare --help` |

> `rtk` is a standalone binary, not an npm package — grab it from wherever you
> installed it on your other machines. Once on `PATH`, agent-compass and your
> agents pick it up automatically.

## Quality & security (per project need)

| Tool             | Purpose                       | Install                                                          |
| ---------------- | ----------------------------- | --------------------------------------------------------------- |
| Docker           | Local infra + images          | [Docker Desktop](https://www.docker.com/) / `brew install --cask docker` |
| `sonar-scanner`  | SonarQube analysis            | dev dep (`pnpm exec sonar-scanner`) or `brew install sonar-scanner` |
| SonarQube server | Local quality gate            | `pnpm sonar:setup` (scripted) or run the Sonar Docker image     |
| `osv-scanner`    | Dependency vuln scanning      | `brew install osv-scanner` (or `go install` from OSV)           |
| Checkmarx CLI    | SAST                          | per Checkmarx docs; packaging via `templates/scripts/checkmarx-package.sh` |

## API contract tooling (API projects)

| Tool          | Purpose                          | Install                              |
| ------------- | -------------------------------- | ------------------------------------ |
| Bruno         | Git-versioned API client         | `brew install bruno` / [download](https://www.usebruno.com) |
| Mockoon CLI   | Mock servers from OpenAPI        | `npm i -D @mockoon/cli`              |
| Scalar        | OpenAPI docs UI                  | served by the API (dependency), no separate install |

See [api-contract-sync.md](api-contract-sync.md).

## One-shot check

```bash
for t in node pnpm git gh rtk docker; do printf '%-8s ' "$t"; command -v "$t" >/dev/null && "$t" --version 2>/dev/null | head -1 || echo MISSING; done
```

Missing tools degrade gracefully — e.g. without `rtk`, commands just run
unwrapped. Install only what the project's scripts reference.

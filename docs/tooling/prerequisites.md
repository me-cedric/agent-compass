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
| `headroom`   | Session-level context compression layer  | `pip install "headroom-ai[all]"`, then `headroom --version`. Reference: [headroom.md](headroom.md). |
| `skillshare` | Sync skills/agents across AI CLIs        | `npm i -g skillshare` (or per its README); `skillshare --help` |

> `rtk` is a standalone binary, not an npm package — grab it from wherever you
> installed it on your other machines. Once on `PATH`, agent-compass and your
> agents pick it up automatically.

## Agent integrations (optional)

Install these only when the project uses the matching workflow. Agent Compass
ships guidance and templates; it does not install global agent tooling.

| Integration | Purpose | Required locally | Verify |
| ----------- | ------- | ---------------- | ------ |
| projectmem | Durable local project memory and pre-action warnings | Python `>=3.10`, `pip`, projectmem package | `python --version`, `pjm --help` |
| GitHub Spec Kit CLI | Optional upstream spec artifact generator | Python `>=3.11`, `uv` recommended or `pipx`, `git` | `uv --version`, `specify --help` |
| MCP clients | Let agents read projectmem through MCP | Agent/client that supports MCP, absolute Python path for server config | client shows `projectmem` tools |
| Figma MCP | Design context for frontend implementation | Figma Desktop or supported MCP setup, Dev/Full seat where required, MCP-capable agent | client shows Figma design context tools |
| GitHub PR automation | Create/review PRs from agent workflows | `gh` authenticated against the repo | `gh auth status`, `gh label list` |

projectmem quick setup:

```bash
python3 --version      # must be >= 3.10
python3 -m pip install projectmem
pjm init
pjm brief
```

Spec Kit CLI quick setup (optional; Agent Compass has native templates too):

```bash
uv --version           # install uv first if missing
uv tool install specify-cli --from git+https://github.com/github/spec-kit.git@vX.Y.Z
specify --help
```

Use an absolute Python path in MCP configs because GUI agents often do not
inherit your shell `PATH`:

```bash
which python3
python3 -m projectmem.mcp_server --root /absolute/path/to/project
```

See [projectmem.md](projectmem.md) and
[spec-driven-development.md](../workflows/spec-driven-development.md).

Figma MCP quick setup:

1. Install the official Figma MCP/plugin path for your agent when available.
2. Open the target file in Figma Desktop or the supported client flow.
3. Verify the agent can call Figma design context tools.
4. Keep tokens in the client secret store, not in repo files.

See [mcp.md](mcp.md).

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
for t in node pnpm git gh rtk headroom docker python3 uv pjm specify; do printf '%-10s ' "$t"; command -v "$t" >/dev/null && "$t" --version 2>/dev/null | head -1 || echo MISSING; done
```

Missing tools degrade gracefully — e.g. without `rtk`, commands just run
unwrapped. Install only what the project's scripts reference.

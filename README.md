# agent-compass

Shared operating kit for AI coding agents (Claude Code, Codex, GitHub Copilot) in team repositories.

Compass gives a project one agent contract, a small set of skills, role agents, stack rules, MCP servers and CI packs.
It installs them from a git submodule that is pinned to a release tag. A per-file hash lock keeps updates exact. An edit in the project is never lost.
It has no runtime dependency. It needs Node 20.12 or later and git.

## Start in 5 minutes

`ac` stands for `node docs/agent-compass/bin/ac.mjs`. Run it from the project root.

```bash
git submodule add <compass-url> docs/agent-compass
git -C docs/agent-compass checkout <tag>
ac init                  # create .agents/compass.json, then sync
ac doctor                # fix each "fail" line
ac check --frozen        # exit 0 when the project matches the lock
ac ui                    # open the local UI; turn assets on and off
```

Commit the submodule, `.gitmodules`, `.agents/` and the generated files. Run `ac sync --to <tag>` to update.
See [docs/guide/install.md](docs/guide/install.md).

## Commands

| Command | Does |
|---|---|
| `ac init` | Create `.agents/compass.json` if it is missing. Then sync. |
| `ac sync` | Fetch the upstream sources. Write the files, keys and blocks into the project. `--to <tag>` moves the submodule first. |
| `ac check` | Compare the project with the lock and check the docs layout. `--frozen` exits 1 on drift. Writes nothing. |
| `ac doctor` | Check the tools, the configuration and the ownership rules. `--tokens` checks the context budget. `--global` reports your user-level setup. |
| `ac migrate` | Move a compass 0.4 to 0.9 install to 1.0. `--docs` moves spec-kit specs to the Konvoy docs layout. |
| `ac env` | `check`, `export`, `import` and `run`: keep env vars in step and share them encrypted with age. |
| `ac dev` | `up`, `down`, `status` and `logs`: run the local stack with process-compose. |
| `ac run` | Run a command from `agent-compass.commands.json`. Store the result in `.agents/runs/`. |
| `ac usage` | Show tokens, cost, cache hit rate and sub-agent share from the Claude Code transcripts. |
| `ac promote` | Copy a project skill into compass. |
| `ac ui` | Start the local web UI on `127.0.0.1`. |

`init`, `sync`, `check`, `doctor` and `migrate` take `--root <dir>`, `--dry` and `--json`. Every command has `--help`; read it for the options of `env`, `dev`, `run`, `usage`, `promote` and `ui`. Exit 0 is success, 1 is an error or drift, 2 is a usage error.

## Providers

| Provider | Reads | Compass sets |
|---|---|---|
| Claude Code | `CLAUDE.md` (imports `AGENTS.md`), `.claude/skills`, `.claude/agents`, `.claude/rules` | Output style, hooks, permission rules, agent model pins, the `deliver` workflow. |
| Codex | `AGENTS.md`, `.agents/skills`, `.codex/agents` | `model_verbosity`, reasoning summary, hooks, agent model pins. |
| GitHub Copilot | `AGENTS.md`, `.claude/skills`, `.claude/agents`, `.claude/rules`, `.github/agents` | Agent model pins and MCP servers. |

## Docs

Start with [docs/README.md](docs/README.md).

| Guide | Covers |
|---|---|
| [Install](docs/guide/install.md) | Submodule, sync, update, CI check, migration. |
| [Assets](docs/guide/assets.md) | Skills, stack rules, agents, packs, MCP servers, upstream sources. |
| [Local UI](docs/guide/ui.md) | `ac ui`, `ac usage`, `ac promote`. |
| [Dev loop](docs/guide/dev-loop.md) | Env, local run, e2e. |
| [Quality](docs/guide/quality.md) | Security scans, CI packs, version pins. |
| [Delivery](docs/guide/delivery.md) | Docs layout, OpenSpec, RAID, ADRs, pull requests. |
| [Engineering rules](docs/guide/engineering-rules.md) | Code, tests, git, security, accessibility, docs. |
| [Agents](docs/guide/agents.md) | Style contract, delegation, cost, permissions. |
| [Architecture](docs/guide/architecture.md) | APIs, resilience, observability, monorepos. |
| [Native](docs/guide/native.md) | Mobile, desktop, devices, design. |

The [ownership contract](docs/contract/ownership.md) says what compass and Konvoy write. The [decisions](docs/decisions/) hold ADR 0001 to 0006.

## Layout

```
bin/ac.mjs   engine/   ui/        the CLI, the engine and the local UI
core/        the compass block, output style, hooks, role agents, OpenSpec schema
skills/      rules/     packs/    mcp/catalog.json   upstream.json
docs/        scripts/   test/
```

## Develop

Read [AGENTS.md](AGENTS.md) and [CONTRIBUTING.md](CONTRIBUTING.md) first. Run `npm test` for the tests and `npm run check` for the tests and the lints.

Licence: MIT. See [LICENSE](LICENSE) and [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). The last 0.x release is the tag `v0.9.6`.

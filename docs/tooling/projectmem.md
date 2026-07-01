# projectmem

Use `projectmem` when a project needs durable local memory for AI coding agents:
decisions, failed attempts, fixes, validation outcomes, fragile files, and
pre-action warnings.

`projectmem` is optional tooling. Agent Compass installs policy files and agent
guidance, but it does not install Python packages or mutate global MCP config.

## Install

Verify current upstream instructions first:

- Repository: <https://github.com/riponcm/projectmem>
- Website: <https://projectmem.dev/>

Typical setup:

```bash
python3 --version      # projectmem currently requires Python >= 3.10
uv tool install projectmem
pjm init
pjm --help
```

Prefer a project-local install when the host project already has a Python
virtualenv:

```bash
python3 -m venv .venv
.venv/bin/pip install projectmem
.venv/bin/pjm init
```

`pjm init` creates `.projectmem/` and installs local hooks for warnings and
classification. The canonical command is `projectmem`; `pjm` is the short alias.
Command names can drift between projectmem releases; verify the command registry
entries with `pjm --help` after install.
Backfill/import commands are opt-in because they can create many legacy
`.projectmem/issues/*` files.

## Prerequisites

| Requirement | Why |
| ----------- | --- |
| Python `>=3.10` | Required by the projectmem package. |
| `pip` or another Python package installer | Installs projectmem. |
| Git repository | projectmem uses repository history and hooks. |
| MCP-capable agent/client (optional) | Lets agents read summaries and warnings through tools. |

For MCP, prefer `uvx --from projectmem pjm-mcp` with `cwd: "."` so shared
examples work in every clone.

## Agent workflow

Before starting:

```bash
pjm brief
pjm precheck
```

During work, log durable events as soon as they matter:

- failed attempts and why they failed
- important findings
- fragile files or risky areas discovered

After work, log:

- decisions
- fixes
- files changed
- validation commands and results
- remaining risks

Never log secrets, tokens, credentials, personal data, or temporary
brainstorming.

## MCP setup

Use the upstream docs for exact client config. The portable server command is:

```bash
uvx --from projectmem pjm-mcp
```

For Codex, use TOML like:

```toml
[mcp_servers.projectmem]
command = "uvx"
args = ["--from", "projectmem", "pjm-mcp"]
cwd = "."
```

Copy `.mcp/projectmem.example.json` into your local MCP client config and never
commit that local client config.

## Generated files

- `.projectmem/summary.md` is generated shared context. It may be committed after
  review for secrets, personal data, and local absolute paths.
- `.projectmem/events.jsonl`, `.projectmem/issues/`, `.projectmem/watch.*`,
  `.projectmem/data/`, and DB files stay ignored by default.
- Keep `.projectmem/summary.md` in `.prettierignore`; agents can read it without
  formatter churn.

## Export mode

For agents without MCP, upstream supports:

```bash
pjm export --claude-md
```

Treat generated agent-file blocks as derived memory. Do not hand-edit secrets or
private data into them.

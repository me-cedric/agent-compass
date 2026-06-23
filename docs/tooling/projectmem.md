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
python3 -m pip install projectmem
pjm init
```

`pjm init` creates `.projectmem/` and installs local hooks for warnings and
classification. The canonical command is `projectmem`; `pjm` is the short alias.

## Prerequisites

| Requirement | Why |
| ----------- | --- |
| Python `>=3.10` | Required by the projectmem package. |
| `pip` or another Python package installer | Installs projectmem. |
| Git repository | projectmem uses repository history and hooks. |
| MCP-capable agent/client (optional) | Lets agents read summaries and warnings through tools. |

For GUI agents, use the absolute path from `which python3` in MCP config because
they may not inherit shell `PATH`.

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

Use the upstream docs for exact client config. The common server command is:

```bash
python -m projectmem.mcp_server --root /absolute/path/to/project
```

For Codex, upstream currently documents TOML like:

```toml
[mcp_servers.projectmem]
command = "/absolute/path/to/python"
args = ["-m", "projectmem.mcp_server", "--root", "/absolute/path/to/project"]
cwd = "/absolute/path/to/project"
```

Use an absolute Python path when the client does not inherit shell `PATH`.

## Export mode

For agents without MCP, upstream supports:

```bash
pjm export --claude-md
```

Treat generated agent-file blocks as derived memory. Do not hand-edit secrets or
private data into them.

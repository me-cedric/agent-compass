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

For MCP, prefer `uvx --from projectmem --with 'mcp<2' pjm-mcp` with `cwd: "."`
so shared examples work in every clone. The `--with 'mcp<2'` pin is required —
see [Troubleshooting](#troubleshooting).

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
uvx --from projectmem --with 'mcp<2' pjm-mcp
```

For Codex, use TOML like:

```toml
[mcp_servers.projectmem]
command = "uvx"
args = ["--from", "projectmem", "--with", "mcp<2", "pjm-mcp"]
cwd = "."
```

Copy `.mcp/projectmem.example.json` into your local MCP client config and never
commit that local client config.

## Generated files

projectmem is event-sourced. `.projectmem/events.jsonl` is an append-only log —
the source of truth — and every other file is a projection folded from it by
`pjm regenerate`. This decides what to commit:

- **Commit `.projectmem/events.jsonl`** (the shared source of truth) plus the
  static docs (`README.md`, `projectmem-policy.md`, `config.toml`).
- **Gitignore the regenerated projections:** `.projectmem/summary.md`,
  `.projectmem/PROJECT_MAP.md`, `.projectmem/AI_INSTRUCTIONS.md`,
  `.projectmem/issues/`, plus `.projectmem/watch.*`, `.projectmem/data/`, and DB
  files. Rebuild them locally with `pjm regenerate`.
- `.gitattributes` gives the log `merge=union` so concurrent appends auto-combine.
- Keep `.projectmem/` in `.prettierignore`; agents read the files without
  formatter churn, and stable lines keep the union merge clean.

`node scripts/install.mjs --fix` (or a fresh install) writes these `.gitignore`,
`.gitattributes`, and `.prettierignore` entries for you.

## Collaboration

The failure mode this avoids: projectmem's own default commits the regenerated
`summary.md` and gitignores the log, so each teammate regenerates their own
summary from their own local log and the last commit silently overwrites the rest.
Agent Compass inverts that — share the append-only log, derive the summary locally.

- **After every `git pull`/merge, run `pjm regenerate`** to fold teammates' events
  into your local summary. The vendored `post-merge` hook does this automatically.
- **First-time migration on an existing repo:** one collaborator's log has never
  been shared, so before switching, union the two `events.jsonl` files
  (concatenate, sort by timestamp, drop duplicate lines) or the un-shared history
  is lost. After that, `merge=union` handles ongoing appends.
- **Division of labor with durable notes:** the log is a high-churn running record
  (attempts, findings, fixes, risks). Architecture and design decisions that must
  survive belong in a committed, one-file-per-item note that merges cleanly — an
  ADR under `docs/decisions/NNN-*.md` — not the regenerated summary. `tasks/lessons.md`
  stays local scratch (gitignored); promote a durable lesson into an ADR or the log.
- **Known limit:** sequential issue ids (`0042`) can collide between two offline
  writers; `merge=union` keeps both lines, but a later `pjm fix --issue`/
  `--supersedes` on that id can be ambiguous. Rare for small teams; if it bites,
  give each author a separate `PROJECTMEM_ROOT` and concatenate before regenerate.

## Troubleshooting

### MCP server fails to start: `ModuleNotFoundError: No module named 'mcp.server.fastmcp'`

projectmem (≤ 0.2.0) pins its dependency loosely (`mcp>=0.1.0`), so `uvx`
resolves the newest `mcp` — and **`mcp` 2.0.0 relocated FastMCP** (from
`mcp.server.fastmcp` to `mcp.server.mcpserver`). projectmem still imports
`from mcp.server.fastmcp import FastMCP`, so the server crashes on startup and
the client shows projectmem as failed/never-connecting.

Fix: constrain `mcp` to the 1.x line in the launch command —
`uvx --from projectmem --with 'mcp<2' pjm-mcp` (already applied in the command
strings above and in `templates/mcp/projectmem.example.json`). Drop the pin once
upstream projectmem supports `mcp` 2.x.

Two operational notes: an MCP server does **not** hot-reload — after fixing
`.mcp.json` you must restart the agent session for the tools to reconnect. In the
meantime you can still record memory through the identical `pjm` CLI
(`pjm note`/`decision`/`fix` …), which writes the same `events.jsonl` — never
hand-edit `.projectmem/` files.

## Export mode

For agents without MCP, upstream supports:

```bash
pjm export --claude-md
```

Treat generated agent-file blocks as derived memory. Do not hand-edit secrets or
private data into them.

# Codebase Memory (structural code intelligence)

[`codebase-memory-mcp`](https://github.com/DeusData/codebase-memory-mcp) (CBM,
MIT) builds a local structural graph of a repository — symbols, definitions,
imports, callers and callees, routes, cross-service links, dependency paths —
and exposes it over MCP. Agents query the graph to find the right files instead
of grepping the tree, then read only those files.

It is **optional**. Agent Compass installs the binary and generates the MCP
configuration itself; CBM never writes compass-owned files.

## Purpose

Cut the exploration cost of every task. A broad recursive grep pulls dozens of
files into context to answer "where does payment processing live?". One graph
query answers it and hands back a short list to read.

## The four sources of truth

| Source | Answers | Written by |
| ------ | ------- | ---------- |
| Source code | What the program does. **Always authoritative.** | Developers |
| `README` / `DESIGN` / [ADRs](../decisions/) | Intended architecture, constraints, rationale. | Developers and agents |
| CBM graph | Current structure and change impact. | Derived automatically |
| [projectmem](projectmem.md) | Durable history: decisions, failures, fixes, fragile areas. | Agents and developers |

CBM does **not** replace projectmem. A code graph is derived and always current;
project memory is authored and remembers what the code cannot say — why a
provider was dropped, which refactor failed twice, which module breaks under
load. Keep both. The behavioral rule lives in `AGENTS.md` §1b.

## When to use it

| Need | Tool |
| ---- | ---- |
| Architecture overview of an unfamiliar area | `get_architecture` |
| Find a symbol or its file | `search_graph` |
| Who calls this / what does it call | `trace_path` (`inbound`, `outbound`, `both`) |
| Blast radius of a change | `detect_changes` |
| Exact source of a symbol | `get_code_snippet` |
| Fuzzy concept with no known symbol | `search_code` |
| Confidence in a cited path | `check_index_coverage` |

## When not to use it

- Literal text that is not code: comments, error strings, config values,
  documentation. Grep is better and cheaper.
- Non-indexed file types, generated output, or anything outside the repository.
- **Any exhaustive or negative claim on its own.** The graph misses dynamic
  dispatch, reflection, string-keyed lookups, config-driven wiring, and
  generated code, and it returns same-named symbols from unrelated modules.
  `check_index_coverage` returns a `best_effort` signal and says so in its own
  caveat. Corroborate in source before saying "nothing calls this".
- As a second ADR store. See [ADR ownership](#adr-ownership) below.

## Install

```bash
agent-compass code-intel install
```

This downloads the official installer, then runs it with `--skip-config`. That
flag matters: without it CBM configures dozens of coding agents itself and would
overwrite Agent Compass-owned provider config. Upstream's mandatory SHA-256
checksum verification stays in charge of the download — Agent Compass does not
reimplement it. The binary lands in `~/.local/bin`, no `sudo`.

Interactive runs ask before touching user-level machine state. Use `--yes` for
non-interactive approval and `--dry` to preview. If automatic installation is
impossible (Windows, no `curl`), the command prints the exact manual command
rather than failing silently.

## Agent Compass CLI

```bash
agent-compass code-intel status      # read-only; never triggers indexing
agent-compass code-intel install     # binary only, user-level, no sudo
agent-compass code-intel configure   # auto_index=true, auto_watch=true
agent-compass code-intel setup --yes # status → install → configure → wire → verify
agent-compass code-intel doctor      # actionable diagnostics
```

`setup` is idempotent: run it as often as you like. It installs the binary if
missing, applies the compass config defaults, adds the `.codebase-memory/`
ignore rule, creates `.mcp/codebase-memory.example.json`, and records
`"codeIntelligence": "codebase-memory"` in `agent-compass.answers.json`.

Registry names: `agentTools.codeIntelStatus`, `agentTools.codeIntelSetup`,
`agentTools.codeIntelDoctor`.

## MCP

The generated example resolves the executable from `PATH`, so the file is
portable between machines and contains no developer-specific absolute path:

```json
{
  "mcpServers": {
    "codebase-memory-mcp": { "command": "codebase-memory-mcp", "args": [], "cwd": "." }
  }
}
```

Copy `.mcp/codebase-memory.example.json` into your MCP client config and restart
the agent session. `agent-compass mcp-probe` includes it in the readiness table.
Gemini CLI reads servers from `.gemini/settings.json` instead — merge the same
`mcpServers` entry there.

## Auto-index and auto-watch

```
auto_index = true    # index a repository on first query instead of failing
auto_watch = true    # keep the graph fresh in the background
```

Both are set by `agent-compass code-intel configure` and checked by `doctor`.
They are the point of the integration: without them agents rebuild project
understanding every session, which is the cost the graph exists to remove.
`configure` touches only these two keys and leaves the rest of your CBM
configuration alone.

## Local cache and the generated graph

The graph lives in the user cache (`~/.cache/codebase-memory-mcp/`). A
repository-local `.codebase-memory/` directory may also appear.

**Default: `.codebase-memory/` is gitignored.** Committing a binary graph adds
diff noise, merge conflicts, and churn for a cache that is already persistent
locally. `agent-compass code-intel setup` and `agent-compass doctor --fix` add
the ignore line; `doctor` verifies it for hosts that selected the layer.

**Optional team mode.** Upstream supports committing
`.codebase-memory/graph.db.zst`, a compressed snapshot teammates use to skip
first-clone indexing. Enable it only if clone/bootstrap indexing cost proves
significant in practice, and only as a deliberate team decision — Agent Compass
never enables it for you.

## ADR ownership

Agent Compass owns durable ADRs under [`docs/decisions/`](../decisions/). CBM
exposes a `manage_adr` tool and its indexer prints a hint suggesting you use it.
**Ignore that hint.** A second ADR store fragments the record and loses the
review history that a committed Markdown file carries.

CBM may *index and discover* the committed ADR files. The write path stays the
compass ADR workflow — see [decision-records](../workflows/decision-records.md).

## Relationship to `depgraph`

`agent-compass depgraph` remains. The two do different jobs:

| | `depgraph` | CBM |
| --- | --- | --- |
| Output | Committed Mermaid file for humans | Live queryable graph for agents |
| Scope | JS/TS relative imports | Multi-language symbols, calls, routes, impact |
| Needs | Nothing | The CBM binary |

Use `depgraph` for a reviewable snapshot in `docs/architecture/dependencies.md`
and as the fallback when CBM is not installed. Use CBM for live navigation.

## Troubleshooting

| Symptom | Fix |
| ------- | --- |
| `executable: missing` | `agent-compass code-intel install` |
| Installed but agents do not see the tools | Copy the MCP example into the client config, then restart the session |
| `auto_index: false` | `agent-compass code-intel configure` |
| Queries return nothing on a fresh clone | First query indexes the repo; re-run once |
| Stale results after a large external change | `index_repository` forces a refresh |
| Command found in a shell but not by an agent | `~/.local/bin` is missing from the agent's `PATH` |

## Update, uninstall, privacy

```bash
codebase-memory-mcp update      # prints the exact reinstall command
codebase-memory-mcp uninstall   # removes config entries and the binary
```

Indexing and querying are local and deterministic. No API keys, no tokens, no
model calls, no telemetry dependency — the network is used only for installation
and updates. Nothing in this integration adds a credential.

For low-level tool arguments and options that change between releases, read the
upstream repository rather than copying them here.

# Recommended MCP Servers

Ready-to-use MCP servers that make the repo's research-first workflows (the
[architecture-advisor](../../skills/architecture-advisor/SKILL.md),
spec/dev workflows) actually executable. Keyless ones can be enabled now; keyed
ones need an API key — **never commit keys**. Verify a server's current package
and flags from its own repo before relying on it; package names move.

## Catalog

| Server | What it gives the agent | Run | Key | When to use |
| ------ | ----------------------- | --- | --- | ----------- |
| **context7** | Live, version-correct library/framework/SDK docs | `npx -y @upstash/context7-mcp` (or remote `https://mcp.context7.com/mcp`) | none (optional `CONTEXT7_API_KEY` for higher limits) | Before asserting any library/API/version fact. |
| **sequential-thinking** | Structured multi-step reasoning | `npx -y @modelcontextprotocol/server-sequential-thinking` | none | Hard decisions: architecture trade-offs, gnarly debugging. |
| **fetch** | Fetch a URL → clean markdown | `uvx mcp-server-fetch` (needs Python/uv) | none | Read docs/pages the agent finds during research. |
| **playwright** | Drive a real browser | `npx @playwright/mcp@latest` | none (downloads a browser) | Verify UI, inspect or scrape a live web app. |
| **figma-mcp-go** | Local Figma design context via plugin bridge, no REST token | `npx -y @vkhanhqui/figma-mcp-go@latest` | none | When official Figma MCP/API limits block design reads; requires Figma Desktop plugin running and edit role. |
| **angular-cli** | Live Angular best-practices guide, doc search, project listing, build/test targets, zoneless-migration analysis | `npx -y @angular/cli mcp` (add `--read-only` to register only non-modifying tools) | none | Angular workspaces only; run from the workspace root. |
| **exa** | Web search / research API | `npx -y exa-mcp-server` (or remote `https://mcp.exa.ai/mcp`) | `EXA_API_KEY` | Optional: current best practice, benchmarks, prior art, pricing. |
| **GitHub** | Issues/PRs/code search/CI | the `gh` CLI (already used here), or the official remote `https://api.githubcopilot.com/mcp/` (auth) | auth | Repo/PR/CI access. The old `@modelcontextprotocol/server-github` npm server is **archived** — don't use it. |

Optional, usually redundant for coding agents (they already have file/git tools):
`@modelcontextprotocol/server-filesystem` and `mcp-server-git` (`uvx`).

## Enable

Copy what you want from
[`../../templates/mcp/recommended.example.json`](../../templates/mcp/recommended.example.json)
into your client's MCP config:

- **Claude Code:** `mcpServers` in `.mcp.json` (project). This repo ships a
  root `.mcp.json` with the two safe, keyless servers (context7,
  sequential-thinking) already enabled — your client will ask you to approve
  them on first use.
- **Codex:** translate to `config.toml` `[mcp_servers.<name>]` with
  `enabled_tools` + `default_tools_approval_mode` (see
  [`../../templates/mcp/codex.example.toml`](../../templates/mcp/codex.example.toml)).
- **Gemini CLI:** `mcpServers` in `.gemini/settings.json` (see
  [`../../templates/gemini/.gemini/settings.example.json`](../../templates/gemini/.gemini/settings.example.json)).
- **Remote URLs** (`context7`, `exa`) work across clients when you'd rather not
  spawn a local process.
- **Angular workspaces:** copy
  [`../../templates/mcp/angular-cli.example.json`](../../templates/mcp/angular-cli.example.json)
  (ships `--read-only`; see [`../../stacks/angular-web.md`](../../stacks/angular-web.md)).
- **Figma plugin bridge:** copy
  [`../../templates/mcp/figma-mcp-go.example.json`](../../templates/mcp/figma-mcp-go.example.json)
  and follow
  [`../../templates/mcp/figma-mcp-go.md`](../../templates/mcp/figma-mcp-go.md).
  The user must have edit role on the Figma file to run plugins.

## Safety

- Keys go in your shell/secret store or the client's `env`, **never** in a
  committed file. Keep keyed servers such as `exa` in local config.
- Record every enabled tool in
  [`../../templates/mcp/tool-contract.md`](../../templates/mcp/tool-contract.md)
  with its access (read/write), sensitivity, and approval mode. A tool absent
  from the contract is not approved.
- Prefer keyless, read-only servers by default; gate write/keyed servers behind
  per-call approval.

See [`mcp.md`](mcp.md) for the broader MCP setup rules and
[`headroom.md`](headroom.md) for the context-compression layer that sits over all
of this.

# MCP

Use MCP only for tools/data the agent actually needs. Keep credentials outside
repo files.

## Rules

- Prefer official servers and marketplace plugins over random wrappers.
- Keep tokens in the client secret store or local env, never in committed files.
- Use absolute paths for local servers in GUI clients.
- Copy repo `.mcp/*.example.json` into your local MCP client config, replace
  `/absolute/path/to/repo`, and never commit local MCP client config.
- Document every configured server in `.mcp/README.md`.
- Before using a server, verify the client can list the expected tools.
- For Copilot cloud agent/code review, allowlist specific read-only tools where
  possible; configured MCP tools may be used autonomously without per-call
  approval.
- For Codex, put durable MCP setup in `config.toml` and keep server instructions
  concise enough to guide tool selection.
- For Claude, package repeatable MCP + skills + hooks as a plugin when the setup
  should travel across repos.

## Tool Contracts

Connecting a server is not the same as approving its tools. Keep a per-tool
contract — access (read/write), data sensitivity, approval mode, expected
failure, validation — in `.mcp/tool-contract.md`. A tool absent from the
contract is not approved. Codex enforces it with `enabled_tools` +
`default_tools_approval_mode`; Copilot cloud allowlists in repo settings; Cursor
and Gemini have no per-tool allowlist, so their contract is the document plus
client approval prompts. Template:
[`../../templates/mcp/tool-contract.md`](../../templates/mcp/tool-contract.md).

## Provider Templates

| Provider | Template |
| -------- | -------- |
| Tool contract (all) | [`../../templates/mcp/tool-contract.md`](../../templates/mcp/tool-contract.md) |
| Copilot cloud/code review | [`../../templates/mcp/copilot-cloud.example.json`](../../templates/mcp/copilot-cloud.example.json) |
| Codex | [`../../templates/mcp/codex.example.toml`](../../templates/mcp/codex.example.toml) |
| Cursor | [`../../templates/mcp/cursor.example.json`](../../templates/mcp/cursor.example.json) |
| Gemini CLI | [`../../templates/mcp/gemini.example.json`](../../templates/mcp/gemini.example.json) |

## Project Memory

Project memory should expose summaries, pre-action warnings, and factual logs.
See [`projectmem.md`](projectmem.md).

## Figma

Use Figma MCP when frontend work depends on a real design, design system, or
component library.

Recommended setup:

1. Install the official Figma plugin/server for the active client when available.
2. Open the target Figma file in Figma Desktop or the supported client flow.
3. Connect the agent to the Figma MCP server.
4. Verify the server exposes design context tools before implementation.
5. Ask the agent to pull tokens, components, layout rules, states, and target
   frames before writing UI code.

Agent flow:

```text
User: Build the checkout screen from this Figma frame.
Agent:
1. Read repo UI rules and existing component system.
2. Pull Figma design context for selected frame.
3. Extract tokens, typography, spacing, components, variants, and states.
4. Map Figma components to existing code components before creating new ones.
5. Implement smallest matching UI.
6. Validate screenshot against Figma-derived requirements.
```

Use Code Connect where the project has it. It lets Figma map designs to real
code components instead of letting agents guess.

Use [`../../skills/figma-mcp-frontend/SKILL.md`](../../skills/figma-mcp-frontend/SKILL.md)
for implementation tasks that start from Figma.

References:

- Figma MCP guide: https://github.com/figma/mcp-server-guide
- Figma MCP docs: https://developers.figma.com/docs/figma-mcp-server/
- MCP docs: https://modelcontextprotocol.io/docs/getting-started/intro

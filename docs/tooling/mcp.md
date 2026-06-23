# MCP

Use MCP only for tools/data the agent actually needs. Keep credentials outside
repo files.

## Rules

- Prefer official servers and marketplace plugins over random wrappers.
- Keep tokens in the client secret store or local env, never in committed files.
- Use absolute paths for local servers in GUI clients.
- Document every configured server in `.mcp/README.md`.
- Before using a server, verify the client can list the expected tools.

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

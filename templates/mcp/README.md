# MCP Setup

This project may use MCP servers for agent tools and context.

## Servers

| Name | Purpose | Setup | Secret Location |
| ---- | ------- | ----- | --------------- |
| projectmem | Durable project memory | See `.mcp/projectmem.example.json` | none or local only |
| figma | Design context | See `.mcp/figma.example.json` | client secret store |

## Rules

- Do not commit tokens.
- Prefer official servers/plugins.
- Use absolute paths for local servers.
- Copy `*.example.json` into your local MCP client config, replace
  `/absolute/path/to/repo`, and keep local MCP config out of git.
- Verify tool availability before using a server.
- Log only durable facts, never secrets or personal data.

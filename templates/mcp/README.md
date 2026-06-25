# MCP Setup

This project may use MCP servers for agent tools and context.

## Servers

| Name | Purpose | Setup | Secret Location |
| ---- | ------- | ----- | --------------- |
| projectmem | Durable project memory | See `.mcp/projectmem.example.json` | none or local only |
| figma | Design context | See `.mcp/figma.example.json` | client secret store |
| headroom | Context compression (compress/retrieve/stats) | See `.mcp/headroom.example.json` | none or local only |
| research (context7, sequential-thinking, fetch, exa, playwright) | Live docs, reasoning, web research, browser | See `.mcp/recommended.example.json` + `docs/tooling/mcp-servers.md` | keyless except exa (`EXA_API_KEY`) |

## Rules

- Do not commit tokens.
- Prefer official servers/plugins.
- Use absolute paths for local servers.
- Copy `*.example.json` into your local MCP client config, replace
  `/absolute/path/to/repo`, and keep local MCP config out of git.
- Verify tool availability before using a server.
- Log only durable facts, never secrets or personal data.
- Record every enabled tool in [`tool-contract.md`](tool-contract.md) with its
  access (read/write), sensitivity, and approval mode. A tool absent from the
  contract is not approved.

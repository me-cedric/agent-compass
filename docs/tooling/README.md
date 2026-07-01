# Tooling

Concrete setup guides. Each points at runnable files in
[`templates/`](../../templates/).

| Guide                                          | Tool / concern                                          |
| ---------------------------------------------- | ------------------------------------------------------- |
| [cli.md](cli.md)                               | The `agent-compass` CLI: install, usage, every command. |
| [prerequisites.md](prerequisites.md)           | Install the toolchain (node, pnpm, rtk, docker, scanners…). |
| [rtk.md](rtk.md)                               | Compact, token-cheap wrappers for noisy shell commands. |
| [headroom.md](headroom.md)                     | Session-level context compression (wrap/proxy/MCP); layers over rtk. |
| [pnpm.md](pnpm.md)                             | Workspaces, filters, `.npmrc`, `packageManager` pin.    |
| [turbo.md](turbo.md)                           | Task pipeline, caching, the `check` verb.               |
| [version-pinning.md](version-pinning.md)       | `.nvmrc`, `.npmrc`, `packageManager`, engines.          |
| [github-actions.md](github-actions.md)         | Required GitHub Action majors and CI template policy.   |
| [husky.md](husky.md)                           | `pre-commit`, `pre-push`, `commit-msg` hooks.           |
| [mcp.md](mcp.md)                               | MCP setup, projectmem, Figma design context.            |
| [mcp-servers.md](mcp-servers.md)               | Recommended ready-to-use MCP servers (context7, fetch, playwright, …). |
| [agent-provider-capabilities.md](agent-provider-capabilities.md) | Claude, Codex, and Copilot native levers: skills, hooks, goals, subagents, prompts, MCP. |
| [agent-permissions.md](agent-permissions.md)   | Model & permission profiles per task type (read-only, fast-edit, careful, goal). |
| [model-routing.md](model-routing.md)           | Model tier + delegation + token layer per task type to cut cost. |
| [projectmem.md](projectmem.md)                 | Durable local project memory for coding agents.          |
| [sonarqube.md](sonarqube.md)                   | Local SonarQube: sonar:do (scan + auto-close + report). |
| [security-scanning.md](security-scanning.md)   | OSV scanner, Checkmarx packaging, CI security.          |
| [docker.md](docker.md)                         | Multi-stage images, local/test compose.                 |
| [env-management.md](env-management.md)         | `.env.example` discipline, startup validation.          |
| [api-contract-sync.md](api-contract-sync.md)   | OpenAPI/Scalar + Bruno + Gherkin + Mockoon.             |

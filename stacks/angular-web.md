# Preset: Angular Web

Public or authenticated web app on the Angular framework.

## Components

- **Angular** + **TypeScript** (strict mode).
- **Standalone components**, **signals** for state, native control flow
  (`@if` / `@for` / `@switch`) — per Angular's own best-practices guide.
- **Angular CLI** for scaffolding, builds, and tests.
- `ng test` for units; Playwright for critical flows.

## AI / agent integration

Angular ships first-party agent tooling (https://angular.dev/ai) — wire it in
instead of relying on training data:

- **Angular CLI MCP server** — keyless, runs from the workspace root. Copy
  [`templates/mcp/angular-cli.example.json`](../templates/mcp/angular-cli.example.json)
  into the client MCP config. Call `get_best_practices` before writing Angular
  code and `search_documentation` instead of guessing APIs. The example ships
  `--read-only`; drop the flag only after updating
  [`templates/mcp/tool-contract.md`](../templates/mcp/tool-contract.md).
- **Context files** — official prompt rules at
  `https://angular.dev/assets/context/best-practices.md`, per-IDE guideline
  downloads at `https://angular.dev/ai/develop-with-ai`, and
  `https://angular.dev/llms.txt` / `/assets/context/llms-full.txt` as fallback
  context when the MCP server is unavailable.
- **Official agent skills** — `https://github.com/angular/skills`
  (`angular-developer`, `angular-new-app`); install with
  `npx skills add https://github.com/angular/skills`.
- **WebMCP** (experimental) — Angular APIs to expose app features as agent
  tools in the browser; see `https://angular.dev/ai/webmcp` before hand-rolling
  agent access to a running app.

## agent-compass pieces

- Skill: `angular-patterns` for idiomatic Angular (with an offline vendored
  copy of the official best-practices guide when the MCP server is absent).
- Skill: `figma-mcp-frontend` for design-context-driven UI work.
- Template: [`templates/mcp/angular-cli.example.json`](../templates/mcp/angular-cli.example.json).
- Guidelines: [typescript](../docs/guidelines/typescript.md),
  [testing-tdd](../docs/guidelines/testing-tdd.md).

## Validate

```bash
npx ng lint && npx ng test && npx ng build
```

---
id: angular-ai-assets
trigger: 'when working in an Angular workspace (angular.json present or @angular/* dependencies)'
confidence: 0.9
domain: frontend
source: hand-authored
---

# Use Angular's official AI assets instead of training-data recall

Angular ships first-party agent tooling (https://angular.dev/ai). Its best
practices change per major release, so live sources beat memorized ones.

## Action

1. Enable the **Angular CLI MCP server** if the client config allows it:
   `npx -y @angular/cli mcp --read-only` (see
   `templates/mcp/angular-cli.example.json`). Keep `--read-only` unless
   `run_target`/devserver control is wanted **and**
   `templates/mcp/tool-contract.md` covers those tools.
2. Call `get_best_practices` before writing or reviewing Angular code; follow
   what it returns (standalone components, signals, native control flow,
   strict typing) over older patterns.
3. Use `search_documentation` for API facts instead of guessing; use
   `list_projects` to map the workspace before structural edits.
4. Without MCP, use the `angular-patterns` skill (ships a vendored copy of
   the official guide), or fetch
   `https://angular.dev/assets/context/best-practices.md` /
   `https://angular.dev/llms.txt` (index) /
   `https://angular.dev/assets/context/llms-full.txt` as context.
5. For richer scaffolding guidance, Angular publishes official agent skills at
   `https://github.com/angular/skills`.

## Why

Angular's idioms moved fast (modules → standalone, zones → signals/zoneless,
`*ngIf` → `@if`). Training-data Angular is usually one or two majors stale;
the CLI MCP server and context files are versioned with the framework and
kept current by the Angular team.

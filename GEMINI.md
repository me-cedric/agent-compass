# Gemini — agent-compass

## Priority

- Read **[AGENTS.md](AGENTS.md)** first; it is the canonical agent contract
  (workflow, validation, completion gate, safety).
- Asked to set up an existing project, bootstrap a new one, or add a
  capability to compass? Route through **[MISSIONS.md](MISSIONS.md)** — it maps
  the request to an executable playbook (`skills/compass-*`).
- This file adds only Gemini-specific behavior.
- In a host project, the host's own `GEMINI.md` / `AGENTS.md` win on conflict.

## Gemini-specific notes

- **Context file.** `GEMINI.md` is Gemini CLI's context file — the equivalent
  of `CLAUDE.md` for Claude. Keep it a thin pointer; the shared rules live in
  `AGENTS.md`.
- **MCP servers.** Gemini CLI configures MCP servers via `.gemini/settings.json`.
  Start from
  [`templates/gemini/.gemini/settings.example.json`](templates/gemini/.gemini/settings.example.json)
  (recommended servers, keyless by default). Record every enabled tool in the
  MCP tool contract — Gemini has no per-tool allowlist, so the contract plus
  client approval prompts are the guardrail
  (see [`templates/mcp/tool-contract.md`](templates/mcp/tool-contract.md)).
- **No hook system.** Gemini CLI has no lifecycle hooks, so deterministic
  enforcement comes from the repo instead: Husky hooks, CI, and the command
  registry `agent-compass.commands.json`. Use only commands from the registry
  or `package.json`; never invent commands.
- **Skills.** The folders under `skills/` are directly usable as referenced
  context — point at the relevant `SKILL.md` when a playbook applies.

## Safety

Do not commit, push, deploy, publish, or open PRs unless explicitly asked —
see `AGENTS.md §10`.

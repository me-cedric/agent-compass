# Agent Conformance Smoke Test

Use this in a small fixture repo before releasing new agent-compass guidance.

## Prompt

Read `AGENTS.md`. Make a tiny docs-only change. Use the repo command registry.
Report through the Completion Gate.

## Expected Behavior

- Reads `AGENTS.md` first.
- Checks `agent-compass.commands.json` before choosing commands.
- Does not invent lint/typecheck/test commands.
- Creates or updates spec artifacts only when task scope needs them.
- Reads project memory when configured.
- Reports files changed, commands run, validation result, and risks.

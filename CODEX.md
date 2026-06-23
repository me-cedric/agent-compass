# Codex — agent-compass

## Priority

- Follow **[AGENTS.md](AGENTS.md)** first. It owns the workflow, validation,
  completion gate, handoff format, and safety rules.
- This file adds only Codex-specific context behavior.

## Communication

Be concise: prefer commands, diffs, file paths, and exact next actions. Keep
essential reasoning, verification, and risks short.

## Context layering

Load only what you need, smallest scope first. Never ask for "full context" or
the entire chat history — request the one missing piece. In a host project,
prefer its code-intelligence/MCP tooling and per-path instruction files before
broad exploration.

## Rules

- Don't do broad/recursive exploration when a targeted read answers the question.
- Use only scripts that exist in the project; never invent commands.
- Do **not** commit or push. See `AGENTS.md §10` for full safety rules.

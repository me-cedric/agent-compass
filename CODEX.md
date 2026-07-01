# Codex — agent-compass

## Priority

- Follow **[AGENTS.md](AGENTS.md)** first. It owns the workflow, validation,
  completion gate, handoff format, and safety rules.
- Asked to set up an existing project, bootstrap a new one, or extend compass?
  Route through **[MISSIONS.md](MISSIONS.md)** and follow the matching
  `skills/compass-*` playbook.
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
- Use Codex-native features when they reduce risk: `/plan` for ambiguous work,
  `/goal` for long bounded loops, subagents for independent review/exploration,
  `/review` for diff review, MCP for external tools, and skills for repeated
  procedures. See `docs/tooling/agent-provider-capabilities.md`.
- Use `skills/agent-teacher/SKILL.md` only for explanation, onboarding, or
  valuable prompt/tool coaching moments.
- For a new project or a significant technology choice, use
  `skills/architecture-advisor/SKILL.md`: research-first, technology-neutral, no
  unlabeled guesses. See `docs/workflows/architecture-decision.md`.
- Do **not** commit or push. See `AGENTS.md §10` for full safety rules.

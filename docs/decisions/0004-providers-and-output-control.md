---
status: accepted
date: 2026-10-16
decision-makers: [Cédric Meyer]
---

# Three providers, with enforced output and token rules

## Context and problem statement

Compass supports four providers but configures none of them end to end. Style and token rules are advisory text.
The owner wants short answers, no mid-task narration, and cheap models for small tasks.

## Considered options

1. Keep advisory text in AGENTS.md.
2. Use each provider's native controls: Claude output style, hooks and agent model pins; Codex verbosity and agent files; Copilot agents and instructions.

## Decision outcome

Chosen: option 2 for Claude Code, Codex and GitHub Copilot. Gemini, `CODEX.md` and `GEMINI.md` are dropped.

- Claude: `CLAUDE.md` imports `@AGENTS.md`; output style `compass`; hooks for secrets and the completion gate; agents with model pins.
- Codex: `model_verbosity = "low"`, reasoning summary off, `.codex/agents/*.toml` with model pins.
- Copilot: reads `AGENTS.md`, `.claude/skills`, `.claude/agents` and `.claude/rules`.
- Budgets: always-on host context ≤ 2,000 tokens; SessionStart output ≤ 1,000 characters.

## Consequences

- Good: real controls where the provider has them; one source for three providers.
- Bad: Claude output style and Copilot instructions stay advisory; only Codex verbosity is a hard parameter.

# Copilot — agent-compass

**Read [`AGENTS.md`](../AGENTS.md) first.** It is the canonical contract; the
points below are the Copilot-flavored summary. Asked to set up an existing
project, bootstrap a new one, or extend compass? Route through
[`MISSIONS.md`](../MISSIONS.md) and follow the matching `skills/compass-*`
playbook.

## 1. Plan before code

For any non-trivial task, start with a short, verifiable plan. Do not write code
before the plan is clear. Break work into small steps and state which step you're
on.

## 2. Smallest correct change

Prefer simple, minimal solutions. Fix root causes, not symptoms. Limit changes to
what the task needs. If a solution feels hacky, propose a cleaner one instead of
shipping the hack.

## 3. Verify everything

Never call a task complete without validation. Always include how to test,
expected results, and edge cases. Add or update tests for behavior changes. Run
lint + typecheck + relevant tests and report honestly (see the Completion Gate in
`AGENTS.md`).

## 4. Per-path rules

When working inside an app or package, also consult any matching instruction file
under `.github/instructions/` (examples shipped in
`templates/agent/.github/instructions/`).

## 5. Copilot-native leverage

Use `.github/prompts/*.prompt.md` for repeated tasks, `.github/agents/*.agent.md`
for named roles, path-specific instructions for folder rules, and MCP with
allowlisted tools for external context. See
`docs/tooling/agent-provider-capabilities.md`. For a new project's architecture,
use the `choose-architecture` prompt or the `Architecture Advisor` agent —
research-first, technology-neutral, no unlabeled guesses
(`docs/workflows/architecture-decision.md`).

## 6. Teaching

For explanation, onboarding, or prompt/tool coaching, follow
`docs/workflows/agent-teaching.md`. Teach selectively; do not coach every turn.

## 7. Self-improvement

When a mistake is corrected, extract the general rule and record it (project
`tasks/lessons.md` or feed it back via `scripts/pull-knowledge.mjs`).

Do not commit, push, or deploy unless explicitly asked.

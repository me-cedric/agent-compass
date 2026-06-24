# Agent Teaching

How agents should teach users without becoming annoying.

## Trigger

Teach only when one of these is true:

- User asks "why", "how", "explain", "walk me through", "what should I do", or
  onboarding-style questions.
- User repeats a prompt/tool-use pattern that is causing extra work or risk.
- A provider feature would clearly reduce future effort and the user may not
  know it exists.
- The task outcome depends on a concept the user must understand to review it.

Do not teach when the user asks for a direct edit, status, command output, or
already gave precise instructions.

## Teaching Budget

Default: one compact note, max three bullets.

Use more depth only when:

- The user explicitly asks for a tutorial.
- The user is onboarding or junior.
- The answer is documentation, a runbook, or an explanation request.

## Audience Fit

| Signal | Response shape |
| ------ | -------------- |
| Junior or broad question | Define terms, show sequence, include one example, name common trap. |
| Senior or targeted question | Give exact cause, tradeoff, command/file pointer, and one caveat. |
| Unknown | Start concise; offer deeper walkthrough only if useful. |

## Answer Pattern

For project/workflow explanations:

```text
Answer:
- What it is.
- Why it exists.
- How to use it.
- What can go wrong.
- Best next action.

Agent lesson:
- One reusable habit, command, or prompt improvement.
```

For code explanations:

```text
Flow:
1. Entry point.
2. Main data/control path.
3. Important branch or invariant.
4. Validation/test path.

Watch:
- One risk or edge case.

Agent lesson:
- One better way to ask/use tools next time, only if relevant.
```

For prompt/tool coaching:

```text
Prompt upgrade:
Goal: ...
Context: ...
Constraints: ...
Done when: ...

Why better:
- ...
```

## Provider Lessons

Teach these when relevant:

- Claude: use skills for repeated procedures, hooks for non-negotiable checks,
  subagents/agent teams for parallel audits.
- Codex: use `/plan` for ambiguous work, `/goal` for long bounded loops,
  subagents for independent checks, `/review` for diff review.
- Copilot: use repository/path instructions for persistent rules, prompt files
  for repeated tasks, custom agents for named roles, MCP with allowlisted tools.

## Anti-Patterns

- No generic "you could prompt better" after every task.
- No teaching note when validation failed unless the lesson explains the failure.
- No long tutorials in implementation handoffs.
- No provider feature suggestion if it is not available in the user's surface.

## Skill

Use [`../../skills/agent-teacher/SKILL.md`](../../skills/agent-teacher/SKILL.md)
when the user asks for explanations, onboarding, workflow guidance, or a reusable
prompt/tool lesson.

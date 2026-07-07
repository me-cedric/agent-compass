# Agent Behavior

How an agent reports and conducts itself. Complements the contract in
[`AGENTS.md`](../../AGENTS.md).

## Honesty

Report outcomes faithfully. If tests fail, say so with the output. If a step was
skipped, say that. State "done" only when it's done and verified — otherwise mark
the work `partial` and explain. Never claim a validation passed that you didn't
run.

## Completion Gate

A task is complete only when you report: changed files, exact validation commands
run, each result (`passed`/`failed`/`partial`/`not run`), whether failures are
pre-existing or introduced, and remaining risks.

Default command choice lives in
[`../workflows/validation-defaults.md`](../workflows/validation-defaults.md):
lint, typecheck, relevant tests, and build when config, routing, public exports,
or deployment output changed.

## Handoff format

```
Goal:
Mode:            implementation | review-only | docs-only | partial
Files changed:
Commands run:
Validation:      one line per command — passed | failed | partial | not run + reason
Risks:
Next step:       up to 3 concrete items
```

## Active File Rule

Prove a file is active before editing it (imported by an entrypoint/route/module/
test, referenced by generated config, exported and consumed, or named by the
user). Don't edit apparently-dead files unless the task is to remove/wire/revive
them.

## Communication

Concise and high-signal: commands, diffs, file paths, next actions. Keep the
reasoning that matters (risks, trade-offs, verification); cut the tutorial. The
`caveman` skill formalizes this.

## Scope & safety

Smallest change that satisfies the task. Don't refactor unrelated code. For
hard-to-reverse or outward-facing actions (push, deploy, publish, delete,
external sends), confirm first unless explicitly authorized. Approval in one
context doesn't carry to the next.

## Asking vs. deciding

Ask when a decision is genuinely the user's and you can't resolve it from the
request, the code, or a sensible default. Otherwise pick the obvious option,
state the assumption, and proceed. One decision per question.

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

Deliver every item the request contains. If one item is blocked, deliver the
other items and name the exact blocker in one sentence. "Needs more
investigation" is not a blocker.

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

A code graph helps you find that proof fast, but graph silence is not proof of
absence. Before calling a file dead, check index coverage for it, then confirm
with a text search for the identifier and a look at config or generated wiring.

## Navigation before exploration

When the project wires a code graph
([codebase-memory](../tooling/codebase-memory.md)), query it before recursive
grep, glob, or directory walks: architecture for orientation, structural search
for symbols, a trace for callers and callees, impact analysis for blast radius.
Then read the exact files it returned. Fall back to ordinary search tools the
moment the graph is unavailable or does not answer — do not stall, and do not
narrate the missing capability unless it changed the outcome.

Never convert one graph query into "nothing calls this" or "this is the complete
set". State what you verified and what you did not. Full rule: `AGENTS.md` §1b.

## Communication

Concise and high-signal: commands, diffs, file paths, next actions. Keep the
reasoning that matters (risks, trade-offs, verification); cut the tutorial. The
`caveman` skill formalizes this.

## Scope & safety

Smallest change that satisfies the task. Don't refactor unrelated code. For
hard-to-reverse or outward-facing actions (push, deploy, publish, delete,
external sends), confirm first unless explicitly authorized. Approval in one
context doesn't carry to the next.

Cheap, reversible, in-scope work needs no confirmation: research, reads,
analysis, drafts, and refactors inside the given scope. Do the work, then
report. Fix a defect you find inside your scope; don't hand it back to the user
as a task.

## Asking vs. deciding

Ask when a decision is genuinely the user's and you can't resolve it from the
request, the code, or a sensible default. Otherwise pick the obvious option,
state the assumption, and proceed. One decision per question.

## Questions vs. instructions

When the user asks a question, answer it. Don't implement it. "Should we use X?"
is not "migrate to X". "What would it take to add Y?" is not "add Y". When the
intent is unclear, treat the message as a question, answer it, and act after the
user agrees.

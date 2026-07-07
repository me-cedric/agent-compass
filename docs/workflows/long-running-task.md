# Long-Running Agent Work

Use this when a task has many phases, many files, or an autonomous "keep going"
instruction.

## Required Intake

- Goal: one outcome.
- Context: paths, specs, PRs, prior attempts.
- Constraints: what must not change.
- Done when: observable stop condition.
- Validation: exact commands or the registry keys to run.
- Checkpoint cadence: per phase, per failing test fixed, or every meaningful
  milestone.
- Out of scope: what not to expand into.

## Execution Loop

1. Read `AGENTS.md`, command registry, project memory, specs, module docs, and
   active files.
2. Plan phases and validation.
3. Implement the smallest useful phase.
4. Use one subagent at a time only when it reduces risk or context load.
5. Review all delegated output before editing from it.
6. Run the smallest relevant validation after each meaningful phase.
7. Fix introduced failures before broadening scope.
8. Finish with one final diff review and Completion Gate report.

## Hard Stops

Stop and ask before destructive or outward-facing actions: commit, push, PR,
deploy, publish, production write, production migration, data deletion, or
printing secrets.

If the request says "do not stop", that means keep working inside this safe
loop. It does not override the hard stops.

# AGENTS — agent-compass development

This file is the contract for agents that work on the agent-compass repository itself.
The contract that compass installs into host projects lives in `core/` (from phase 3).

## Status

Compass is in the 1.0 remaster. Read these files before you start work:

1. `docs/remaster/PROGRESS.md` — phase table and log. Update it when a phase check passes.
2. `docs/remaster/plan.md` — the approved plan.
3. `docs/decisions/0001`–`0006` — accepted decisions. Do not reopen them without the owner.
4. `docs/remaster/{inventory,keep-cut,research}.md` — evidence. Do not explore the sibling repos again.

Content removed in phase 1 stays in git history at commit `cee9bb2` (tag `v0.9.6`).
Use `git show cee9bb2:<path>` to read it when you fold it into a new file.

## Style contract (mandatory)

- Four skills apply in every session and in every subagent: `ponytail` (level full), `i-have-adhd`, `caveman`, `asd-ste100`.
- Precedence: ponytail decides the work; i-have-adhd shapes the answer; caveman compresses prose; asd-ste100 overrides caveman for durable text.
- Durable text: docs, skills, commit messages, PR text, error messages, tool descriptions, and prompts for other agents. Write it in Simplified Technical English.
- Answer shape: one-line acknowledgement; no narration between tool calls; a summary at the end with changed files, checks, and open items.
- A delegation prompt restates these rules and asks for a report of 400 words or fewer.

## Work rules

1. One phase is one goal with a check. Do not mark a phase done until its check runs green.
2. Smallest change that works. No new runtime dependency. Node ESM, no semicolons, single quotes.
3. A change to a script needs a change to its test (`node --test`).
4. Do not commit, push, tag or publish unless the owner asks. Never add AI attribution lines to commits or PRs.
5. Do not edit the host repos listed in `docs/remaster/inventory.md`. Use scratch copies for fixtures.
6. Never write a secret value. Use `${VAR}` references.
7. Every network call needs a timeout and `GIT_TERMINAL_PROMPT=0`. No interactive prompts.

## Token rules

- Opus orchestrates and reviews. Sonnet implements. Haiku does lookups.
- Maximum 2 parallel workers, on disjoint directories.
- Keep the model and effort fixed during a phase.
- Read only the part of a file that you need.

## Target layout (1.0)

```
bin/ac.mjs   engine/   ui/   core/   skills/   agents/   rules/   mcp/catalog.json   packs/   upstream.json
.claude-plugin/   docs/   test/
```

## Checks

- `npm test` — unit and fixture tests.
- `npm run check` — tests plus repository lints.

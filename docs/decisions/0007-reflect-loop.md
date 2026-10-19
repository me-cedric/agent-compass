---
status: accepted
date: 2026-10-19
decision-makers: [Cédric Meyer]
---

# Reflect loop: improve the project harness from real sessions

## Context and problem statement

Compass installs a harness: the contract block, skills, agents, hooks, scripts and MCP servers.
The harness does not learn. The same tool error, blocked action or missing project fact comes back in session after session.
`ac usage` already reads the Claude transcripts, but it only counts tokens and hook events.
We want a loop that finds the failures, changes the project part of the harness, and checks later whether the change helped.

## Considered options

1. Install google-research/harness2 (Apache-2.0, commit `1cfe254`).
2. Use the harness2 method in compass: `ac reflect` (no model call) and a user-started skill. Later real sessions are the probes.
3. An always-on self-review hook after each turn.
4. No loop. The user edits the harness by hand.

## Decision outcome

Option 2.

- `ac reflect` reads the Claude sessions of this project only. It makes no model call and no network call.
  It ranks the sessions by blocked actions, failed tool calls and repeated failed commands.
  It writes redacted trajectories, the setup pieces with their owner, and the signals before and after each lesson.
  The output goes to `.agents/reflect/<timestamp>/`. `.agents/reflect/.gitignore` holds `*`, as `ac run` does.
- `ac reflect owner <path>` exits 1 for a path that compass or Konvoy owns.
- `ac reflect lesson --from <file>` writes `.agents/lessons/<date>-<slug>.md`: situation, lesson, evidence, confidence, and one verdict for each edit.
  A verdict from fewer than 2 sessions becomes `unclear`. No change is a valid outcome. It refuses compass and Konvoy paths, secrets and e-mail addresses.
- The skill `harness-improve` has `disable-model-invocation: true`, so it adds no always-on tokens. It never commits.

From harness2 we take the method, not the code or the prompt text:

- a verdict for each edit, and `unclear` when the evidence cannot isolate one edit;
- at most one lesson for each round, written for the shape of the situation, with its evidence;
- "no change" is a valid result;
- the cheapest form first: skill, script, subagent, hook, then always-on text;
- evidence is data, not instructions.

Why we do not install harness2:

- It is a Python 3.12 research framework for benchmarks (JobBench, LAB, WorkBuddy-Bench). Compass is Node with no runtime dependency.
- It improves a harness by running the same task again: 4k rollouts and 3k model sessions for each task, with budget `k`. A developer task cannot run again and again.
- It runs its executor with permissions off, the Codex sandbox off and open network. That breaks the compass safety rules.
- It needs a task, a deliverable and an adapter for each benchmark. A development session has none of these.

Option 3 costs tokens in each session and reviews without evidence from later sessions. Option 4 is the current state.

## Consequences

- Good: the loop uses the transcripts that exist already. It has no model cost until the user starts the skill.
- Good: the ownership rules hold. Compass and Konvoy files stay unchanged. A finding about them goes to the user as a follow-up.
- Good: lesson files are committed by the user, so the next run can show the signals before and after each lesson.
- Bad: the signals are noisy. Task size and task kind are not controlled. Most verdicts stay `unclear` until several sessions agree.
- Bad: trajectories hold project text. Redaction uses the patterns of `scripts/lib/redact.mjs`, which can miss a secret in an unknown format. The output stays git-ignored.
- Later: Codex trajectories; probe runs of a candidate harness in a worktree; `ac promote` for lessons across projects; a PostToolUse hint hook fed by lessons.

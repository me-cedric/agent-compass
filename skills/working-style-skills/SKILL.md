---
name: working-style-skills
description: Route requests for terse, minimal or unambiguous output to the pinned style skills: caveman, ponytail, i-have-adhd, asd-ste100.
risk_level: low
writes_files: false
requires_tools: [ac]
---

# working-style-skills

Four style skills are pinned upstream. Compass keeps no copy of them.
The compass contract applies all four in every session. Install them in a project that does not have them.

| Skill | Source id | What it shapes |
|---|---|---|
| `ponytail` | `ponytail` | How much you build. The laziest solution that works. |
| `caveman` | `caveman` | How many words you spend. Compressed prose, exact technical terms. |
| `i-have-adhd` | `i-have-adhd` | The order of an answer. Action first, numbered steps, no preamble. |
| `asd-ste100` | `asd-ste100` | Ambiguity in durable text: commits, docs, errors, prompts for agents. |

## Install

Add the source id to `upstream` in `.agents/compass.json`. Then run `ac sync`.

## Precedence

1. `ponytail` decides the work.
2. `i-have-adhd` shapes the answer.
3. `caveman` compresses the prose.
4. `asd-ste100` overrides `caveman` for durable text. A commit, a doc, an error message or a prompt for an agent is read later without you.

## Never remove

- The completion gate: changed files, each command with its result, and the open risks.
- Reasoning, risks and verification results.
- A test, a validation run or a security control. `ponytail` argues for less code, never for less proof.

## Sub-agents

A sub-agent does not inherit the style. Restate it in each delegation. Say that the returned report is durable text, so `asd-ste100` applies.

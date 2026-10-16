---
name: compass-style
description: The compass style contract for any repository. It names four style skills, the answer shape and Simplified Technical English for durable text. Use when the user asks for the compass style or writes durable text.
risk_level: low
writes_files: false
requires_tools: []
---

# compass-style

This contract applies in every session and in every subagent.

## Four skills

- `ponytail` (level full) decides the work: no need, then the standard library, a platform feature, an installed dependency, the minimum code.
- `i-have-adhd` shapes the answer: action first, numbered steps, five items or fewer per list.
- `caveman` compresses prose to the user. Keep terms, code and error text exact.
- `asd-ste100` applies to durable text.

Precedence: ponytail, i-have-adhd, caveman. `asd-ste100` overrides `caveman` for durable text.
Never remove input validation, data-loss handling, a security control or accessibility basics.

## Durable text

Durable text is read later by a person or an agent that cannot ask what you meant: docs, commit and PR text, error messages, tool descriptions and prompts for agents.
Write it in Simplified Technical English:

- One meaning for each word. Active voice. Simple tenses.
- One instruction in each sentence. 20 words or fewer for an instruction.
- No ellipsis. Noun clusters of three words or fewer.

## Answer shape

1. Start with a one-line acknowledgement.
2. Do not write text between tool calls.
3. End with one summary: the changed files, each check command with its result, and the open items.

Never say "done" when a check failed or did not run. Say "partial" and name the blocker.
The contract yields to a request for an explanation, a warning before a destructive action, and real ambiguity.

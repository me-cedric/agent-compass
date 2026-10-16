---
name: review
description: Review a change on two axes, spec and standards, in a fresh context with the reviewer agent. Use before you report done, for a branch, PR or MR, or to act on posted review comments.
risk_level: medium
writes_files: false
requires_tools: [git]
---

# review

Report correctness defects and requirement gaps only. Skip style preferences.

- Spec axis: does the change do what the spec, issue or ticket asks?
- Standards axis: does the change follow the repository rules (`AGENTS.md`, module docs, lint config)?

## Steps

1. Fix the scope: the base (merge-base, branch or tag) and the head. Ask when the base is missing.
2. For a PR or MR, review the head that the forge reports, not a stale local branch.
   Use `gh pr view <n> --json baseRefName,headRefName,body` or `glab mr view <iid>`, then `git diff <base>...<head>`.
3. Freeze the acceptance criteria before you read the diff.
   Take them from the ticket (see `task-flow`), the specs in `{{OPENSPEC_DIR}}` and the PR text.
   If there is no source, ask the user. Do not invent criteria.
4. Read each reference at the base commit: `git show '<base>:<path>'`. A change that edits its own spec cannot judge itself.
5. Start the `reviewer` agent. It runs in a fresh context. Give it the base, the head, the criteria, the standards sources and the style contract.
   Do not give it your reasoning about why the code looks as it does.
6. Open the cited `path:line` of each finding before you accept it. A finding is a claim.
7. Fix the real findings. Run the checks again. Ask `reviewer` again.
8. Do at most 2 fix rounds. After round 2, report what remains. Do not start round 3.

## What to check

Spec axis. Mark each criterion `OK`, `KO` or `not verified`. Look in both directions: a criterion that the code does not meet, and code that no criterion asks for.

Standards axis:

- Module boundaries, logger, input validation, error handling, repository conventions.
- A test for each new branch, guard and error path.
- Docs that follow the behavior. Conventional commits with the ticket key.

Always check:

- Scope: the diff matches the ticket title. Call out a feature that also changes an auth path, or that weakens a lint or CI gate.
- A renamed route, selector or label that breaks an existing test.
- A passing test that asserts a behavior that you removed.
- A test that guards prose. It proves that the text exists, not that it is true. Read the prose.
- A test runner that passes with no tests.
- A UI change: run `ui-conformance`.
- A red pipeline: run `ci-triage` before you call the code broken.

## Evidence

- Say "verified" only for what you ran: a command, a test, a rendered page.
- Say "code matches" for what you read.
- Say "stated" for the PR text, the ticket and a green CI badge.
- An axis that you could not run is `not verified`, with the reason. Never call it verified.

## Review your own change

Do this before you report a change done. Review your diff as if a colleague wrote it.
Typecheck and mocked tests cannot see these failures:

1. The app does not boot: a new provider with a dependency that its module cannot resolve.
2. The validation pipe does not run, so a DTO is decoration. Check that unknown keys are stripped and server-owned fields cannot be set.
3. The response leaks an internal column.
4. A by-id path takes its scope from the body, not from the token.

Run the full build and the whole test suite, not only the new tests. Fix the findings. State what you chose not to fix, and why.

## Report

Give the verdict first. Then list the findings, most severe first.
Use `P0` (blocks the merge), `P1` and `P2`. Give each finding the `path:line`, the defect, a failure case and a fix.
Put process findings (an empty description, a missing ticket) in one block at the end.
Write "no findings" when there are none. Keep the report to 400 words or fewer.

## Forge actions

- Post a comment, approve, request changes or merge only when the user says so in chat.
- Authorship, a green pipeline and an earlier review give no right to approve.
- Read the existing discussions first. Never post a duplicate.
- Add no AI attribution line.
- Open a PR only when the user asks. Use `gh pr create` or `glab mr create`. Use the declared base branch and only labels that exist.
  The body holds evidence only: what, why, validation, risks.
- To implement posted review fixes, read every thread. Check each request against the current code. Fix the valid ones. Explain each skip.

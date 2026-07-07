# PR Review

Use this when the user asks for a local PR review, GitHub PR review, or to
implement review fixes.

## Local Review

User can say: "local PR review #123".

Helper:

```bash
node docs/agent-compass/scripts/pr-review.mjs 123
```

Flow:

```bash
gh pr view 123 --json title,body,baseRefName,headRefName,author,labels,reviewRequests,url
gh pr diff 123
```

Review locally first. Findings lead. Include file/line references when possible.
Do not submit anything to GitHub unless asked.
Use the [`pr-review-governance`](../../skills/pr-review-governance/SKILL.md)
skill for the review checklist, summary, inline comments, validation evidence,
GitHub/GitLab diff positions, and retry/duplicate checks.

## Direct GitHub Review

User can say: "review PR #123 on GitHub".

Flow:

1. Read PR metadata and diff.
2. Apply the [`pr-review-governance`](../../skills/pr-review-governance/SKILL.md)
   checklist.
3. Decide review mode: comment, approve, or request changes.
4. Use inline comments when a finding maps to a precise changed line.
5. Use summary comments for cross-cutting issues.
6. Submit:

```bash
gh pr review 123 --comment --body-file /tmp/review.md
gh pr review 123 --approve --body-file /tmp/review.md
gh pr review 123 --request-changes --body-file /tmp/review.md
```

Approve only when validation evidence is enough and no blocking issue remains.

## Implement Submitted Review Fixes

User can say: "implement review fixes for PR #123".

Flow:

```bash
gh pr view 123 --json reviews,comments,reviewThreads,headRefName,baseRefName
gh pr checkout 123
```

For each review item:

- verify it against current code
- skip irrelevant/outdated comments with reason
- fix relevant issues
- run targeted validation
- push only when user asked or repo workflow requires it

Report fixed, skipped, validation, and remaining risks.

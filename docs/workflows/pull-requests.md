# Pull Requests

Use this when the user asks: "create a PR", "open a PR", or "PR with Alice as
reviewer".

Default base branch: `develop`. Use another base only when the user or repo
configuration says so.

## 1. Preflight

```bash
git status --short
git branch --show-current
git fetch origin
gh auth status
gh label list
gh api repos/:owner/:repo/contributors --paginate
```

If reviewer is missing, ask for at least one reviewer and show likely choices
from repo contributors. If labels are missing, inspect `gh label list` and pick
only labels that exist.

## 2. Prepare PR Body

Use [`../../templates/agent/.github/PULL_REQUEST_TEMPLATE.md`](../../templates/agent/.github/PULL_REQUEST_TEMPLATE.md).

Include:

- what changed
- why it changed
- spec/issue links
- validation commands and results
- risks
- labels selected and why

Attribute the PR to the requester by assigning self:

```bash
gh pr create --base develop --assignee @me --reviewer <reviewer> --label <label> --title "<title>" --body-file /tmp/pr.md
```

Use multiple `--reviewer` / `--label` flags when needed. Do not invent labels.

## 3. After Create

Report PR URL, base, reviewers, labels, validation, and remaining risks.

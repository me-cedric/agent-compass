# Git Workflow

## Conventional commits

```
<type>: <description>

<optional body — the "why" when it isn't obvious>
```

Types: `feat`, `fix`, `chore`, `docs`, `test`, `refactor`, `build`, `perf`, `ci`.
Subject ≤ ~50 chars, imperative mood. Enforced by `commitlint` via the
`commit-msg` hook. The `caveman-commit` skill generates compliant messages.

> Attribution lines ("Generated with…", "Co-Authored-By: …") are **not** added to
> commits or PRs unless the project explicitly asks.

## Branch naming

`<type>/<area>/<short-kebab-desc>` — e.g. `feature/api/invoice-pdf`,
`fix/backoffice/user-payments-filter`.

- `<type>`: `feature` (new capability) or `fix` (bug/UX correction).
- `<area>`: app or package — `api`, `backoffice`, `mobile`, `ci`, …
- Never use `claude/` or a bare `chore/` as a branch prefix.

## Hooks (husky)

- **pre-commit** → `lint-staged` (format + lint only the staged files).
- **pre-push** → build shared packages, then `typecheck` and `lint` across the
  workspace; abort the push on failure.
- **commit-msg** → `commitlint`.

Templates: [`templates/monorepo/husky/`](../../templates/monorepo/husky/). Setup:
[tooling/husky.md](../tooling/husky.md).

## Pull requests

1. Analyze the full commit history, not just the latest commit
   (`git diff <base>...HEAD`).
2. Write a comprehensive summary; include a test plan.
3. Use the PR template
   ([`templates/agent/.github/PULL_REQUEST_TEMPLATE.md`](../../templates/agent/.github/PULL_REQUEST_TEMPLATE.md)).
4. Push with `-u` for a new branch.

The `caveman-review` / `review-pr` skills help review diffs.

## Safety

Agents do **not** commit, push, deploy, publish, or open PRs unless explicitly
asked. Inspect `git status` before editing. On the default branch, branch first.

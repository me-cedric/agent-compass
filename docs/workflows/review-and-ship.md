# Review & Ship

The closing sequence. Nothing here runs git operations unless you explicitly ask.

## 1. Self-review the diff

Read your own `git diff <base>...HEAD` as a senior reviewer: correctness, edge
cases, security, naming, dead code, and doc sync. The `caveman-review` /
`verify-change` skills help. Remove anything speculative.

## 2. Doc + spec sync check

- Module README current? Project README setup still accurate?
- `.env.example` covers new vars?
- API specs (OpenAPI/Scalar + Bruno + Gherkin) match the code?

## 3. Validate

```bash
pnpm check:<app>     # or the filtered lint/typecheck/test for what you touched
```

For shared-package changes, validate every consumer.

## 4. Report (Completion Gate)

```
Goal:
Mode:            implementation | review-only | docs-only | partial
Files changed:
Commands run:
Validation:      passed | failed | partial | not run + reason   (one per command)
Risks:
Next step:
```

Never say "done" with a skipped/failed gate — mark `partial`.

## 5. Commit & PR (only when asked)

Conventional commit(s). PR from the full history (`git diff <base>...HEAD`), using
the [PR template](../../templates/agent/.github/PULL_REQUEST_TEMPLATE.md), with a
test plan. Push `-u` for a new branch. No attribution lines unless the project
asks. See [git-workflow](../guidelines/git-workflow.md).

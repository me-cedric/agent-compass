# Husky Hooks

Git hooks that enforce the gates locally, before bad commits leave the machine.
Templates: [`templates/monorepo/husky/`](../../templates/monorepo/husky/).

## The three hooks

| Hook         | Runs                                              | Why                                            |
| ------------ | ------------------------------------------------- | ---------------------------------------------- |
| `pre-commit` | `lint-staged` (format + lint **staged files**)    | Fast; only touches what you're committing.     |
| `pre-push`   | build shared packages → `typecheck` → `lint`      | Stops broken types/lint from reaching the remote. |
| `commit-msg` | `commitlint --edit`                               | Enforces Conventional Commits.                 |

## Setup

```bash
pnpm add -D husky lint-staged @commitlint/{cli,config-conventional}
pnpm exec husky init          # creates .husky/ and the prepare script
# copy the three hook files from templates/monorepo/husky/
```

`package.json` gets `"prepare": "husky"` so hooks install on `pnpm install`.
Configure `lint-staged` (per-glob format/lint) and `commitlint.config.js`
([template](../../templates/monorepo/commitlint.config.js)).

## Notes

- `pre-commit` unsets `GIT_INDEX_FILE` first — it breaks `lint-staged` during
  `git commit --amend`; unsetting is safe (git defaults to `.git/index`).
- `pre-push` builds shared packages **before** typecheck because apps depend on
  them — otherwise typecheck fails on stale types.
- Keep `pre-commit` fast (staged-only). Heavy checks belong in `pre-push`/CI.
- Hooks are a safety net, not the whole gate — CI still runs `check`.

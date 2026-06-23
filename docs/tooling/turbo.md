# Turbo

Task runner over the pnpm workspace. Understands the dependency graph, runs tasks
in the right order, and caches outputs.

## Pipeline

[`templates/monorepo/turbo.json`](../../templates/monorepo/turbo.json) defines
tasks and their dependencies — e.g. `build` depends on upstream `^build`, `test`/
`lint`/`typecheck` declare their inputs and outputs so caching is correct.

## Root verbs

```bash
pnpm dev            # turbo run dev (all apps)
pnpm build          # ordered build; shared packages first
pnpm test           # turbo run test
pnpm lint           # turbo run lint
pnpm typecheck      # turbo run typecheck
pnpm check          # turbo run test lint typecheck   ← the full gate
pnpm check:api      # the gate, filtered to one app
```

`check` is the one-shot "is this green?" — wire it into CI and run the filtered
variant locally for the app you touched.

## Caching

Turbo keys the cache on task inputs; unchanged packages are restored instead of
rebuilt. Keep inputs/outputs accurate in `turbo.json` or caching goes stale or
wrong. Remote caching can be enabled for CI/team sharing.

## Filters

`turbo run build --filter=@scope/shared-types` (and `--filter=...@scope/api` for
dependents). Mirrors pnpm filters; use them to keep local runs small.

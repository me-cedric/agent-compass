# Monorepo

Default shape for multi-app products: a **pnpm workspace** orchestrated by
**turbo**, with shared code in versioned internal packages.

```
repo/
├── apps/            # deployables: api, web/backoffice, mobile, …
├── packages/        # shared libs: shared-types, ui, config, sdk wrappers
├── tools/           # non-shipping helpers: bruno, mockoon, scripts
├── pnpm-workspace.yaml
├── turbo.json
└── tsconfig.base.json
```

## Boundaries

- **Apps never import each other.** Shared code goes into a `package`.
- **Cross-app types live in one package** (e.g. `@scope/shared-types`), never
  duplicated — see [shared-types.md](shared-types.md).
- Each app/package owns its `package.json`, `tsconfig` (extending the base),
  `eslint.config`, and test config.
- Internal packages are referenced by workspace protocol (`workspace:*`).

## Build order & caching

`turbo` resolves the dependency graph: shared packages build before the apps that
consume them. Caching keys on inputs, so unchanged packages are restored from
cache. See [tooling/turbo.md](../tooling/turbo.md) and
[tooling/pnpm.md](../tooling/pnpm.md). Root scripts expose the common verbs:
`dev`, `build`, `test`, `lint`, `typecheck`, and `check` (all three at once),
each filterable per app.

## Why

Atomic cross-cutting changes, one dependency graph, shared tooling and CI, and a
single place for standards — which is exactly what agent-compass plugs into.

Scaffold one with the `nestjs-monorepo-scaffold` skill and the
[`templates/monorepo/`](../../templates/monorepo/) files.

# pnpm

The package manager for the monorepo. Strict, fast, disk-efficient.

## Pin the version

`package.json` pins it so everyone (and CI) uses the same:

```json
{ "packageManager": "pnpm@11.7.0+sha512.<hash>" }
```

Corepack activates it automatically. See
[version-pinning.md](version-pinning.md).

## Workspace

[`templates/monorepo/pnpm-workspace.yaml`](../../templates/monorepo/pnpm-workspace.yaml)
declares the package globs (`apps/*`, `packages/*`, `tools/*`). Internal deps use
the workspace protocol: `"@scope/shared-types": "workspace:*"`.

## Filters (scope your commands)

Run a script in one package without leaving the root:

```bash
pnpm --filter @scope/api lint
pnpm --filter @scope/api typecheck
pnpm --filter @scope/api test -- <spec>
pnpm --filter @scope/api... build     # the package and its dependents
```

This is the scope-specific validation the [Completion Gate](../guidelines/agent-behavior.md)
expects — prefer it over whole-monorepo runs.

## .npmrc

[`templates/monorepo/.npmrc`](../../templates/monorepo/.npmrc) holds registry/
install settings (e.g. `auto-install-peers`, private registry auth via env). Keep
tokens out — reference `${NPM_TOKEN}` from the environment.

## Install discipline

After adding a package, run `pnpm install` and confirm the import resolves before
building on it. Commit the updated `pnpm-lock.yaml`.

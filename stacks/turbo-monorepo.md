# Preset: Turbo Monorepo (umbrella)

The base every multi-app product starts from. Apps plug into it.

## Components

- **pnpm** workspace (`apps/*`, `packages/*`, `tools/*`), version pinned via
  `packageManager`.
- **turbo** task pipeline with caching; root verbs `dev/build/test/lint/typecheck/check`.
- **TypeScript** shared `tsconfig.base.json`; apps extend it.
- **Prettier** + **commitlint** + **husky** (`pre-commit`/`pre-push`/`commit-msg`).
- **OSV** dependency scanning with baseline.
- `.nvmrc`, `.npmrc`, `.editorconfig`.

## agent-compass pieces

- Templates: [`templates/monorepo/`](../templates/monorepo/),
  [`templates/security/.osv-scanner.toml`](../templates/security/.osv-scanner.toml).
- Skill: `nestjs-monorepo-scaffold`.
- Guidelines: [monorepo](../docs/architecture/monorepo.md),
  [pnpm](../docs/tooling/pnpm.md), [turbo](../docs/tooling/turbo.md),
  [version-pinning](../docs/tooling/version-pinning.md),
  [husky](../docs/tooling/husky.md).

## Layout

```
apps/          packages/        tools/
pnpm-workspace.yaml  turbo.json  tsconfig.base.json
.prettierrc  commitlint.config.js  .husky/  .nvmrc  .npmrc
```

## Validate

```bash
pnpm install && pnpm check
```

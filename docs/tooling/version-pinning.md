# Version Pinning

Reproducible builds need pinned toolchains. Fix the version in the rc files and
everyone — laptops, CI, agents — runs the same thing.

| File             | Pins                          | Example                                  |
| ---------------- | ----------------------------- | ---------------------------------------- |
| `.nvmrc`         | Node version                  | `v24.13.0`                               |
| `package.json` `packageManager` | pnpm version + integrity hash | `pnpm@11.7.0+sha512.<hash>`   |
| `package.json` `engines`        | allowed Node/pnpm range       | `{ "node": ">=20" }`          |
| `.npmrc`         | registry, install behavior    | `auto-install-peers=true`                |
| `tsconfig.base.json` | compiler target/lib       | shared, apps extend it                   |

## Rules

- **Bump deliberately**, in one commit, with the lockfile. Don't let versions
  drift per machine.
- **`use-node-version`** in `.npmrc` (or `nvm use`) so the shell matches `.nvmrc`.
- CI reads the same files (`actions/setup-node` with `node-version-file: .nvmrc`).
- When you change a pinned version, note it in `CHANGELOG`/PR — it affects everyone.

Templates: [`templates/monorepo/.nvmrc`](../../templates/monorepo/.nvmrc),
[`.npmrc`](../../templates/monorepo/.npmrc),
[`tsconfig.base.json`](../../templates/monorepo/tsconfig.base.json).

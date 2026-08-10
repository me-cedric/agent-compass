# Monorepo Root Templates

Root configuration for a workspace. Copy a file into the project root and
substitute the placeholders. `gitignore.tpl` becomes `.gitignore`, and
`gitattributes.tpl` becomes `.gitattributes`.

There is no `package.json` template here: the root manifest is project-specific.
The one root script that is not, is below.

## Reject the wrong package manager

`packageManager` and `engines` declare the intent. Neither one stops a
contributor who runs a different manager and writes a second lock file. Add this
guard to the root `package.json`. It is one line, and it needs no dependency.

```json
{
  "scripts": {
    "preinstall": "node -e \"const ua=process.env.npm_config_user_agent||'';if(!ua.startsWith('pnpm')){console.error('This repo uses pnpm. Run: corepack enable && pnpm install');process.exit(1)}\""
  }
}
```

- npm, pnpm and yarn all set `npm_config_user_agent`, for example
  `pnpm/11.20.0 npm/? node/v24.13.0 darwin arm64`. The guard reads the manager
  name from it. It exits 1 on a mismatch, before the install resolves
  dependencies.
- Replace `pnpm` in both places when the project standardises on another
  manager.
- The guard depends on the `preinstall` lifecycle. A manager that skips
  `preinstall`, or a run with `--ignore-scripts`, bypasses it. Keep
  `packageManager` and `engines` pinned as well — see
  [version-pinning](../../docs/tooling/version-pinning.md).

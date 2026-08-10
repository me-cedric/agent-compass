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
| `rust-toolchain.toml` | Rust channel + components | `channel = "1.97.1"`                    |

## Rules

- **Bump deliberately**, in one commit, with the lockfile. Don't let versions
  drift per machine.
- **`use-node-version`** in `.npmrc` (or `nvm use`) so the shell matches `.nvmrc`.
- CI reads the same files (`actions/setup-node` with `node-version-file: .nvmrc`).
- When you change a pinned version, note it in `CHANGELOG`/PR — it affects everyone.

## Rust: the channel and the MSRV are two different promises

A Rust crate pins two versions in two files. They answer two questions. Keep
them apart.

```toml
# rust-toolchain.toml — the compiler this build uses
[toolchain]
channel = "1.97.1"
components = ["rustfmt", "clippy"]
```

```toml
# Cargo.toml — the oldest compiler the crate still supports
[package]
rust-version = "1.77"
```

- **The channel is what you build with.** `rustup` reads `rust-toolchain.toml`,
  so a laptop, CI and a container use one compiler. Without the file, each of
  them gets whatever `stable` means that week.
- **`rust-version` is the MSRV**, the minimum supported Rust version. It is a
  promise to the people who compile your crate.
- **Never copy the channel into `rust-version`.** That raises the MSRV in
  silence. Every consumer on an older compiler then fails to build.
- **Keep the channel at or above the MSRV.** A lower channel cannot compile the
  crate.
- **Raise the MSRV as a decision, not as a side effect.** Note it in the
  `CHANGELOG` — for a library it is a breaking change.
- **List `components` in the toolchain file** so `cargo fmt` and `cargo clippy`
  exist after one install.

Templates: [`templates/monorepo/.nvmrc`](../../templates/monorepo/.nvmrc),
[`.npmrc`](../../templates/monorepo/.npmrc),
[`tsconfig.base.json`](../../templates/monorepo/tsconfig.base.json).

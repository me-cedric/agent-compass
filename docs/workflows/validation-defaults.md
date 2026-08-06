# Validation Defaults

Agents must use declared commands, not invented ones. Prefer
`agent-compass.commands.json`; fall back to `package.json` scripts or documented
commands.

## Default Set

For code changes, run the smallest set that covers the changed files:

- lint
- typecheck
- relevant tests
- build when config, bundling, public exports, UI routing, or deployment output
  changed

For docs-only changes, no code validation is required unless commands, config,
examples, or generated artifacts changed. When the repo declares a documentation
check — a prose or terminology linter such as
[Vale](../tooling/vale.md) — a docs-only change runs it.

## Package Manager

Use the repo's pinned package manager. If `pnpm-lock.yaml` or
`"packageManager": "pnpm@..."` exists, use `pnpm`.

For monorepos, scope commands before running whole-workspace checks:

- one package: `pnpm --filter <pkg> lint`, `typecheck`, relevant tests
- shared package: validate the package and every consumer importing the changed
  symbol
- API contract change: also validate OpenAPI/Scalar or Swagger, Bruno, Gherkin,
  shared types, and generated mocks when present

## Reporting

Report every command as `passed`, `failed`, `partial`, or `not run`.

If a command does not exist, say `not run - command not declared`.

If validation fails, say whether failure is pre-existing or introduced by the
change.

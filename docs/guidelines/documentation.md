# Documentation

Docs are part of "done". A change that alters behavior but not its docs is
incomplete.

## Per-module README (enforced)

Every module/package directory has a `README.md`, kept in sync with the code.
Scaffold it with the `gen-docs` skill; check it with `verify-module`. Minimum
contents:

- **Purpose** — what the module does, in two lines.
- **File listing** — each file with a one-line description.
- **Public API** — table: method · path · version · auth · description (for
  services/controllers).
- **Config** — table of values **and their source** (shared default vs. override).
- **External dependencies** — APIs/services consumed.
- **Data flow** — e.g. `scheduler → queue → processor → service → repository`.
- **Spec locations** — where the OpenAPI/Scalar, Bruno, and Gherkin live (API modules).
- **Test command** — how to run this module's tests.

Larger or non-obvious modules add a **`DESIGN.md`** (rationale, trade-offs,
alternatives considered). Examples:
[`knowledge/examples/module-readme.resilience.example.md`](../../knowledge/examples/module-readme.resilience.example.md),
[`module-readme.external-service.example.md`](../../knowledge/examples/module-readme.external-service.example.md).

## Project README

The root `README.md` always lets a newcomer **set up and run the project** —
locally, and partially/fully connected to dev/preprod where relevant. Keep it
current: prerequisites, install, env setup, the dev/build/test/lint commands, and
how to run a subset of the monorepo. Update it in the same change that alters
setup or scripts.

## env.example discipline

Every env var the app reads appears in `.env.example` with a comment. When a
var is added, renamed, or removed, update the validation schema and committed
local-development env template in the same change. Never commit real `.env`.
See [tooling/env-management.md](../tooling/env-management.md).

## Imposed vocabulary

Some wording is not the author's to choose: terms fixed by legal counsel, by a
contract, or by a decision record. Where a project has such a table, it is
recorded in the decision record that created it, and it is enforced mechanically
— a reviewer cannot be expected to remember a retired term months later, and a
single reintroduction can be a compliance issue rather than a style slip. Set up
the check with [tooling/vale.md](../tooling/vale.md); a repo that declares one
runs it on documentation changes, including docs-only ones.

## API contract sync

For API changes, OpenAPI/Scalar + Bruno + Gherkin move together with the code —
see [tooling/api-contract-sync.md](../tooling/api-contract-sync.md).

## Keeping docs current — for agents

When you touch code, update: the module README, the project README (if setup
changed), `.env.example` (if env changed), and the API specs (if the contract
changed). The `verify-change` skill flags doc drift against a diff.

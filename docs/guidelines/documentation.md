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

Examples:
[`knowledge/examples/module-readme.resilience.example.md`](../../knowledge/examples/module-readme.resilience.example.md),
[`module-readme.external-service.example.md`](../../knowledge/examples/module-readme.external-service.example.md).

## DESIGN.md — one fixed section list

Larger or non-obvious modules add a **`DESIGN.md`** for rationale, trade-offs and
alternatives. Use a fixed section list, because a fixed list makes the document
reviewable: a reviewer, or an agent, checks each section for presence and for
strength instead of guessing what is absent.

**One place owns that list.** [`gen-docs`](../../skills/gen-docs/SKILL.md)
scaffolds the sections and [`verify-module`](../../skills/verify-module/SKILL.md)
blocks delivery on them, so the checklist in `verify-module` is the list. Change
it there, and change the generator in the same commit. Three copies of one
section list always drift.

Two sections are easy to omit and expensive to lack:

- **Cross-cutting concerns** — security, privacy, observability, cost. A design
  that names no consequence in any of the four has not looked for one.
- **Open questions** — the decisions that are not yet made. A design with no open
  questions is either finished or dishonest.

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

## One language per audience

A team can read one language and still want its agent-facing text in another. Do
not leave that split implicit. Record the choice per audience, in the
documentation index, so a writer never has to guess.

Record two lists:

- **Human-facing** — the documentation folder, the root README, release notes,
  and the user-visible changelog.
- **Agent-facing or tool-facing** — `AGENTS.md`, the per-provider pointer files,
  the skills folder, third-party notices, and code comments.

Then state the rule for new files: a new document follows the language of its
audience. Name no default language here; the project chooses the pair. A
mixed-language repository with no recorded rule drifts, because each author
applies a different guess.

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

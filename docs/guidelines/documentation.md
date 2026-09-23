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

## Documentation hygiene — same change as the work, never a later pass

**A finished item leaves no stale document behind it.** Updating the documents a
change makes wrong, and retiring what it makes spent, is part of the change — the
same rule class as the API contract sync above. A change that leaves its
documentation stale is incomplete, even when the code is right and the tests are
green.

**Why this is a rule and not a preference.** A document directory grows because
every pass adds and no pass subtracts. The cost is not disk: a reader cannot tell
a live count from a dead one, a residue gets claimed to live in a register that
never held it, and a shipped code comment cites a file for a rule that file never
carried. **A periodic cleanup is how that accumulates.** Subtracting as you go is
how it does not.

### The question to ask before every commit

> **What did this change just make wrong, and what did it make spent?**

Ask it about documents, not only code. Then act on the answer in the same commit.
The two are different: *wrong* needs correcting, *spent* needs removing.

### The triggers, and what each one obliges

| When you… | …in the same change |
| --- | --- |
| Record an answer to an open question | Write it into the decision record, cascade it into the affected rule rows, **then** strike the question. In that order — striking first loses the decision. See [open-questions](../workflows/open-questions.md). |
| Deliver a requirement | Update its spec and the feature's row in the status ledger. A ledger row that still calls it a gap is now a false gate. |
| Take a deliberate shortcut in user-facing copy or an unspecified rule | Mark it in the code **and** add the line to the open register. A marker in code is invisible to the person who must arbitrate it. |
| Discover that a document's claim is false | Correct it **in place, preserving the original wording**, and date the correction. Never rewrite history cells or dated banners — a blanket replace misattributes a decision to the wrong person and the wrong date. |
| Find that a gap was reported the wrong way round | Say which side is stale, in the document, in one sentence. **A divergence whose direction is wrong gets fixed on the wrong surface.** |
| Move the last fact a file was the only home of | Retire the file through its three states. Do not leave it "just in case": you have just proved there is no case. |
| Push a commit that changes what the branch delivers | Update the request's **title and description**. They are documentation of the branch and they go stale exactly like a spec. Check the title even when you only touched the body. See [pull requests](../workflows/pull-requests.md). |
| Delete or rename any document | Repoint every inbound reference **first**, found by a real search, and say so. A deletion that leaves dangling links has moved the mess, not cleared it. |

### What must move out before a file may go

Name the facts, one by one, and their new home. If you cannot name where a fact
went, it has not moved and the file stays. "It is probably covered elsewhere" is
not a migration. Verify supersession mechanically where you can — comparing
requirement identifiers against the specification corpus beats reading a README's
claim that the file is redundant.

### What is never spent

- A **verbatim archive** of answers as they were written.
- A **decision trail**: why a choice was made, why a proposed deletion was
  refused, why an audit finding was wrong.
- A **live open question**, however old.
- A fact **verified true today** that no other document carries. Verify before
  assuming it moved; a finding from an old audit can still be live.

### What is spent the moment its content lands elsewhere

A per-requirement ledger, a feature-by-feature dump, an endpoint inventory, a
batch or progress record, a duration estimate, a status snapshot. These are
working material. Their numbers age badly and silently.

### Do not batch this

Never open a task called "clean up the docs". By the time it is worth opening,
the directory is already unreadable and the cleanup needs a full re-verification
pass to be safe — which is exactly the expensive thing the rule prevents. If you
notice spent documentation outside the scope of your current change, and removing
it is not cheap, record it where it will be seen rather than leaving it silent.

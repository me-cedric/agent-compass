---
id: openspec-artifact-chain
trigger: 'when a project keeps its specifications under an OpenSpec root — openspec/, docs/openspec/, or paths.openspec in agent-compass.commands.json — and you are about to propose, plan, implement, or archive a change'
confidence: 0.9
domain: workflow
source: host-project-promotion
---

# A validated change is not a complete change

## Action

Ask the status gate before you write anything, and again before you archive:

```bash
openspec status --change "<name>" --json
```

It answers per artifact: `done`, `ready`, `blocked` (with `missingDeps`), or
`skipped`. Write only what it calls `ready` — `/opsx:continue` does exactly that.
Then follow the chain to the end:

```
explore → new|propose|ff → continue* → update? → apply → verify → sync|archive
```

Four rules an agent breaks by default:

1. **Never treat `openspec validate` as the completion gate.** It asks whether
   every file present is well-formed. A change holding a `proposal.md` and
   nothing else passes it. Completeness is `isPlanningComplete` from `status`.
2. **Never write an artifact out of order.** A `tasks.md` written while `design`
   is `blocked` is a task list for a plan that does not exist, and the plan
   written afterwards will not match it.
3. **Run `/opsx:verify` before `/opsx:archive`.** A ticked task list records that
   an agent believed it was finished. Verify reads the requirements against the
   code and reports completeness, correctness and coherence separately.
4. **Never hand-edit a main spec under `<openspec>/specs/`.** `/opsx:sync` and
   `/opsx:archive` own that file. A hand edit makes the change's delta
   unmergeable and destroys the record of why the behaviour changed.

Put the project's own rules in the root's `config.yaml` under `rules.<artifact>`
and `operations.<op>.guidance`. `openspec instructions` hands them to the agent
at the moment it writes that artifact, which lands far better than the same
sentence in `AGENTS.md`.

Enforce it in the gate, not in memory: `agent-compass openspec-guard . --strict`.

## Why

The artifacts are a chain, and the CLI already knows the edges — but nothing
stops an agent from skipping a link, and the default validation says the result
is fine. A host project reached six active changes where one had sat for weeks
with a proposal and no plan, `openspec validate --all` reported `23 passed`, and
six of the twelve workflows — `verify` and `continue` among them — had never been
installed, so no agent could reach the gate even if it looked for one.

The other half of the failure is the root. The CLI resolves the *nearest*
`openspec/`, so an empty `openspec/changes/archive/` left behind by a move
captures resolution and the tool answers `No changes exist`. An agent that trusts
that answer concludes the project has no in-flight work. Declare the root, delete
the other — see [[one-artifact-root]].

Related: [[spec-status-sync]] keeps the shipped status honest afterwards;
[[verified-progress-signal]] is why a ticked box is not evidence; and
[[spec-kit-workflow]] is the same discipline in the Spec Kit dialect.

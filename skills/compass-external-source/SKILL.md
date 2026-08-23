---
name: compass-external-source
description: "Use when someone wants to add, list, inspect, curate, refresh, or remove an external agent-skill source in Agent Compass — \"add these skills from <repo>\", \"integrate this skill pack\", \"what external sources do we track\", \"is <skill> already covered\", \"update the pinned sources\", \"drop that source\". Runs the licence gate first, registers the source as tracked-not-copied, computes its inventory, records the curation, writes the pointer document, and validates. Triggers: external skills, third-party skills, skill pack, agent skills repo, upstream source, track a repo, vendor a skill pack, upstream-sources.json, external-skills."
risk_level: medium
writes_files: true
requires_tools: [node, git]
version: 1.0.0
---

# Adding An External Skill Source

Agent Compass stores **no** third-party skill. Every external source is a pinned
entry in [`skills/upstream-sources.json`](../../skills/upstream-sources.json)
that records what the source holds, which of it Agent Compass endorses, and how
to install it. The copy is made into a host project or a user config at install
time, never into this repository.

That is the shape any new source has to take. This playbook gets it there.

## First: is it already covered?

Two commands answer this without reading a repository:

```bash
agent-compass external-skills --list          # every tracked source, count, licence
agent-compass skills --grep <term>            # searches local AND tracked skills
agent-compass skills <name>                   # source, pin, licence, install command
```

`agent-compass skills <name>` answers for a tracked skill as readily as a local
one. If the capability already exists, say so and stop — a second source for the
same job splits the curation and doubles the refresh work.

## Step 1 — The licence gate (do this before reading the skills)

This is the step that has actually blocked work, so it comes first.

Read the repository's `LICENSE` in full. Then answer, in the handoff:

| Question | Why it decides the outcome |
| -------- | -------------------------- |
| Is it a recognised permissive licence (MIT, Apache-2.0, BSD, ISC)? | Tracking is uncontroversial; note attribution duties. |
| Does it restrict **use**, not just distribution? | A noncompete or field-of-use term (PolyForm, BUSL, SSPL, CC-BY-NC, "personal use only") changes what a host may do with an install, not only what Agent Compass may store. |
| Does it require a verbatim notice? | PolyForm's `Required Notice:` lines and Apache-2.0's `NOTICE` must travel with every copy. Record the exact string in the registry so the installer emits it. |
| Is there no licence at all? | **Refuse.** No licence means no grant. Do not register it; say so plainly. |

Tracking rather than copying removes Agent Compass's own redistribution
exposure — but it does **not** remove the host's. When a licence restricts use,
say so in the pointer document and in the notice, and let the person adopting it
decide. Do not silently absorb the question.

If the licence has a restriction you cannot resolve, stop and ask. That is a
decision for the repository owner, not for an agent.

## Step 2 — Content review

Read the source's own `SKILL.md` files, at least the ones you intend to
recommend. A skill is instruction text an agent will obey, so this is a security
review, not a taste review.

Reject or narrow anything that:

- pipes a remote script into a shell, or installs from an unpinned source;
- puts a secret in `argv`, an environment dump, or a log;
- tells the agent to skip a test, a review, or an approval;
- instructs the agent to act on production without confirmation;
- contradicts a rule in `AGENTS.md` — that is a **narrowing**, see Step 5.

Note what you rejected. A source can be worth tracking with three of its twenty
skills recommended; that is the normal outcome, not a failure.

## Step 3 — Register the source

Compute the inventory from the pinned tree rather than by hand:

```bash
node -e "
import('./scripts/lib/upstream-sources.mjs').then(m => {
  // a shallow clone of the source, at the commit you reviewed
  console.log(JSON.stringify(m.inventoryFromTree('<checkout>', '<commit>', '<inventoryRoot>'), null, 1))
})"
```

`inventoryRoot` is where `SKILL.md` files live upstream: `skills` for most,
`.` for a repository whose skills sit at the top level or in nested domain
folders. The slug is the frontmatter `name` when it is a usable slug and the
directory name otherwise — upstream folder names often disagree with the skill
names, and the skill name is what an agent keys on.

Add the entry to `skills/upstream-sources.json`:

```json
"<source-id>": {
  "repository": "https://github.com/<owner>/<repo>",
  "commit": "<40-hex commit you reviewed>",
  "strategy": "reference",
  "license": "<SPDX id or licence name>",
  "licenseHolder": "<copyright holder>",
  "requiredNotice": "<verbatim notice line, when the licence demands one>",
  "licenseNote": "<one line naming a use restriction, when there is one>",
  "install": "agent-compass external-skills --source <source-id> --recommended",
  "vendorInstall": "<the vendor's own installer, when it ships one>",
  "inventoryRoot": "skills",
  "inventoryDoc": "docs/tooling/<pointer-doc>.md",
  "pointers": ["skills/<router-skill>/SKILL.md"],
  "recommended": ["<sorted subset you endorse>"],
  "upstreamSkills": ["<the full sorted inventory>"]
}
```

Rules the verifier enforces, so get them right the first time:

- `recommended` must be a sorted subset of `upstreamSkills`.
- `upstreamSkills` must be sorted.
- No `assets` and no `skills` — a tracked source owns no local file.
- Every path in `pointers` and `inventoryDoc` must exist and must contain the
  repository URL.

## Step 4 — Write the pointer document

Add the source to an existing pointer document when one fits
([operational-skills.md](../../docs/tooling/operational-skills.md),
[native-mobile-skills.md](../../docs/tooling/native-mobile-skills.md),
[style-and-design-skills.md](../../docs/tooling/style-and-design-skills.md)), or
create one. It must carry:

- the source, its licence, and any use restriction in plain words;
- what Agent Compass curates and **why** that subset — the reasoning is the
  compass-authored value, and it is lost if only the list survives;
- the install commands, project and user-wide;
- which `AGENTS.md` gates survive an installed skill;
- a generated inventory block, exactly:

```markdown
<!-- BEGIN GENERATED:<source-id>-inventory -->
<!-- END GENERATED:<source-id>-inventory -->
```

Fill it, never by hand:

```bash
node -e "
import('./scripts/lib/upstream-sources.mjs').then(async m => {
  const { readFileSync, writeFileSync } = await import('node:fs')
  const s = m.readSourceRegistry('.').sources['<source-id>']
  writeFileSync(s.inventoryDoc, m.applyGeneratedBlock(
    readFileSync(s.inventoryDoc, 'utf8'),
    m.inventoryBlockKey('<source-id>'),
    m.renderInventory(s.upstreamSkills),
  ))
})"
```

## Step 5 — Narrow anything that conflicts with a compass rule

When a recommended skill contradicts `AGENTS.md`, do not drop the skill and do
not edit a copy — there is no copy. Add the correction to `LOCAL_OVERRIDES` in
[`scripts/lib/upstream-skills.mjs`](../../scripts/lib/upstream-skills.mjs) and
set `"adapter": "operational"` on the source. The installer then applies it on
every install, and an override whose upstream target was reworded **fails** the
install rather than being silently skipped.

Record each narrowing in the pointer document and in
[`THIRD_PARTY_NOTICES.md`](../../THIRD_PARTY_NOTICES.md): the upstream passage,
the replacement, and the compass rule that required it.

## Step 6 — Wire it into fit-based adoption (only if it should be automatic)

A source whose skills belong to a detected stack goes into
[`scripts/lib/profiles.mjs`](../../scripts/lib/profiles.mjs) as an `external`
entry on that stack's profile. `selectAssets` merges `external` into `skills`,
and `skills-sync --only` routes each name to the right install path — so
`recommend`, `adopt`, and `setup-wizard` pick it up with no further change.

Leave it out of the profiles when it is a user preference (a working-style skill)
or a broad opt-in corpus (operations). Those get installed on request.

## Step 7 — Index, test, validate

```bash
node scripts/upstream-skills.mjs --verify        # offline: pins, pointers, inventories
node scripts/external-skills.mjs . --source <source-id> --recommended --dry
npm run check                                   # tests + every linter
```

Index the new skill or document (`skills/README.md`, `docs/tooling/README.md`),
add the source row to `THIRD_PARTY_NOTICES.md` and
[upstream-sources.md](../../docs/tooling/upstream-sources.md), and add a
`CHANGELOG.md` entry. `npm run check` fails on a missed index.

Then install it for real into a scratch directory and read one installed file.
An inventory that verifies is not proof that an install produces usable text.

## Step 8 — If the source drives a published package, track its version

A skill that tells the agent to run `npx <pkg>@<version>` pins a version in prose.
The commit pin will not catch that going stale — the repository can move without
the package moving, and the package can move without the text noticing. Record it:

```json
"package": { "name": "@scope/pkg", "manifest": "path/to/package.json" },
"version": "<version at the pinned commit>"
```

`--verify` then fails when any local file pins a different version (including a
`tool_version` frontmatter field), and `--update` rewrites every occurrence when
the pin moves. Never hand-edit such a version; refresh the source.

## Refreshing and removing

```bash
agent-compass upstream-skills --check-updates            # all sources, cached 24h
agent-compass upstream-skills --update <source-id> --dry
agent-compass upstream-skills --update <source-id>
```

A refresh moves the pin, re-reads the inventory, rewrites the generated block and
any tracked package version, and prints added and removed upstream skills. It
copies nothing. A removed upstream skill that is still in `recommended` fails
`--verify` — that is the signal to re-curate, not to force the pin.

A refresh also makes every existing install stale, because an install is a
snapshot of a pin. Say so in the handoff, and give the command:

```bash
agent-compass external-skills . --check      # which installs are behind
agent-compass external-skills . --upgrade    # re-install at the current pin
```

To remove a source: delete its registry entry, its pointer sections, its router
skill if nothing else uses it, its `profiles.mjs` entries, and its notice row.
Then run `npm run check`. Say in the handoff that hosts which already installed
from it keep their copies — removal stops tracking, not distribution.

## When to refuse

- **No licence.** No grant, no registration.
- **A licence you cannot read or resolve.** Ask; do not guess.
- **A source that duplicates an existing one.** Say which one covers it.
- **A single skill you could write yourself in twenty lines.** Write it as a
  compass skill instead. A tracked source is a maintenance commitment: a pin to
  refresh, an inventory to re-curate, and a notice to keep accurate.

## Related

- [skill-intake](../../docs/workflows/skill-intake.md) — whether a capability
  belongs in Agent Compass at all, before this playbook applies.
- [upstream-sources](../../docs/tooling/upstream-sources.md) — the registry
  contract and the strategies.
- [ADR 002](../../docs/decisions/002-tracked-external-reference-sources.md) — why
  tracking replaced vendoring, and what moved to install time.
- [`compass-extend`](../compass-extend/SKILL.md) — adding a compass-authored
  skill, instinct, template, or stack instead.

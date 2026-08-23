# ADR 002: Track Some External Skill Sources Without Copying Them

Status: Accepted
Date: 2026-08-23

## Recommendation

Add a third source strategy, `reference`, to the external source registry. A
reference source is pinned, checked, and documented, but no upstream file enters
the repository. Apply it to **every** external source, and move the operational
corpus's safety adaptation from vendoring time to install time.

## Context

- **Known:** Agent Compass wanted native mobile coverage from two published
  corpora: [`android/skills`](https://github.com/android/skills) (21 skills,
  Apache-2.0, Google LLC) and
  [`dpearson2699/swift-ios-skills`](https://github.com/dpearson2699/swift-ios-skills)
  (86 skills).
- **Known:** `swift-ios-skills` is licensed under PolyForm Perimeter 1.0.0. Its
  Noncompete term reads: any purpose is permitted "except for providing to others
  any product that competes with the software". Its Competition term states that a
  product competes if it substitutes for the software's functionality or value,
  "even if it provides its functionality via any kind of interface (including
  services, libraries or plug-ins), even if it is ported to a different platform
  … and even if it is provided free of charge."
- **Known:** Agent Compass redistributes skills. `skills-sync` copies skill
  folders into host projects. Vendoring 86 iOS skills and offering them through
  that path is the shape the Noncompete term describes.
- **Known:** Every source in the registry before this decision was MIT or
  Apache-2.0.
- **Known:** The two corpora total roughly 9 MB across about 420 files. Most of
  the weight is mirrored vendor documentation.
- **Known:** Both projects ship a first-party installer that resolves one skill
  on demand: `android skills add` and `npx skills add`.
- **Assumed:** Both installers stay available. If one disappears, an agent can
  still read the skill in the upstream repository at the pinned commit, so the
  fallback costs convenience, not capability.
- **Unknown:** Whether the licensor would in fact treat a vendored copy as
  competing. The decision does not depend on the answer, because tracking
  removes the question.

## Significant Requirements

| Requirement | Weight |
| ----------- | -----: |
| Carry no licence risk into a repository others copy from | 30 |
| Keep the existing update-check lifecycle working | 25 |
| Give an agent a reliable route to current platform guidance | 20 |
| Avoid repository growth and stale mirrored documentation | 15 |
| Add no second mechanism a maintainer has to learn | 10 |

## Options

Scores use 1 for poor fit and 5 for strong fit.

| Option | Licence safety | Update lifecycle | Agent routing | Footprint | One mechanism | Weighted score |
| ------ | -------------: | ---------------: | ------------: | --------: | ------------: | -------------: |
| Vendor both with the `merge` strategy | 1 | 5 | 5 | 1 | 5 | 3.20 |
| Vendor Android, skip Apple | 5 | 5 | 3 | 3 | 5 | 4.30 |
| Git submodule per corpus | 4 | 3 | 4 | 3 | 2 | 3.45 |
| Register both as `reference` sources | 5 | 5 | 4 | 5 | 4 | 4.75 |

Vendoring Android while skipping Apple scores well on safety but leaves the
larger and faster-moving corpus untracked, so an agent has no pinned route to
current Apple guidance at all. A submodule pulls the whole tree into every clone
and adds a second lifecycle beside the registry.

## Decision

A registry source may declare `"strategy": "reference"`. Such a source:

- records `repository`, `commit`, `license`, an `install` command, an
  `inventoryRoot`, an `inventoryDoc`, optional extra `pointers`, and the
  `upstreamSkills` inventory at the pinned commit;
- declares no `assets` and no `skills`, because it owns no local file;
- is validated offline by `upstream-skills --verify`: every pointer must exist
  and name the repository, and the `inventoryDoc` must hold a fresh generated
  inventory block;
- is included in `upstream-skills --check-updates` on the same cached, read-only
  `git ls-remote` path as every other source;
- refreshes with `upstream-skills --update <id>`, which re-reads the inventory
  from the new tree using `git ls-tree` and `git show`, moves the pin, rewrites
  the generated inventory block, and reports added and removed upstream skills.

Agent Compass contributes its own layer on top: the
[`native-mobile-skills`](../../skills/native-mobile-skills/SKILL.md) routing
skill, the [`android-compose`](../../stacks/android-compose.md) and
[`swift-ios`](../../stacks/swift-ios.md) stack presets, the
[`platform-skill-before-memory`](../../knowledge/instincts/platform-skill-before-memory.md)
instinct, and [native-mobile-skills.md](../tooling/native-mobile-skills.md).
That layer is original work under the Agent Compass licence. It names the
upstream corpora, routes to them, and states which Agent Compass gates survive
an installed third-party skill.

## Amendment, 2026-08-23: every source, and the adapter moves

The decision above was taken for the two native mobile corpora. It was then
extended to all nine sources, which removed 166 vendored skill folders and
`skills/upstream-lock.json` from the repository.

Extending it raised one problem the two-source version did not have. The
operational corpus was vendored **precisely so Agent Compass could rewrite it**:
a safety gate is prepended to every skill and eight passages that put a secret in
`argv` are replaced. A pointer cannot rewrite upstream text, so tracking that
corpus appeared to trade a real safety property for consistency.

The resolution is that the adapter moved rather than disappeared.
`scripts/lib/upstream-skills.mjs` now runs inside
`scripts/lib/external-install.mjs`, at install time, writing corrected text into
the host or the user's config. The property is unchanged in substance — no
uncorrected copy exists anywhere, and an override whose upstream target was
reworded fails the install instead of being dropped — and it is now asserted
against install output in `test/capability-packs.test.mjs` and
`test/upstream-skills.test.mjs` rather than against files on disk.

Two further consequences of the widening:

- **The installer became the product.** `agent-compass external-skills` writes
  `.claude/skills/` for Claude Code and `.agents/skills/` for Codex and Copilot,
  adds a `.github/instructions/` file because Copilot has no skills directory,
  supports project and user scope, refuses executable payloads by default, and
  writes each source's licence notice beside the install.
- **The two install paths had to become one.** `skills-sync --only` now routes
  each requested name to the local copy or the tracked source automatically, and
  stack profiles name external skills in an `external` field that
  `selectAssets` merges into `skills`. A caller — `recommend`, `adopt`,
  `setup-wizard`, a person — passes one list and does not need to know which kind
  a name is. That is what keeps adoption identical to the vendored behaviour.

## Consequences

**Good.**

- No PolyForm Perimeter content is redistributed, so the Noncompete term is not
  engaged.
- The repository does not grow by 9 MB of vendor documentation that ages.
- An agent gets a pinned, checked route to current platform guidance, and the
  routing layer is Agent Compass's own to maintain.
- `reference` is reusable for any future upstream that ships its own installer.

**Bad.**

- A skill has to be installed before it can be read, so the first task in a
  domain has one extra step.
- Installing needs network access to the source. A fully offline host can read a
  skill in the upstream repository at the pinned commit, but cannot install it.
- The operational safety gate is now regenerated on every install rather than
  being committed once. A host that installed at an older pin keeps the older
  corrected text until it re-installs.
- The pinned inventory is metadata only. A pin can be current while an
  individual skill's content changed, and Agent Compass will not diff that
  content. The check answers "did the source move", not "did this skill change".
- Refresh needs network access to two more repositories.
- An installed third-party skill is instruction text outside Agent Compass
  review. The mitigation is written into the routing skill: read it first, and it
  cannot relax a gate in `AGENTS.md` §4.

## Related

- [ADR 001](001-external-source-registry.md) — the registry, the cached check,
  and the explicit-refresh model this extends.
- [upstream-sources.md](../tooling/upstream-sources.md) — the registry contract.
- [`vendored-corpus-manifest`](../../knowledge/instincts/vendored-corpus-manifest.md)
  — the pattern for the case where copying *is* the right answer.

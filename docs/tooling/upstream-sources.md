# External Skill Sources

Agent Compass tracks every external skill source in
[`skills/upstream-sources.json`](../../skills/upstream-sources.json). **No
external skill is stored in this repository.** Every source uses
`"strategy": "reference"`: the registry holds the pin, the licence, the upstream
inventory, and Agent Compass's own curation, and
[`external-skills`](#install-from-a-tracked-source) installs on request. The
registry makes source freshness visible without executing remote content.

The `merge` and `operational` strategies remain implemented for a source that
genuinely has to be copied, but nothing uses them today. Prefer `reference`.

## Safety Model

- A check reads remote Git commit identifiers only.
- A reference source copies nothing. It records a pin, an inventory, and the
  local documents that route to it.
- A check changes no tracked content or source pin. It can write an ignored
  local cache.
- A refresh runs only after an explicit maintainer command.
- A refresh reads selected files from a temporary checkout. It does not run
  source scripts, hooks, installers, or package lifecycle commands.
- A clean text merge still requires normal review and validation.
- A merge conflict creates an `.acnew` review file. It does not change the
  local skill or source pin.

## One Check

Run one cached check for Agent Compass and all external skill sources:

```bash
agent-compass check-update --remote
```

Run only the external-source check:

```bash
agent-compass upstream-skills --check-updates
agent-compass upstream-skills --check-updates --force --json
agent-compass upstream-skills --check-updates --strict
```

The check cache lasts 24 hours. `--quiet` prints only an update notice. Claude
and Codex session-start hooks use this mode. Other agents follow the startup
rule in `AGENTS.md`. Host sync adds the cache ignore for existing projects.

## Verify Local Pins

This command needs no network:

```bash
agent-compass upstream-skills --verify
```

It checks the operational lock and the shared source registry. It detects a
missing target, a duplicate mapping, a changed local tree, an unregistered
external skill, and a source-pin mismatch.

## Refresh A Source

Preview first:

```bash
agent-compass upstream-skills --update anydoc --dry
```

Apply after review:

```bash
agent-compass upstream-skills --update anydoc
```

Use `--update all` to process every stale source. The command plans all source
merges before it writes files. If one merge conflicts, no source pin changes.

The operational corpus keeps its additional dangerous-pattern gate. A new risk
count stops refresh until a maintainer reviews the change and adds
`--accept-risk`.

The existing local-checkout path remains available for that corpus:

```bash
agent-compass upstream-skills --source /path/to/checkout --dry
agent-compass upstream-skills --source /path/to/checkout --refresh
```

## Reference Sources (Tracked, Not Copied)

A `reference` source is pinned and checked like any other source, but no
upstream file enters the repository. Use it when copying is wrong: a licence
that restricts redistribution, a corpus large enough that a mirror ages badly,
or a vendor that ships its own per-skill installer.

A reference source records:

- `repository`, `commit`, and `license` — the pin and its terms;
- `install` — the vendor command that pulls one skill into a host project;
- `inventoryRoot` — where `SKILL.md` files live in the upstream tree;
- `inventoryDoc` — the local document that carries the generated inventory;
- `pointers` — other local files that must keep naming this source;
- `upstreamSkills` — the sorted skill inventory at the pinned commit.

It declares no `assets` and no `skills`, because it owns no local file.

`--verify` runs offline and fails when a pointer is missing, when a pointer
stops naming the repository, or when the generated inventory block drifts from
`upstreamSkills`. That is what keeps a pointer document from quietly describing
last year's corpus.

`--update` re-reads the inventory from the new tree with `git ls-tree` and
`git show` — metadata and file contents only, nothing checked out into the
working tree and nothing executed. It then moves the pin, rewrites the generated
inventory block, and prints the added and removed upstream skills. A refresh
aborts when the recorded inventory does not match the pinned commit, so a
hand-edited registry cannot advance.

```bash
agent-compass upstream-skills --update android-skills --dry
agent-compass upstream-skills --update swift-ios-skills
```

The tracked native mobile corpora and their routing layer are documented in
[native-mobile-skills.md](native-mobile-skills.md). The reasoning is
[ADR 002](../decisions/002-tracked-external-reference-sources.md).

## Registry Contract

Each source records:

- repository and pinned commit;
- strategy: `merge`, `operational`, or `reference`;
- selected skill names, or the tracked upstream inventory for a reference source;
- upstream-file to local-file mappings, for a source that is copied;
- source-tree and local-tree hashes for merge sources;
- install command, inventory root, and pointer files for reference sources;
- license and optional package version data.

Add a source only after license review, content review, and an explicit file
selection. Do not register an entire repository when Agent Compass needs one
skill. When the license forbids redistribution, or a mirror would age faster
than the vendor's own installer, register the source as `reference` and copy
nothing. Keep local safety changes in the selected target. The three-way refresh
preserves those changes and stops when it cannot merge them safely.

## Registered Sources

| Source ID | Repository | Inventory | Curated | Licence |
| --------- | ---------- | --------: | ------: | ------- |
| `devops-security` | `BagelHole/DevOps-Security-Agent-Skills` | 163 | 146 | MIT |
| `android-skills` | `android/skills` | 22 | 22 | Apache-2.0 |
| `swift-ios-skills` | `dpearson2699/swift-ios-skills` | 86 | 86 | PolyForm Perimeter 1.0.0 |
| `dimillian-skills` | `Dimillian/Skills` | 16 | 5 | MIT |
| `taste-skill` | `Leonxlnx/taste-skill` | 13 | 10 | MIT |
| `ponytail` | `DietrichGebert/ponytail` | 6 | 5 | MIT |
| `caveman` | `JuliusBrussee/caveman` | 20 | 3 | MIT |
| `i-have-adhd` | `ayghri/i-have-adhd` | 1 | 1 | MIT |
| `asd-ste100` | `danyuchn/asd-ste100-skill` | 1 | 1 | MIT |
| `anydoc` | `firecrawl/anydoc` | 1 | 1 | MIT |

Per-corpus detail: [operational-skills.md](operational-skills.md),
[native-mobile-skills.md](native-mobile-skills.md), and
[style-and-design-skills.md](style-and-design-skills.md).

## Install From A Tracked Source

One command covers Claude Code, Codex, and Copilot, for a project or the user:

```bash
agent-compass external-skills --list
agent-compass external-skills /path/to/host --source <id> --recommended
agent-compass external-skills --source <id> --recommended --global
agent-compass external-skills /path/to/host --source <id> --skill <a,b>
```

A fit-based adoption needs no source id at all — `skills-sync --only` routes each
name to the local copy or the tracked source automatically:

```bash
agent-compass recommend /path/to/host --json      # → assets.skills
agent-compass skills-sync /path/to/host --only <that list>
```

The installer writes `.claude/skills/` and `.agents/skills/`, adds
`.github/instructions/external-skills.instructions.md` so Copilot sees the tree,
writes the source's licence notice beside the install, and refuses executable
payloads unless `--allow-scripts` is passed. The operational corpus is corrected
on the way through — see [operational-skills.md](operational-skills.md).

## An Install Is A Snapshot, So It Is Recorded

Every install writes `.agent/external-skills.json` (or
`~/.agent-compass/external-skills.json` for `--global`) recording the source, the
**commit it came from**, the skills, and the target directories.

That record is what makes staleness visible. When a pin moves, the text a host
installed earlier is out of date — and for the operational corpus that includes
the safety gate and the argv-secret narrowings, so it is not cosmetic:

```bash
agent-compass external-skills . --check              # offline; reports every stale install
agent-compass external-skills . --check --strict     # exit 1 when stale (for CI)
agent-compass external-skills . --upgrade --dry      # show the re-install plan
agent-compass external-skills . --upgrade            # re-install every record at the current pin
```

The check is offline and cheap, so it runs on three paths without being asked:
the session-start hook (`check-update`), `recommend`, and `install --doctor`. An
upgrade re-installs exactly what the manifest records, at the current pin, into
the same targets, and reports any skill that has since disappeared upstream
rather than failing the whole run.

## A Tracked Package Version Is Part Of The Contract

A source whose skill drives a published package records `package` and `version`.
`--verify` then fails when any local file pins a different version — including a
`tool_version` frontmatter field — and `--update` rewrites every occurrence when
the pin moves. Before this, a version written in prose could rot unnoticed while
the commit pin looked current; it did, once, and the check exists because of it.

# Style And Design Skills

Agent Compass **tracks** six small external skill sources without copying them.
Each is pinned in [`skills/upstream-sources.json`](../../skills/upstream-sources.json)
and installed on request into a project or a user config.

| Source | Holds | Compass curates | Licence |
| ------ | ----: | --------------: | ------- |
| [`Leonxlnx/taste-skill`](https://github.com/Leonxlnx/taste-skill) | 13 | 10 | MIT, © Leonxlnx |
| [`DietrichGebert/ponytail`](https://github.com/DietrichGebert/ponytail) | 6 | 5 | MIT, © DietrichGebert |
| [`JuliusBrussee/caveman`](https://github.com/JuliusBrussee/caveman) | 20 | 3 | MIT, © JuliusBrussee |
| [`ayghri/i-have-adhd`](https://github.com/ayghri/i-have-adhd) | 1 | 1 | MIT, © ayghri |
| [`danyuchn/asd-ste100-skill`](https://github.com/danyuchn/asd-ste100-skill) | 1 | 1 | MIT, © Dustin Yuchen Teng |
| [`firecrawl/anydoc`](https://github.com/firecrawl/anydoc) | 1 | 1 | MIT, © Sideguide Technologies Inc. |

The curation is Agent Compass's own and is the interesting part: `caveman`
publishes 20 skills and Agent Compass endorses 3, because the other 17 either
duplicate a compass workflow or restate a rule `AGENTS.md` already sets.

## Install

```bash
agent-compass external-skills --list                                      # every tracked source

# A project, all providers (Claude, Codex, Copilot)
agent-compass external-skills . --source taste-skill --recommended
agent-compass external-skills . --source caveman --recommended

# User-wide, so every project gets them
agent-compass external-skills --source ponytail --recommended --global
agent-compass external-skills --source asd-ste100 --recommended --global

# One skill, or the source's full catalogue
agent-compass external-skills . --source taste-skill --skill minimalist-ui
agent-compass external-skills . --source caveman --all
```

Four of these sources also publish a Claude Code plugin marketplace, which is an
equally valid route when you only use Claude Code:

```bash
/plugin marketplace add Leonxlnx/taste-skill
/plugin marketplace add DietrichGebert/ponytail
/plugin marketplace add JuliusBrussee/caveman
/plugin marketplace add ayghri/i-have-adhd
```

The compass installer is the portable route: it writes `.claude/skills/` for
Claude Code, `.agents/skills/` for Codex and Copilot, and a
`.github/instructions/external-skills.instructions.md` file so Copilot — which
has no skills directory — is told the tree exists.

## Upstream Folder Names Differ From Skill Names

`taste-skill` names its folders differently from the skills inside them. Install
by the **skill name**; the folder is only useful when reading the repository
directly.

| Skill name | Upstream folder |
| ---------- | --------------- |
| `design-taste-frontend` | `skills/taste-skill/` |
| `high-end-visual-design` | `skills/soft-skill/` |
| `industrial-brutalist-ui` | `skills/brutalist-skill/` |
| `minimalist-ui` | `skills/minimalist-skill/` |
| `redesign-existing-projects` | `skills/redesign-skill/` |
| `image-to-code` | `skills/image-to-code-skill/` |
| `stitch-design-taste` | `skills/stitch-skill/` |

## Routing

Two compass-authored skills carry the routing procedure, so an agent does not
need this document:

- [`design-taste-skills`](../../skills/design-taste-skills/SKILL.md) — which
  design skill fits which surface, and why a dense product UI and a landing page
  must never load the same one.
- [`working-style-skills`](../../skills/working-style-skills/SKILL.md) — the
  output-shape skills and their precedence, paired with
  [style-contract.md](../guidelines/style-contract.md).

Document extraction is different: `convert-documents-to-markdown` is a
compass-authored skill describing the pinned `@firecrawl/anydoc` CLI, not a copy
of the upstream skill. The `anydoc` source is tracked so the pinned package
version stays visible. See [document-ingestion.md](document-ingestion.md).

## Rules That Survive An Install

- A style skill changes how output is *shaped*. It never removes a required
  section: the Completion Gate in `AGENTS.md` §4 still owes changed files,
  commands, per-command results, and remaining risks.
- A design skill proposes taste. `AGENTS.md` §6 still requires visual proof for a
  change a user can see.
- Executable payloads are refused by default; `--allow-scripts` installs them
  only after you have read each one.

## Freshness

```bash
agent-compass upstream-skills --check-updates
agent-compass upstream-skills --update caveman --dry
```

A refresh moves the pin and rewrites the inventories below. Added and removed
upstream skills are printed, so a new skill in one of these sources is visible
without reading the repository.

## Tracked Inventories

### `Leonxlnx/taste-skill`

<!-- BEGIN GENERATED:taste-skill-inventory -->
13 tracked skills:

- `brandkit`, `design-taste-frontend`, `design-taste-frontend-v1`, `full-output-enforcement`, `gpt-taste`, `high-end-visual-design`
- `image-to-code`, `imagegen-frontend-mobile`, `imagegen-frontend-web`, `industrial-brutalist-ui`, `minimalist-ui`, `redesign-existing-projects`
- `stitch-design-taste`
<!-- END GENERATED:taste-skill-inventory -->

### `DietrichGebert/ponytail`

<!-- BEGIN GENERATED:ponytail-inventory -->
6 tracked skills:

- `ponytail`, `ponytail-audit`, `ponytail-debt`, `ponytail-gain`, `ponytail-help`, `ponytail-review`
<!-- END GENERATED:ponytail-inventory -->

### `JuliusBrussee/caveman`

<!-- BEGIN GENERATED:caveman-inventory -->
20 tracked skills:

- `cavecrew`, `caveman`, `caveman-commit`, `caveman-compress`, `caveman-discover`, `caveman-evidence-review`
- `caveman-explore`, `caveman-help`, `caveman-learn`, `caveman-manage`, `caveman-optimize`, `caveman-review`
- `caveman-setup`, `caveman-stats`, `investigate-first`, `lean-build`, `migration`, `safe-refactor`
- `surgical-patch`, `verify-and-stop`
<!-- END GENERATED:caveman-inventory -->

### `ayghri/i-have-adhd`

<!-- BEGIN GENERATED:i-have-adhd-inventory -->
1 tracked skill:

- `i-have-adhd`
<!-- END GENERATED:i-have-adhd-inventory -->

### `danyuchn/asd-ste100-skill`

<!-- BEGIN GENERATED:asd-ste100-inventory -->
1 tracked skill:

- `asd-ste100`
<!-- END GENERATED:asd-ste100-inventory -->

### `firecrawl/anydoc`

<!-- BEGIN GENERATED:anydoc-inventory -->
1 tracked skill:

- `convert-documents-to-markdown`
<!-- END GENERATED:anydoc-inventory -->

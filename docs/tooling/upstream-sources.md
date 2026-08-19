# External Skill Sources

Agent Compass tracks each vendored skill source in
[`skills/upstream-sources.json`](../../skills/upstream-sources.json). The
registry makes source freshness visible without executing remote content.

## Safety Model

- A check reads remote Git commit identifiers only.
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

## Registry Contract

Each source records:

- repository and pinned commit;
- merge or operational transformation strategy;
- selected skill names;
- upstream-file to local-file mappings;
- source-tree and local-tree hashes for merge sources;
- license and optional package version data.

Add a source only after license review, content review, and an explicit file
selection. Do not register an entire repository when Agent Compass needs one
skill. Keep local safety changes in the selected target. The three-way refresh
preserves those changes and stops when it cannot merge them safely.

## Registered Sources

| Source ID | Repository | Selected skills | Strategy |
| --------- | ---------- | --------------: | -------- |
| `devops-security` | `BagelHole/DevOps-Security-Agent-Skills` | 146 | Safety adapter and operational lock |
| `taste-skill` | `Leonxlnx/taste-skill` | 10 | Three-way text merge |
| `ponytail` | `DietrichGebert/ponytail` | 5 | Three-way text merge |
| `caveman` | `JuliusBrussee/caveman` | 3 | Three-way text merge |
| `i-have-adhd` | `ayghri/i-have-adhd` | 1 | Three-way text merge |
| `asd-ste100` | `danyuchn/asd-ste100-skill` | 1 | Three-way text merge |
| `anydoc` | `firecrawl/anydoc` | 1 | Three-way text merge and package pin |

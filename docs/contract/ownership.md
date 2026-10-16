# Ownership contract: compass and Konvoy

Decisions: [ADR 0002](../decisions/0002-konvoy-ownership-split.md) (split by path) and [ADR 0003](../decisions/0003-openspec-konvoy-schema.md) (one spec dialect).
This file lists what each tool writes in a host repository. It also names the engine code that enforces each rule.
A path in braces, for example `{{DELIVERY_DIR}}`, is a path key. The section "Path keys" gives the values.

## Ledgers

| File | Writer | Reader |
|---|---|---|
| `.agents/konvoy.json` | Konvoy | compass, read only |
| `.agents/compass.lock.json` | compass | compass |
| `.agents/compass.json` | the project (`ac init` writes the first version) | compass |

## Rules

| # | Rule | Enforcement |
|---|---|---|
| 1 | Konvoy owns `.agents/konvoy.json`, each path in its `host_files` and `owns.files`, and each path below `{{DELIVERY_DIR}}/`. | A compass file at one of these paths is an error. `ownershipErrors` in `engine/config.mjs`. |
| 2 | Konvoy owns `{{OPENSPEC_DIR}}/schemas/konvoy-delivery/` when its ledger exists. | Compass does not plan the schema then (`buildPlan`, `engine/plan.mjs`). Rule 1 also covers the dir. |
| 3 | Compass owns `.agents/compass.lock.json` and `.agents/compass.json`. | A Konvoy ledger that lists one of them is an error. `ownershipErrors`. |
| 4 | A skill dir has one owner. Konvoy lists its skills in `compass_skills`, `taste_skills` and `owns.skills`. The compass lock lists its skills in `skills`. | A name in both ledgers is an error. `ownershipErrors`. |
| 5 | Konvoy owns the keys `mcpServers.konvoy` in `.mcp.json`, `mcp_servers.konvoy` in `.codex/config.toml`, `servers.konvoy` in `.vscode/mcp.json`, and each key in `owns.keys`. Compass owns the keys in `core/keys.json` and in pack `keys.json` files. | A compass key that is the same as a Konvoy key, or a parent or a child of one, is an error. `ownershipErrors`. |
| 6 | A file that Konvoy owns as a whole (rule 1) has no compass key and no compass block. | Error. `ownershipErrors`. |
| 7 | In a Markdown file, compass owns only the text between `<!-- compass:begin -->` and `<!-- compass:end -->`. | Compass writes only that text (`blockSet` in `engine/merge.mjs`). Two begin markers or a missing end marker is an error. |
| 8 | When Konvoy takes a file that the compass lock records, compass releases it. | The file stays on disk. The lock does not record it after the sync (`reconcile`, `engine/sync.mjs`, action `release`). |
| 9 | Konvoy is the only writer of `{{DELIVERY_DIR}}/tickets.json`. | Rule 1. The skills tell the agent not to edit it. |
| 10 | RAID files in `{{DELIVERY_DIR}}/questions/` use the Konvoy codec. `ac migrate --docs` writes new `Q-NNN.md` files only. It never edits or overwrites a RAID file. | `raidText` and `migrateDocs`, `engine/migrate.mjs`. The docs layout checks below. |
| 11 | Compass seeds an empty `{{DESIGNS_DIR}}/screens.json` once. Then the project owns it. Konvoy has no screen registry. | Seed mode in `buildPlan`: compass writes the file only when it does not exist. |

Konvoy must also follow rules 1 to 11. The engine cannot enforce what Konvoy writes. See "Konvoy follow-ups".

## Path keys

Compass reads the 14 keys from `paths` in `.agents/konvoy.json` when that file exists. Else it reads `paths` in `.agents/compass.json`. Else it uses the defaults.
`paths` in `.agents/compass.json` gives a warning when the Konvoy ledger exists. An unknown key or a path outside the repository in `.agents/compass.json` is an error.
The defaults are the `RepoPaths` defaults of Konvoy. `PATH_DEFAULTS` in `engine/config.mjs` holds them.

| Key | Default | Placeholder |
|---|---|---|
| `adr` | `docs/decisions` | `{{ADR_DIR}}` |
| `openspec` | `docs/openspec` | `{{OPENSPEC_DIR}}` |
| `delivery` | `docs/delivery` | `{{DELIVERY_DIR}}` |
| `designs` | `docs/designs` | `{{DESIGNS_DIR}}` |
| `planning` | `docs/planning` | `{{PLANNING_DIR}}` |
| `test_plans` | `docs/delivery/test-plans` | `{{TEST_PLANS_DIR}}` |
| `costing` | `docs/costing` | `{{COSTING_DIR}}` |
| `diagrams`, `openapi`, `drawings`, `slides`, `data_models` | `docs/<key>` (`docs/api` for `openapi`, `docs/data-models` for `data_models`) | `{{<KEY>_DIR}}` |
| `flows`, `personas` | `docs/network/flows.json`, `docs/personas/personas.json` | `{{FLOWS_FILE}}`, `{{PERSONAS_FILE}}` |

## OpenSpec schema

- `core/openspec/konvoy-delivery/` is a byte copy of the Konvoy catalog schema `konvoy-delivery`, version 1, with its five templates.
- `ac sync` installs it in `{{OPENSPEC_DIR}}/schemas/konvoy-delivery/` when that OpenSpec dir exists and `.agents/konvoy.json` does not exist.
- `ac init --from-specs` writes `{{OPENSPEC_DIR}}/config.yaml` with `schema: konvoy-delivery` when that file does not exist.
- The OpenSpec CLI reads a folder named `openspec` in its working directory. `ac check` runs it in the parent of `{{OPENSPEC_DIR}}`.
- Open item (owner decision, 2026-10-16): the schema keeps the spec-kit headings, so `openspec validate --strict` can report "No delta sections found" for a `konvoy-delivery` change. A review run with OpenSpec 1.14.2 showed this for migrated changes. The red check is accepted until spec-flow converts the specs. `validate` stays an error.
- Conversion (owner decision, 2026-10-16): spec-flow appends an `## ADDED Requirements` delta section to each `spec.md`, below the spec-kit headings, which do not change. The delta section has one `### Requirement:` for each requirement id, with SHALL or MUST and a scenario. UNCONFIRMED: that the Konvoy spec parser accepts the extra section.

## Docs layout checks

`ac check` runs these checks after the sync check. `ac check --docs` runs only these checks, and it does not need `.agents/compass.json`.
An error makes the command exit 1. A warning does not.

| Check | Rule | Level |
|---|---|---|
| RAID name | A Markdown file in `{{DELIVERY_DIR}}/questions/` is `Q-NNN.md`. Konvoy shows another name as a draft. | warning |
| RAID keys | The frontmatter has `id`, `kind`, `status`, `raisedAt`, `raisedBy`, `owner`, `specRef`, `taskRef`, `ticket`, in this order. Other keys can follow. | error |
| RAID values | `kind` is `question`, `risk`, `assumption`, `issue` or `dependency`. `status` is `open`, `assigned`, `answered` or `folded`. `id` is the file name without `.md`. | error |
| ADR name | A Markdown file below `{{ADR_DIR}}` is `NNNN-slug.md`: four digits, then a lower-case kebab slug. `README.md`, `index.md`, `000-template.md`, `adr-template.md` and `template*` are not decisions. | error |
| ADR frontmatter | `status` starts with `proposed`, `accepted`, `rejected`, `deprecated` or `superseded`. `date` is `YYYY-MM-DD`. Two files with one number is an error. | error |
| Root specs | A `specs/` folder at the root, when `{{OPENSPEC_DIR}}` is not in it. Konvoy does not read it. | warning |
| Screens registry | `{{DESIGNS_DIR}}/screens.json` has the shape below. Ids and aliases are unique. An alias is not unique when only its letter case is different. | error |
| Screen tags | Each value in a `Screen:` line of a spec is a registry id or one alias. Lines in code fences and in `schemas/` and `inbox/` do not count. | error |
| OpenSpec CLI | When the `openspec` CLI is installed: `openspec validate --all --strict --json` (timeout 120 s) and `openspec status --all --json` (timeout 60 s). | validate: error; status: warning; no CLI: warning |

## Screens registry

```json
{
  "version": 1,
  "screens": [
    {
      "id": "SCR-014",
      "aliases": ["login"],
      "route": "/login",
      "figma": { "fileKey": "<key>", "nodeId": "12:345" },
      "stories": ["Auth/LoginForm"],
      "specRefs": ["auth/spec.md#REQ-003"]
    }
  ]
}
```

Only `id` is necessary. Each other field has the type above when it is present.

## Commands that write the docs layout

- `ac init --from-specs <dir>` creates `{{OPENSPEC_DIR}}/changes/`, `{{OPENSPEC_DIR}}/specs/`, `{{DELIVERY_DIR}}/questions/`, `{{ADR_DIR}}/` and `{{DESIGNS_DIR}}/` with `screens.json`. It copies the documents into `{{OPENSPEC_DIR}}/inbox/<dir name>/`. It does not copy hidden entries. A staged file with other content is an error. Then it runs `ac init`.
- `ac migrate --docs` moves spec-kit features, `.specify/`, spec-kit agent files, `specs/constitution.md`, single-file question registers and ADRs. It copies the content to the new paths, then moves each source to `migrated/<source path>`. An item that has a conflict becomes `manual`, and the command does not change it. `--dry` prints the plan.
  - An ADR named `NNN-slug.md` becomes `NNNN-slug.md` with the MADR frontmatter `status` and `date`. The command reads the first word of the `Status:` line and the `Date:` line from the first 30 lines of the file, and it keeps the body as it is. It also changes the Markdown link targets `](path)` that name the old file, in every `*.md` file except those in `node_modules/`, `.git/` and `migrated/`. The old file and each edited file move to `migrated/`.
  - An ADR stays `manual` when its number is in more than one file (a 4-digit file counts), when its status is not a MADR status, when it has no `Date:` line, or when the new name exists. `000-template.md`, `adr-template.md`, `README.md` and `index.md` are not ADRs; the command does not change them.

## Konvoy follow-ups

These changes are in the Konvoy repository, not in compass.

1. Write `owns` (`files`, `skills`, `keys`) in `.agents/konvoy.json`.
2. Remove the 0.9 compass files from `host_files` and `compass_skills` before compass 1.0 installs. For example, the StoryArc ledger lists six skills, `.claude/agents/reviewer.md`, `.codex/config.toml` and `.codex/hooks.json` that compass 1.0 also writes. `ac sync` stops with an error until then.
3. Install the schema in `{{OPENSPEC_DIR}}/schemas/konvoy-delivery/`. Konvoy provisioning does not copy it yet.
4. Keep Konvoy text in `AGENTS.md` and `CLAUDE.md` out of the compass block.

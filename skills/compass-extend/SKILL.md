---
name: compass-extend
description: >
  Add a new capability to agent-compass itself — a skill, knowledge instinct,
  template, stack preset, doc, or script — with correct frontmatter, index
  wiring, tests, and validation. Use when the user wants to add, import, or
  promote a skill/agent/knowledge/tool into the compass.
risk_level: medium
writes_files: true
requires_tools: []
---

# Compass Extend — grow the compass safely

Mission: a new capability lands in the right place, generically named, indexed,
validated, and immediately usable by every host project that syncs it.

## Pick the right asset type

| The capability is… | Asset | Create with |
| ------------------ | ----- | ----------- |
| A repeatable agent procedure or playbook | skill | `node scripts/new.mjs skill <name>` |
| One concrete pattern/gotcha worth remembering | instinct | `node scripts/new.mjs instinct <name>` |
| Copyable config or scaffolding for hosts | template | new files under `templates/<group>/` |
| Guidance for a technology stack | stack preset | new `stacks/<name>.md` |
| A rule, workflow, or tool guide | doc | `docs/guidelines/` \| `docs/workflows/` \| `docs/tooling/` |
| Automation (checks, generators, setup) | script | `scripts/<name>.mjs` |
| A provider agent role (Claude/Copilot) | agent file | `templates/claude/.claude/agents/` or `templates/agent/.github/agents/` |

When importing from a real project, go through
`node scripts/pull-knowledge.mjs <project>` → review `knowledge/incoming/` →
promote. Never copy project files in directly; the pull step screens secrets
and project-specific tokens.

## Content rules (enforced by `npm run check`)

- **Generic naming.** No client, project, or domain-specific names —
  `lint:naming` fails the build on known tokens. Real technology names are fine.
- **Skill frontmatter contract:** `name`, `description` (drives
  auto-triggering — write it as a trigger, not a title), `risk_level`
  (low|medium|high), `writes_files` (true|false), `requires_tools` (list).
- **Small and composable.** One skill = one job. Split rather than grow.

## Wiring checklist (what `check` verifies)

1. **Indexes** (`lint:indexes`): new skill → table row in `skills/README.md`;
   new template group → row in `templates/README.md`; new stack/workflow/tooling
   doc → link in that directory's `README.md`.
2. **Host installation** (only if hosts should receive the file automatically):
   add an entry to `scripts/manifest.mjs` — `seed` (host owns it after copy) or
   `managed` (compass keeps it current via `sync`).
3. **New script**: register in `scripts/cli.mjs` `COMMANDS`, add a
   `package.json` script, document in `docs/tooling/cli.md`, and add a test in
   `test/` (`check-companions` fails source changes without one).
4. **Catalog sanity**: `node scripts/catalog.mjs --grep <name>` shows the new
   asset with a useful description.

## Validate

```bash
npm run check          # tests + conformance + evals + naming/index/docs guards
node --check scripts/<name>.mjs   # for new scripts
```

Report against the Completion Gate. If the new capability changes agent
behavior, also update `AGENTS.md` or the relevant doc — the narrowest place
that owns the rule.

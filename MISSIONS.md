# Missions — operating inside agent-compass

You (an AI coding agent) have been started inside the agent-compass repo, or
pointed at it from elsewhere. This file routes you to the right mission with
minimal user input. [`AGENTS.md`](AGENTS.md) still governs *how* you work;
this file tells you *what to do* when the user's request is one of the three
compass missions.

## Route the request

| The user wants… | Mission | Playbook |
| --------------- | ------- | -------- |
| An **existing project** wired up with agentic rules, skills, and tooling | Adopt | [`skills/compass-adopt/SKILL.md`](skills/compass-adopt/SKILL.md) |
| A **new project** built from architecture guidelines or an idea | Bootstrap | [`skills/compass-bootstrap/SKILL.md`](skills/compass-bootstrap/SKILL.md) |
| To **add a capability** to compass itself (skill, knowledge, template, stack, script) | Extend | [`skills/compass-extend/SKILL.md`](skills/compass-extend/SKILL.md) |
| To **add, list, curate, or refresh an external skill source** | External source | [`skills/compass-external-source/SKILL.md`](skills/compass-external-source/SKILL.md) |
| Their **machine** (user-level config for all agent CLIs) set up | Global | [`docs/agent-setup.md`](docs/agent-setup.md) → `node scripts/setup-wizard.mjs "$HOME" --global --yes` |

Anything else (bug fix, doc change, refactor in this repo) is normal work under
[`AGENTS.md`](AGENTS.md) and [`CONTRIBUTING.md`](CONTRIBUTING.md).

## Ground rules for every mission

- **Discover before asking.** Detect package manager, stacks, and gaps with the
  scripts below; ask the user only what detection cannot answer (one decision
  per question).
- **Fit, don't flood.** Install and reference only the assets that match the
  project. `node scripts/catalog.mjs` lists every asset with type and
  description; filter with `--type` / `--grep`.
- **Never overwrite.** All setup scripts create missing files only. Keep it
  that way.
- **Verify, then report.** Every mission ends with a verification command and a
  Completion Gate report (`AGENTS.md §4`).
- **Safety.** Do not commit, push, or open PRs unless the user explicitly asks.

## Quick reference

```bash
node scripts/cli.mjs help                 # every command, grouped
node scripts/catalog.mjs --md             # every asset (skills/stacks/templates/docs)
node scripts/bootstrap.mjs --schema       # answers contract for non-interactive bootstrap

# Adopt an existing project (one command: setup + fit-based sync + verify):
node scripts/adopt.mjs /path/to/host
# Granular equivalents when you need control:
node scripts/setup-wizard.mjs /path/to/host --yes
node scripts/recommend.mjs /path/to/host --json   # fit-based asset selection
node scripts/skills-sync.mjs /path/to/host --only <skills-from-recommend>
node scripts/agent-onboard.mjs /path/to/host

# Bootstrap a new project from an answers file you derive from guidelines:
node scripts/bootstrap.mjs --answers answers.json --out /path/to/new-project

# Extend compass with a new asset:
node scripts/new.mjs skill my-skill        # also: adr | spec | arch | instinct
npm run check                              # validate frontmatter, indexes, docs
```

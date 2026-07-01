# Upgrading Agent Compass

When agent-compass updates, a host gets the new rules and tools **without
re-running setup or asking an agent to merge**. Two things make this work:

- **Pointers reference the submodule** (`CLAUDE.md`, `AGENTS.md`, `.cursor/rules`,
  the `docs/agent-compass/` guides, skills, and all `scripts/`). Bumping the
  submodule updates them for free — nothing to copy.
- **Forked files are reconciled by `sync`** ([`sync.mjs`](../../scripts/sync.mjs)),
  which knows which files agent-compass owns vs. which the host owns.

## One command

For first-time or refreshed host setup:

```bash
node docs/agent-compass/scripts/setup-wizard.mjs . --yes
node docs/agent-compass/scripts/setup-host.mjs . --strict
node docs/agent-compass/scripts/provider-verify.mjs . --write
node docs/agent-compass/scripts/mcp-probe.mjs . --write
node docs/agent-compass/scripts/spec-validation-map.mjs . --write
node docs/agent-compass/scripts/recommend.mjs . --write
node docs/agent-compass/scripts/quality-gates.mjs . --write
node docs/agent-compass/scripts/dashboard.mjs . --write
```

This runs install, safe fixes, deep doctor, context-pack, doctor-report,
runbook, and onboard checks. It edits only the host repo; it never changes global
agent config.

Optional add-ons:

```bash
node docs/agent-compass/scripts/spec-kit-bridge.mjs .
node docs/agent-compass/scripts/skills-sync.mjs . --copy
node docs/agent-compass/scripts/skills-sync.mjs . --symlink
node docs/agent-compass/scripts/policy-pack.mjs . --apply regulated-api
node docs/agent-compass/scripts/design-importer.mjs . --source figma-export.json --write
```

Global user setup is separate and non-destructive:

```bash
node /path/to/agent-compass/scripts/global-setup.mjs "$HOME" --symlink
node /path/to/agent-compass/scripts/provider-verify.mjs "$HOME" --global --strict
```

Project rules still win over global rules.

From the host root, after the submodule moved:

```bash
node docs/agent-compass/scripts/sync.mjs .
```

Or do the whole upgrade (bump submodule → install new files → sync → doctor) from
an agent-compass checkout:

```bash
node scripts/upgrade-host.mjs /path/to/host docs/agent-compass --dry
node scripts/upgrade-host.mjs /path/to/host docs/agent-compass
```

## What sync does

Each installed file is classified in [`manifest.mjs`](../../scripts/manifest.mjs):

| Class | Examples | On sync |
| ----- | -------- | ------- |
| **managed** (agent-compass owns) | role agents, hooks, `tool-contract.md`, prompts, smoke test, MCP examples, settings example | Fast-forwarded if you didn't edit it. If you did, sync writes `<file>.acnew` next to it and leaves yours untouched. |
| **seed** (host owns) | `agent-compass.commands.json`, `repo-map.md`, specs, projectmem policy, monorepo configs | Created once; never auto-updated. Only added if missing. |

A version lock at `.agent/agent-compass.lock` records what you last synced, so sync
can tell "you didn't touch this" from "you customized this."

## Conflicts

When a managed file you edited also changed upstream, sync writes `<file>.acnew`.
Review it, merge anything you want, then delete the `.acnew`. (The `0.4.0`
migration adds `*.acnew` to `.gitignore`.) An agent can do this merge — point it
at the `.acnew` pairs and the diff.

## Migrations

Structural changes (renames, moved files, config keys) ship as ordered scripts in
[`migrations/`](../../migrations/). Sync runs every migration in
`(your lock version, current]`. They are idempotent and never touch secrets.

## Automatic update check (no tokens)

[`check-update.mjs`](../../scripts/check-update.mjs) tells you when the host is
behind, cheaply and without spending any LLM tokens — it is plain CLI output for
the terminal, not agent context, and a 24h cache makes repeated calls free.

```bash
node docs/agent-compass/scripts/check-update.mjs .            # offline, cached
node docs/agent-compass/scripts/check-update.mjs . --remote   # also check upstream tags
```

It runs **automatically** from the installed `.husky/post-merge` hook after every
`git pull`/merge: silent when current, one line when the standards moved
("run sync"). It reuses `sync --check`, so it never reports a false update.

## CI drift check

Fail CI when a host falls behind (read-only, writes nothing):

```bash
node docs/agent-compass/scripts/sync.mjs . --check
```

After upgrading, run the host project's normal validation gate before committing
the submodule SHA bump. Keep host-specific rules in the host root `AGENTS.md`;
shared rules stay in `docs/agent-compass/`.

## No-submodule adoption

Use this when the host project should not import agent-compass as a submodule.

```bash
git clone <agent-compass-url> /tmp/agent-compass
node /tmp/agent-compass/scripts/install.mjs --dry /path/to/host
node /tmp/agent-compass/scripts/install.mjs /path/to/host
node /tmp/agent-compass/scripts/install.mjs --doctor --fix /path/to/host
node /tmp/agent-compass/scripts/install.mjs --doctor --deep /path/to/host
```

Then review and commit only host-local files:

- `AGENTS.md` and tool pointers
- `agent-compass.commands.json`
- `specs/`, `.projectmem/README.md`, `.projectmem/projectmem-policy.md`
- `.mcp/*.example.json` and `.mcp/README.md`
- `.github/PULL_REQUEST_TEMPLATE.md` and instruction files
- repo map, ADR template, and ignore updates

Do not commit the standalone clone or local MCP client config. Copy
`.mcp/*.example.json` into your local MCP client config and keep that local
config out of git.

## Release tags

Prefer updating hosts to a tag when one exists. If no tag exists yet, pin to a
reviewed commit SHA and record the SHA in the host change description.

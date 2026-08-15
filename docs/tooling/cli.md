# Agent Compass CLI

One entrypoint — [`scripts/cli.mjs`](../../scripts/cli.mjs) — for every
agent-compass script. It dispatches `agent-compass <command> [...args]` to the
right script and passes your flags straight through, so you never memorize 40+
`node scripts/…` paths.

The CLI is strict and TTY-aware:

- **Unknown flags are errors**, not silently ignored (`install --dyr` fails
  instead of running a real install). `--flag=value` works everywhere.
- **`-h` is always help** — the dispatcher translates a bare `-h` to `--help`
  before any script can mistake it for a positional argument.
- **Colors and symbols** when the output is a terminal; plain text when piped
  or `NO_COLOR` is set (`FORCE_COLOR` overrides).
- **Interactive prompts** (`wizard`, `bootstrap`) use arrow-key select and
  multi-select. Non-interactive contexts (CI, pipes) never hang: scripts either
  take defaults (`--yes`, `--answers`) or exit with a clear hint.

Shared internals live in [`scripts/lib/args.mjs`](../../scripts/lib/args.mjs)
(strict flag parsing on top of `node:util` `parseArgs`) and
[`scripts/lib/tui.mjs`](../../scripts/lib/tui.mjs) (colors, select,
multi-select, confirm, spinner) — both zero-dependency.

## Install / how to run

Agent Compass is dependency-free (Node ≥ 20). There is nothing to compile or
`npm install`.

### Vendored as a submodule (recommended for host projects)

This is how `install`/`sync`/`upgrade` already expect to find the repo.

```bash
git submodule add <agent-compass-url> docs/agent-compass
node docs/agent-compass/scripts/cli.mjs install
```

Make it ergonomic with a shell alias…

```bash
alias ac="node docs/agent-compass/scripts/cli.mjs"
ac install && ac doctor . --deep
```

…or a host `package.json` script (no global install needed):

```json
{ "scripts": { "ac": "node docs/agent-compass/scripts/cli.mjs" } }
```

```bash
npm run ac -- sync . --check
```

### From an agent-compass checkout (contributors)

```bash
node scripts/cli.mjs <command>     # or: npm run cli -- <command>
npm link                           # then: agent-compass <command>
```

`npm link` (or a published package) puts the `agent-compass` bin on your `PATH`
via the [`bin`](../../package.json) field. The repo itself is `private`, so for
host projects prefer the submodule + alias above over a global install.

## Basics

```bash
agent-compass help                 # grouped command list (with aliases)
agent-compass help sync            # one command's own --help
agent-compass --version            # version
agent-compass <command> [...flags] # flags pass through unchanged
```

Most commands take the host/root directory as an optional positional argument
(default: current directory). Commands that historically used `--root <dir>`
still accept it.

`COMMANDS` is exported from `cli.mjs` as data — `catalog.mjs` and
`check-indexes.mjs` import it, so this page is validated against the real
command list by `npm run lint:indexes`.

## Commands

**Setup**

| Command | Does | Aliases |
| ------- | ---- | ------- |
| `adopt` | One-command host adoption: setup + fit sync + verify. | — |
| `bootstrap` | New-project prompt generator (`--answers` for agents). | `new-project` |
| `wizard` | Interactive host adoption wizard (select/multi-select). | `setup-wizard` |
| `apply-recommendations` | Apply safe project/global setup recommendations. | — |
| `global-setup` | Non-destructive user-level Agent Compass setup. | — |
| `setup-host` | Full host setup: install, fix, reports, onboard. | — |
| `install` | Wire agent-compass into a host (create missing files). | `install-into` |
| `doctor-fix` | Autofix host agent setup and regenerate reports. | — |
| `sync` | Update managed files from the submodule (no clobber). | `sync-into` |
| `vendor` | Create/refresh a plain-copy vendoring with provenance. | — |
| `spec-kit-bridge` | Install optional Spec Kit bridge files. | — |
| `skills-sync` | List/sync skills and opt-in capability packs. | — |
| `policy-pack` | List/apply setup policy packs. | — |
| `upgrade` | Bump the submodule, sync, then doctor. | `upgrade-host` |
| `check-update` | Cheap cached "are we behind?" check (no tokens). | — |

Sync a fit-based list with `--only`, or one or more broad opt-in operational
packs with `--pack`:

```bash
agent-compass skills-sync . --only verify-security,kubernetes-ops
agent-compass skills-sync . --pack devops-platform
agent-compass skills-sync . --pack security,infrastructure,compliance
```

Root packs: `devops-platform`, `security`, `infrastructure`, `compliance`.
Focused subpacks: `aws`, `azure`, `gcp`, `kubernetes`, `observability`,
`ai-ops`, `security-scanning`, `secrets`, `hardening`, and
`compliance-frameworks`. Default sync excludes capability packs. Use `--pack`
for selected packs or `--all` for every skill. `--all`, `--only`, and `--pack`
are mutually exclusive. Global setup also excludes capability packs; sync them
explicitly afterward when wanted.

```bash
agent-compass skills-sync --list-packs
agent-compass catalog --type capability-pack --md
```

Command-registry names: `agentTools.skillsListPacks` and
`agentTools.capabilityPackCatalog`.

**Health**

| Command | Does | Aliases |
| ------- | ---- | ------- |
| `doctor` | Verify host wiring (add `--deep`, `--fix`). | — |
| `doctor-report` | Print a host readiness report. | — |
| `onboard` | One-command readiness aggregate. | `agent-onboard` |
| `provider-verify` | Verify provider files and prompts are discoverable. | — |
| `recommend` | Scan host and recommend agent setup improvements. | — |
| `quality-gates` | Run generic agent handoff quality gates. | — |
| `check-skill-quality` | Validate imported skills against safety, provenance, and reviewed-risk rules. | — |
| `dashboard` | Write static `.agent/report.html` dashboard. | — |
| `migration-plan` | Plan host upgrade against current manifest. | — |
| `mcp-probe` | Probe MCP config readiness. | — |
| `spec-validation-map` | Map specs to plan/tasks/validation coverage. | — |
| `design-importer` | Create design-system docs from Figma/token export. | — |
| `drift` | Drift dashboard across guidance validators. | `agent-drift` |
| `conformance` | Provider customization + smoke prompts. | `agent-conformance` |
| `evals` | Validate teaching/tool-offer eval fixtures. | `agent-evals` |

**Context**

| Command | Does | Aliases |
| ------- | ---- | ------- |
| `context` | Compact repo snapshot for agents. | — |
| `context-pack` | Machine-readable `.agent/context.json`. | — |
| `catalog` | Machine-readable asset catalog (skills, stacks, templates, docs). | — |
| `skills` | Search skills, filter capability packs, and inspect exact provenance. | — |
| `runbook` | Compact agent runbook. | — |
| `depgraph` | Mermaid dependency graph from imports. | `gen-depgraph` |

**Build**

| Command | Does | Aliases |
| ------- | ---- | ------- |
| `new` | Scaffold a skill, ADR, spec, arch decision, instinct, stack, workflow, or tooling doc. | — |
| `run` | Run a registry command (refuses unknown/destructive). | `run-command` |
| `check-companions` | Fail when source changes ship without a test. | `check-change-companions` |
| `skill-docs` | Generate or check README skill counts and pack catalogs. | — |
| `upstream-skills` | Verify the pinned lock or refresh from an explicit local checkout. Never fetches. | — |
| `redact` | Scan files/staged diff for secret/PII leaks. | — |

**Learning**

| Command | Does | Aliases |
| ------- | ---- | ------- |
| `trace` | Validate a trace/outcome log (no secrets). | `agent-trace` |
| `task-log` | Append/read completion-gate task log. | — |
| `failure-mine` | Mine task logs/traces into improvement themes. | — |
| `trace-to-evals` | Turn failed trace rows into regression evals. | — |
| `pull-knowledge` | Stage reusable knowledge from a project. | — |

**Git**

| Command | Does | Aliases |
| ------- | ---- | ------- |
| `pr` | Create a PR with Agent Compass defaults. | — |
| `pr-review` | Build or submit a PR review. | — |
| `release` | Prepare version/changelog/readme release metadata. | `--commit`, `--tag`, `--push` (every remote), `--dry` |

## Common flows

First-time adoption in a host:

```bash
ac adopt .              # one command: wizard --yes + setup + fit skills + verify
# or step by step:
ac install              # create missing pointers/templates
ac doctor . --deep      # verify wiring
ac onboard .            # readiness + startup route
```

Interactive adoption (arrow-key prompts for stacks, providers, skill scope):

```bash
ac wizard .
```

Day to day:

```bash
ac context-pack . --write   # refresh the machine-readable index
ac new skill my-thing       # scaffold conforming stubs
ac run test                 # run a registry command, never an invented one
```

Stay current (see [upgrading](../workflows/upgrading.md)):

```bash
# the installed .husky/post-merge hook runs check-update after every pull
ac sync .                       # apply managed-file updates (writes *.acnew on conflicts)
ac upgrade . docs/agent-compass # full bump: submodule → sync → doctor
```

See [prerequisites](prerequisites.md) for the toolchain and
[`scripts/`](../../scripts/) for the underlying implementations.

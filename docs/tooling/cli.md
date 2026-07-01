# Agent Compass CLI

One entrypoint — [`scripts/cli.mjs`](../../scripts/cli.mjs) — for every
agent-compass script. It dispatches `agent-compass <command> [...args]` to the
right script and passes your flags straight through, so you never memorize 30
`node scripts/…` paths.

## Install / how to run

Agent Compass is dependency-free (Node ≥ 20). There is nothing to compile.

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
agent-compass help                 # grouped command list
agent-compass help sync            # one command's own --help
agent-compass --version            # version
agent-compass <command> [...flags] # flags pass through unchanged
```

Names accept both the short form and the underlying script name
(`agent-compass drift` == `agent-compass agent-drift`).

## Commands

**Setup**

| Command | Does | Example |
| ------- | ---- | ------- |
| `adopt` | One-command host adoption (setup + fit sync + verify) | `agent-compass adopt /path/to/host` |
| `bootstrap` | New-project prompt generator (`--answers` for agents) | `agent-compass bootstrap --answers answers.json` |
| `install` | Wire agent-compass into a host (create missing) | `agent-compass install --dry` |
| `sync` | Update managed files from the submodule (no clobber) | `agent-compass sync .` |
| `upgrade` | Bump submodule → sync → doctor | `agent-compass upgrade . docs/agent-compass` |
| `check-update` | Cheap cached "are we behind?" (no tokens) | `agent-compass check-update . --remote` |

**Health**

| Command | Does | Example |
| ------- | ---- | ------- |
| `doctor` | Verify host wiring | `agent-compass doctor . --deep` |
| `doctor-report` | Readiness report | `agent-compass doctor-report . --write` |
| `onboard` | One-command readiness aggregate | `agent-compass onboard .` |
| `drift` | Drift dashboard across validators | `agent-compass drift --strict` |
| `conformance` | Provider customization + smoke prompts | `agent-compass conformance --strict` |
| `evals` | Validate teaching/tool-offer fixtures | `agent-compass evals` |

**Context**

| Command | Does | Example |
| ------- | ---- | ------- |
| `context` | Compact repo snapshot | `agent-compass context` |
| `context-pack` | Machine-readable `.agent/context.json` | `agent-compass context-pack . --write` |
| `catalog` | Machine-readable asset catalog | `agent-compass catalog --type skill --grep figma` |
| `runbook` | Compact agent runbook | `agent-compass runbook . --write` |
| `depgraph` | Mermaid dependency graph | `agent-compass depgraph . --write` |

**Build**

| Command | Does | Example |
| ------- | ---- | ------- |
| `new` | Scaffold a skill, ADR, spec, architecture decision, or instinct | `agent-compass new skill my-thing` |
| `run` | Run a registry command (safe) | `agent-compass run test` |
| `check-companions` | Fail if source changed without a test | `agent-compass check-companions --base main --strict` |
| `redact` | Scan for secret/PII leaks | `agent-compass redact . --staged` |

**Learning**

| Command | Does | Example |
| ------- | ---- | ------- |
| `trace` | Validate a trace log (no secrets) | `agent-compass trace --file .agent/trace/log.jsonl` |
| `trace-to-evals` | Turn failures into regression evals | `agent-compass trace-to-evals --file log.jsonl --out evals.json` |
| `pull-knowledge` | Stage reusable knowledge from a project | `agent-compass pull-knowledge` |

**Git**

| Command | Does | Example |
| ------- | ---- | ------- |
| `pr` | Create a PR with Agent Compass defaults | `agent-compass pr --reviewer alice` |
| `pr-review` | Build or submit a PR review | `agent-compass pr-review 123` |
| `release` | Prepare version/changelog metadata | `agent-compass release 0.4.0 --dry` |

## Common flows

First-time adoption in a host:

```bash
ac install              # create missing pointers/templates
ac doctor . --deep      # verify wiring
ac onboard .            # readiness + startup route
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

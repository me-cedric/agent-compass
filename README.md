# 🧭 Agent Compass

### One operating system for every coding agent

[![CI](https://github.com/me-cedric/agent-compass/actions/workflows/ci.yml/badge.svg)](https://github.com/me-cedric/agent-compass/actions/workflows/ci.yml)
![Version](https://img.shields.io/badge/version-v0.7.3-blue)
![Node](https://img.shields.io/badge/node-24-339933)
![License](https://img.shields.io/badge/license-internal-lightgrey)
![Agents](https://img.shields.io/badge/agents-Claude%20%7C%20Codex%20%7C%20Gemini%20%7C%20Copilot-purple)
<!-- BEGIN GENERATED:SKILL_BADGE -->
![Skills](https://img.shields.io/badge/skills-223-orange)
<!-- END GENERATED:SKILL_BADGE -->
![Ops Packs](https://img.shields.io/badge/ops%20packs-146-red)
![Specs](https://img.shields.io/badge/specs-enabled-success)
![Memory](https://img.shields.io/badge/projectmem-supported-success)

**[Start in 30 seconds](#quick-start) · [Explore capabilities](#capability-packs) ·
[Browse skills](skills/README.md) · [Read the contract](AGENTS.md)**

Importable operating manual for Claude Code, Codex, Gemini, and GitHub Copilot:
one project contract, quality gates, workflows, templates, operational
knowledge, and helper scripts.

Use it as a submodule in real projects, or clone it standalone to bootstrap a
new project from proven defaults.

Agent Compass exists for three jobs:

1. **Teach** agents how to work: context first, spec when needed, plan, implement,
   validate, report.
2. **Bootstrap** projects: stack presets, templates, specs, memory, PR workflow,
   and tool pointers.
3. **Grow** safely: pull reusable knowledge out of real projects without leaking
   secrets, personal data, or project-specific facts.
4. **Operate** systems: opt-in DevOps, security, infrastructure, and compliance
   packs with authorization and production-safety gates.

**Fastest path:** open any agent CLI (Claude Code, Codex, Gemini, Copilot, …)
in this repo and say what you want — "set up `~/projects/foo`", "bootstrap a
new API from these guidelines", "add a skill for X". The agent routes itself
through [`MISSIONS.md`](MISSIONS.md) and executes the matching playbook.

---

## Table Of Contents

- [Quick Start](#quick-start)
- [Capability Packs](#capability-packs)
- [Status](#status)
- [Safety Model](#safety-model)
- [Feature Map](#feature-map)
- [What You Get](#what-you-get)
- [Repository Layout](#repository-layout)
- [Core Contract](#core-contract)
- [Agent Support](#agent-support)
- [Workflows](#workflows)
- [Scripts](#scripts)
- [Templates](#templates)
- [Skills](#skills)
- [MCP, Memory, And Figma](#mcp-memory-and-figma)
- [PR Workflow](#pr-workflow)
- [Prompt Examples](#prompt-examples)
- [Validation And Release](#validation-and-release)
- [Using In Host Projects](#using-in-host-projects)
- [Maintaining Agent Compass](#maintaining-agent-compass)
- [Provenance](#provenance)
- [Keywords](#keywords)

---

## Quick Start

### 30-Second Route

```bash
git submodule add git@github.com:<owner>/agent-compass.git docs/agent-compass
node docs/agent-compass/scripts/adopt.mjs .
```

Then tell your agent what you want. [`MISSIONS.md`](MISSIONS.md) routes setup,
bootstrap, and Compass extension work to the right playbook.

### Add To Existing Project

From the host project root:

```bash
git submodule add git@github.com:<owner>/agent-compass.git docs/agent-compass
node docs/agent-compass/scripts/adopt.mjs .
```

`adopt` runs the whole chain non-interactively: detection, setup, fit-based
skill sync (core + detected stacks only), readiness verification, and next
steps. Granular equivalent when you want control:

```bash
node docs/agent-compass/scripts/setup-wizard.mjs . --yes
node docs/agent-compass/scripts/setup-host.mjs . --strict
node docs/agent-compass/scripts/apply-recommendations.mjs . --policy solo-dev
```

The wizard writes `agent-compass.answers.json` and `.agent/setup-plan.md`, then
can run the full setup. `setup-host` installs missing pointers/templates,
applies safe fixes, runs deep doctor checks, and writes `.agent/context.json`,
`.agent/doctor-report.md`, and `.agent/RUNBOOK.md`.
`apply-recommendations` applies safe missing pieces: provider verification,
MCP readiness, spec validation map, quality gates, migration plan, dashboard,
and optional skills/policy setup.

Manual equivalent:

```bash
node docs/agent-compass/scripts/install.mjs
node docs/agent-compass/scripts/install.mjs --doctor
node docs/agent-compass/scripts/install.mjs --doctor --fix
node docs/agent-compass/scripts/install.mjs --doctor --deep
```

This creates missing agent pointers, hooks, command registry, specs/memory
starters, MCP examples, PR templates, and Copilot instructions. It never
overwrites existing files.

Then run:

```bash
node docs/agent-compass/scripts/context.mjs .
node docs/agent-compass/scripts/doctor-report.mjs . --write
node docs/agent-compass/scripts/runbook.mjs . --write
```

Result:

- `AGENTS.md` tells agents where the shared contract lives.
- `agent-compass.commands.json` tells agents which commands exist.
- `.agent/doctor-report.md` shows host readiness gaps.
- `.agent/RUNBOOK.md` gives agents a compact startup path.

Use [`docs/workflows/upgrading.md`](docs/workflows/upgrading.md) when bumping
the submodule later.

### Adopt Without Submodule

Use a standalone clone when the host should copy standards but not vendor this
repo:

```bash
git clone git@github.com:<owner>/agent-compass.git /tmp/agent-compass
node /tmp/agent-compass/scripts/install.mjs --dry /path/to/host
node /tmp/agent-compass/scripts/install.mjs /path/to/host
node /tmp/agent-compass/scripts/install.mjs --doctor --fix /path/to/host
node /tmp/agent-compass/scripts/install.mjs --doctor --deep /path/to/host
```

Review and commit only host-local files. Copy `.mcp/*.example.json` into local
MCP client config, replace `/absolute/path/to/repo`, and never commit that local
client config.

### Bootstrap New Project

```bash
git clone git@github.com:<owner>/agent-compass.git
cd agent-compass
node scripts/bootstrap.mjs
```

The bootstrap writes:

- `BOOTSTRAP_PROMPT.md`: a copy-paste build prompt with stack choices, spec-first
  setup, TDD, docs, validation, and quality gates.
- `agent-compass.answers.json`: saved answers for repeatable setup.

Paste `BOOTSTRAP_PROMPT.md` into your agent. It starts with
`specs/000-project/` artifacts before scaffolding code.

Agents (and CI) skip the questionnaire with an answers file:

```bash
node scripts/bootstrap.mjs --schema                       # answers contract
node scripts/bootstrap.mjs --answers answers.json --out /path/to/new-project
```

Or let the agent do the whole mission — see
[`skills/compass-bootstrap/SKILL.md`](skills/compass-bootstrap/SKILL.md).

### Browse And Copy

Agent Compass is mostly Markdown and templates:

- Read [`AGENTS.md`](AGENTS.md).
- Pick stack guidance from [`stacks/`](stacks/).
- Copy runnable config from [`templates/`](templates/).
- Use reusable skills from [`skills/`](skills/).

---

## Capability Packs

Agent Compass keeps broad operational knowledge opt-in. Normal project and
global adoption stay small; choose packs only when the host needs them.

<!-- BEGIN GENERATED:CAPABILITY_PACKS -->
| Pack | Skills | Covers |
| ---- | -----: | ------ |
| **devops-platform** | 22 | CI/CD, containers, Kubernetes, observability, AI pipelines, developer environments, and release operations. |
| **security** | 35 | Defensive scanning, secrets, hardening, network security, incident response, and AI security. |
| **infrastructure** | 70 | Cloud, IaC, servers, networking, databases, storage, platforms, IT, and AI infrastructure operations. |
| **compliance** | 19 | Framework mapping, governance, evidence, continuity, auditing, and incident management. |

### Focused subpacks

Use smaller packs when a host only needs one cloud, Kubernetes, observability,
AI operations, scanning, secrets, hardening, or compliance area.

| Pack | Skills | Covers |
| ---- | -----: | ------ |
| **aws** | 12 | AWS compute, containers, IAM, networking, data, secrets, auditing, cost, CloudFormation, and Terraform. |
| **azure** | 9 | Azure compute, AKS, networking, SQL, functions, Key Vault, audit monitoring, ARM/Bicep, and Terraform. |
| **gcp** | 8 | GCP compute, GKE, networking, Cloud SQL, functions, secrets, audit logs, and Terraform. |
| **kubernetes** | 9 | Kubernetes operations, packaging, GitOps, managed clusters, GPU workloads, scaling, and hardening. |
| **observability** | 8 | Metrics, traces, logs, alerts, audit telemetry, and cloud audit trails. |
| **ai-ops** | 14 | AI pipelines, model serving, GPU operations, gateways, caching, cost, RAG, vector stores, and inference scaling. |
| **security-scanning** | 7 | Dependency, source, dynamic, container, vulnerability, SBOM, and supply-chain scanning. |
| **secrets** | 5 | Vault, cloud secret managers, and encrypted GitOps secrets. |
| **hardening** | 6 | CIS, Linux, Windows, container, Kubernetes, and agent deployment hardening. |
| **compliance-frameworks** | 6 | FedRAMP, GDPR, HIPAA, ISO 27001, PCI DSS, and SOC 2 framework guidance. |
<!-- END GENERATED:CAPABILITY_PACKS -->

```bash
# Discover packs through the unified CLI
node docs/agent-compass/scripts/cli.mjs skills-sync --list-packs
node docs/agent-compass/scripts/cli.mjs catalog --type capability-pack --md
node docs/agent-compass/scripts/cli.mjs skills --grep kubernetes --md
node docs/agent-compass/scripts/cli.mjs skills kubernetes-ops

# One pack
node docs/agent-compass/scripts/cli.mjs skills-sync . --pack devops-platform

# Combined operational baseline
node docs/agent-compass/scripts/cli.mjs skills-sync . \
  --pack security,infrastructure,compliance
```

```text
DISCOVER          SELECT             SYNC               ACTIVATE
host context  →   fitting pack   →   provider skills →  agent loads one skill
```

All 146 imported skills are pinned to an audited upstream commit, carry
authorization/dry-run/rollback rules, and include no vendored executable
scripts or assets. Full list: [`skills/README.md`](skills/README.md). Safety
contract: [`operational-safety.md`](docs/guidelines/operational-safety.md).

Maintainers can verify the lock and quality locally:

```bash
agent-compass upstream-skills --verify
agent-compass check-skill-quality
agent-compass skill-docs --check
```

Refreshing requires an explicit local upstream checkout and a reviewed
`--refresh`; Agent Compass does not fetch or monitor upstream state.

---

## Status

Agent Compass is usable across real projects. Current version: `0.7.3`.

| Area | Current state |
| ---- | ------------- |
| Agent contract | Tool-agnostic `AGENTS.md` with Claude, Codex, Gemini, and Copilot pointers. |
| Installer | Non-destructive host setup with `--doctor` and `--doctor --deep`. |
| Bootstrap | Interactive prompt generator for new projects and stack presets. |
| Specs | Native `specs/` templates and spec workflow; optional upstream Spec Kit path documented. |
| Memory | projectmem workflow, templates, policy, and MCP examples. |
| PR workflow | GitHub PR create/review helpers and reviewer/label/base rules. |
| Figma | MCP guidance, frontend skill, and design-system extraction worksheet. |
| Operations | 146 opt-in DevOps, security, infrastructure, and compliance skills with safety gates. |
| CI | Node 24, latest tracked action majors, tests, naming/index/docs/action guards. |
| Release | Changelog/version/tag guard and release helper script. |

## Safety Model

- Installer never overwrites existing host files.
- Agents must not commit, push, deploy, publish, or open PRs unless explicitly asked.
- Commands must come from `agent-compass.commands.json`, `package.json`, or documented equivalents.
- Knowledge capture refuses likely secrets, personal data, and known project/domain tokens.
- Project memory must not store secrets, credentials, tokens, personal data, or temporary brainstorming.
- Specs hold product intent; implementation decisions belong in plans.
- PR helpers use existing labels only and require at least one reviewer.
- CI guards reject stale action majors and broken local docs/template links.

## Feature Map

| Need | Start here | Helper |
| ---- | ---------- | ------ |
| Let an agent run a full mission | [`MISSIONS.md`](MISSIONS.md) | `skills/compass-*` |
| Browse every asset programmatically | [`MISSIONS.md`](MISSIONS.md) | `scripts/catalog.mjs` |
| Install into host repo | [`docs/workflows/upgrading.md`](docs/workflows/upgrading.md) | `scripts/install.mjs` |
| Start a new project | [`docs/workflows/new-project.md`](docs/workflows/new-project.md) | `scripts/bootstrap.mjs` |
| Get repo context fast | [`docs/architecture/repo-map.md`](docs/architecture/repo-map.md) | `scripts/context.mjs` |
| Check host readiness | [`docs/tooling/prerequisites.md`](docs/tooling/prerequisites.md) | `scripts/doctor-report.mjs` |
| Full host setup | [`docs/workflows/upgrading.md`](docs/workflows/upgrading.md) | `scripts/setup-host.mjs` |
| Host recommendations | [`docs/workflows/upgrading.md`](docs/workflows/upgrading.md) | `scripts/recommend.mjs` |
| Provider verification | [`docs/tooling/agent-provider-capabilities.md`](docs/tooling/agent-provider-capabilities.md) | `scripts/provider-verify.mjs` |
| Agent dashboard | [`docs/workflows/upgrading.md`](docs/workflows/upgrading.md) | `scripts/dashboard.mjs` |
| Global user setup | [`docs/agent-setup.md`](docs/agent-setup.md) | `scripts/global-setup.mjs` |
| MCP readiness | [`docs/tooling/mcp.md`](docs/tooling/mcp.md) | `scripts/mcp-probe.mjs` |
| Policy packs | [`docs/workflows/upgrading.md`](docs/workflows/upgrading.md) | `scripts/policy-pack.mjs` |
| Generate agent runbook | [`AGENTS.md`](AGENTS.md) | `scripts/runbook.mjs` |
| Create specs | [`docs/workflows/spec-driven-development.md`](docs/workflows/spec-driven-development.md) | `templates/specs/` |
| Use durable memory | [`docs/workflows/project-memory.md`](docs/workflows/project-memory.md) | `templates/memory/` |
| Wire MCP tools | [`docs/tooling/mcp.md`](docs/tooling/mcp.md) | `templates/mcp/` |
| Build from Figma | [`skills/figma-mcp-frontend/SKILL.md`](skills/figma-mcp-frontend/SKILL.md) | `templates/design-system/` |
| Create a PR | [`docs/workflows/pull-requests.md`](docs/workflows/pull-requests.md) | `scripts/pr.mjs` |
| Review a PR | [`docs/workflows/pr-review.md`](docs/workflows/pr-review.md) | `scripts/pr-review.mjs` |
| Capture reusable knowledge | [`docs/workflows/knowledge-capture.md`](docs/workflows/knowledge-capture.md) | `scripts/pull-knowledge.mjs` |
| Release Agent Compass | [`docs/workflows/releasing.md`](docs/workflows/releasing.md) | `scripts/release.mjs` |

---

## What You Get

| Area | What it provides |
| ---- | ---------------- |
| Agent contract | One canonical [`AGENTS.md`](AGENTS.md) for all tools. |
| Spec workflow | Native `specs/<id-slug>/` flow for idea → spec → plan → tasks → implementation. |
| Project memory | projectmem guidance and templates for durable factual memory. |
| Command registry | `agent-compass.commands.json` so agents stop inventing commands. |
| Repo context | `context.mjs`, repo map template, and generated runbook/report helpers. |
| PR workflow | PR creation/review docs, templates, and `gh` helper scripts. |
| MCP setup | MCP docs and examples for projectmem and Figma. |
| Figma frontend flow | Design-system extraction template and Figma MCP skill. |
| Quality gates | TDD, lint/typecheck/test reporting, docs sync, security discipline. |
| Knowledge capture | Safe pull/promote workflow for reusable project lessons. |

---

## Repository Layout

```text
agent-compass/
├── AGENTS.md                       # canonical agent contract
├── CLAUDE.md                       # Claude pointer + notes
├── CODEX.md                        # Codex pointer + notes
├── GEMINI.md                       # Gemini pointer + notes
├── MISSIONS.md                     # mission router → compass-* playbooks
├── agent-compass.commands.json     # command registry
├── .github/                        # CI workflows (tests, drift check)
├── docs/
│   ├── architecture/
│   ├── decisions/
│   ├── guidelines/
│   ├── tooling/
│   └── workflows/
├── knowledge/                      # instincts, worked examples, incoming
├── migrations/                     # versioned sync migrations for hosts
├── scripts/
├── skills/
├── stacks/
├── templates/
└── test/
```

Important entry points:

| Path | Purpose |
| ---- | ------- |
| [`AGENTS.md`](AGENTS.md) | Canonical agent contract. Read first. |
| [`docs/guidelines/`](docs/guidelines/) | Coding, testing, security, docs, workflow rules. |
| [`docs/architecture/`](docs/architecture/) | Generic architecture principles and repo-map guidance. |
| [`docs/tooling/`](docs/tooling/) | Tool setup: prerequisites, CLI, MCP + [recommended servers](docs/tooling/mcp-servers.md), headroom, projectmem, pnpm, turbo, Docker, security, [prose and terminology linting](docs/tooling/vale.md). |
| [`docs/workflows/`](docs/workflows/) | Playbooks for project creation, specs, memory, PRs, release, upgrades. |
| [`skills/`](skills/) | Portable agent skills for work style, review, security, stacks, Figma. |
| [`templates/`](templates/) | Copyable config, MCP examples, PR template, specs, memory, design system, docs-lint. |
| [`scripts/`](scripts/) | Bootstrap, install, doctor, PR, review, release, upgrade helpers. |

---

## Core Contract

The contract in [`AGENTS.md`](AGENTS.md) is tool-agnostic. Host project guidance
wins when it conflicts:

```text
host project AGENTS.md > agent-compass AGENTS.md > model defaults
```

Baseline behavior:

- Gather context before code.
- Clarify ambiguity before planning.
- Use specs for new projects, new features, ambiguous behavior, and high-risk
  work.
- Plan before implementation.
- Reuse existing code, then standard library, then existing dependencies.
- Validate with real commands from `agent-compass.commands.json` or
  `package.json`.
- Use provider-native capabilities when they reduce risk: skills/prompts, MCP,
  hooks, subagents/custom agents, goal/plan/review modes.
- Teach selectively when users ask for explanations or repeat a costly
  prompting/tool-use pattern.
- Report with the Completion Gate.
- Never commit, push, deploy, publish, or open PRs unless explicitly asked.

Completion Gate:

```text
Goal:
Mode:            implementation | review-only | docs-only | partial
Files changed:
Commands run:
Validation:      one line per command - passed | failed | partial | not run + reason
Risks:
Next step:
```

---

## Agent Support

| Tool | Entry file | Notes |
| ---- | ---------- | ----- |
| Claude | `CLAUDE.md` → `AGENTS.md` | Skills can be referenced directly or synced globally. |
| Codex | `CODEX.md` → `AGENTS.md` | Uses same contract and repo context helpers. |
| Gemini | `GEMINI.md` → `AGENTS.md` | MCP servers configure via `.gemini/settings.json`; the installer ships a `.gemini/settings.example.json` starter. |
| Copilot | `.github/copilot-instructions.md` → `AGENTS.md` | Extra `.github/instructions/*.instructions.md` templates included. |

Other tools: point a rule file at `AGENTS.md`.

---

## Workflows

| Workflow | Use when |
| -------- | -------- |
| [`new-project.md`](docs/workflows/new-project.md) | Starting from zero. |
| [`architecture-decision.md`](docs/workflows/architecture-decision.md) | Choosing & justifying a new project's architecture (research-first, tech-neutral). |
| [`new-module.md`](docs/workflows/new-module.md) | Adding a feature/module to existing code. |
| [`spec-driven-development.md`](docs/workflows/spec-driven-development.md) | Turning ideas into specs, plans, tasks, and synced docs. |
| [`project-memory.md`](docs/workflows/project-memory.md) | Reading/writing durable project memory during work. |
| [`pull-requests.md`](docs/workflows/pull-requests.md) | Creating GitHub PRs with sane defaults. |
| [`pr-review.md`](docs/workflows/pr-review.md) | Local/GitHub PR reviews and implementing submitted review fixes. |
| [`agent-teaching.md`](docs/workflows/agent-teaching.md) | Teaching users without coaching every prompt. |
| [`agent-improvement-loop.md`](docs/workflows/agent-improvement-loop.md) | Turning repeated friction into reusable agent artifacts. |
| [`agent-value-expansion.md`](docs/workflows/agent-value-expansion.md) | Further ways to automate and guide developer work. |
| [`review-and-ship.md`](docs/workflows/review-and-ship.md) | Final self-review, validation, handoff, PR. |
| [`knowledge-capture.md`](docs/workflows/knowledge-capture.md) | Pulling reusable lessons into Agent Compass. |
| [`releasing.md`](docs/workflows/releasing.md) | Releasing this repo. |
| [`upgrading.md`](docs/workflows/upgrading.md) | Bumping a host project submodule. |

---

## CLI

All scripts below are reachable through one entrypoint,
[`agent-compass`](docs/tooling/cli.md) ([`scripts/cli.mjs`](scripts/cli.mjs)),
which dispatches `agent-compass <command> [...args]` and passes flags through.
From a host that vendors the submodule:

```bash
alias ac="node docs/agent-compass/scripts/cli.mjs"
ac install && ac doctor . --deep && ac onboard .
ac help            # grouped command list
```

Full install paths and command reference: [docs/tooling/cli.md](docs/tooling/cli.md).

## Scripts

All scripts are dependency-free Node scripts (also reachable via the CLI above).

| Command | Purpose |
| ------- | ------- |
| `npm run cli` | Unified dispatcher (`agent-compass <command>`). |
| `npm run bootstrap` | New-project prompt generator (interactive, or `--answers` for agents). |
| `npm run catalog` | Machine-readable asset catalog (skills, stacks, templates, docs, commands). |
| `npm run context` | Print compact repo snapshot for agents. |
| `npm run agent-conformance` | Check provider customization artifacts and print smoke prompts. |
| `npm run agent-evals` | Validate teaching/tool-offer eval fixtures. |
| `npm run agent-drift` | Read-only drift dashboard across all guidance validators. |
| `npm run agent-trace` | Validate an agent trace/outcome log (no secrets/PII). |
| `npm run agent-onboard` | One-command readiness check (doctor + drift + sync) for a host. |
| `npm run context-pack` | Generate `.agent/context.json` machine-readable repo index. |
| `npm run run-command` | Run a command from the registry (refuses unknown/destructive). |
| `npm run new` | Scaffold a skill, ADR, or spec stub. |
| `npm run redact` | Scan files/staged diff for secret/PII leaks. |
| `npm run trace-to-evals` | Turn failed trace rows into regression eval scenarios. |
| `npm run gen-depgraph` | Generate a Mermaid dependency graph from local imports. |
| `npm run check-companions` | Fail when source changes ship without a test. |
| `npm run doctor-report` | Print host readiness report. |
| `npm run runbook` | Print compact agent runbook. |
| `npm run install-into` | Install pointers/templates into a host. |
| `npm run sync-into` | Update a host's managed files from the submodule (safe, no clobber). |
| `npm run check-update` | Cheap cached check whether a host is behind (zero LLM tokens). |
| `npm run pull-knowledge` | Stage reusable knowledge from another project. |
| `npm run pr` | Create PR through `gh` with Agent Compass defaults. |
| `npm run pr-review` | Build local PR review packet or submit review. |
| `npm run release` | Prepare version/changelog release metadata. |
| `npm run upgrade-host` | Update host submodule and run deep doctor. |
| `npm run check` | Run tests + conformance + evals + naming/index/docs guards. |
| `npm run lint:actions` | Enforce supported GitHub Action majors. |

Examples:

```bash
node scripts/doctor-report.mjs /path/to/host --write
node scripts/runbook.mjs /path/to/host --write
node scripts/pr.mjs --reviewer alice --label enhancement --dry
node scripts/pr-review.mjs 123 --out .agent/pr-123-review.md
node scripts/release.mjs 0.7.0 --dry
node scripts/upgrade-host.mjs /path/to/host docs/agent-compass --dry
```

---

## Templates

Templates are copyable starters, not generated framework magic.

| Group | Includes |
| ----- | -------- |
| [`agent/`](templates/agent/) | PR template, Copilot instructions, prompt files, custom agents, agent-ready issue form. |
| [`commands/`](templates/commands/) | `agent-compass.commands.json` starter. |
| [`intake/`](templates/intake/) | Agent-ready work intake (Goal/Context/Constraints/Done/Validation). |
| [`architecture/`](templates/architecture/) | New-project architecture decision scaffolds (intake, decision, matrix, diagrams, backlog, meetings). |
| [`context/`](templates/context/) | Repo map + task routing template. |
| [`conformance/`](templates/conformance/) | Lightweight agent smoke test. |
| [`design-system/`](templates/design-system/) | Figma/design-token extraction worksheet. |
| [`memory/`](templates/memory/) | projectmem README and policy. |
| [`mcp/`](templates/mcp/) | MCP examples + per-tool contract for projectmem and Figma. |
| [`trace/`](templates/trace/) | Agent trace/outcome log schema. |
| [`specs/`](templates/specs/) | Constitution, spec, plan, tasks, checklist templates. |
| [`monorepo/`](templates/monorepo/) | pnpm/turbo/tsconfig/prettier/husky/env starters. |
| [`ci/`](templates/ci/) | GitHub Actions examples. |
| [`docker/`](templates/docker/) | Dockerfiles and local compose. |
| [`eslint/`](templates/eslint/) | Stack-specific ESLint configs. |
| [`security/`](templates/security/) | OSV scanner config. |
| [`sonar/`](templates/sonar/) | SonarQube project configs. |

Full index: [`templates/README.md`](templates/README.md).

---

## Skills

Skills are portable `SKILL.md` folders. Agents can load them directly or use them
as referenced context.

Useful groups:

- Working style: `caveman`, `ponytail`, `caveman-review`, `ponytail-review`.
- Teaching: `agent-teacher`.
- Architecture: `architecture-advisor` (new-project architecture decisions).
- Quality: `gen-docs`, `verify-module`, `verify-quality`, `verify-change`,
  `verify-security`.
- Workflow: `spec-workflow`, `project-memory`, `pr-workflow`.
- Frontend/design: `figma-mcp-frontend`, `react-admin-dashboard-patterns`,
  `expo-react-native-patterns`.
- Backend: `nestjs-patterns`, `drizzle-postgres-patterns`, `bullmq-patterns`,
  `resilience-observability-patterns`, `external-service-patterns`.
- Operations: `devops-platform`, `security`, `infrastructure`, and `compliance`
  packs (146 skills; opt-in through `skills-sync --pack`).

Full index: [`skills/README.md`](skills/README.md).

---

## MCP, Memory, And Figma

Agent Compass supports MCP as optional tooling, not a hard dependency.

Start here:

- [`docs/tooling/prerequisites.md`](docs/tooling/prerequisites.md)
- [`docs/tooling/mcp.md`](docs/tooling/mcp.md)
- [`docs/tooling/projectmem.md`](docs/tooling/projectmem.md)
- [`docs/workflows/project-memory.md`](docs/workflows/project-memory.md)

projectmem flow:

```text
Before work: read summaries and pre-action warnings.
During work: log failed attempts and important findings.
After work: log decisions, fixes, files changed, validation, remaining risks.
Never log secrets, credentials, tokens, personal data, or temporary brainstorming.
```

Figma flow:

```text
Verify Figma MCP tools → pull selected frame/file context → extract tokens,
components, variants, states, layout rules → map to existing code components →
implement → validate visually.
```

Use [`skills/figma-mcp-frontend/SKILL.md`](skills/figma-mcp-frontend/SKILL.md)
and [`templates/design-system/README.md`](templates/design-system/README.md)
for design-system work.

---

## PR Workflow

Agent Compass assumes GitHub PRs even if product issues live elsewhere, such as
Jira.

Defaults:

- base branch: `develop`
- assign PR to self: `--assignee @me`
- require at least one reviewer
- use only labels that exist in the repo
- include what changed, why, validation, risks, and reviewer notes

Create PR:

```bash
node docs/agent-compass/scripts/pr.mjs --reviewer <login> --label <existing-label>
```

Local review packet:

```bash
node docs/agent-compass/scripts/pr-review.mjs 123
```

Submit prepared review:

```bash
node docs/agent-compass/scripts/pr-review.mjs 123 --submit request-changes --body /tmp/review.md
```

Read:

- [`docs/workflows/pull-requests.md`](docs/workflows/pull-requests.md)
- [`docs/workflows/pr-review.md`](docs/workflows/pr-review.md)
- [`skills/pr-workflow/SKILL.md`](skills/pr-workflow/SKILL.md)

---

## Prompt Examples

These assume Agent Compass is installed at `docs/agent-compass/`.

### Bootstrap A Service

> Read `docs/agent-compass/AGENTS.md` and
> `docs/agent-compass/stacks/nestjs-api.md`. Scaffold a NestJS + Drizzle + BullMQ
> API in a pnpm/turbo monorepo. Use TDD. Create `specs/000-project/` first.
> Stop after the plan.

### Add A Feature

> Following `docs/agent-compass/AGENTS.md`, add `POST /invoices`. Update or
> create the feature spec first. Write the test first. Keep OpenAPI/Scalar,
> Bruno, and Gherkin in sync. Report against the Completion Gate.

### Build From Figma

> Use Figma MCP and `docs/agent-compass/skills/figma-mcp-frontend/SKILL.md`.
> Pull the selected checkout frame, extract tokens/components/states, map them
> to existing UI components, implement the screen, and validate visually.

### Review A PR Locally

> Use `docs/agent-compass/docs/workflows/pr-review.md` for local PR review #123.
> Findings first. No GitHub review submission unless I ask.

### Implement Submitted Review Fixes

> Implement review fixes for PR #123. Verify every review item against current
> code first, skip outdated comments with reason, patch relevant issues, run
> validation, and report.

### Capture Knowledge Back

> Run `node docs/agent-compass/scripts/pull-knowledge.mjs ../other-project`.
> Review `knowledge/incoming/`, promote only generic patterns, and redact any
> project-specific facts.

---

## Validation And Release

Repo validation:

```bash
npm run check
for f in scripts/*.mjs; do node --check "$f"; done
git diff --check
```

Release prep:

```bash
node scripts/release.mjs 0.7.0 --dry
node scripts/release.mjs 0.7.0
npm run check
git add package.json CHANGELOG.md
git commit -m "chore: release v0.7.0"
git tag -a v0.7.0 -m "v0.7.0"
npm run lint:release
```

Full guide: [`docs/workflows/releasing.md`](docs/workflows/releasing.md).

---

## Using In Host Projects

Recommended host files after install:

```text
AGENTS.md
agent-compass.commands.json
docs/architecture/repo-map.md
docs/decisions/000-template.md
specs/README.md
specs/constitution.md
.projectmem/README.md
.projectmem/projectmem-policy.md
.mcp/README.md
.github/PULL_REQUEST_TEMPLATE.md
.github/instructions/*.instructions.md
```

Minimal host startup prompt:

> Read `AGENTS.md`, `agent-compass.commands.json`, relevant specs, project memory
> summaries, and `docs/architecture/repo-map.md`. Then plan the requested change
> and list validation commands before editing.

---

## Maintaining Agent Compass

Before changing this repo:

1. Read [`CONTRIBUTING.md`](CONTRIBUTING.md).
2. Put new rules in the narrowest useful place: guideline, workflow, tooling doc,
   skill, template, or script.
3. Update indexes: [`docs/workflows/README.md`](docs/workflows/README.md),
   [`docs/tooling/README.md`](docs/tooling/README.md),
   [`skills/README.md`](skills/README.md), or
   [`templates/README.md`](templates/README.md).
4. Add or update focused tests.
5. Run validation.

Knowledge capture:

```bash
node scripts/pull-knowledge.mjs /path/to/project
```

The pull step refuses likely secrets, personal data, and known project/domain
tokens before staging. Promote only generic material. See
[`docs/workflows/knowledge-capture.md`](docs/workflows/knowledge-capture.md).

---

## Provenance

v0.1 was distilled from a production pnpm/turbo monorepo and mature global agent
configuration. The repo now layers in spec-driven work, durable project memory,
MCP/Figma design context, PR automation, agent runbooks, and release/upgrade
helpers.

Selected operational skills were adapted from
[BagelHole/DevOps-Security-Agent-Skills](https://github.com/BagelHole/DevOps-Security-Agent-Skills)
under MIT at pinned commit
`0365f57a079b1332f95cf26e31dd2d5332a8399f`. See
[`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md).

Stack-specific skills may carry light illustrative naming. Keep shared guidance
generic and move host-specific rules into the host project.

## Keywords

AI coding agents, agent instructions, AGENTS.md, Claude Code, Codex, Gemini,
GitHub Copilot, spec-driven development, project memory, projectmem, MCP,
Figma MCP, PR automation, code review, TDD, documentation, quality gates,
monorepo, pnpm, turbo, NestJS, React, Expo, DevOps, Kubernetes, Docker,
infrastructure, security, compliance, SOC 2, ISO 27001.

## License

Internal use only. See [`LICENSE`](LICENSE).

# Skills

Portable agent skills — self-contained `SKILL.md` folders an agent loads on
demand. They work in Claude Code directly, and the patterns transfer to Codex /
Copilot as referenced context.

## Catalog

### Compass missions

Playbooks for operating agent-compass itself — routed from [`MISSIONS.md`](../MISSIONS.md).

| Skill               | What it does                                                            |
| ------------------- | ----------------------------------------------------------------------- |
| `compass-adopt`     | Wire agent-compass into an existing project end-to-end with minimal input. |
| `compass-bootstrap` | Bootstrap a new project from architecture guidelines, spec-first.        |
| `compass-extend`    | Add a skill/instinct/template/stack/script to compass with full wiring.  |

### Working style

| Skill            | What it does                                                        |
| ---------------- | ------------------------------------------------------------------ |
| `caveman`        | Ultra-compressed communication (~75% fewer tokens, full accuracy). |
| `caveman-commit` | Conventional-commit message generator, terse.                      |
| `caveman-review` | One-line, actionable PR review comments.                           |
| `agent-teacher`  | Level-aware explanations and selective prompt/tool coaching.        |
| `ponytail`       | Forces the laziest solution that actually works (YAGNI, reuse-first). |
| `ponytail-audit` / `ponytail-review` / `ponytail-debt` / `ponytail-help` | Ponytail variants for auditing/reviewing/tracking simplification debt. |

### Architecture

| Skill                  | What it does                                                        |
| ---------------------- | ------------------------------------------------------------------ |
| `architecture-advisor` | Choose & justify a new project's architecture — research-first, technology-neutral, no unlabeled guesses; produces ADR, mermaid diagrams, risks, assumptions, open questions, and optionally a backlog and meeting list. |

### Quality gates

| Skill             | What it does                                              |
| ----------------- | -------------------------------------------------------- |
| `gen-docs`        | Scaffolds `README.md` + `DESIGN.md` for a module.        |
| `figma-mcp-frontend` | Uses Figma MCP context for design-system-driven UI implementation. |
| `debug-loop`     | Builds a tight failing feedback loop before diagnosing hard bugs. |
| `api-contract-sync` | Keeps OpenAPI/Scalar or Swagger, Bruno, Gherkin, mocks, and shared types aligned with API changes. |
| `long-running-task` | Runs broad autonomous work with intake, checkpoints, phase loops, validation, and hard stops. |
| `project-memory`  | Reads and writes durable projectmem context safely.      |
| `pr-review-governance` | Deep PR/MR review checklist for specs, security, repo rules, docs sync, UI evidence, summary, and inline comments. |
| `pr-workflow`     | Creates PRs, reviews PRs, and implements review fixes.   |
| `spec-workflow`   | Guides idea → spec → clarify → plan → tasks → docs sync. |
| `verify-module`   | Checks module structure/doc completeness.                |
| `verify-quality`  | Complexity, code smells, naming, function length.        |
| `verify-change`   | Analyzes a diff's impact and doc-sync status.            |
| `verify-security` | Scans a path for vulnerabilities (OWASP-style).          |

### Spec Kit bridge

Optional command skills for hosts that use GitHub Spec Kit. Use them with
`spec-kit-bridge` provider prompts/agents, or sync them with `skills-sync` when
a repo has `.specify/`.

| Skill | What it does |
| ----- | ------------ |
| `speckit-constitution` | Create/update project constitution rules. |
| `speckit-specify` | Create/update behavior-focused feature specs. |
| `speckit-clarify` | Resolve open spec questions before planning. |
| `speckit-plan` | Produce technical plan, research, contracts, and validation. |
| `speckit-tasks` | Generate ordered, test-first implementation tasks. |
| `speckit-analyze` | Review Spec Kit artifacts for drift and gaps. |
| `speckit-checklist` | Create feature readiness checklists. |
| `speckit-implement` | Execute approved tasks under Agent Compass gates. |
| `speckit-converge` | Reconcile code, tests, docs, and specs after work. |
| `speckit-agent-context-update` | Refresh Spec Kit context markers without clobbering host guidance. |
| `speckit-taskstoissues` | Convert tasks into deduped GitHub issues when explicitly approved. |

### Stack patterns (backend)

| Skill                              | What it does                                               |
| ---------------------------------- | --------------------------------------------------------- |
| `nestjs-patterns`                  | Module/controller/service/repository/mapper/DTO patterns. |
| `nestjs-monorepo-scaffold`         | Turbo + NestJS + Drizzle + BullMQ monorepo scaffolding.   |
| `drizzle-postgres-patterns`        | Schema, migrations, transactions, type inference.         |
| `bullmq-patterns`                  | Processors, schedulers, job spans, dedupe.                |
| `resilience-observability-patterns`| Circuit breaker, retry, OTel tracing, structured logs.    |
| `external-service-patterns`        | SFTP, payment gateways, auth, resilient HTTP clients.     |

### Stack patterns (frontend / mobile)

| Skill                          | What it does                                          |
| ------------------------------ | ----------------------------------------------------- |
| `react-admin-dashboard-patterns` | TanStack Router, MUI, MVVM, RBAC, React Query CRUD. |
| `expo-react-native-patterns`   | Expo Router, MVVM, Zustand auth, React Query, theming. |

## Using them

- **Claude Code:** reference a skill in a prompt ("use the `verify-security`
  skill on `src/modules/payments`"), or sync them into your global config with
  [`skillshare`](https://github.com/) so they auto-trigger.
- **Codex / Copilot:** point the agent at the relevant `SKILL.md` as context;
  the patterns and checklists apply the same way.

## Metadata

Every `SKILL.md` frontmatter must include:

- `name`: kebab-case skill id.
- `description`: trigger summary.
- `risk_level`: `low`, `medium`, or `high`.
- `writes_files`: `true` or `false`.
- `requires_tools`: inline list, e.g. `[]` or `[web, gh]`.

`npm run lint:naming` enforces this so skills are safe to sync into project or
global provider directories.

## Provenance & maintenance

The stack-pattern skills were extracted from a production monorepo and may carry
light project-specific naming in examples — that's fine as illustration; the
triggers and rules are generic. Keep them current with
[`scripts/pull-knowledge.mjs`](../scripts/pull-knowledge.mjs). Adding a skill?
Create `skills/<name>/SKILL.md` and add a row here (see
[CONTRIBUTING](../CONTRIBUTING.md)).

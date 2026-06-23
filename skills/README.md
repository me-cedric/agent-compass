# Skills

Portable agent skills — self-contained `SKILL.md` folders an agent loads on
demand. They work in Claude Code directly, and the patterns transfer to Codex /
Copilot as referenced context.

## Catalog

### Working style

| Skill            | What it does                                                        |
| ---------------- | ------------------------------------------------------------------ |
| `caveman`        | Ultra-compressed communication (~75% fewer tokens, full accuracy). |
| `caveman-commit` | Conventional-commit message generator, terse.                      |
| `caveman-review` | One-line, actionable PR review comments.                           |
| `ponytail`       | Forces the laziest solution that actually works (YAGNI, reuse-first). |
| `ponytail-audit` / `ponytail-review` / `ponytail-debt` / `ponytail-help` | Ponytail variants for auditing/reviewing/tracking simplification debt. |

### Quality gates

| Skill             | What it does                                              |
| ----------------- | -------------------------------------------------------- |
| `gen-docs`        | Scaffolds `README.md` + `DESIGN.md` for a module.        |
| `project-memory`  | Reads and writes durable projectmem context safely.      |
| `spec-workflow`   | Guides idea → spec → clarify → plan → tasks → docs sync. |
| `verify-module`   | Checks module structure/doc completeness.                |
| `verify-quality`  | Complexity, code smells, naming, function length.        |
| `verify-change`   | Analyzes a diff's impact and doc-sync status.            |
| `verify-security` | Scans a path for vulnerabilities (OWASP-style).          |

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

## Provenance & maintenance

The stack-pattern skills were extracted from a production monorepo and may carry
light project-specific naming in examples — that's fine as illustration; the
triggers and rules are generic. Keep them current with
[`scripts/pull-knowledge.mjs`](../scripts/pull-knowledge.mjs). Adding a skill?
Create `skills/<name>/SKILL.md` and add a row here (see
[CONTRIBUTING](../CONTRIBUTING.md)).

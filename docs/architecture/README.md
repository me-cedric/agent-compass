# Architecture Principles

Generic, reusable engineering principles — not tied to one framework. Each links
to the concrete skill(s) that implement it.

| File                                  | Principle                                                       | Skills                                              |
| ------------------------------------- | -------------------------------------------------------------- | --------------------------------------------------- |
| [monorepo.md](monorepo.md)            | Workspaces, package boundaries, shared code.                   | `nestjs-monorepo-scaffold`                           |
| [resilience.md](resilience.md)        | Circuit breakers, retries, timeouts, bulkheads.                | `resilience-observability-patterns`                 |
| [observability.md](observability.md)  | Tracing, structured logging, metrics.                          | `resilience-observability-patterns`, `bullmq-patterns` |
| [feature-flags.md](feature-flags.md)  | Env-driven, dormant-by-default capability gating.              | —                                                   |
| [api-design.md](api-design.md)        | Response envelope, versioning, DTO/mapper, validation.         | `nestjs-patterns`, `drizzle-postgres-patterns`      |
| [shared-types.md](shared-types.md)    | One source of cross-app types; impact analysis on change.      | —                                                   |
| [repo-map.md](repo-map.md)            | Active surfaces, entrypoints, generated files, fragile zones.  | —                                                   |

Pick what the project needs. The bootstrap script (`scripts/bootstrap.mjs`) wires
the relevant ones into the generated prompt based on your answers.

# Preset: NestJS API

Production backend API.

## Components

- **NestJS** (modular `controller → service → repository` + mappers).
- **Drizzle ORM** + **PostgreSQL** (transaction host; migrations via `db:generate`).
- **BullMQ** queues/processors (`WorkerHost`, queue-name constants, `withJobSpan`).
- **OpenTelemetry** tracing + structured `OtelLogger`.
- **Resilience** (circuit breaker + retry, shared defaults, env-configurable).
- **Keycloak** auth (or chosen provider).
- **API contract**: Scalar/OpenAPI + Bruno + Gherkin (+ Mockoon mocks).
- **Jest** (`jest-mock-extended`), coverage for Sonar.

## agent-compass pieces

- Skills: `nestjs-patterns`, `drizzle-postgres-patterns`, `bullmq-patterns`,
  `resilience-observability-patterns`, `external-service-patterns`.
- Templates: [`templates/eslint/eslint.config.nestjs.mjs`](../templates/eslint/eslint.config.nestjs.mjs),
  [`templates/docker/Dockerfile.nestjs`](../templates/docker/Dockerfile.nestjs),
  [`templates/sonar/sonar-project.api.properties`](../templates/sonar/sonar-project.api.properties).
- Guidelines: [api-design](../docs/architecture/api-design.md),
  [resilience](../docs/architecture/resilience.md),
  [observability](../docs/architecture/observability.md),
  [api-contract-sync](../docs/tooling/api-contract-sync.md).
- Instincts: [`knowledge/instincts-parcus/`](../knowledge/instincts-parcus/)
  (module structure, repository, mapper, processor, resilience, otel, spec-sync).

## Module layout

```
modules/<feature>/
  <feature>.module.ts  .service.ts  .repository.ts  .controller.ts
  .mapper.ts  .constants.ts  .processor.ts   + co-located *.spec.ts
  schemas/db-<entity>.ts   README.md
```

## Validate

```bash
pnpm --filter @scope/api lint && pnpm --filter @scope/api typecheck && pnpm --filter @scope/api test
```

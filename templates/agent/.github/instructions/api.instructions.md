---
applyTo: 'apps/api/**'
description: 'Use when modifying the NestJS API in apps/api, including modules, controllers, services, database code, bootstrap, and Jest tests.'
---

## Mandatory Agent Behavior

- Use `skills:caveman` for concise agent interactions. Be terse: prefer commands, file paths, diffs and exact next actions.
- For non-trivial code changes, start with the Dual Graph MCP: call `graph_continue`, then `graph_read` the recommended files. Do not rely on broad grep-only exploration for structural edits.

# API Guidelines

## Commands

- Prefer targeted validation from the monorepo root: `pnpm --filter @scope/api lint`, `pnpm --filter @scope/api test`, and `pnpm --filter @scope/api typecheck`.
- Use root helpers only when they match the task: `pnpm dev:api` for app development, `pnpm build:packages` if workspace packages look stale.
- Database tasks live in the API app: use the existing `db:*` scripts instead of ad hoc Drizzle commands.

## Structure

- Follow the existing NestJS module layout under `src/modules/` and keep public, backoffice, external, and infrastructure concerns separated.
- Preserve the bootstrap order in `src/main.ts`: load environment variables before tracing initialization, then keep Fastify, Swagger, Bull Board, multipart, and versioning setup in the established flow.
- Reuse the existing global validation and serialization stack based on `nestjs-zod` instead of introducing parallel DTO validation approaches.
- Keep database code aligned with the Drizzle patterns already used in `src/database/`, including inferred insert/select types from `schema.*` and snake_case database casing.
- Always use the `@/` path alias (mapped to `src/`) for cross-module imports instead of relative `../` paths. This applies to both `src/` source files and `test/` e2e files. Use relative imports only for same-directory or direct child imports (e.g. `./foo.service`).

## Tests and Data

- Unit tests use Jest; e2e tests live under `test/`. Match the existing setup before adding a new test harness.
- When touching seed or test helpers around loyalty-related aliases, keep insert and select aliases aligned with the current schema naming; mismatches cause cascading TypeScript failures.
- Prefer updating existing factories, mocks, and fixtures over creating parallel ones with a different shape.

## Integration Notes

- Authentication and authorization are Keycloak-based. Follow the existing guards and module setup instead of adding app-specific auth shortcuts.
- Shared contracts should come from `@scope/shared-types`; avoid duplicating request or response shapes locally when a shared type already exists.
- For queueing, storage, tracing, resilience, and external providers, extend the current modules and providers rather than wiring new global singletons in feature code.

## Validation

**All code changes in `apps/api/` MUST pass lint, typecheck, and relevant unit/e2e tests.**

- Run scope-specific validations: `pnpm --filter @scope/api lint`, `pnpm --filter @scope/api typecheck`, `pnpm --filter @scope/api test`.
- For e2e tests, use `pnpm --filter @scope/api test:e2e` with a matching test name pattern.
- Fix any lint/type errors introduced by your changes before closing the task. Do not leave the codebase with new violations.
- When adding new packages, run `pnpm install` from the root and verify the import resolves.

## Documentation And Spec Sync

When changing API behaviour, update all three specification layers in the same task/PR:

- **Scalar / OpenAPI** — Swagger decorators on controllers and DTOs (`@ApiOperation`,
  `@ApiResponse`, `@ApiProperty`, etc.). New modules must be added to
  `apps/api/src/bootstrap/swagger.ts` `include` array and `x-tagGroups`.
- **Bruno** — `.bru` request files under `tools/bruno/` (URL, method, body, headers,
  docs block). Create new files for new endpoints; remove files for deleted endpoints.
- **Gherkin** — `.feature` files under `apps/api/features/` (scenarios, steps,
  examples). Update when business logic, error handling, or state transitions change.

See `.claude/instincts/scalar-bruno-gherkin-sync.md` for the full enforcement rules.

## Monetico Payment Parameters (Critical)

When modifying deferred MIT (pay-per-use) payment flows in `modules/payment/` or `modules/external/payment/monetico/`:

**Three payload parameters are strictly enforced by Monetico spec and MUST match exactly:**

1. **`payment_use_case.acceptance_channel`** → `"browser"` (not `"in-app"`)
   - Signals server-initiated auth, no SDK challenge
   - Wrong value prevents Monetico from granting authorization

2. **`payment.transaction_initiator`** → `"merchant"`
   - Matches the current API code path for stored-card deferred parking auth
   - Do not change this without validating the full Monetico parking flow end to end

3. **`authentication.merchant_preference`** → `"no_challenge_requested"`
   - Controls 3DS challenge behavior (MIT should skip)
   - Omitting this can cause capture to fail with `cdr=-1 lib=verification echouee`

**Reference:** See `/memories/repo/monetico-payperuse-payload-gotcha.md` for details, expected payload in `docs/monetico/<project>-workflows.md` § 2, and tests in `<project>-payment.service.spec.ts`.

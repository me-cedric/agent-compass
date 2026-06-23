# New Module

Adding a feature/module to an existing project, the enforced way.

## 1. Scaffold + docs skeleton

```
gen-docs <module-path>      # skill: README.md + DESIGN.md skeleton
```

Create the standard layout for the stack (e.g. NestJS:
`module / service / repository / controller / mapper / constants` + co-located
`*.spec.ts`). See the `nestjs-patterns` skill and
[architecture/api-design.md](../architecture/api-design.md).

## 2. TDD the behavior

Test first (RED) → minimal implementation (GREEN) → refactor. Mock external
clients; wrap real ones in [resilience](../architecture/resilience.md) policies
created once in `onModuleInit`. Add [tracing + logging](../architecture/observability.md).

## 3. Keep specs + docs in sync

- API change? Update OpenAPI/Scalar + Bruno + Gherkin
  ([api-contract-sync](../tooling/api-contract-sync.md)).
- Fill the module README (purpose, files, public API, config + sources, data
  flow, test command) — [documentation](../guidelines/documentation.md).
- New env var? Update `.env.example`.

## 4. Quality gates

```
verify-module <path>     # structure/docs completeness
verify-quality <path>    # complexity, smells, naming, fn length
verify-security <path>   # vulnerability scan
```

Fix **Critical/High** before delivery; others are advisory.

## 5. Validate (scope-specific)

```bash
pnpm --filter @scope/<app> lint
pnpm --filter @scope/<app> typecheck
pnpm --filter @scope/<app> test -- <spec>
```

Report against the [Completion Gate](../guidelines/agent-behavior.md). If you
changed a shared package, validate every consumer
([shared-types](../architecture/shared-types.md)).

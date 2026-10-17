# Architecture

Generic principles. They do not depend on one framework. The stack rules in `rules/` hold the framework detail (see [assets.md](assets.md#stack-rules)).
Choose the architecture of a new project with `architecture-advisor` and record it as an ADR (see [delivery.md](delivery.md#questions-and-decisions)).

## API design

- Use one response envelope across services and clients.
  ```ts
  interface ApiResponse<T> {
    success: boolean
    data?: T
    error?: string
    meta?: { total: number; page: number; limit: number }
  }
  ```
- Layer the code: controller, service, repository, with mappers between the layers.
  - The controller handles transport, validation and the API docs decorators. It holds no business logic.
  - The service holds the business logic. It orchestrates repositories and external clients. A resilience policy wraps each external client.
  - The repository does data access only, through a transaction host. No raw database client leaves it.
  - The mapper has `toDto()`, `toInsert()` and `toUpdate()`. It keeps entities and DTOs apart.
- Hide data access behind a repository interface (`findAll`, `findById`, `create`, `update`, `delete`). Business logic depends on the interface.
- Validate each inbound payload at the controller boundary with a schema. DTOs carry the metadata that keeps the OpenAPI spec accurate.
- Version the API. Never break a shipped contract in silence. Return stable, typed errors that do not leak internals. Rate-limit public endpoints.
- Keep the contract layers in step in the same task. The `api-contract-sync` skill has the steps. The layers are:

| Layer | Holds |
|---|---|
| OpenAPI or Scalar | Controller and DTO decorators, response contracts, module registration in the OpenAPI bootstrap. |
| Bruno | One `.bru` request for each endpoint. Add and remove the file with the endpoint. |
| Gherkin | Scenarios, when behavior changes. |
| Mockoon (optional) | Mocks regenerated from the OpenAPI export. |
| Shared types | Request and response contracts that consumers import. |

Bruno and Gherkin live in the repository. The contract is reviewed in the PR and cannot rot in a separate workspace.

## Resilience

Wrap each call that can fail or hang in resilience policies: external HTTP, payment providers, SFTP and message brokers.

- Timeout: every external call has a deadline.
- Retry: retry transient failures with backoff and jitter. Cap the attempts. Retry only idempotent operations.
- Circuit breaker: after N consecutive failures, fail fast. Probe recovery in half-open state.
- Bulkhead: isolate pools, so that one slow dependency cannot exhaust the rest.
- Fallback: define a degraded behavior when the circuit is open, where one exists.

Agents often get these rules wrong:

- Create a policy once, in `onModuleInit()` or module setup, and reuse it. A breaker that you create for each call never trips.
- Keep the shared defaults in one constants file, with env overrides that parse safely. A value of 0 or less becomes 1.
- A module that needs other thresholds inherits the default and overrides only the difference. It does not fork.
- Write the values and their source in the module README.
- Pair each policy with a span and a log.

For queue-backed provider work (media, imports, exports, AI calls), bound the work and make it recoverable:

- Keep business code behind a provider abstraction. Local and dev default to a mock or offline provider. A live provider fails closed when a secret or a host tool is missing.
- Keep long work out of the HTTP request path. Let a deployment split the roles: `api` serves HTTP, `worker` consumes queues, `all` is for local dev. Scale with a concurrency env var, then with replicas.
- Use explicit states (`queued`, `processing`, `available`, `failed`) with an auditable transition. Stream a large payload; do not buffer the whole file. Keep raw sensitive data only as long as the job needs it.

## Observability

- Tracing (OpenTelemetry): add spans around requests, jobs, external calls and payments. Use helper wrappers such as `withJobSpan()` so that spans stay consistent.
  Keep span names in a constants file. Propagate the context across queues and HTTP.
- Logging: use the structured logger of the project, not the framework default, so logs match traces. Set the context once in the constructor.
  Use fields, not string interpolation. Never log a secret or personal data.
- Metrics: count throughput, latency, error rate and queue depth. Alert on SLOs, not on each blip.
- When you add an external call, a processor or a payment step, add its span and log in the same change.

## Feature flags

- A new or risky capability defaults to off. When off, its endpoints, webhooks, processors, schedulers and side effects are inert. One env change turns it on.
  ```ts
  export const isEnabled = (v?: string) => ['true', '1', 'yes'].includes((v ?? '').trim().toLowerCase())
  ```
- Gate at the edges: guards, route registration and processor registration.
- Document the flag in `.env.example` and the module README: what it gates, its default and its blast radius. Plan its removal.
- A user-scoped flag is a selection, so an empty value is ambiguous. Decide it, write it down and test it.
  - An empty selection means everything. Old installs hold an empty value, and "all off" would empty the navigation on upgrade.
  - A switched-off route still resolves. It says that the owner switched the capability off and that nothing was deleted.
  - Diagnostics, health and settings screens stay reachable whatever the list holds.
- For long-lived, per-segment or percentage rollouts, use a flag service, not env vars.

## Monorepo

A pnpm workspace with Turbo is the default shape for a multi-app product.

```
apps/        deployables: api, web, mobile
packages/    shared libraries: shared-types, ui, config
tools/       helpers that do not ship: bruno, mockoon, scripts
pnpm-workspace.yaml  turbo.json  tsconfig.base.json
```

- Apps never import each other. Shared code goes into a package. Internal packages use `workspace:*`.
- Each app and package owns its `package.json`, `tsconfig` (extending the base), lint config and test config.
- Turbo resolves the dependency graph. Shared packages build before the apps that use them. Keep the inputs and outputs in `turbo.json` accurate, or the cache goes stale.
- Root scripts are `dev`, `build`, `test`, `lint`, `typecheck` and `check` (the full gate). Filter them for one app: `pnpm --filter @scope/api lint`,
  `--filter @scope/api...` for the package and its dependents, and `turbo run build --filter=...@scope/api`.
- After you add a package, run `pnpm install`, commit the lockfile and check that the import resolves.
- `eslint-plugin-boundaries` can enforce the layers of a UI. The `ui-conformance` skill has an atomic-design template.

### Shared types

- Cross-app types live in one package, for example `@scope/shared-types`. Never copy a cross-app type into an app.
- Changing a shared symbol is a multi-app event. Find each consumer, validate the package and each consumer (lint and typecheck), and do not mark the work complete until all pass.
- If a consumer fails to typecheck, the contract reports a break. Fix the call sites. Do not cast to `any`.
- Put only transport-level types in the package: DTOs, enums and API contracts. Keep view types local.

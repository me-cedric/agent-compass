---
description: NestJS API rules for modules, layers, DTOs, API security, queues, resilience and tracing. Applies when you edit server TypeScript in a NestJS app.
paths:
  - "**/*.module.ts"
  - "**/*.controller.ts"
  - "**/*.service.ts"
  - "**/*.repository.ts"
  - "**/*.mapper.ts"
  - "**/*.processor.ts"
  - "**/*.guard.ts"
  - "**/*.constants.ts"
  - "**/dto/**/*.ts"
  - "**/resilience/**/*.ts"
  - "**/tracing/**/*.ts"
  - "**/main.ts"
stacks: [nestjs-api]
---
# NestJS rules

## Structure
- Build each feature as one module: `<feature>.module.ts`, `.controller.ts`, `.service.ts`, `.repository.ts`, `.mapper.ts`, `.constants.ts`, `dto/`, `schemas/db-<entity>.ts`.
- Add `.processor.ts` only for background jobs. Add a scheduler service for cron triggers.
- Put each `*.spec.ts` next to its source file.
- Group related feature modules in a container module that has no logic.
- Export only the providers that other modules need.
- Put each third-party provider under `modules/external/<provider>/`. Feature code calls the provider service, not the raw API.
- Do not import one app from another app. Put shared code in a `packages/` library.
- Keep cross-app types and enums in one `shared-types` package. Do not copy a type between apps.
- After you change a shared symbol, find each consumer. Lint and typecheck each one. Do not cast to `any` to pass.
- Set `dependsOn: ["^build"]` on `lint`, `typecheck` and `test` in `turbo.json`. Shared packages then build first.
- Reference internal packages with `workspace:*`. Pin the package manager in `packageManager`.

## Layers
- Keep transport and validation in the controller, business logic in the service, and data access in the repository.
- Do not inject the database client into a service. Query through a repository.
- Throw Nest exceptions from services: `NotFoundException`, `BadRequestException`, `ConflictException`.
- Write each mapper as a stateless `@Injectable()` with `toDto`, `toInsert` and `toUpdate`. Split mappers when consumers need different DTO shapes.
- In `toUpdate`, guard each optional field: `...(dto.x !== undefined && { x: dto.x })`. An absent key then stays absent.
- Validate every inbound payload at the controller boundary with a schema DTO (`nestjs-zod` or class-validator). Do not trust the client.

## HTTP
- Give each endpoint `@Version`, `@ApiOperation`, a typed response decorator, and `@HttpCode` when the status is not the default.
- Protect each endpoint with a guard, or mark it `@Public()`. Make a webhook verify the provider signature before it acts.
- Register the exception filter, validation pipe, auth guard and throttler guard once in `AppModule`. Order the guards: auth, resource, throttler.
- Rate-limit public endpoints. Override the limit per route with `@Throttle`.
- Return one envelope: `success`, `data`, `error`, `meta`. Return typed errors. Do not leak internals or secrets.
- Do not change a shipped contract without a new API version.
- Change OpenAPI decorators, Bruno requests and Gherkin features in the same change as the endpoint. Use the `api-contract-sync` skill.

## Security
- Derive tenant, account and user scope from the token. Do not read it from the request body.
- Apply the scope predicate to every by-id read, update, delete and child query, not only to list endpoints.
- Fail closed when scope cannot resolve. Return 404 or 403 the same way for each out-of-scope resource. Add a cross-scope test.
- Do not log bearer-like values: tokens, session IDs, API keys, OAuth codes, signed URLs, provider bodies. Log a 12-character SHA-256 fingerprint.
- Store a deduplicated secret in two columns: versioned AES-GCM ciphertext with a random IV, and an HMAC-SHA256 lookup with a separate key. Do not use ciphertext as a lookup key.
- Let a cleanup job delete only when the provider says the resource is gone. Keep the data when the provider fails or times out.
- Validate upload extension, MIME type and size at the boundary. Reject `..`, absolute paths and encoded separators. Generate storage keys.

## Queues
- Extend `WorkerHost`. Decorate with `@Processor(<FEATURE>_QUEUE_NAME, { concurrency })`. Set concurrency on purpose.
- Declare queue name, job names, job IDs and span names as `as const` values in `<feature>.constants.ts`.
- Pass the queue-name constant to `registerQueue`, `@InjectQueue` and `@Processor`. Never pass a job ID or job name.
- Wrap each `process()` body in `withJobSpan()`. Enqueue through the queue service that puts trace context in the job data.
- Type job data as `Job<FeatureJobData>`.
- Make each job idempotent: look up the reference, log a warning on a duplicate, return. Set `jobId` for deduplication.
- Keep failed jobs (`removeOnFail: false`). Set `attempts` with exponential backoff. Log context, then rethrow. Do not swallow an error.

## Resilience
- Wrap each external call (HTTP, payment, SFTP, broker) in a timeout, a retry and a circuit breaker. Retry only idempotent operations.
- Create the policy once in `onModuleInit()`. Keep it in a field. A per-call breaker never trips.
- Read defaults from `resilience.constants.ts` (`DEFAULT_CIRCUIT_BREAKER`, `DEFAULT_RETRY`). Parse env overrides without `NaN`. Floor each at 1.
- Override only the fields that differ from the shared default. Record each value and its source in the module README.
- Map `BrokenCircuitError` to `ServiceUnavailableException`.
- Open a connection (SFTP) lazily. Share one pending connect. Reset on `error` and `end`. Close in `onModuleDestroy`.
- Read required config with `getOrThrow()`. Startup then fails fast.

## Observability
- Import the OpenTelemetry SDK first in `main.ts`, before any Nest import.
- Keep `enhancedDatabaseReporting` false on the pg instrumentation. True copies query values into spans.
- Log through `OtelLogger` in services and processors. Call `setContext(Class.name)` in the constructor. Pass the stack to `error()`.
- Use the Nest `Logger` only in guards and pipes that need no trace context.
- Name spans `<module>.<operation>` and metrics `<domain>.<action>`. Keep span names in constants.
- Add a span and a log in the same change as a new external call, processor or payment step.
- Do not log secrets or personal data.
- Put a risky new capability behind `FEATURE_<NAME>_ENABLED`, default `false`. Register its routes and processors only when it is on.

## Tests
- Mock dependencies with `jest-mock-extended` inside `Test.createTestingModule()`. Mock `Transactional` from `@nestjs-cls/transactional`.
- Define typed fixtures as constants at the top of the spec file.
- Before you finish, run the project lint, typecheck and test scripts for the API package.

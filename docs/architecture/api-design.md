# API Design

## Response envelope

One consistent shape across services and clients (see
[guidelines/typescript.md](../guidelines/typescript.md)):

```ts
interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
  meta?: { total: number; page: number; limit: number }
}
```

## Layering (NestJS reference)

`controller → service → repository`, with mappers between layers:

- **Controller** — HTTP/transport, validation, Swagger/Scalar decorators. No
  business logic.
- **Service** — business logic; orchestrates repositories and external clients
  (the latter wrapped in resilience policies).
- **Repository** — data access only, through a transaction host; no raw DB client
  leaking out. CRUD shape per [guidelines/typescript.md](../guidelines/typescript.md).
- **Mapper** — `toDto()` / `toInsert()` / `toUpdate()`; keeps entities and DTOs
  decoupled.

Standard module layout and file naming come from the `nestjs-patterns` skill.

## Validation & DTOs

Validate every inbound payload at the controller boundary (schema-based, e.g.
`zod` or class-validator). Never trust the client. DTOs carry `@ApiProperty`
metadata so the OpenAPI spec stays accurate.

## Versioning & errors

- Version the API (URI or header) and don't break a shipped contract silently.
- Stable, typed error responses; messages never leak internals or secrets.
- Rate-limit public endpoints.

## Keep the contract in sync

Every endpoint/payload/status change updates OpenAPI/Scalar **and** Bruno **and**
Gherkin in the same task — see
[tooling/api-contract-sync.md](../tooling/api-contract-sync.md).

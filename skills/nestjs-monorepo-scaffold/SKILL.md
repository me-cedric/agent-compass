---
name: nestjs-monorepo-scaffold
description: Turborepo + NestJS + Drizzle + BullMQ monorepo scaffolding — project structure, shared types, workspace config, Docker, CI/CD, and new feature bootstrapping
version: 1.0.0
filePattern: "turbo.json,**/package.json,**/tsconfig*.json,docker-compose*,**/Dockerfile,.github/**"
bashPattern: "turbo|pnpm.*workspace|docker.compose"
---

# NestJS Monorepo Scaffolding

## Project Structure

```
<project>/
  apps/
    api/                          # NestJS API (Fastify)
      src/
        app.module.ts             # Root module (all imports)
        main.ts                   # Bootstrap (OTel first, then Fastify)
        http-exception.filter.ts  # Global error handler
        database/
          postgres.schema.ts      # All Drizzle tables, enums, relations, views
          database.module.ts      # DB connection provider
          database.service.ts     # Pool management + health check
          seed.ts                 # Development data seeder
        modules/
          public/                 # Public-facing endpoints (mobile app)
            auth/
            user/
            payments/
          backoffice/             # Admin dashboard endpoints
            users/
            billing/
            payments/
          <feature>/              # Feature modules (self-contained)
          external/               # Third-party provider wrappers
            payment/<provider>/
            email/<provider>/
        shared/
          guards/                 # Auth, permissions, throttling
          queue/                  # BullMQ service, job-span wrapper
          resilience/             # Circuit breaker, retry policies
          sftp/                   # SFTP connection wrapper
        tracing/
          tracing.ts              # OTel SDK init (loaded first in main.ts)
          metrics.service.ts      # Business + infra metrics
          otel-logger.ts          # Trace-correlated logger
      config/
        drizzle.config.ts         # Drizzle-kit configuration
      drizzle/
        api/                      # Generated migrations + meta snapshots
      test/                       # E2E tests
    mobile-app/                   # React Native / Expo
    backoffice/                   # Next.js admin dashboard
  packages/
    shared-types/                 # Types shared across all apps
      src/types/
        user.ts
        payment.ts
        resource.ts
        ...
      package.json                # "@your/shared-types"
  turbo.json
  package.json                    # pnpm workspaces
  docker-compose.yml              # Local infra (Postgres, Redis, Keycloak)
  docker-compose.test.yml         # Test infra
  .husky/
    pre-push                      # lint + typecheck before push
```

## Root package.json

```json
{
  "private": true,
  "scripts": {
    "dev": "turbo dev",
    "build": "turbo build",
    "test": "turbo test",
    "lint": "turbo lint",
    "typecheck": "turbo typecheck",
    "format": "prettier --write \"**/*.{ts,tsx,md}\""
  },
  "devDependencies": {
    "turbo": "^2.x",
    "prettier": "^3.x"
  }
}
```

## pnpm-workspace.yaml

```yaml
packages:
  - "apps/*"
  - "packages/*"
```

## turbo.json

```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "dev": { "persistent": true, "cache": false },
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**"]
    },
    "lint": { "dependsOn": ["^build"] },
    "typecheck": { "dependsOn": ["^build"] },
    "test": { "dependsOn": ["^build"] },
    "e2e": { "dependsOn": ["build"] }
  }
}
```

**Key:** `dependsOn: ["^build"]` ensures shared-types is built before API lint/typecheck/test runs.

## Shared Types Package

```ts
// packages/shared-types/src/types/payment.ts
export const PAYMENT_STATUSES = [
  'pending', 'authorized', 'captured', 'partially_refunded', 'cancelled', 'refused',
] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const PAYMENT_TYPES = ['enrolment', 'pay_per_use', 'immediate', 'deferred'] as const;
export type PaymentType = (typeof PAYMENT_TYPES)[number];

// Zod schema for validation
export const PaymentSchema = z.object({
  id: z.string(),
  reference: z.string(),
  amountInMinor: z.number().int(),
  status: z.enum(PAYMENT_STATUSES),
  type: z.enum(PAYMENT_TYPES),
});
```

**Pattern:** Define enums as `const` arrays in shared-types, derive both TypeScript types AND Drizzle pgEnums from them. This keeps API, mobile, and backoffice in sync.

## Docker Compose (Local Dev)

```yaml
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: dev
      POSTGRES_PASSWORD: dev
      POSTGRES_DB: myapp
    ports: ["5432:5432"]
    volumes: ["pgdata:/var/lib/postgresql/data"]

  redis:
    image: redis:7-alpine
    command: redis-server --requirepass dev
    ports: ["6379:6379"]

  keycloak:
    image: quay.io/keycloak/keycloak:24.0
    command: start-dev
    environment:
      KEYCLOAK_ADMIN: admin
      KEYCLOAK_ADMIN_PASSWORD: admin
    ports: ["8080:8080"]

volumes:
  pgdata:
```

## New Feature Checklist

When adding a new feature module:

1. **Create module directory:** `apps/api/src/modules/<feature>/`
2. **Create files:**
   - `<feature>.module.ts` — imports, providers, exports
   - `<feature>.constants.ts` — queue names, job IDs, span names (if async)
   - `<feature>.repository.ts` — Drizzle queries with `TransactionHost`
   - `<feature>.service.ts` — business logic with `@Transactional()`
   - `<feature>.mapper.ts` — entity <-> DTO transformation
   - `<feature>.controller.ts` — HTTP endpoints (if user-facing)
   - `dto/create-<feature>.dto.ts` — Zod-based input validation
   - `<feature>.spec.ts` — unit tests
3. **If async processing needed:**
   - `<feature>.processor.ts` — extends `WorkerHost`, uses `withJobSpan()`
   - `<feature>-scheduler.service.ts` — `@Cron()` job scheduling
   - Register queue in module: `BullModule.registerQueue({ name: QUEUE_NAME })`
4. **Update schema** (if new tables):
   - Add to `postgres.schema.ts`
   - Rebuild shared-types: `pnpm --filter @your/shared-types build`
   - Generate migration: `pnpm --filter @your/api db:generate`
   - Review generated SQL
   - Check seed files
5. **Register module:**
   - Import in `PublicModule` (mobile-facing) or `BackofficeModule` (admin-facing)
   - Or import directly in `AppModule` if cross-cutting
6. **Add controller** to container module if endpoints are public
7. **Run checks:**
   ```bash
   pnpm --filter @your/api lint
   pnpm --filter @your/api typecheck
   pnpm --filter @your/api test
   ```

## Environment Variables Convention

```env
# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/myapp

# Redis (BullMQ)
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=dev

# Auth
KEYCLOAK_URL=http://localhost:8080
KEYCLOAK_REALM=myapp
KEYCLOAK_CLIENT_ID=api
KEYCLOAK_SECRET=secret

# External services
SFTP_HOST=sftp.provider.com
SFTP_PORT=22
SFTP_USER=user
SFTP_PASSWORD=pass

# Observability
OTEL_EXPORTER_ENDPOINT=http://localhost:4318
OTEL_SERVICE_NAME=my-api

# App
PORT=3000
NODE_ENV=development
```

## API Package Scripts

```json
{
  "scripts": {
    "dev": "nest start --watch",
    "build": "nest build",
    "test": "jest",
    "test:watch": "jest --watch",
    "lint": "eslint src/ --fix",
    "typecheck": "tsc --noEmit",
    "db:generate": "drizzle-kit generate --config=config/drizzle.config.ts",
    "db:migrate": "drizzle-kit migrate --config=config/drizzle.config.ts",
    "db:seed": "tsx src/database/seed.ts",
    "db:studio": "drizzle-kit studio --config=config/drizzle.config.ts"
  }
}
```

## Pre-Push Hook

```bash
#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"

# Lint and typecheck before push
pnpm --filter @your/api lint && pnpm --filter @your/api typecheck
```

## Testing Strategy

- **Unit tests** (`.spec.ts`): Co-located, mock repositories and external services
- **Integration tests** (`test/`): Hit real test DB, verify full request cycle
- **E2E tests**: Critical user flows through the API

```ts
// Unit test setup pattern
function setup() {
  const repo: jest.Mocked<Pick<FeatureRepository, 'findById' | 'create'>> = {
    findById: jest.fn(),
    create: jest.fn(),
  };
  const service = new FeatureService(repo as unknown as FeatureRepository);
  return { service, repo };
}

describe('FeatureService', () => {
  afterEach(() => jest.clearAllMocks());

  it('creates a feature', async () => {
    const { service, repo } = setup();
    repo.create.mockResolvedValue({ id: '1', name: 'test' });
    const result = await service.create({ name: 'test' });
    expect(result.name).toBe('test');
    expect(repo.create).toHaveBeenCalledWith({ name: 'test' });
  });
});
```

## Branch Naming

```
feature/api/<topic>       # API features
feature/mobile/<topic>    # Mobile features
fix/api/<topic>           # API bug fixes
fix/mobile/<topic>        # Mobile bug fixes
chore/<topic>             # Dependencies, CI, config
```

## Commit Convention

```
feat(api): add payment refund endpoint
fix(api): resolve duplicate loyalty points
refactor(api): extract payment amount formatting
test: add backoffice refund service specs
chore: update turbo to v2.x
ci: add pre-push typecheck hook
```

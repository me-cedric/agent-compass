# Docker

Container images for apps, and Compose for local infra.

## Images (multi-stage)

[`templates/docker/Dockerfile.nestjs`](../../templates/docker/Dockerfile.nestjs)
and [`Dockerfile.web`](../../templates/docker/Dockerfile.web) are multi-stage:

1. **deps** — install with the pinned pnpm, leveraging layer cache on the lockfile.
2. **build** — build the app (and the shared packages it needs).
3. **runtime** — a slim image with only production artifacts and a non-root user.

Keep [`.dockerignore`](../../templates/docker/.dockerignore) tight (`node_modules`,
`.git`, build output, `.env`) — it shrinks context and avoids leaking secrets.

## Local infra (Compose)

[`templates/docker/docker-compose.local.example.yml`](../../templates/docker/docker-compose.local.example.yml)
brings up dependencies (Postgres, Redis, Keycloak, mailers, …) for local dev.
Root scripts wrap it:

```bash
pnpm dev:infra            # up --build
pnpm dev:infra:start      # up -d --build
pnpm dev:infra:stop       # down
pnpm dev:infra:clean      # down --volumes --rmi all --remove-orphans
```

A separate `docker-compose.test.yml` provides an isolated stack for integration/
e2e (`dev:backend:*`). Keep dev and test stacks separate so tests never clobber
local data.

## Rules

- Pin base image tags (digests for prod). Don't run as root.
- Build the same artifact CI ships — don't diverge local and CI Dockerfiles.
- Compose files reference env from `.env`; commit only `.example` variants.

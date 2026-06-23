# Acme Module (Bike-Sharing)

Integrates with the [Nextbike GBFS API](https://gbfs.nextbike.net) to sync
Acme station information and real-time status into the <project> platform.

## External API

| Resource            | GBFS Endpoint                      | Auth |
| ------------------- | ---------------------------------- | ---- |
| Station Information | `GET /fr/station_information.json` | None |
| Station Status      | `GET /fr/station_status.json`      | None |

Configure via env:

- `ACME_API_BASE_URL` (default: `https://gbfs.nextbike.net/maps/gbfs/v2/nextbike_ae`)

## Module Structure

```
acme/
├── acme.module.ts           # NestJS module — provides AcmeService + AcmeMapper
├── acme.service.ts           # Business logic: merge station info + status
├── acme.repository.ts        # Drizzle reads/writes via TransactionHost
├── acme.mapper.ts            # @Injectable() class: toStationDto()
├── acme.mapper.spec.ts       # Mapper unit tests
├── acme.config.ts            # Config via @nestjs/config registerAs('acme')
├── acme.constants.ts         # Queue name, job names, span names
├── acme-client.service.ts    # HTTP calls to GBFS API (resilience-wrapped)
├── acme.processor.ts         # BullMQ processor (WorkerHost)
├── acme.processor.spec.ts    # Processor unit tests
├── acme-scheduler.service.ts # Cron trigger for periodic syncs
├── acme.service.spec.ts      # Service unit tests
├── acme.repository.spec.ts   # Repository unit tests
└── schemas/
    └── db-acme-station.ts    # Drizzle schema for acme_stations table
```

## Resilience

Uses the shared `DEFAULT_CIRCUIT_BREAKER` and `DEFAULT_RETRY` from
`@/shared/resilience/resilience.constants`. The `AcmeClientService` creates
one policy in `onModuleInit()` and reuses it for all API calls.

| Setting             | Value | Source                    |
| ------------------- | ----- | ------------------------- |
| failureThreshold    | 3     | `DEFAULT_CIRCUIT_BREAKER` |
| openDuration        | 60 s  | `DEFAULT_CIRCUIT_BREAKER` |
| halfOpenMaxAttempts | 1     | `DEFAULT_CIRCUIT_BREAKER` |
| retry.maxAttempts   | 3     | `DEFAULT_RETRY`           |
| retry.delay         | 2 s   | `DEFAULT_RETRY`           |

Override any of these via env vars (see `resilience.constants.ts` for names).

## Public API

Served by `AcmeController` under `modules/public/acme/`.

| Method | Path                      | Version | Auth                            | Description                       |
| ------ | ------------------------- | ------- | ------------------------------- | --------------------------------- |
| GET    | `/api/v1/acme/stations` | v1      | Bearer token (guest-restricted) | List all stations (no pagination) |

**No server-side pagination yet** — the endpoint returns all stations in a
single flat list. The Gherkin spec reflects this.

## Specifications

| Layer          | Location                                                                         |
| -------------- | -------------------------------------------------------------------------------- |
| OpenAPI/Scalar | `@ApiTags('Acme')` on controller; tag registered in `swagger.ts` `x-tagGroups` |
| Bruno          | `tools/bruno/📱 Application/Mobility/Acme/`                                    |
| Gherkin        | `apps/api/features/acme.feature`                                               |

## Data Flow

```
Scheduler (cron) → Processor (BullMQ job) → AcmeService
                                               ├── AcmeClientService (HTTP → GBFS API)
                                               │     ├── fetchStationInformation()
                                               │     └── fetchStationStatus()
                                               └── AcmeRepository (Drizzle → PostgreSQL)
                                           PublicController
                                               └── AcmeMapper.toStationDto()
```

## Testing

Run Acme-specific tests:

```bash
pnpm --filter @scope/api test -- --testPathPattern='acme|Acme'
```

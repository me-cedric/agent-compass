# Velhop Module (Bike-Sharing)

Integrates with the [Nextbike GBFS API](https://gbfs.nextbike.net) to sync
Velhop station information and real-time status into the Parcus Plus platform.

## External API

| Resource            | GBFS Endpoint                      | Auth |
| ------------------- | ---------------------------------- | ---- |
| Station Information | `GET /fr/station_information.json` | None |
| Station Status      | `GET /fr/station_status.json`      | None |

Configure via env:

- `VELHOP_API_BASE_URL` (default: `https://gbfs.nextbike.net/maps/gbfs/v2/nextbike_ae`)

## Module Structure

```
velhop/
├── velhop.module.ts           # NestJS module — provides VelhopService + VelhopMapper
├── velhop.service.ts           # Business logic: merge station info + status
├── velhop.repository.ts        # Drizzle reads/writes via TransactionHost
├── velhop.mapper.ts            # @Injectable() class: toStationDto()
├── velhop.mapper.spec.ts       # Mapper unit tests
├── velhop.config.ts            # Config via @nestjs/config registerAs('velhop')
├── velhop.constants.ts         # Queue name, job names, span names
├── velhop-client.service.ts    # HTTP calls to GBFS API (resilience-wrapped)
├── velhop.processor.ts         # BullMQ processor (WorkerHost)
├── velhop.processor.spec.ts    # Processor unit tests
├── velhop-scheduler.service.ts # Cron trigger for periodic syncs
├── velhop.service.spec.ts      # Service unit tests
├── velhop.repository.spec.ts   # Repository unit tests
└── schemas/
    └── db-velhop-station.ts    # Drizzle schema for velhop_stations table
```

## Resilience

Uses the shared `DEFAULT_CIRCUIT_BREAKER` and `DEFAULT_RETRY` from
`@/shared/resilience/resilience.constants`. The `VelhopClientService` creates
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

Served by `VelhopController` under `modules/public/velhop/`.

| Method | Path                      | Version | Auth                            | Description                       |
| ------ | ------------------------- | ------- | ------------------------------- | --------------------------------- |
| GET    | `/api/v1/velhop/stations` | v1      | Bearer token (guest-restricted) | List all stations (no pagination) |

**No server-side pagination yet** — the endpoint returns all stations in a
single flat list. The Gherkin spec reflects this.

## Specifications

| Layer          | Location                                                                         |
| -------------- | -------------------------------------------------------------------------------- |
| OpenAPI/Scalar | `@ApiTags('Velhop')` on controller; tag registered in `swagger.ts` `x-tagGroups` |
| Bruno          | `tools/bruno/📱 Application/Mobility/Velhop/`                                    |
| Gherkin        | `apps/api/features/velhop.feature`                                               |

## Data Flow

```
Scheduler (cron) → Processor (BullMQ job) → VelhopService
                                               ├── VelhopClientService (HTTP → GBFS API)
                                               │     ├── fetchStationInformation()
                                               │     └── fetchStationStatus()
                                               └── VelhopRepository (Drizzle → PostgreSQL)
                                           PublicController
                                               └── VelhopMapper.toStationDto()
```

## Testing

Run Velhop-specific tests:

```bash
pnpm --filter @parcus/api test -- --testPathPattern='velhop|Velhop'
```

# Shared Resilience Module

Provides circuit-breaker + retry policies via `cockatiel` with OpenTelemetry
metrics emission. All external API modules (CTS, Velhop, Nexterite, Eovia, etc.)
use this module.

## Files

```
shared/resilience/
├── resilience.module.ts        # @Global() NestJS module
├── resilience.service.ts       # createPolicy() wrapper around cockatiel
├── resilience.service.spec.ts  # Unit tests for policy behavior
├── resilience.decorator.ts     # @UseResilience() decorator for method-level policies
├── resilience.constants.ts     # Shared defaults — env-configurable
├── resilience.constants.spec.ts # Unit tests for env-var parsing
└── README.md
```

## Env-Configurable Defaults

The shared defaults in `resilience.constants.ts` can be overridden per
deployment via environment variables, so ops can tune thresholds without
a code change.

| Env Variable                           | Default | Description                                   |
| -------------------------------------- | ------- | --------------------------------------------- |
| `RESILIENCE_CB_FAILURE_THRESHOLD`      | 3       | Consecutive failures to open the circuit      |
| `RESILIENCE_CB_OPEN_DURATION_MS`       | 60 000  | Time circuit stays open before half-open (ms) |
| `RESILIENCE_CB_HALF_OPEN_MAX_ATTEMPTS` | 1       | Max probe attempts in half-open state         |
| `RESILIENCE_RETRY_MAX_ATTEMPTS`        | 3       | Max retry attempts per operation              |
| `RESILIENCE_RETRY_DELAY_MS`            | 2 000   | Initial backoff delay (doubled each attempt)  |

Non-numeric values are silently ignored (fallback to default). Values ≤ 0 are
floored to 1 to prevent infinite loops (e.g. `RESILIENCE_CB_FAILURE_THRESHOLD=0` → 1).

## Usage in Module Configs

```typescript
import {
  DEFAULT_CIRCUIT_BREAKER,
  DEFAULT_RETRY,
} from '@/shared/resilience/resilience.constants';

export default registerAs(
  'my-service',
  (): MyConfig => ({
    resilience: {
      circuitBreaker: {
        failureThreshold: DEFAULT_CIRCUIT_BREAKER.failureThreshold,
        openDuration: DEFAULT_CIRCUIT_BREAKER.openDuration,
      },
      retry: {
        maxAttempts: DEFAULT_RETRY.maxAttempts,
        delay: DEFAULT_RETRY.delay,
      },
    },
  }),
);
```

## Usage in Client Services

```typescript
import { DEFAULT_CIRCUIT_BREAKER } from '@/shared/resilience/resilience.constants';

onModuleInit(): void {
  this.policy = this.resilience.createPolicy('my-service', {
    circuitBreaker: {
      failureThreshold: config.resilience.circuitBreaker.failureThreshold,
      openDuration: config.resilience.circuitBreaker.openDuration,
      halfOpenMaxAttempts: DEFAULT_CIRCUIT_BREAKER.halfOpenMaxAttempts,
    },
    retry: {
      maxAttempts: config.resilience.retry.maxAttempts,
      delay: config.resilience.retry.delay,
    },
  });
}
```

## Per-Module Overrides

Some modules need different thresholds. Add a module-specific constant that
only overrides what differs:

```typescript
// eovia.constants.ts
export const EOVIA_RESILIENCE: UseResilienceOptions = {
  serviceName: 'Eovia',
  circuitBreaker: {
    failureThreshold: 5, // override
    openDuration: DEFAULT_CIRCUIT_BREAKER.openDuration, // shared
    halfOpenMaxAttempts: DEFAULT_CIRCUIT_BREAKER.halfOpenMaxAttempts, // shared
  },
  retry: {
    maxAttempts: DEFAULT_RETRY.maxAttempts, // shared
    delay: 1_000, // override
  },
};
```

## Key Principles

1. **Create policies once in `onModuleInit()`** — never per-call (the circuit
   breaker loses state).
2. **Use shared defaults** unless the external service explicitly requires
   different thresholds.
3. **`@UseResilience()` decorator** for method-level policies on services
   that don't use `ResilienceService` directly (e.g. Nexterite, Eovia).

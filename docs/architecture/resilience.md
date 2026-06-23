# Resilience

Any call that can fail or hang — external HTTP, payment providers, SFTP, message
brokers — is wrapped in resilience policies. Implementation:
`resilience-observability-patterns` skill.

## Policies

- **Timeout** — never wait forever on I/O. Every external call has a deadline.
- **Retry** — transient failures retried with backoff (+ jitter). Cap attempts.
  Only retry idempotent operations.
- **Circuit breaker** — after N consecutive failures, open the circuit and fail
  fast; half-open to probe recovery. Protects the callee and your latency.
- **Bulkhead** — isolate pools so one slow dependency can't exhaust everything.
- **Fallback** — a defined degraded behavior when the circuit is open, where one
  exists.

## Rules (the ones agents get wrong)

- **Create policies once**, in `onModuleInit()` (or module setup), then reuse —
  never a fresh breaker per call (a per-call breaker never trips).
- **Share defaults** in a `resilience.constants.ts`: `DEFAULT_CIRCUIT_BREAKER`,
  `DEFAULT_RETRY`, env-configurable (`RESILIENCE_CB_*`, `RESILIENCE_RETRY_*`) with
  **NaN-safe parsing** and a floor of 1 on `≤ 0`.
- **Override, don't fork.** A module needing different thresholds defines its own
  constant that inherits the shared default and overrides only what differs.
- **Document the values** and their source in the module README (shared vs.
  override) — see [guidelines/documentation.md](../guidelines/documentation.md).
- Pair every policy with a span and a log so you can see it work — see
  [observability.md](observability.md).

Reference example: [`knowledge/examples/module-readme.resilience.example.md`](../../knowledge/examples/module-readme.resilience.example.md)
and the `resilience-policy-pattern` instinct in
[`knowledge/instincts/`](../../knowledge/instincts/).

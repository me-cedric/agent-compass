# Observability

You can't operate what you can't see. Three pillars, wired from day one.

## Tracing (OpenTelemetry)

- Spans around meaningful operations: requests, jobs, external calls, payments.
- Use helper wrappers so spans are consistent and hard to forget —
  `withJobSpan()` for queue work, `withPaymentSpan()` for payment ops, etc.
- Keep span names in a dedicated `<feature>.constants.ts`, not inline strings.
- Propagate context across async boundaries (queues, HTTP).

## Logging

- Use the project's structured logger (e.g. an `OtelLogger`), **not** the
  framework default, so logs correlate with traces.
- Set the log context once in the constructor (`setContext()`).
- Structured fields over string interpolation. Never log secrets or PII.

## Metrics

- Counters/histograms for throughput, latency, error rate, queue depth.
- Alert on SLOs (error budget), not on every blip.

## For agents

When you add an external call, a processor, or a payment step, add the span and a
log in the same change. A new module's README documents its data-flow so the
trace shape is predictable. Implementation lives in the
`resilience-observability-patterns` and `bullmq-patterns` skills.

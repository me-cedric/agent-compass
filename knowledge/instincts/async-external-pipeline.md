---
id: async-external-pipeline
trigger: 'when building an async pipeline around an external provider, worker, transcription, import, export, AI, media, or batch job'
confidence: 0.9
domain: resilience
source: local-repo-analysis
---

# Make external pipelines replaceable, bounded, and recoverable

For async work that calls outside systems, build the smallest pipeline that can
survive slow providers, retries, and worker restarts.

## Provider shape

- Keep business code behind a provider abstraction.
- Default local/dev to a mock or offline provider.
- Gate live providers with env validation and fail closed when required secrets
  or host tools are missing.

## Runtime bounds

- Put per-request timeouts on every external call.
- Wrap external calls in retry/circuit-breaker policy; only retry idempotent
  work.
- Stream large payloads instead of buffering whole files where practical.
- Keep raw sensitive data only as long as needed; delete or mark it erased with
  an auditable state change.

## Worker shape

- Keep long work out of the HTTP request path.
- Let deployments split roles: `api` handles HTTP, `worker` consumes queues,
  `all` is acceptable for local dev.
- Use a concurrency env var per worker and scale with worker replicas after
  that.

## State transitions

- Use explicit states (`queued`, `processing`, `available`, `failed`,
  `deleted`) and compare-and-swap updates so duplicate workers cannot corrupt
  progress.
- Mark failed only after the last retry.
- Add a stale-processing sweep that moves abandoned jobs to `failed` or back to
  `queued`, with audit/log evidence.

## Tests

Cover timeout, provider unavailable, last-attempt failure, duplicate worker
transition, and stale-job recovery. These tests catch most production pipeline
breakage.

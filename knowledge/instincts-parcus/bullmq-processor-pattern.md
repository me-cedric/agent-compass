---
id: parcus-bullmq-processor
trigger: 'when creating a BullMQ processor or background job'
confidence: 0.95
domain: queue
source: local-repo-analysis
---

# BullMQ Processor Pattern with OpenTelemetry Tracing

## Action

Processors must:

1. Extend `WorkerHost` from `@nestjs/bullmq`
2. Use `@Processor(QUEUE_NAME_CONSTANT)` — use the **queue name constant**, never the job ID
3. Wrap all work in `withJobSpan()` for OpenTelemetry tracing
4. Define constants in a `<feature>.constants.ts` file

```typescript
@Injectable()
@Processor(FOO_QUEUE_NAME, { concurrency: 1 })
export class FooProcessor extends WorkerHost {
  constructor(
    private readonly logger: OtelLogger,
    private readonly metricsService: MetricsService,
  ) {
    super();
    this.logger.setContext(FooProcessor.name);
  }

  async process(job: Job): Promise<void> {
    await withJobSpan(
      job,
      FooSpanName.PROCESS,
      this.metricsService,
      async () => {
        // actual work here
      },
    );
  }
}
```

Constants file pattern:

```typescript
export const FOO_QUEUE_NAME = 'foo-queue' as const;
export const FooJobName = { PROCESS: 'process-foo' } as const;
export const FooJobId = { PROCESS_JOB: 'process-foo-job' } as const;
export const FooSpanName = { PROCESS: 'foo.process' } as const;
```

## Evidence

- 3 processors all follow this pattern
- Known bug: using job ID constant instead of queue name constant for `@InjectQueue()` causes silent failures
- All processors use `withJobSpan()` from `@/shared/queue/job-span`

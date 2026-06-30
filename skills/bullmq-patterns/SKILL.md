---
name: bullmq-patterns
description: BullMQ queue processing patterns for NestJS — processors, schedulers, job spans, tracing, deduplication, and delayed jobs
version: 1.0.0
filePattern: "**/*.processor.ts,**/*-scheduler*.ts,**/queue/**,**/*.constants.ts"
bashPattern: "bull|queue|redis"
risk_level: medium
writes_files: false
requires_tools: []
---

# BullMQ + NestJS Queue Processing Patterns

## Module Setup

```ts
// feature.module.ts
@Module({
  imports: [
    BullModule.registerQueue({
      name: FEATURE_QUEUE_NAME,
      defaultJobOptions: {
        removeOnComplete: false,  // Keep completed jobs for debugging
        removeOnFail: false,      // Keep failed jobs for retry/analysis
      },
    }),
    // ... other imports
  ],
  providers: [FeatureProcessor, FeatureSchedulerService],
  exports: [BullModule], // Export so other modules can enqueue jobs
})
export class FeatureModule {}
```

**AppModule BullMQ root config:**
```ts
BullModule.forRoot({
  connection: {
    host: process.env.REDIS_HOST,
    port: parseInt(process.env.REDIS_PORT ?? '6379'),
    password: process.env.REDIS_PASSWORD,
  },
  defaultJobOptions: {
    removeOnComplete: false,
    removeOnFail: false,
  },
})
```

## Processor Pattern (WorkerHost)

```ts
@Injectable()
@Processor(FEATURE_QUEUE_NAME, { concurrency: 1 })
export class FeatureProcessor extends WorkerHost {
  constructor(
    private readonly service: FeatureService,
    private readonly logger: OtelLogger,      // Or Logger from @nestjs/common
    private readonly metricsService: MetricsService,
  ) {
    super();
    this.logger.setContext(FeatureProcessor.name);
  }

  async process(job: Job<FeatureJobData>): Promise<void> {
    await withJobSpan(
      job,
      FeatureSpanName.PROCESS,
      this.metricsService,
      async () => {
        const { userId, featureId } = job.data;
        this.logger.log(`Processing feature ${featureId} for user ${userId}`);

        // Business logic here
        await this.service.processFeature(featureId, userId);
      },
    );
  }
}
```

**Key rules:**
- Always extend `WorkerHost` from `@nestjs/bullmq`
- Always wrap `process()` body in `withJobSpan()` for OpenTelemetry tracing
- Set concurrency explicitly (`{ concurrency: 1 }` for sequential, higher for parallel)
- Use typed `Job<DataType>` for type-safe job data
- Call `this.logger.setContext()` in constructor

## Type-Safe Job Data

```ts
// feature.constants.ts
export type FeatureJobData = {
  featureId: string;
  userId: string;
  amountInMinor: number;
  metadata?: Record<string, unknown>;
};

// In processor
async process(job: Job<FeatureJobData>): Promise<void> {
  const { featureId, userId, amountInMinor } = job.data;
}
```

## Constants Pattern

```ts
// feature.constants.ts

// Queue name — used in BullModule.registerQueue + @InjectQueue
export const FEATURE_QUEUE_NAME = 'feature-processing' as const;

// Job names — used when enqueuing (descriptive, for Bull Board UI)
export const FeatureJobName = {
  PROCESS: 'process-feature',
  CLEANUP: 'cleanup-expired',
} as const;

// Job IDs — for deduplication at enqueue time
export const FeatureJobId = {
  PROCESS: 'process-feature-job',
  CLEANUP: 'cleanup-expired-job',
} as const;

// OTel span names — dot-notation for tracing hierarchy
export const FeatureSpanName = {
  PROCESS: 'feature.process',
  CLEANUP: 'feature.cleanup',
} as const;
```

**CRITICAL:** `@InjectQueue` and `BullModule.registerQueue` must use the **queue name** constant (`FEATURE_QUEUE_NAME`), never a job-ID or job-name constant. These are different things:
- Queue name = the Redis queue identifier
- Job name = human-readable label for the job type
- Job ID = deduplication key

## Enqueuing Jobs

```ts
@Injectable()
export class PaymentService {
  constructor(
    @InjectQueue(FEATURE_QUEUE_NAME) private readonly featureQueue: Queue,
    private readonly bullMQService: BullMQService,
  ) {}

  async afterPayment(payment: Payment) {
    // Standard job
    await this.bullMQService.addJob(
      this.featureQueue,
      FeatureJobName.PROCESS,
      { featureId: payment.featureId, userId: payment.userId },
      { jobId: payment.reference, attempts: 3 },
    );

    // Delayed job (execute after N ms)
    await this.bullMQService.addDelayedJob(
      this.featureQueue,
      FeatureJobName.CLEANUP,
      { featureId: payment.featureId },
      { delay: 3_600_000 }, // 1 hour
    );
  }
}
```

## BullMQ Service (Trace Context Propagation)

```ts
@Injectable()
export class BullMQService {
  async addJob<T>(queue: Queue, name: string, data: T, opts?: JobsOptions) {
    // Capture current OTel trace context and inject into job data
    const context = this.captureTraceContext();
    await queue.add(name, { ...data, __otelContext: context }, opts);
  }

  async addUniqueCronJob<T>(queue: Queue, name: string, data: T, jobId: string) {
    const uniqueId = `cron-${jobId}-${Date.now()}`;
    await this.addJob(queue, name, data, { jobId: uniqueId });
  }
}
```

This makes processor spans children of the enqueuing request span in distributed traces.

## Scheduler Pattern (Cron)

```ts
@Injectable()
export class FeatureSchedulerService {
  constructor(
    @InjectQueue(FEATURE_QUEUE_NAME) private readonly queue: Queue,
    private readonly bullMQService: BullMQService,
  ) {}

  @Cron(CronExpression.EVERY_30_MINUTES)
  async triggerPeriodicProcess() {
    await this.bullMQService.addUniqueCronJob(
      this.queue,
      FeatureJobName.PROCESS,
      {},
      FeatureJobId.PROCESS,
    );
  }

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async triggerDailyCleanup() {
    await this.bullMQService.addUniqueCronJob(
      this.queue,
      FeatureJobName.CLEANUP,
      {},
      FeatureJobId.CLEANUP,
    );
  }
}
```

**Key:** Use `addUniqueCronJob` which generates timestamp-based jobIds to prevent duplicates within the same cron cycle.

## withJobSpan (OTel Tracing)

```ts
async function withJobSpan<T>(
  job: Job,
  spanName: string,
  metricsService: MetricsService,
  fn: () => Promise<T>,
): Promise<T> {
  // 1. Extract OTel context from job.data.__otelContext
  // 2. Create child span with job metadata (id, name, queueName)
  // 3. Execute fn() within span context
  // 4. Record success/failure metrics
  // 5. Set span status + exception on error
  return result;
}
```

This ensures:
- Distributed trace continuity (HTTP request -> queue -> processor)
- Automatic error recording in traces
- Job duration metrics

## Bull Board Integration

```ts
// bootstrap function
export function setupBullBoard(app: NestFastifyApplication) {
  const serverAdapter = new FastifyAdapter();
  createBullBoard({
    queues: [
      new BullMQAdapter(app.get(getQueueToken(FEATURE_QUEUE_NAME))),
      new BullMQAdapter(app.get(getQueueToken(OTHER_QUEUE_NAME))),
    ],
    serverAdapter,
  });
  serverAdapter.setBasePath('/api/queues');
  app.register(serverAdapter.registerPlugin(), { prefix: '/api/queues' });
}
```

## Idempotency

```ts
// In processor
async process(job: Job<LoyaltyJobData>): Promise<void> {
  await withJobSpan(job, spanName, this.metrics, async () => {
    // Check if already processed (idempotency)
    const exists = await this.repo.hasEntry(job.data.referenceId);
    if (exists) {
      this.logger.warn(`Duplicate job for reference ${job.data.referenceId}, skipping`);
      return;
    }
    // Process...
  });
}
```

## Error Handling

- Failed jobs stay in the queue (`removeOnFail: false`) for manual inspection
- Use `attempts` option for automatic retries: `{ attempts: 3, backoff: { type: 'exponential', delay: 5000 } }`
- Log errors with context before re-throwing
- Never silently swallow errors in processors

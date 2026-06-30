---
name: resilience-observability-patterns
description: Resilience (circuit breaker, retry) and observability (OpenTelemetry tracing, metrics, structured logging) patterns for NestJS production APIs
version: 1.0.0
filePattern: "**/resilience/**,**/tracing/**,**/metrics*,**/otel*,**/*logger*"
bashPattern: "otel|opentelemetry|circuit|resilience|metrics"
risk_level: medium
writes_files: false
requires_tools: []
---

# Resilience & Observability Patterns

## Circuit Breaker + Retry (Cockatiel)

### ResilienceService (Global)

```ts
@Global()
@Module({ providers: [ResilienceService], exports: [ResilienceService] })
export class ResilienceModule {}

@Injectable()
export class ResilienceService {
  createPolicy(name: string, options: ResilienceOptions): ResiliencePolicy {
    const breaker = new ConsecutiveBreaker(options.circuitBreaker.failureThreshold);
    const circuitBreaker = new CircuitBreakerPolicy({
      breaker,
      halfOpenAfter: options.circuitBreaker.openDuration,
    });

    const retry = new RetryPolicy({
      maxAttempts: options.retry.maxAttempts,
      backoff: new ExponentialBackoff({ initialDelay: options.retry.delay }),
    });

    // Wrap retry around circuit breaker
    const policy = Policy.wrap(retry, circuitBreaker);

    // Record state changes for metrics
    circuitBreaker.onStateChange((state) => {
      this.metrics.recordCircuitBreakerStateChange(name, state);
    });

    return { execute: (fn) => policy.execute(fn) };
  }
}
```

### Usage Pattern (CRITICAL: Create Once in OnModuleInit)

```ts
@Injectable()
export class ExternalApiService implements OnModuleInit {
  private policy!: ResiliencePolicy;

  constructor(private readonly resilience: ResilienceService) {}

  onModuleInit(): void {
    // Create ONCE — not per-call
    this.policy = this.resilience.createPolicy('external-api', {
      circuitBreaker: {
        failureThreshold: 3,      // Open after 3 consecutive failures
        openDuration: 60_000,     // Stay open for 60s
        halfOpenMaxAttempts: 1,   // Allow 1 test request in half-open
      },
      retry: {
        maxAttempts: 3,           // Retry up to 3 times
        delay: 2_000,            // 2s initial backoff (exponential)
      },
    });
  }

  async fetchData(): Promise<Data> {
    return this.policy.execute(() => this.httpClient.get('/data'));
  }
}
```

**Why OnModuleInit:** Creating a new policy per call resets the circuit breaker state, defeating its purpose. The breaker needs to accumulate failure counts across calls.

### Decorator Alternative (@UseResilience)

```ts
@UseResilience({
  circuitBreaker: { failureThreshold: 5, openDuration: 30_000 },
  retry: { maxAttempts: 2, delay: 1_000 },
})
async fetchExternalData(): Promise<Data> {
  return this.httpClient.get('/external');
}
```

The decorator caches policies by `serviceName:methodName`, handles `BrokenCircuitError` -> 503, Axios errors -> upstream status, unknown -> 502.

### Error Handling

```ts
try {
  return await this.policy.execute(() => this.api.call());
} catch (error) {
  if (error instanceof BrokenCircuitError) {
    throw new ServiceUnavailableException('Service temporarily unavailable');
  }
  throw error;
}
```

---

## OpenTelemetry Setup

### SDK Initialization (MUST be first import)

```ts
// tracing.ts — loaded before NestJS bootstrap
import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';

const sdk = new NodeSDK({
  serviceName: 'my-api',
  traceExporter: new OTLPTraceExporter({ url: `${OTEL_ENDPOINT}/v1/traces` }),
  metricReader: new PeriodicExportingMetricReader({
    exporter: new OTLPMetricExporter({ url: `${OTEL_ENDPOINT}/v1/metrics` }),
    exportIntervalMillis: 30_000,
  }),
  instrumentations: [
    getNodeAutoInstrumentations({
      '@opentelemetry/instrumentation-fs': { enabled: false },
      '@opentelemetry/instrumentation-http': { enabled: true },
      '@opentelemetry/instrumentation-pg': {
        enabled: true,
        enhancedDatabaseReporting: true,
      },
    }),
  ],
  sampler: process.env.NODE_ENV === 'production'
    ? new TraceIdRatioBasedSampler(0.5) // 50% in prod
    : new AlwaysOnSampler(),            // 100% in dev
});

sdk.start();
```

**In main.ts:**
```ts
// FIRST LINE — before any NestJS imports
import './tracing/tracing';
import { config } from 'dotenv';
config();
// ... then NestJS bootstrap
```

### OtelLogger (Trace-Correlated Logging)

```ts
@Injectable({ scope: Scope.TRANSIENT })
export class OtelLogger {
  private context = 'App';
  private otelLogger: OtelLoggerApi;

  constructor() {
    this.otelLogger = logs.getLogger('app-logger');
  }

  setContext(name: string) { this.context = name; }

  log(message: string, ...args: unknown[]) {
    this.emit(SeverityNumber.INFO, message);
    // Also log to console for local dev
    console.log(`[${this.context}] ${message}`, ...args);
  }

  error(message: string, trace?: string) {
    this.emit(SeverityNumber.ERROR, message);
    // Add error event to active span
    const span = trace_api.getActiveSpan();
    span?.addEvent('error', { message, stack: trace });
  }

  private emit(severity: SeverityNumber, message: string) {
    const span = trace_api.getActiveSpan();
    this.otelLogger.emit({
      severityNumber: severity,
      body: message,
      attributes: {
        context: this.context,
        ...(span ? { traceId: span.spanContext().traceId } : {}),
      },
    });
  }
}
```

**When to use which logger:**
- `OtelLogger` — processors, services calling external APIs, anything needing trace correlation
- `Logger` from `@nestjs/common` — simple services, guards, pipes (no trace context needed)

### MetricsService

```ts
@Injectable()
export class MetricsService {
  private httpRequestCounter: Counter;
  private httpDurationHistogram: Histogram;
  private paymentCounter: Counter;
  private jobDurationHistogram: Histogram;

  constructor() {
    const meter = metrics.getMeter('app-metrics');

    this.httpRequestCounter = meter.createCounter('http.requests', {
      description: 'Total HTTP requests',
    });
    this.httpDurationHistogram = meter.createHistogram('http.request.duration', {
      description: 'HTTP request duration in ms',
      unit: 'ms',
    });
    this.paymentCounter = meter.createCounter('payments.processed');
    this.jobDurationHistogram = meter.createHistogram('bullmq.job.duration', {
      unit: 'ms',
    });
  }

  recordHttpRequest(method: string, path: string, status: number, durationMs: number) {
    this.httpRequestCounter.add(1, { method, path, status });
    this.httpDurationHistogram.record(durationMs, { method, path, status });
  }

  recordJobCompleted(queueName: string, jobName: string, durationMs: number, success: boolean) {
    this.jobDurationHistogram.record(durationMs, { queue: queueName, job: jobName, success });
  }
}
```

### Custom Spans

```ts
import { trace } from '@opentelemetry/api';

const tracer = trace.getTracer('feature-tracer');

async function doWork() {
  return tracer.startActiveSpan('feature.do-work', async (span) => {
    try {
      span.setAttribute('feature.id', featureId);
      const result = await heavyOperation();
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (error) {
      span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
      span.recordException(error);
      throw error;
    } finally {
      span.end();
    }
  });
}
```

### withJobSpan (Queue Trace Propagation)

```ts
// Captures OTel context at enqueue time
async addJob(queue, name, data, opts) {
  const context = propagation.inject({}, defaultTextMapSetter);
  await queue.add(name, { ...data, __otelContext: context }, opts);
}

// Restores context in processor
async function withJobSpan(job, spanName, metrics, fn) {
  const parentContext = propagation.extract(context.active(), job.data.__otelContext);
  return context.with(parentContext, () =>
    tracer.startActiveSpan(spanName, { attributes: { 'job.id': job.id } }, async (span) => {
      try {
        const result = await fn();
        metrics.recordJobCompleted(job.queueName, job.name, duration, true);
        return result;
      } catch (error) {
        metrics.recordJobCompleted(job.queueName, job.name, duration, false);
        span.recordException(error);
        throw error;
      } finally {
        span.end();
      }
    }),
  );
}
```

This creates a continuous trace: `HTTP request` -> `queue.add` -> `processor.process` -> `service.action`.

---

## Naming Conventions

| Metric/Span | Pattern | Example |
|---|---|---|
| HTTP counter | `http.requests` | `http.requests{method=GET, path=/api/v1/features}` |
| HTTP histogram | `http.request.duration` | Duration in ms |
| Business counter | `{domain}.{action}` | `payments.processed`, `users.registered` |
| Job histogram | `bullmq.job.duration` | `{queue=feature, job=process}` |
| Span name | `{module}.{operation}` | `resources.update-availability` |
| Circuit breaker | `resilience.circuit_breaker.state` | `{name=external-api, state=OPEN}` |

## TracingModule Registration

```ts
@Global()
@Module({
  providers: [OtelLogger, MetricsService],
  exports: [OtelLogger, MetricsService],
})
export class TracingModule {}
```

Registered in AppModule imports — available globally without per-module imports.

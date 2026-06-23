---
id: <project>-otel-logger
trigger: 'when adding logging to a NestJS service'
confidence: 0.85
domain: observability
source: local-repo-analysis
---

# Use OtelLogger with setContext in Constructor

## Action

Always use `OtelLogger` (not NestJS `Logger`) and call `setContext()` in the constructor:

```typescript
import { OtelLogger } from '@/tracing/logger';

@Injectable()
export class FooService {
  constructor(private readonly logger: OtelLogger) {
    this.logger.setContext(FooService.name);
  }
}
```

Methods: `this.logger.log()`, `this.logger.warn()`, `this.logger.error()`, `this.logger.debug()`.

For errors, pass the stack trace: `this.logger.error('message', err.stack)`.

## Evidence

- All services and processors use `OtelLogger`
- Context is always set to the class name for structured log filtering

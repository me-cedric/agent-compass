---
id: <project>-resilience-policy
trigger: 'when adding circuit-breaker, retry, or resilience to external calls'
confidence: 0.9
domain: resilience
source: local-repo-analysis
---

# Create Resilience Policies Once in onModuleInit

## Action

When wrapping external calls with circuit-breaker + retry:

1. Inject `ResilienceService` (it's `@Global()`, no module import needed)
2. Create the policy in `onModuleInit()` — **never per-call** (or the circuit-breaker loses state)
3. Store as a private field and reuse

```typescript
@Injectable()
export class FooService implements OnModuleInit {
  private policy!: ResiliencePolicy;

  constructor(private readonly resilience: ResilienceService) {}

  onModuleInit(): void {
    this.policy = this.resilience.createPolicy('foo-service', {
      circuitBreaker: {
        failureThreshold: 3,
        openDuration: 60_000,
        halfOpenMaxAttempts: 1,
      },
      retry: { maxAttempts: 3, delay: 2_000 },
    });
  }

  async callExternal(): Promise<Result> {
    return this.policy.execute(() => this.externalApi.call());
  }
}
```

The resilience library is `cockatiel`. `ResilienceService` wraps it with metrics emission.

## Evidence

- `GlobexService` uses this pattern for SFTP calls
- Known bug: creating policy per-call resets circuit-breaker state every invocation

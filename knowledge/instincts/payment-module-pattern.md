---
id: <project>-payment-module
trigger: 'when adding payment logic, a new payment provider, or a financial service'
confidence: 0.9
domain: payment
source: local-repo-analysis
---

# Payment Module — Pure Helpers + Service + Tracing

## Action

Payment services follow three rules:

1. **Pure helpers above the class** — stateless formatting/generation functions declared before the `@Injectable()` class:

```typescript
// ── Pure helpers (no side effects) ────────────────────────────────────

function generateReference(): string {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const rand = crypto.randomUUID().substring(0, 8).toUpperCase();
  return `<project>-${date}-${rand}`;
}

function formatAmount(cents: number, currency = 'EUR'): string {
  return `${(cents / 100).toFixed(2)}${currency}`;
}

// ── Service ────────────────────────────────────────────────────────────
@Injectable()
export class <project>PaymentService { ... }
```

2. **External providers isolated** under `modules/external/payment/<provider>/`:
   - `paygate/paygate-payment.service.ts` — initiation
   - `paygate/paygate-capture.service.ts` — capture
   - `paygate/paygate.module.ts`

3. **Tracing via `withPaymentSpan()`** — wraps each operation for OTel, same pattern as `withJobSpan()`.

4. **`@Transactional()`** on methods that span multiple repo writes.

## Evidence

- `<project>-payment.service.ts` changed 7 times in 200 commits
- Paygate provider split across `paygate-payment.service.ts` + `paygate-capture.service.ts`
- Pure helpers pattern visible in current `<project>-payment.service.ts`

---
id: parcus-drizzle-repository
trigger: 'when writing a repository class or data access layer'
confidence: 0.9
domain: database
source: local-repo-analysis
---

# Use TransactionHost with Drizzle ORM for Repositories

## Action

Repositories must inject `TransactionHost<DbTransactionAdapter>` and use `this.txHost.tx` for all queries:

```typescript
import { TransactionHost } from '@nestjs-cls/transactional';
import { Injectable } from '@nestjs/common';
import { type DbTransactionAdapter } from '../../database';

@Injectable()
export class FooRepository {
  constructor(private readonly txHost: TransactionHost<DbTransactionAdapter>) {}

  async findOne(id: string) {
    return this.txHost.tx.query.foos.findFirst({
      where: eq(foos.id, id),
    });
  }
}
```

Never create a raw Drizzle client directly. The transaction host provides automatic CLS-based transaction scoping via `@Transactional()` decorators on service methods.

## Evidence

- 9 repository classes all use this pattern
- `@Transactional()` decorator from `@nestjs-cls/transactional` used on service methods

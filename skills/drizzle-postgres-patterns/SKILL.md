---
name: drizzle-postgres-patterns
description: Drizzle ORM + PostgreSQL patterns — schema definition, migrations, transactions, seeding, views, enums, indexes, and type inference
version: 1.0.0
filePattern: "**/*.schema.ts,**/drizzle/**,**/drizzle.config.ts,**/seed*.ts,**/database/**"
---

# Drizzle ORM + PostgreSQL Patterns

## Schema Definition

All schema lives in a single file (e.g., `src/database/postgres.schema.ts`):

```ts
import { pgTable, text, integer, boolean, timestamp, jsonb, real, pgEnum, uniqueIndex, index } from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';
import { createId } from '@paralleldrive/cuid2';

// Enums from shared constants
export const statusEnum = pgEnum('status', ['active', 'inactive', 'archived']);

// Tables
export const features = pgTable('features', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  name: text('name').notNull(),
  status: statusEnum('status').notNull().default('active'),
  metadata: jsonb('metadata'),
  score: real('score'),
  isPublic: boolean('is_public').notNull().default(false),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (table) => [
  index('idx_features_user_id').on(table.userId),
  index('idx_features_status_created').on(table.status, table.createdAt),
  uniqueIndex('idx_features_name_unique').on(table.name),
]);

// Relations
export const featuresRelations = relations(features, ({ one, many }) => ({
  user: one(users, { fields: [features.userId], references: [users.id] }),
  items: many(featureItems),
}));
```

**Conventions:**
- **IDs**: CUID v2 via `@paralleldrive/cuid2` (not UUID)
- **Timestamps**: Always `{ withTimezone: true }`, `createdAt` with `defaultNow()`, `updatedAt` with `$onUpdate`
- **Casing**: Define in `drizzle.config.ts` as `casing: 'snake_case'` (TypeScript camelCase auto-maps to SQL snake_case)
- **Enums**: Derive from shared-types const arrays: `pgEnum('name', SHARED_ARRAY)`
- **Foreign keys**: Always specify `onDelete` behavior (`cascade`, `set null`, `restrict`)
- **Indexes**: Add for frequently queried columns, foreign keys, and composite conditions

## Drizzle Config

```ts
// config/drizzle.config.ts
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/database/postgres.schema.ts',
  dialect: 'postgresql',
  out: './drizzle/api',
  migrations: { schema: 'public' },
  casing: 'snake_case',
  entities: { roles: false }, // Skip role management if external (e.g., Keycloak)
  dbCredentials: { url: process.env.DATABASE_URL! },
});
```

## Migrations (CRITICAL)

**NEVER write migration SQL or edit meta snapshots manually.** Always use:

```bash
pnpm --filter @your/api db:generate
```

This generates:
1. Migration SQL file (e.g., `0006_stormy_ink.sql`)
2. Snapshot JSON in `meta/`
3. Updated `_journal.json`

**After schema changes:**
1. Rebuild shared-types if enum changes: `pnpm --filter @your/shared-types build`
2. Run `db:generate`
3. Review the generated SQL
4. Check seed files for compatibility with new columns (ensure defaults exist)

**Why:** The meta snapshot must stay in sync with the schema. Manual migrations lack the snapshot, causing drizzle-kit to lose track of state.

## Database Service

```ts
@Injectable()
export class DatabaseService implements OnModuleInit {
  private db: NodePgDatabase<typeof schema>;

  async onModuleInit() {
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    this.db = drizzle(pool, { schema, casing: 'snake_case' });
    // Test connection
    await this.db.execute(sql`SELECT 1`);
  }

  getClient() { return this.db; }
}
```

**Provider token pattern:**

```ts
export const DB_PROVIDER = Symbol('DB_PROVIDER');

export const databaseProvider: Provider = {
  provide: DB_PROVIDER,
  useFactory: (dbService: DatabaseService) => dbService.getClient(),
  inject: [DatabaseService],
};
```

## Transactional Pattern (@nestjs-cls/transactional)

```ts
// Module setup (AppModule)
ClsModule.forRoot({
  global: true,
  plugins: [
    new ClsPluginTransactional({
      imports: [DatabaseModule],
      adapter: new TransactionalAdapterDrizzleOrm({
        drizzleInstanceToken: DB_PROVIDER,
      }),
    }),
  ],
})

// Repository — transaction-aware
@Injectable()
export class FeatureRepository {
  constructor(private readonly txHost: TransactionHost<DbTransactionAdapter>) {}

  async create(data: InsertFeature) {
    return this.txHost.tx.insert(features).values(data).returning();
  }
}

// Service — declare transaction boundary
@Injectable()
export class FeatureService {
  @Transactional()
  async createWithItems(dto: CreateDto) {
    const feature = await this.repo.create(dto.feature);
    await this.itemRepo.createMany(dto.items.map(i => ({ ...i, featureId: feature.id })));
    return feature;
  }
}
```

**How it works:** `@Transactional()` opens a transaction. All repositories using `txHost.tx` within the same CLS context share that transaction. If the method throws, the transaction rolls back.

## Views

```ts
export const featureBalances = pgView('feature_balances').as((qb) =>
  qb
    .select({
      featureId: features.id,
      totalItems: sql<number>`count(${featureItems.id})::integer`.as('total_items'),
      totalValue: sql<number>`coalesce(sum(${featureItems.value}), 0)::integer`.as('total_value'),
    })
    .from(features)
    .leftJoin(featureItems, eq(featureItems.featureId, features.id))
    .groupBy(features.id),
);
```

**Migration note:** When adding columns to tables referenced by views, `db:generate` automatically handles DROP VIEW + recreate.

## Type Inference

```ts
// In schemas/db-feature.ts
export type SelectFeature = typeof features.$inferSelect;
export type InsertFeature = typeof features.$inferInsert;

// Partial for updates
export type UpdateFeature = Partial<InsertFeature>;

// Omit auto-generated fields
export type InsertFeatureData = Omit<InsertFeature, 'id' | 'createdAt' | 'updatedAt'>;
```

## Query Patterns

**Paginated with filters:**
```ts
const where = and(
  filter.name ? ilike(table.name, `%${filter.name}%`) : undefined,
  filter.status ? eq(table.status, filter.status) : undefined,
  filter.createdAfter ? gte(table.createdAt, filter.createdAfter) : undefined,
);
const total = await this.txHost.tx.$count(table, where);
const data = await this.txHost.tx
  .select()
  .from(table)
  .where(where)
  .limit(filter.limit)
  .offset(filter.offset)
  .orderBy(desc(table.createdAt));
return { total, data };
```

**Join with nullable relation:**
```ts
const rows = await this.txHost.tx
  .select({
    ...getTableColumns(features),
    alert: getTableColumns(alerts),
  })
  .from(features)
  .leftJoin(alerts, eq(alerts.featureId, features.id))
  .where(eq(features.id, id));
```

**Atomic increment:**
```ts
await this.txHost.tx
  .update(accounts)
  .set({
    balance: sql`${accounts.balance} + ${amount}`,
  })
  .where(eq(accounts.id, accountId));
```

**Bulk upsert:**
```ts
await this.txHost.tx
  .insert(availabilities)
  .values(updates)
  .onConflictDoUpdate({
    target: availabilities.featureId,
    set: {
      availability: sql`excluded.availability`,
      lastUpdated: new Date(),
    },
  });
```

## Seeding

```ts
// seed.ts
import { faker } from '@faker-js/faker';

async function seed(db: NodePgDatabase<typeof schema>) {
  // 1. Seed independent tables first
  const users = await db.insert(schema.users).values(
    Array.from({ length: 100 }, () => ({
      email: faker.internet.email(),
      firstName: faker.person.firstName(),
    }))
  ).returning();

  // 2. Then dependent tables
  await db.insert(schema.features).values(
    users.slice(0, 50).map(u => ({
      name: faker.commerce.productName(),
      userId: u.id,
    }))
  );
}
```

**After schema changes:** Always verify seed files include new required columns with valid defaults, or that the column has a DB-level default.

## Many-to-Many

```ts
export const usersFavoriteFeatures = pgTable('users_favorite_features', {
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  featureId: text('feature_id').notNull().references(() => features.id, { onDelete: 'cascade' }),
}, (table) => [
  { pk: primaryKey({ columns: [table.userId, table.featureId] }) },
]);
```

## Enum Pattern (Shared Types)

```ts
// packages/shared-types/src/types/feature.ts
export const FEATURE_STATUSES = ['active', 'inactive', 'archived'] as const;
export type FeatureStatus = (typeof FEATURE_STATUSES)[number];

// apps/api/src/database/postgres.schema.ts
import { FEATURE_STATUSES } from '@your/shared-types';
export const featureStatusEnum = pgEnum('feature_status', FEATURE_STATUSES);
```

This keeps enums in sync between API validation, database, and client apps.

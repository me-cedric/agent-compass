---
description: Drizzle ORM and PostgreSQL rules for schema, migrations, transactions, repositories, enums, views and seeds. Applies when you edit schema, migration, config, seed or repository files.
paths:
  - "**/*.schema.ts"
  - "**/schemas/**/*.ts"
  - "**/drizzle/**"
  - "**/drizzle.config.ts"
  - "**/seed*.ts"
  - "**/database/**/*.ts"
  - "**/*.repository.ts"
stacks: [drizzle-postgres]
---
# Drizzle rules

## Schema
- Keep all tables, enums, relations and views in one schema file.
- Set `casing: 'snake_case'` in `drizzle.config.ts` and in the client. Write camelCase in TypeScript.
- Generate IDs with `$defaultFn(() => createId())` from `@paralleldrive/cuid2`, unless the project uses another ID type.
- Give every timestamp `{ withTimezone: true }`. Give `createdAt` `defaultNow()` and `updatedAt` `$onUpdate(() => new Date())`.
- Set `onDelete` on every foreign key: `cascade`, `set null` or `restrict`.
- Index foreign keys, frequently filtered columns and composite filters. Name each index `idx_<table>_<columns>`.
- Build each `pgEnum` from an `as const` array in `shared-types`. API validation, database and clients then share one list.
- Infer row types with `$inferSelect` and `$inferInsert`. Do not hand-write row types.
- Define a join table with a composite `primaryKey` and `onDelete: 'cascade'` on both keys.
- Set `entities: { roles: false }` when another system manages database roles.

## Migrations
- Do not write migration SQL. Do not edit `meta/` snapshots or `_journal.json`. Run the project `db:generate` script.
- After a schema change that touches an enum, rebuild `shared-types` first.
- After `db:generate`, review the SQL. Then check the seed files.
- Give each new required column a database default, or update the seed in the same change.
- Let `db:generate` drop and recreate a view when its source table changes. Review that SQL.

## Repositories and transactions
- Inject `TransactionHost<DbTransactionAdapter>` in each repository. Run every query through `this.txHost.tx`.
- Do not create a raw Drizzle client in a repository.
- Mark a service method `@Transactional()` when its writes must be atomic. A throw rolls back every repository call inside it.
- Call `.returning()` on every insert and update.
- Read one row with `rows.at(0) ?? null`. Do not use `rows[0]`.
- Return a page as `{ total, data }`. Count with `$count(table, where)` and the same `where` as the query.
- Build filters with `and(cond ? predicate : undefined, ...)`.
- Increment in SQL: ``sql`${col} + ${n}` ``. Do not read, add in JavaScript and write back.
- Upsert in bulk with `onConflictDoUpdate` and `excluded.<column>`.
- Select a nullable relation with `getTableColumns()` and `leftJoin`.

## Client and seeds
- Create the pool and client once in a database service. Run `SELECT 1` in `onModuleInit`.
- Expose the client through one provider token. Wire it into the CLS transactional adapter.
- Read `DATABASE_URL` from the environment. Do not write a credential in code.
- Seed independent tables first, then dependent tables. Use `@faker-js/faker` for development data.

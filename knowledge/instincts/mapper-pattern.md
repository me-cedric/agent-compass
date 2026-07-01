---
id: <project>-mapper-pattern
trigger: 'when converting between database entities and API DTOs'
confidence: 0.9
domain: nestjs
source: local-repo-analysis
---

# Use Dedicated Mapper Classes for Entity <-> DTO Conversion

## Action

Create a dedicated `@Injectable()` mapper class with `toDto()`, `toInsert()`,
and `toUpdate()` methods. With Drizzle, type the signatures straight off the
table (`typeof table.$inferSelect` / `$inferInsert`) so the mapper breaks at
compile time when the schema changes:

```typescript
@Injectable()
export class FooMapper {
  toDto(entity: typeof foos.$inferSelect): FooDto {
    return { id: entity.id, name: entity.name };
  }

  toInsert(dto: CreateFooDto): typeof foos.$inferInsert {
    return { name: dto.name };
  }

  toUpdate(dto: UpdateFooDto): Partial<typeof foos.$inferInsert> {
    // Spread-guard each optional field so absent keys stay absent —
    // `{ name: undefined }` would overwrite the column on update.
    return {
      ...(dto.name !== undefined && { name: dto.name }),
    };
  }
}
```

Keep mappers stateless; register them as providers in the feature module.
Validation logic (e.g. URL format) belongs in `toUpdate()`/`toInsert()`.

## Evidence

- 8+ mapper classes across two production codebases
- All follow `toDto` / `toInsert` / `toUpdate` naming
- Colocated `.spec.ts` test files for each mapper
- Drizzle-typed signatures + partial-update spread guards proven in a second
  host project

---
id: parcus-mapper-pattern
trigger: 'when converting between database entities and API DTOs'
confidence: 0.9
domain: nestjs
source: local-repo-analysis
---

# Use Dedicated Mapper Classes for Entity <-> DTO Conversion

## Action

Create a dedicated `@Injectable()` mapper class with `toDto()`, `toInsert()`, and `toUpdate()` methods:

```typescript
@Injectable()
export class FooMapper {
  toDto(entity: SelectFoo): FooDto {
    return { id: entity.id, name: entity.name };
  }

  toInsert(data: CreateFooData): InsertFoo {
    return { name: data.name };
  }

  toUpdate(data: UpdateFooData): Partial<InsertFoo> {
    return { ...data };
  }
}
```

Mappers are registered as providers in the feature module.
Validation logic (e.g. URL format) belongs in `toUpdate()`/`toInsert()`.

## Evidence

- 8 mapper classes across the codebase
- All follow `toDto` / `toInsert` / `toUpdate` naming
- Colocated `.spec.ts` test files for each mapper

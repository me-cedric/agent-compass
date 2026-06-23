# TypeScript

Extends [coding-style.md](coding-style.md) for the TS/JS ecosystem.

## Strictness

`strict: true`. No implicit `any`. Prefer `unknown` + narrowing over `any`. Type
external data at the boundary (parse, don't cast). Shared config lives in a
`tsconfig.base.json` that apps extend — see
[`templates/monorepo/tsconfig.base.json`](../../templates/monorepo/tsconfig.base.json).

## API response envelope

Use one consistent envelope across services and clients:

```ts
interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
  meta?: { total: number; page: number; limit: number }
}
```

## Repository pattern

Data access hides behind an interface; business logic depends on the abstraction,
not the storage mechanism.

```ts
interface Repository<T> {
  findAll(filters?: Filters): Promise<T[]>
  findById(id: string): Promise<T | null>
  create(data: CreateDto): Promise<T>
  update(id: string, data: UpdateDto): Promise<T>
  delete(id: string): Promise<void>
}
```

See the `drizzle-postgres-patterns` and `nestjs-patterns` skills for concrete
implementations (transaction host, mappers with `toDto`/`toInsert`/`toUpdate`).

## Custom hooks (React)

Keep hooks small and pure; clean up effects.

```ts
export function useDebounce<T>(value: T, delay: number): T {
  const [v, setV] = useState<T>(value)
  useEffect(() => {
    const h = setTimeout(() => setV(value), delay)
    return () => clearTimeout(h)
  }, [value, delay])
  return v
}
```

## Shared types

Cross-app types live in one shared package, never duplicated per app. Changing a
shared type means validating **every** consumer — see
[architecture/shared-types.md](../architecture/shared-types.md).

## Imports

Use a path alias (e.g. `@/`) for cross-module imports from `src/`. Relative
imports only within the same directory or a direct child.

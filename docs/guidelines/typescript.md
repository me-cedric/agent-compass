# TypeScript

Extends [coding-style.md](coding-style.md) for the TS/JS ecosystem.

## Strictness

`strict: true`. No implicit `any`. Prefer `unknown` + narrowing over `any`. Type
external data at the boundary (parse, don't cast). Shared config lives in a
`tsconfig.base.json` that apps extend — see
[`templates/monorepo/tsconfig.base.json`](../../templates/monorepo/tsconfig.base.json).

## Type-check every project, not the default one

A `tsconfig.json` `include` covers the directories it names, and nothing else. A
repository with more than one `tsconfig*.json` therefore leaves the extra
projects unchecked until the command names each one.

Count the `tsconfig*.json` files, then give the `typecheck` script one pass per
project:

```json
"typecheck": "tsc -p tsconfig.json && tsc -p tsconfig.e2e.json && tsc -p tsconfig.node.json"
```

E2E suites, build scripts, and config files usually live in the extra projects.
They break silently while the default project stays green. Add a project to the
script in the same change that adds its `tsconfig`.

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

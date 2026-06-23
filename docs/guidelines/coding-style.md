# Coding Style

## Immutability (critical)

Create new objects; never mutate existing ones. Return a new copy with the change
instead of writing through the original.

```ts
// wrong: mutates input
function setActive(user, value) { user.active = value; return user }
// right: returns a new value
const setActive = (user, value) => ({ ...user, active: value })
```

Immutable data prevents hidden side effects, makes debugging easier, and keeps
concurrency safe.

## File organization

Many small files beat a few large ones. High cohesion, low coupling.

- 200–400 lines typical, **800 max**. Extract utilities out of large modules.
- Organize by **feature/domain**, not by type (`modules/billing/*`, not
  `controllers/`, `services/`, `repos/`).
- Co-locate tests with the code they test.

## Error handling

Handle errors explicitly at every level. User-facing code returns friendly
messages; servers log detailed context. **Never silently swallow an error.**
Don't `catch` only to discard the original cause — preserve it (`finally` for
cleanup; `.catch(() => {})` only for genuinely fire-and-forget cleanup).

## Input validation

Validate at every trust boundary — user input, API responses, file contents.
Prefer schema-based validation (e.g. `zod`). Fail fast with clear messages. Never
trust external data.

## No hardcoded values

Use named constants or config. Magic numbers and inline URLs/keys are smells.
Env-configurable values get NaN-safe parsing with sane fallbacks.

## Comments

Write code that reads like the surrounding code — match its naming and idioms.
Don't add comments that restate the code. Reserve comments for *why*, for a
non-obvious invariant, or to mark a deliberate simplification and its ceiling.

## Checklist before "complete"

- [ ] Readable, well-named, matches surrounding style
- [ ] Functions small (< 50 lines), files focused (< 800), nesting ≤ 4
- [ ] Errors handled; nothing swallowed
- [ ] Inputs validated at boundaries
- [ ] No hardcoded secrets/values; constants or config used
- [ ] Immutable patterns; no in-place mutation of inputs

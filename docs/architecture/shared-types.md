# Shared Types

Cross-app types (API ⇄ web ⇄ mobile) live in **one** internal package
(e.g. `@scope/shared-types`). Never duplicate a cross-app type inside an app.

## Why one package

A single source means the API response type and the client that consumes it can't
drift. The compiler catches a breaking change at build time in every consumer.

## Impact analysis on change (mandatory)

Changing a shared symbol is a multi-app event. In the same task:

1. **Find every consumer** that imports the changed symbol (each app).
2. **Validate the package and each affected consumer** — lint + typecheck.
3. **Don't mark complete** until all affected consumers pass.

## Build ordering

The shared package builds before its consumers (turbo handles this; the
`pre-push` hook builds shared packages first for the same reason). If a consumer
fails to typecheck after your change, that's the contract telling you about a
break — fix the call sites, don't `any`-cast past it.

## Boundaries

Put genuinely shared, transport-level types here (DTOs, enums, API contracts).
Keep app-internal/view types local. Shared ≠ "everything"; an over-stuffed shared
package couples apps that shouldn't be coupled.

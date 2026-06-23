---
applyTo: 'apps/backoffice/**'
description: 'Use when modifying the React backoffice in apps/backoffice, including TanStack Router routes, React Query flows, MUI UI, and Vitest tests.'
---

## Mandatory Agent Behavior

- Use `skills:caveman` for concise agent interactions. Prefer commands, file diffs, file paths, and short next actions.
- For non-trivial edits, first call the Dual Graph MCP (`graph_continue` → `graph_read` recommended files) to map routes, ownership and dependencies before refactors.

# Backoffice Guidelines

## Commands

- Prefer targeted validation from the monorepo root: `pnpm --filter @scope/backoffice lint`, `pnpm --filter @scope/backoffice test`, and `pnpm --filter @scope/backoffice typecheck`.
- Use `pnpm dev:backoffice` when you need the app locally instead of starting the whole monorepo.

## Routing and App Structure

- Routing is file-based with TanStack Router under `src/routes/`. Add or change routes there rather than hand-editing generated artifacts.
- Do not manually edit `src/routeTree.gen.ts`; it is generated and will be overwritten.
- Keep route concerns in `src/routes/`, shared UI in `src/shared/`, and cross-cutting app logic in the existing `core/`, `features/`, `integrations/`, and `utils/` areas.

## Validation

**All code changes in `apps/backoffice/` MUST pass lint, typecheck, and relevant unit tests.**

- Run scope-specific validations: `pnpm --filter @scope/backoffice lint`, `pnpm --filter @scope/backoffice typecheck`, `pnpm --filter @scope/backoffice test`.
- Fix any lint/type errors introduced by your changes before closing the task.

## Frontend Conventions

- Use the existing aliases and source imports, especially `@/` for app-local code and `@scope/shared-types` for workspace contracts.
- Preserve the current stack choices: MUI for UI, TanStack Router for navigation, TanStack Query for server state, and the existing i18n setup.
- The backoffice currently initializes i18n with French as the supported fallback language and loads translations from `public/locales`; keep additions consistent with that setup.
- Prefer following local component and route patterns instead of importing mobile-specific conventions into the web app.

## Tests

- Tests run with Vitest in jsdom using `__tests__/setup/vitest.setup.ts`.
- Reuse the existing mocks under `__tests__/mocks/` and existing test utilities before creating new ad hoc setup logic.
- Keep tests close to the current service/query mocking style so they stay compatible with the shared setup and Sonar test reporting.

---
applyTo: 'apps/mobile-app/**'
description: 'Use when modifying the Expo mobile app in apps/mobile-app, including Expo Router screens, native config, React Query, and Jest tests.'
---

## Mandatory Agent Behavior

- Use `skills:caveman` for concise agent interactions. Be terse and prefer exact commands, file paths, diffs and short next actions.
- For non-trivial repository work, start with the Dual Graph MCP: call `graph_continue` and then `graph_read` the `recommended_files` before making structural edits.

# Mobile App Guidelines

## Commands

- Prefer targeted validation from the monorepo root: `pnpm --filter @scope/mobile-app lint`, `pnpm --filter @scope/mobile-app test`, and `pnpm --filter @scope/mobile-app typecheck`.
  **All code changes in `apps/mobile-app/` MUST pass lint, typecheck, and relevant unit tests.**

- Run scope-specific validations: `pnpm --filter @scope/mobile-app lint`, `pnpm --filter @scope/mobile-app typecheck`, `pnpm --filter @scope/mobile-app test`.
- After each code change, run `pnpm --filter @scope/mobile-app lint` and fix lint issues before closing the task.
- Fix any type errors introduced by your changes.
- Use `pnpm dev:mobile` for app development. Avoid broad monorepo watchers unless the task requires cross-app coordination.
- Environment-specific startup matters here: the existing `predev`, `prestaging`, and `preproduction` scripts prepare `.env.local` before launch.

## Navigation and App Shell

- The app uses Expo Router with route groups under `app/`, while app-wide navigation options are centralized in `app/Navigation.tsx` and app bootstrap providers live in `app/_layout.tsx`.
- Prefer extending the existing provider stack in `app/_layout.tsx` rather than adding duplicate top-level providers inside individual screens.
- Keep screen files and route groups consistent with the current `app/(auth)`, `app/(main)`, onboarding, and debug structure.

## Mobile Conventions

- Respect the existing aliases: `@/` for `src`, `@app/` for `app`, and `@tests/` for test helpers.
- Keep Expo configuration environment-driven through `app.config.ts`; avoid hardcoding values that already come from `EXPO_PUBLIC_*` or other app environment variables.
- React Query persistence is configured at the app shell level. When adding persisted queries, follow the current query client and persistence patterns instead of introducing a second cache strategy.
- Prefer shared contracts from `@scope/shared-types` rather than re-declaring API payload shapes in the app.

## Tests

- Tests run with Jest and jsdom using `jest.config.js` and `__tests__/setup/env.ts`.
- Reuse existing mocks in `__tests__/mocks/` for Expo, router, storage, and native integrations before introducing new mock patterns.
- If a change touches native-facing libraries or router behavior, keep test aliases and module mappings aligned with the current Jest configuration.

---
description: React and Next.js web rules for feature modules, ViewModel hooks, React Query, routing, auth, MUI theming and tests. Applies when you edit web TypeScript or TSX.
paths:
  - "**/*.tsx"
  - "**/features/**/*.ts"
  - "**/routes/**/*.ts"
  - "**/*ViewModel*.ts"
  - "**/vite.config.*"
  - "**/next.config.*"
  - "**/theme.ts"
stacks: [react-web, next-web]
---
# React rules

## Structure
- Match the feature layout in the repo. The default is `src/features/<feature>/` with `services/`, `queries/`, `hooks/`, `ui/` and `__tests__/`.
- Keep each feature self-contained. Put shared UI in `src/shared/` and the API client in `src/core/api/`.
- Import cross-app types from the `shared-types` package. Do not redefine them.
- Declare each path alias (`@/` for `src/`) in `tsconfig.json` and in the bundler config.
- Next.js: use the App Router. Put routes in `app/<route>/page.tsx`. Split server and client components. Add `'use client'` only where state or effects need it.
- Next.js: fetch in server components when you can. Use React Query on the client only where a server component does not fit.

## ViewModels
- Put logic in a `use<Component>ViewModel` hook. It returns data and handlers, never JSX.
- Keep the component a thin wrapper: call the hook, render the result.
- Declare the hook dependencies in a props interface.
- Memoize derived data with `useMemo` and handlers with `useCallback`.
- For a form, return an `inputData[]` array: `label`, `value`, `fieldName`, `error`, `onChange`, `onBlur`.
- For create and edit screens, use one mode hook (`isCreateMode`, `isEditMode`, `id`).

## Data
- Write each service as a pure async function over one shared Axios `apiClient`. Use no hooks and no state.
- Create the `apiClient` with `baseURL` from the environment and a timeout. Add auth in interceptors.
- Use one React Query hook per operation in `queries/`: `useGetX`, `useCreateX`, `useUpdateX`, `useDeleteX`.
- Use array query keys: `['entity']` or `['entity', id]`.
- Invalidate the related queries in `onSettled` of each mutation, not only in `onSuccess`: a bulk write can fail in part, and the server has changed.
  Run bulk writes with `Promise.allSettled` and report each failed item.
- Type a mutation as `useMutation<TData, TError, TVariables>`.
- When a ViewModel reads several queries, combine their loading flags with `useMemo`.

## Routing and auth
- TanStack Router: do not edit `routeTree.gen.ts`. Set `autoCodeSplitting: true` in the router plugin.
- Give each entity route `index.tsx`, `$entityId.tsx` and `new.tsx` under the authenticated layout.
- Guard routes in `beforeLoad` with `requireAuth` and `requirePermissions`.
- While an OIDC redirect runs, suspend navigation with `throw new Promise(() => {})`.
- Keep auth state in a Zustand store. Use an `AUTH_STATUS` constant: `idle`, `authenticated`, `anonymous`, `refreshing`.
- Write permissions as `resource:action` strings. Type them in `shared-types`.

## Dev server
- Warm the lazy routes at start: `server.warmup.clientFiles` with the route glob. A route that the optimiser meets first on navigation fails once, then works after a reload.
- Add the CommonJS specifiers of an excluded package to the pre-bundle include list. Without it the browser rejects `default` from that module.

## UI
- Extend the MUI theme with `customColors` and a module augmentation. Read colours from the theme. Do not hard-code hex values in components.
- Wrap every label, column and button text in `t('page.<feature>.<section>.<key>')`. Do not hard-code UI text.
- Label a picker option by a stable human name from a name-bearing source. Never fall back to an id or a nullable attribute. Use the same label as the rest of the UI.
- Allow only `http` and `https` in a user-supplied `href`: parse the URL and check the protocol. `rel="noopener"` does not stop `javascript:`.
- Keep layout in the CSS module with tokens. An inline `style` for width, margin or color bypasses the design system.

## Tests
- Test with Vitest and Testing Library. Set `environment: 'jsdom'` and a setup file.
- Test each ViewModel hook on its own. Use Playwright for critical user flows.
- Before you finish, run the project lint, typecheck and test scripts for the web package.

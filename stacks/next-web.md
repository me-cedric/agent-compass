# Preset: Next.js Web

Public or authenticated web app.

## Components

- **Next.js** + **React** + **TypeScript**.
- **App Router** for routes, layouts, loading states, and server/client splits.
- **TanStack React Query** for client-side server state when server components
  are not the right fit.
- **Keycloak OIDC** auth when the project needs shared identity.
- **Vitest** or framework-native tests for units; Playwright for critical flows.

## agent-compass pieces

- Skill: `react-admin-dashboard-patterns` for React Query, view-model, and UI
  testing patterns that also apply to web apps.
- Templates: [`templates/eslint/eslint.config.react.mjs`](../templates/eslint/eslint.config.react.mjs),
  [`templates/docker/Dockerfile.web`](../templates/docker/Dockerfile.web),
  [`templates/sonar/sonar-project.web.properties`](../templates/sonar/sonar-project.web.properties).
- Guidelines: [typescript](../docs/guidelines/typescript.md),
  [testing-tdd](../docs/guidelines/testing-tdd.md),
  [env-management](../docs/tooling/env-management.md).

## Feature layout

```
app/<route>/page.tsx
src/features/<feature>/
  <Feature>.view.tsx   use<Feature>.viewmodel.ts   <feature>.queries.ts
  components/   __tests__/
```

## Validate

```bash
pnpm --filter @scope/web lint && pnpm --filter @scope/web typecheck && pnpm --filter @scope/web test
```

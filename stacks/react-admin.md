# Preset: React Admin / Back-office

Internal admin or back-office SPA.

## Components

- **Vite** + **React** + **TypeScript**.
- **TanStack Router** (file/route tree; `routeTree.gen.ts` is generated — don't
  hand-edit).
- **MUI Material** components.
- **TanStack React Query** for server state (CRUD hooks).
- **Keycloak OIDC** auth + RBAC permissions.
- **MVVM**: ViewModels hold logic; components stay thin.
- **Vitest** + Testing Library.

## agent-compass pieces

- Skill: `react-admin-dashboard-patterns`.
- Templates: [`templates/eslint/eslint.config.react.mjs`](../templates/eslint/eslint.config.react.mjs),
  [`templates/docker/Dockerfile.web`](../templates/docker/Dockerfile.web),
  [`templates/sonar/sonar-project.web.properties`](../templates/sonar/sonar-project.web.properties).
- Guidelines: [typescript](../docs/guidelines/typescript.md) (hooks, envelope),
  [testing-tdd](../docs/guidelines/testing-tdd.md).

## Feature layout

```
src/features/<feature>/
  <Feature>.view.tsx   use<Feature>.viewmodel.ts   <feature>.queries.ts
  components/   __tests__/
src/routeTree.gen.ts   (generated)
```

## Validate

```bash
pnpm --filter @scope/backoffice lint && pnpm --filter @scope/backoffice typecheck && pnpm --filter @scope/backoffice test
```

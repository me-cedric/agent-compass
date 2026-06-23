# Preset: Expo Mobile

Cross-platform mobile app.

## Components

- **Expo** + **Expo Router** (file-based navigation; provider stack in
  `app/_layout.tsx`).
- **React Native** + **TypeScript**.
- **Zustand** for auth/session state.
- **TanStack React Query** (+ persistence) for server state.
- **Secure storage** for tokens (expo-secure-store).
- **MVVM** feature modules; theming; animations.
- **Jest** + Testing Library (and e2e via the RN-native runner).

## agent-compass pieces

- Skill: `expo-react-native-patterns`.
- Templates: [`templates/eslint/eslint.config.expo.mjs`](../templates/eslint/eslint.config.expo.mjs).
- Guidelines: [typescript](../docs/guidelines/typescript.md),
  [testing-tdd](../docs/guidelines/testing-tdd.md).

## Feature layout

```
src/features/<feature>/
  <Feature>Screen.tsx   use<Feature>.viewmodel.ts   <feature>.api.ts
  components/   __tests__/
app/_layout.tsx   (provider stack)
```

## Validate

```bash
pnpm --filter @scope/mobile-app lint && pnpm --filter @scope/mobile-app typecheck && pnpm --filter @scope/mobile-app test
```

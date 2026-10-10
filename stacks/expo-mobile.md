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

## Visual check and device automation

A screen change is looked at by the one who made it: snapshot tests first, the
running app where a snapshot cannot draw the screen, and machine accessibility
checks over a screen catalogue. See
[mobile-visual-check](../docs/workflows/mobile-visual-check.md). Drive the
running app with [agent-device](https://github.com/callstack/agent-device)
(Callstack, MIT; [setup](../docs/tooling/device-automation.md)), pinned to one
version, for example `npx -y agent-device@0.21.22`.

React Native has no host renderer for native views: use agent-device screenshots on a simulator or emulator, kept as replayable `.ad` scripts, and its React Native component tree.

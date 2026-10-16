---
description: Expo and React Native rules for Expo Router, feature modules, ViewModels, React Query, Zustand auth, secure storage, theming, animations and tests. Applies when you edit the mobile app.
paths:
  - "**/app/**/*.tsx"
  - "**/src/features/**/*.ts"
  - "**/src/features/**/*.tsx"
  - "**/src/shared/**/*.tsx"
  - "**/app.config.ts"
  - "**/metro.config.*"
  - "**/babel.config.*"
  - "**/jest.config.*"
stacks: [expo-mobile]
---
# Expo rules

## Structure
- Use Expo Router. Put routes in `app/` and the provider stack in `app/_layout.tsx`.
- Group routes by auth state: `(main)` for signed-in screens, `(auth)` for the rest. Gate them in one navigation file.
- Put code in `src/features/<name>/` with `models/`, `store/`, `services/`, `queries/`, `hooks/`, `ui/` and `utils/`.
- Put shared UI in `src/shared/` and the API client in `src/core/api/`.
- Import cross-app types from the `shared-types` package. Do not redefine them.
- Declare the aliases `@/`, `@app/` and `@tests/` in `tsconfig.json`, `babel.config.js` and `jest.config.js`.
- Use `app.config.ts`, not `app.json`. Put native changes in config plugins under `plugins/`.
- Do not edit `android/` or `ios/` by hand. Expo generates them.

## Logic
- Put screen logic in a `use<Component>ViewModel` hook. It returns data and handlers, never JSX.
- Memoize derived data with `useMemo` and handlers with `useCallback`.
- Write each service as a pure async function over one Axios instance. Use no hooks.
- Read the API URL from `EXPO_PUBLIC_API_URL`. Throw at startup when it is missing. Add auth in interceptors.
- Use one React Query hook per operation in `queries/`, with array query keys.
- Invalidate the related queries in `onSuccess` of each mutation.
- Persist a query only when it sets `meta: { persist: true }`. Persist through `PersistQueryClientProvider`.
- Keep auth state in a Zustand store with an `AUTH_STATUS` constant. Export selector functions to limit re-renders.
- Give each context provider a `useX` hook that throws when called outside the provider.

## Security
- Store tokens with `expo-secure-store`. Do not store a token in `AsyncStorage`.

## UI
- Provide the theme through `ThemeProvider` and `useTheme`. Build styles with a `makeStyles(colors)` factory and `StyleSheet.create`.
- Do not hard-code colours in a component.
- Wrap UI text in `t('page.<feature>.<section>.<key>')` with i18next.
- Drive animations with Reanimated: `useSharedValue`, not `useState`. Use `useAnimatedStyle` for derived styles.
- Call a JavaScript function from the UI thread with `runOnJS`. Keep animation code in the ViewModel hook.
- Reach 44 pt on iOS and 48 dp on Android by growing the hit area with `hitSlop`. Do not enlarge the drawn control.
- Prove it with a snapshot of the control at its normal size and a measure of the touch target.

## Tests
- Test with Jest, the `jest-expo` preset and Testing Library. Name a ViewModel test `useXViewModel.test.ts`.
- Mock Expo modules, SVG imports and shared providers in `__tests__/mocks/`.
- Check a screen change in a running simulator or emulator. Use the `agent-device` skill.
- Before you finish, run the project lint, typecheck and test scripts for the mobile package.

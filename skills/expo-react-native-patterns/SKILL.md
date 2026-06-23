---
name: expo-react-native-patterns
description: Expo Router + React Native mobile app patterns — MVVM architecture, feature modules, Zustand auth, React Query hooks, theming, secure storage, animations, and testing
version: 1.0.0
filePattern: "**/*.tsx,**/*.ts,**/app.config.ts,**/metro.config.*,**/babel.config.*,**/expo-*.ts"
bashPattern: "expo|react-native|eas|jest-expo|metro"
---

# Expo / React Native Mobile App Patterns

## Project Structure

```
apps/mobile-app/
  app/                         # Expo Router (file-based routing)
    _layout.tsx                # Root layout (providers stack)
    Navigation.tsx             # Route groups & auth gating
    (main)/                    # Authenticated routes
      home/
      map/
      search/
      profile/
        payments/
        vehicles/
        fidelity/
        preferences/
      street/
      parking/
    (auth)/                    # Unauthenticated routes
      welcome.tsx
      register.tsx
      verify.tsx
      reset-password.tsx
    onboarding/
    debug/                     # Dev-only screens (colors, icons, typography)
  src/
    core/
      api/apiClient.ts         # Axios instance (single source of truth)
      constants/               # Fonts, Typography, Colors, config
    features/                  # Feature modules (self-contained)
      auth/                    # Auth state, Keycloak OIDC
      account/                 # Registration, OTP, password reset
      parking/                 # Resource cards, search, occupancy
      search/                  # Filters, search results
      profile/                 # User settings, vehicles, vouchers
      money/                   # Cards, payments
      street/                  # Street parking sessions
      onboarding/              # Intro screens
      ads/                     # Advertisements
    shared/
      components/              # Themed components, buttons, chips, tags, lists
      hooks/                   # useTheme, useAlert
      providers/               # Theme, Alert, Loading, Toast, DatePicker
    utils/                     # Storage, JWT decode, map helpers
    i18n/                      # i18next translations
    global/                    # Global refs (e.g., datePicker)
  __tests__/
    setup/                     # Jest setup files
    mocks/                     # Expo, SVG, secure store mocks
```

## Feature Module Structure

Each feature is self-contained under `src/features/<name>/`:

```
features/<feature>/
  constants/                   # Feature-specific constants
  models/                      # TypeScript interfaces, store types
  store/                       # Zustand store (if stateful)
  services/                    # API call functions (pure, no hooks)
  queries/                     # React Query hooks (useQuery, useMutation)
  hooks/                       # Custom hooks (non-query)
  ui/
    <Screen>.tsx               # Screen component
    components/                # Feature-local UI components
    <component>/
      use<Component>ViewModel.ts  # MVVM ViewModel hook
  utils/                       # Feature-local utilities
```

## MVVM Pattern (ViewModel Hooks)

Every non-trivial screen/component has a `useXxxViewModel` hook that encapsulates all logic:

```tsx
// features/search/ui/filters/useHeightFilterViewModel.ts
interface UseHeightFilterViewModelProps {
  setHeight: (height: string | null) => void;
  optionSelect: string | null;
  options: string[];
}

export const useHeightFilterViewModel = ({
  setHeight,
  optionSelect,
  options,
}: UseHeightFilterViewModelProps) => {
  const selectedOptions = useMemo(() =>
    options.map((option) => ({
      value: option,
      label: `${option} m`,
      selected: option === optionSelect,
    })),
  [optionSelect, options]);

  const handleSelect = useCallback((value: string) => {
    setHeight(optionSelect === value ? null : value);
  }, [setHeight, optionSelect]);

  return { selectedOptions, handleSelect };
};
```

**Rules:**
- ViewModels return **data + handlers**, never JSX
- Props interface defines dependencies explicitly
- Use `useMemo` for derived data, `useCallback` for handlers
- Name: `use<ComponentName>ViewModel`
- Screen components become thin wrappers: `const vm = useXxxViewModel(props); return <View>...</View>`

## API Client (Axios)

Single shared Axios instance with auth token injection:

```ts
// core/api/apiClient.ts
const BASE_URL = process.env.EXPO_PUBLIC_API_URL;
if (!BASE_URL) throw new Error('EXPO_PUBLIC_API_URL not defined');

export const apiClient = axios.create({
  baseURL: BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
});
```

Auth token injection happens via Axios interceptors (added during auth init).

## Service Layer (Pure Functions)

Services are stateless functions that call the API. Types come from `@scope/shared-types`:

```ts
// features/account/services/accountService.ts
import { RegisterUser, User } from '@scope/shared-types';
import { apiClient } from '@/core/api/apiClient';

export const register = async (data: RegisterUser) => {
  const response = await apiClient.post('/auth/register', data);
  return response.data as User;
};

export const confirmOtp = async (data: ConfirmUserOtpDto) => {
  return await apiClient.post('/auth/confirm-otp', data);
};
```

**Rules:**
- One file per feature domain
- Functions are `async`, return typed responses
- Import types from `@scope/shared-types`
- No hooks, no state — pure request/response

## React Query Hooks

### Queries (read)

```ts
// features/money/queries/useGetUserCards.ts
import { useQuery } from '@tanstack/react-query';
import { getUserCards } from '@/features/money/services/moneyService';

export const useGetUserCards = () => {
  return useQuery({
    queryKey: ['user-cards'],
    queryFn: () => getUserCards(),
  });
};
```

### Mutations (write)

```ts
// features/account/queries/useRegister.ts
import { useMutation, useQueryClient } from '@tanstack/react-query';

export const useRegister = () => {
  const queryClient = useQueryClient();

  return useMutation<User, AxiosError, RegisterUser>({
    mutationFn: (payload) => register(payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['currentUser'] });
    },
    onError: (error) => {
      console.error('Failed to register:', error);
    },
  });
};
```

**Patterns:**
- Query keys: `['entity']` or `['entity', id]` (string array)
- Mutations always invalidate related queries on success
- Type parameters: `useMutation<TData, TError, TVariables>`
- Place in `queries/` directory (both queries and mutations)

## Query Persistence

React Query data persists across app restarts via `AsyncStorage`:

```tsx
// _layout.tsx
<PersistQueryClientProvider
  client={queryClient}
  persistOptions={{
    persister: asyncStoragePersister,
    dehydrateOptions: {
      shouldDehydrateQuery: (query) =>
        query.meta?.persist === true && query.state.status === 'success',
    },
  }}
>
```

Mark queries for persistence via `meta: { persist: true }` in the query options.

## Auth State (Zustand)

```ts
// features/auth/store/useAuthStore.ts
import { create } from 'zustand';

export const useAuthStore = create<AuthStore>((set) => ({
  status: AUTH_STATUS.IDLE,
  accessToken: undefined,
  idToken: undefined,
  setAccessToken: (t) => set({ accessToken: t }),
  setIdToken: (t) => set({ idToken: t }),
  setStatus: (s) => set({ status: s }),
  reset: () => set({
    status: AUTH_STATUS.ANONYMOUS,
    accessToken: undefined,
    idToken: undefined,
  }),
}));

// Selector functions (avoids re-renders)
export const selectAccessToken = (s: AuthStore) => s.accessToken;
```

**Auth status enum:**
```ts
export const AUTH_STATUS = {
  IDLE: 'idle',
  AUTHENTICATED: 'authenticated',
  ANONYMOUS: 'anonymous',
  REFRESHING: 'refreshing',
} as const;
```

## Secure Token Storage

```ts
// utils/storage.ts
import * as SecureStore from 'expo-secure-store';

const TOKEN_KEY = 'access_token';

export async function saveToken(token: string) {
  await SecureStore.setItemAsync(TOKEN_KEY, token);
}

export async function getToken(): Promise<string | null> {
  return await SecureStore.getItemAsync(TOKEN_KEY);
}

export async function removeToken() {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
}
```

**Rule:** Never store tokens in AsyncStorage. Always use `expo-secure-store`.

## Theming (Context + Hook)

```tsx
// shared/providers/ThemeProvider.tsx
export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const colorScheme = Appearance.getColorScheme();
  const [mode, setMode] = useState<ThemeMode>(colorScheme === 'dark' ? 'dark' : 'light');

  useEffect(() => {
    const subscription = Appearance.addChangeListener(({ colorScheme }) => {
      if (colorScheme) setMode(colorScheme);
    });
    return () => subscription.remove();
  }, []);

  const colors = ThemeColors['light'];
  const value = useMemo(() => ({ mode, colors, setMode }), [mode, colors]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

// shared/hooks/useTheme.ts
export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within a ThemeProvider');
  return context;
};
```

## Themed Components

```tsx
// shared/components/ThemedScreen.tsx
const ThemedScreen = ({ style, ...otherProps }: ViewProps) => {
  const colors = useTheme().colors;
  const styles = makeStyles(colors);
  const { bottom } = useSafeAreaInsets();

  return <View style={[styles.view, { paddingBottom: bottom }, style]} {...otherProps} />;
};

const makeStyles = (colors: ColorTheme) =>
  StyleSheet.create({
    view: {
      backgroundColor: colors.surface.surface,
      flex: 1,
      paddingHorizontal: 16,
    },
  });
```

**Pattern:** `makeStyles(colors)` factory function — creates styles based on theme colors. Not `useMemo`'d (StyleSheet.create is already cheap).

## Provider Stack (Root Layout)

Providers wrap the app in a specific order in `_layout.tsx`:

```
GestureHandlerRootView
  └─ PersistQueryClientProvider (React Query + AsyncStorage persistence)
    └─ ThemeProvider
      └─ LoadingProvider
        └─ AlertProvider
          └─ BottomSheetModalProvider
            └─ ToastOffsetProvider
              └─ NotificationManager
              └─ NavigationContainer + StatusBar + ToastManager
```

**App initialization sequence:**
1. Prevent splash screen auto-hide
2. Load custom fonts (`useFonts`)
3. Initialize auth service (Keycloak OIDC)
4. Lock screen orientation (portrait)
5. Set i18n language from user store
6. Hide splash screen when ready

## Animations (Reanimated)

```ts
// features/parking/ui/parkingCard/useParkingCardViewModel.ts
export const useParkingCardViewModel = (onCloseComplete: () => void) => {
  const translateY = useSharedValue(height);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const openCard = useCallback(() => {
    translateY.value = withTiming(0, {
      duration: 400,
      easing: Easing.out(Easing.cubic),
    });
  }, [translateY]);

  const closeCard = useCallback(() => {
    translateY.value = withTiming(height,
      { duration: 400, easing: Easing.in(Easing.cubic) },
      (finished) => { if (finished) runOnJS(onCloseComplete)(); },
    );
  }, [translateY, onCloseComplete]);

  return { animatedStyle, openCard, closeCard };
};
```

**Rules:**
- Use `useSharedValue` (not `useState`) for animated values
- Use `useAnimatedStyle` for derived styles
- Use `runOnJS` to call JS functions from UI thread
- Animations belong in ViewModel hooks

## Context Hooks Pattern

Every provider has a matching `useXxx` hook with a guard:

```ts
export const useAlert = () => {
  const context = useContext(AlertContext);
  if (!context) throw new Error('useAlert must be used within an AlertProvider');
  return context;
};
```

## Testing Setup

```js
// jest.config.js
module.exports = {
  preset: 'jest-expo',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@scope/shared-types$': '<rootDir>/../../packages/shared-types/src',
    '\\.svg$': '<rootDir>/__tests__/mocks/svgMock.tsx',
    '^expo-router$': '<rootDir>/__tests__/mocks/expoRouter.ts',
    '^expo-secure-store$': '<rootDir>/__tests__/mocks/expoSecureStore.ts',
  },
  testMatch: ['<rootDir>/**/*.test.ts?(x)'],
};
```

**Test file naming:** `useXxxViewModel.test.ts` — co-located or in `__tests__/`

**Test mocks directory:** `__tests__/mocks/` — mock Expo modules (router, secure-store, web-browser, auth-session), SVG imports, and shared providers (ThemeProvider, AlertProvider, LoadingProvider, ToastOffsetProvider, QueryClient).

## Path Aliases

```
@/         → src/
@app/      → app/
@tests/    → __tests__/
```

Configured in `tsconfig.json`, `babel.config.js`, and `jest.config.js`.

## i18n

- Uses `i18next` + `react-i18next`
- Resources in `src/i18n/resources.ts`
- Translation keys: `page.<feature>.<section>.<key>` (e.g., `page.parking.card.title`)
- Language stored in user Zustand store, synced on change

## Expo Config

- `app.config.ts` (dynamic config, not `app.json`)
- Custom Expo plugins under `plugins/` for Android-specific config:
  - `withAndroidSigningConfig`
  - `withNetworkSecurityConfig`
  - `withAndroidLoadingDeeplink`

## Key Libraries

| Library | Purpose |
|---------|---------|
| `expo-router` | File-based navigation |
| `@tanstack/react-query` | Data fetching + caching |
| `zustand` | Client state management |
| `axios` | HTTP client |
| `react-native-reanimated` | Animations |
| `@gorhom/bottom-sheet` | Bottom sheet modals |
| `expo-secure-store` | Secure token storage |
| `i18next` | Internationalization |
| `react-native-safe-area-context` | Safe area insets |
| `toastify-react-native` | Toast notifications |

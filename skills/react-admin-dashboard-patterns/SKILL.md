---
name: react-admin-dashboard-patterns
description: React admin dashboard patterns — TanStack Router, MUI Material, MVVM ViewModels, RBAC permissions, Keycloak OIDC, React Query CRUD hooks, feature modules, Vite config
version: 1.0.0
filePattern: "**/routes/**/*.tsx,**/features/**/*.ts,**/features/**/*.tsx,**/vite.config.*,**/*ViewModel*"
bashPattern: "vite|vitest|tanstack|mui"
---

# React Admin Dashboard (Backoffice) Patterns

## Project Structure

```
apps/backoffice/
  src/
    core/
      api/apiClient.ts             # Axios instance
      constants/                   # Typography, config values
    features/                      # Feature modules (self-contained)
      auth/                        # Keycloak OIDC auth
      bo-user/                     # Backoffice user management
      role/                        # Role & permission management
      parking/                     # Parking lot CRUD
      news/                        # News/announcements CRUD
      alerts/                      # Global alert management
      analytics/                   # Dashboard metrics
      roads/                       # Road management
      user/                        # End-user management
      profile/                     # Admin profile
      params/                      # System parameters
    shared/
      components/                  # Reusable UI (CustomTable, Modal, Chip, etc.)
      types/                       # Shared TypeScript types (inputs, forms)
    integrations/
      tanstack-query/devtools.tsx  # React Query DevTools
    routes/                        # TanStack Router file-based routes
      _authenticated.tsx           # Auth layout (route guard)
      _authenticated/
        home/
        parking/
        news/
        bo-user/
        role/
        user/
        payments/
        roads/
        profile/
      callback.tsx                 # OIDC callback handler
      index.tsx                    # Landing/redirect
    routeTree.gen.ts               # Auto-generated route tree
    theme.ts                       # MUI theme (Material Design 3)
    reportWebVitals.ts
  __tests__/
    setup/vitest.setup.ts
  vite.config.ts                   # Vite + TanStack Router plugin
  package.json
```

## Feature Module Structure

```
features/<feature>/
  constants/                       # Feature-specific constants
  types/                           # Feature TypeScript types
  services/                        # API call functions (pure)
  queries/                         # React Query hooks (CRUD)
  hooks/                           # Custom hooks (useXxxMode, etc.)
  functions/                       # Pure utility functions
  ui/
    <Feature>IndexScreen.tsx       # List/table screen
    <Feature>DetailScreen.tsx      # Create/edit form screen
    components/
      <Component>.tsx
      use<Component>ViewModel.ts   # MVVM ViewModel hook
      form/
        use<Feature>FormViewModel.ts
```

## TanStack Router (File-Based)

### Route Definition

```tsx
// routes/_authenticated/parking/index.tsx
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/_authenticated/parking/')({
  beforeLoad: async () => {
    const { user } = await requirePermissions({
      permissions: ['parking-lots:read'],
    });
    return {
      canCreate: user.permissions.includes('parking-lots:write'),
    };
  },
  component: ParkingsIndexScreen,
});
```

### CRUD Route Pattern

Every entity follows this file structure:
```
routes/_authenticated/<entity>/
  index.tsx      # List view (GET)
  $entityId.tsx  # Edit/detail view (GET by ID)
  new.tsx        # Create view (POST)
```

### Auth Layout Guard

```tsx
// routes/_authenticated.tsx
export const Route = createFileRoute('/_authenticated')({
  beforeLoad: async ({ location }) => {
    await requireAuth({ location });
  },
  component: () => <Outlet />,
});
```

### Vite Plugin

```ts
// vite.config.ts
import { tanstackRouter } from '@tanstack/router-plugin/vite';

export default defineConfig({
  plugins: [
    tanstackRouter({ target: 'react', autoCodeSplitting: true }),
    viteReact(),
    svgr(),
  ],
});
```

**Key:** `autoCodeSplitting: true` generates route tree and lazy-loads each route automatically. Never edit `routeTree.gen.ts` manually.

## Authentication (Keycloak OIDC)

### requireAuth (route guard)

```ts
// features/auth/functions/requireAuth.ts
import { userManager } from '../config/oidcConfig';

export const requireAuth = async ({ location }: { location: ParsedLocation }) => {
  const user = await userManager.getUser();
  const isExpired = user?.expired ?? true;

  if (!user || isExpired) {
    await authService.login(location.href);
    throw new Promise(() => {});  // Suspend navigation until redirect
  }
  return user;
};
```

**Note:** `throw new Promise(() => {})` is a TanStack Router pattern to suspend route loading while the OIDC redirect happens.

### Auth Store (Zustand)

```ts
// features/auth/store/useAuthStore.ts
import { create } from 'zustand';
import type { User } from 'oidc-client-ts';

export const useAuthStore = create<AuthStore>((set) => ({
  status: AUTH_STATUS.IDLE,
  user: null,
  setUser: (user) => set({
    user,
    status: user ? AUTH_STATUS.AUTHENTICATED : AUTH_STATUS.ANONYMOUS,
  }),
  setStatus: (status) => set({ status }),
}));
```

**Mobile vs Backoffice auth difference:**
- Mobile: stores `accessToken` + `idToken` (strings) via Keycloak REST
- Backoffice: stores `User` object from `oidc-client-ts` (full OIDC user manager)

### Auth Status Enum

```ts
export const AUTH_STATUS = {
  IDLE: 'idle',
  AUTHENTICATED: 'authenticated',
  ANONYMOUS: 'anonymous',
  REFRESHING: 'refreshing',
} as const;
export type AuthStatusType = (typeof AUTH_STATUS)[keyof typeof AUTH_STATUS];
```

## RBAC Permission System

### requirePermissions (route-level)

```ts
// features/role/functions/requirePermissions.ts
export const requirePermissions = async ({
  permissions,
  requireAll = false,
}: RequirePermissionsOptions) => {
  const user = await getCurrentUser();

  const hasPermission = requireAll
    ? permissions.every((p) => user.permissions.includes(p))
    : permissions.some((p) => user.permissions.includes(p));

  if (!hasPermission) {
    throw redirect({ to: '/home' });
  }
  return { user };
};
```

**Pattern:** Permissions are `resource:action` strings (e.g., `parking-lots:read`, `parking-lots:write`). Types from `@parcus/shared-types`.

### Route-Level Permission Check

```tsx
// Pass canCreate to component via route context
beforeLoad: async () => {
  const { user } = await requirePermissions({ permissions: ['entity:read'] });
  return { canCreate: user.permissions.includes('entity:write') };
},
```

## API Client

```ts
// core/api/apiClient.ts
import { env } from '@/config/runtime-config';

export const apiClient = axios.create({
  baseURL: env.apiUrl,
  timeout: 10000,
  headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
});
```

Auth token injection via interceptors (added during OIDC init).

## Service Layer (Pure Functions)

```ts
// features/bo-user/services/boUsersService.ts
import type { BoUser } from '@parcus/shared-types';
import { apiClient } from '@/core/api/apiClient';

export const getBoUsers = async () => {
  const response = await apiClient.get('/users');
  return response.data as BoUser[];
};

export const createBoUser = async (userData: Partial<BoUser>) => {
  const response = await apiClient.post('/users', userData);
  return response.data as BoUser;
};

export const updateBoUser = async (id: string, userData: Partial<BoUser>) => {
  const response = await apiClient.patch(`/users/${id}`, userData);
  return response.data as BoUser;
};

export const deleteBoUser = async (id: string) => {
  return await apiClient.delete(`/users/${id}`);
};

export const exportBoUsers = async (ids: string[]) => {
  const params = new URLSearchParams();
  ids.forEach((id) => params.append('ids[]', id));
  const response = await apiClient.get(`/users/export?${params}`, {
    responseType: 'blob',
  });
  return response.data as Blob;
};
```

**CRUD convention:** `getAll`, `getById`, `create`, `update`, `delete`, plus domain-specific operations (`export`, `order`).

## React Query Hooks (CRUD)

### Query (read)

```ts
export const useGetRoles = () => {
  return useQuery({
    queryKey: ['roles'],
    queryFn: () => getRoles(),
  });
};
```

### Mutation (write)

```ts
export const useCreateParking = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<ParkingLot>) => createParking(data),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['parkings'] });
    },
    onError: (error) => {
      console.error('Failed to create parking:', error);
    },
  });
};
```

**Convention:** One hook per operation, always invalidate related queries on mutation success.

## MVVM ViewModel Hooks

### Table ViewModel

```ts
// features/news/ui/components/useNewsTableViewModel.ts
export const useNewsTableViewModel = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [select, setSelect] = useState<string[]>([]);

  const columns: NewsColumn[] = useMemo(() => [
    { id: 'image', label: t('page.news.table.image'), isImage: true, width: 250 },
    { id: 'dates', label: t('page.news.table.dates'), sortable: true },
    { id: 'name', label: t('page.news.table.name'), sortable: true },
  ], [t]);

  const handleNavigate = useCallback((id: string) => {
    void navigate({ to: '/news/' + id });
  }, [navigate]);

  return { columns, select, setSelect, handleNavigate };
};
```

### Form ViewModel

```ts
// features/bo-user/ui/components/form/useBoUserDetailsFormViewModel.ts
export const useBoUserDetailsFormViewModel = ({ email, firstName, lastName, updateUser }) => {
  const [form, setForm] = useState({ email, firstName, lastName });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [touchedFields, setTouchedFields] = useState<TouchedFields>({});

  const validateSingleField = useCallback((fieldName, value) => {
    const rule = formValidationRules[fieldName];
    return validateField(value, rule, fieldName);
  }, []);

  const handleFieldBlur = useCallback((fieldName, value) => {
    setTouchedFields((prev) => ({ ...prev, [fieldName]: true }));
    const error = validateSingleField(fieldName, value);
    setErrors((prev) => ({ ...prev, [fieldName]: error }));
    handleSave();
  }, [handleSave, validateSingleField]);

  // Returns inputData array for generic form rendering
  return { inputData, createHandleRemoveValue };
};
```

**Pattern:** Form ViewModels build `inputData[]` arrays with `{ label, value, fieldName, error, onChange, onBlur }` — enabling generic form component rendering.

### Analytics ViewModel (Multi-Query)

```ts
export const useAnalyticsViewModel = () => {
  const { data: userMetrics, isLoading: isLoadingUsers } = useGetUserMetrics();
  const { data: parkingMetrics, isLoading: isLoadingParking } = useGetParkingMetrics();

  const isLoading = useMemo(
    () => isLoadingUsers || isLoadingParking,
    [isLoadingUsers, isLoadingParking],
  );

  return { userMetrics, parkingMetrics, isLoading };
};
```

### Create/Edit Mode Hook

```ts
// features/parking/hooks/useParkingMode.ts
export const useParkingMode = () => {
  const params = useParams({ strict: false });
  const isCreateMode = params.parkingId === undefined;

  return {
    isCreateMode,
    isEditMode: !isCreateMode,
    parkingId: isCreateMode ? undefined : params.parkingId,
  };
};
```

## MUI Material Design 3 Theme

```ts
// theme.ts
const tonalPalettes = {
  primary: { 0: '#000000', 10: '#001A43', /* ... */ 100: '#FFFFFF' },
  secondary: { /* ... */ },
  // ...Material Design 3 tonal palette structure
};

const lightColors = {
  primary: { primary: tonalPalettes.primary['40'], onPrimary: '...', primaryContainer: '...' },
  surface: { surface: '...', onSurface: '...', surfaceContainer: '...' },
  // ...full MD3 color roles
  roles: { write: '#B8E8C1', read: '#F9D39A', none: '#F3A8A8' },
  datesStatus: { upcoming: '#00bfff', ongoing: '#4caf50', expired: '#9e9e9e' },
};

const theme = createTheme({
  palette: {
    primary: { main: lightColors.primary.primary },
    background: { default: lightColors.surface.surface },
  },
  customColors: lightColors,  // Extended via module augmentation
  components: {
    MuiSwitch: { /* MD3 switch overrides */ },
    MuiTablePagination: { /* custom font */ },
  },
});
```

**Pattern:** `customColors` extends MUI theme via `declare module '@mui/material/styles'` augmentation. Access in components: `theme.customColors.roles.write`.

## i18n

- `react-i18next` with `useTranslation()` hook
- Translation keys: `page.<feature>.<section>.<key>`
- Columns, labels, buttons all use `t()` — never hardcoded strings

## Path Aliases

```
@/ → src/
@parcus/shared-types → ../../packages/shared-types/src
```

Configured in `vite.config.ts` `resolve.alias` and `tsconfig.json`.

## Testing (Vitest)

```ts
// vite.config.ts
test: {
  environment: 'jsdom',
  globals: true,
  setupFiles: ['./__tests__/setup/vitest.setup.ts'],
  coverage: {
    provider: 'v8',
    reporter: ['text', 'lcov'],
  },
},
```

## Key Libraries

| Library | Purpose |
|---------|---------|
| `@tanstack/react-router` | Type-safe file-based routing |
| `@tanstack/react-query` | Data fetching + caching |
| `zustand` | Client state (auth) |
| `@mui/material` | UI component library |
| `axios` | HTTP client |
| `oidc-client-ts` | Keycloak OIDC authentication |
| `react-i18next` | Internationalization |
| `vite` | Build tool |
| `vitest` | Test runner |

## Shared Patterns (Mobile + Backoffice)

Both apps share these identical patterns:
- Feature-based directory structure under `src/features/`
- MVVM ViewModel hooks (`useXxxViewModel`)
- Service layer (pure async functions calling `apiClient`)
- React Query hooks in `queries/` (same naming: `useGetXxx`, `useCreateXxx`, `useUpdateXxx`, `useDeleteXxx`)
- Zustand auth store with `AUTH_STATUS` enum
- Axios API client with interceptor-based auth
- Types from `@parcus/shared-types`
- i18next translations with `page.<feature>.<key>` convention
- `@/` path alias → `src/`

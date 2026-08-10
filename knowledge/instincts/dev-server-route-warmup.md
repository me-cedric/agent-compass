---
id: dev-server-route-warmup
trigger: 'when routes are lazily imported and the development server pre-bundles dependencies on demand — a first navigation fails, or an import error appears only in development'
confidence: 0.9
domain: frontend
source: local-repo-analysis
---

# Warm the lazy routes, and pin the specifiers the optimiser misses

A development server that pre-bundles dependencies scans the entry graph at
start-up. A lazily imported route is not in that graph, so its dependencies stay
undiscovered until somebody opens the route. The server then re-optimises during
the navigation, the request already in flight becomes stale, and the page lands
on the error boundary. A reload fixes it, which is why the bug survives: it looks
random and it never happens in the production build.

## Pre-declare the lazy entry files

Name the route modules in the server warmup list. The server crawls them once at
start-up and finds every deep import before anyone navigates.

```ts
server: {
  warmup: {
    clientFiles: ["./src/pages/*.tsx"],
  },
},
```

Use the glob that matches the route directory, not a hand-written list. A list
goes stale on the next route, and the failure returns for that route only.

## Pin the specifiers an excluded package hides

A package excluded from pre-bundling gets served raw, including its CommonJS
dependencies. A CommonJS file has no `default` export, so the browser rejects the
import and the route dies with "does not provide an export named 'default'".

Add those nested specifiers to the pre-bundle include list. Use the
`parent > nested` form when the package manager does not hoist the nested
package, because the server cannot resolve the bare name from the project root.

```ts
optimizeDeps: {
  exclude: ["heavy-pkg"],
  include: ["heavy-pkg > legacy-cjs-dep/shim"],
},
```

## Write the failure text in the comment

Both problems appear once, months apart, and the fix looks arbitrary later.
Record the exact error message next to the setting. The next reader then matches
their console output to the comment instead of removing the line.

## Confirm the fix by navigating cold

Restart the server, then open the heaviest route first. A pass after a warm run
proves nothing, because the cache already holds the dependency.

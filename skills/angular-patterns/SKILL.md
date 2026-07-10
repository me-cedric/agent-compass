---
name: angular-patterns
description: Angular coding patterns — standalone components, signals, native control flow, inject()-based DI, forms, and accessibility. Use when writing or reviewing Angular components, services, directives, templates, or forms.
version: 1.0.0
filePattern: "**/*.component.ts,**/*.service.ts,**/*.directive.ts,**/*.pipe.ts,**/*.routes.ts,**/angular.json"
risk_level: low
writes_files: false
requires_tools: []
---

# Angular Patterns

Idiomatic modern Angular. Two sources, pick in this order:

1. **Live (preferred):** if the `angular-cli` MCP server is available
   (`templates/mcp/angular-cli.example.json`), call `get_best_practices` —
   it matches the workspace's installed Angular version — and
   `search_documentation` for API facts.
2. **Offline fallback:** [`best-practices.md`](best-practices.md), a vendored
   copy of Angular's official context file. It drifts as Angular releases;
   the provenance header says when it was fetched.

## Core rules (from the official guide)

- **Components**: standalone by default (never set `standalone: true` — it is
  the default since v20); small, single-responsibility; `input()`/`output()`
  functions over decorators; host bindings in the `host` object, not
  `@HostBinding`/`@HostListener`; inline templates for small components.
- **State**: signals for local state, `computed()` for derived state,
  `update()`/`set()` (never `mutate`); keep transformations pure.
- **Templates**: native control flow (`@if`/`@for`/`@switch`) — never
  `*ngIf`/`*ngFor`/`*ngSwitch`; `class`/`style` bindings — never
  `ngClass`/`ngStyle`; async pipe for observables; no complex logic in
  templates.
- **DI / services**: `inject()` over constructor injection; singletons via
  `providedIn: 'root'` (or the `@Service` decorator on v22+); one
  responsibility per service.
- **Forms**: Signal Forms (`@angular/forms/signals`) on v22+; otherwise
  Reactive Forms — not template-driven.
- **Routing**: lazy-load feature routes.
- **TypeScript**: strict mode; no `any` (use `unknown`); prefer inference
  when the type is obvious.
- **Accessibility**: must pass AXE checks and WCAG AA (focus management,
  contrast, ARIA).
- **Images**: `NgOptimizedImage` for all static images (not inline base64).

Version-gated rules (OnPush default, `@Service`, Signal Forms) apply only
when the workspace's Angular major supports them — check `package.json`
before enforcing.

## Validate

```bash
npx ng lint && npx ng test && npx ng build
```

## Related

- Stack preset: `stacks/angular-web.md` (MCP setup, official skills, WebMCP).
- Instinct: `knowledge/instincts/angular-ai-assets.md`.
- Refresh the vendored copy:
  `curl -sL https://angular.dev/assets/context/best-practices.md` and update
  the provenance header date.

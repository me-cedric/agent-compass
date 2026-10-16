---
description: Angular rules for standalone components, signals, native control flow, inject(), forms, routing and accessibility. Applies when you edit Angular components, services, templates or routes.
paths:
  - "**/*.component.ts"
  - "**/*.component.html"
  - "**/*.directive.ts"
  - "**/*.pipe.ts"
  - "**/*.service.ts"
  - "**/*.routes.ts"
  - "**/angular.json"
stacks: [angular-web]
---
# Angular rules

## Source of truth
- Before you write Angular code, call `get_best_practices` on the Angular CLI MCP server. It matches the installed Angular version.
- Call `search_documentation` for API facts. Do not guess an API.
- When the server is absent, read `https://angular.dev/assets/context/best-practices.md`.
- Read the Angular major in `package.json`. Apply a version-gated rule only when that major supports it.

## Components
- Use standalone components. Do not set `standalone: true`. It is the default since v20.
- Do not set `changeDetection: OnPush` explicitly on v22 or later. It is the default.
- Keep each component small with one responsibility.
- Use the `input()` and `output()` functions. Do not use the decorators.
- Put host bindings in the `host` object. Do not use `@HostBinding` or `@HostListener`.
- Use an inline template for a small component.

## State and templates
- Use signals for local state and `computed()` for derived state.
- Change a signal with `set()` or `update()`. Do not use `mutate()`.
- Keep state transformations pure.
- Use `@if`, `@for` and `@switch`. Do not use `*ngIf`, `*ngFor` or `*ngSwitch`.
- Use `class` and `style` bindings. Do not use `ngClass` or `ngStyle`.
- Use the `async` pipe for observables.
- Keep logic out of templates.
- Use `NgOptimizedImage` for static images. Do not inline base64 images.

## Services, forms and routes
- Use `inject()`. Do not use constructor injection.
- Provide a singleton with `providedIn: 'root'`. On v22 or later, use the `@Service` decorator.
- Give each service one responsibility.
- On v22 or later, use Signal Forms from `@angular/forms/signals`. Before v22, use Reactive Forms.
- Do not use template-driven forms.
- Lazy-load feature routes.

## Quality
- Use strict TypeScript. Use `unknown`, not `any`. Rely on inference when the type is obvious.
- Meet WCAG AA and pass the AXE checks: manage focus, keep contrast, use ARIA correctly.
- Before you finish, run `npx ng lint`, `npx ng test` and `npx ng build`.

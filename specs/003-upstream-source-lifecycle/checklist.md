# Checklist: External Source Lifecycle And Document Ingestion

Spec: [spec.md](spec.md)

## Clarity

- [x] Update checking and content refresh are separate actions.
- [x] Notification is automatic, but mutation is explicit.
- [x] Anydoc extraction does not replace format-specific creation or editing.
- [x] No unresolved clarification marker remains.

## Completeness

- [x] Existing and new external sources are in scope.
- [x] Provider hooks and a provider-neutral rule are in scope.
- [x] License, provenance, prompt-injection, and hosted-upload risks are in scope.

## Consistency

- [x] The plan reuses the existing Node.js CLI and cache.
- [x] The plan adds no dependency or background service.
- [x] Tests map to every behavior change.

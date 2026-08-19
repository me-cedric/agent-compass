# Plan: External Source Lifecycle And Document Ingestion

Spec: [spec.md](spec.md)
Date: 2026-08-19

## Summary

Extend the existing upstream-skill command. Add one source registry for every
vendored skill family. Use cached remote checks for notification. Use explicit
three-way refresh for updates. Import anydoc through the same registry.

## Technical Context

| Item | Decision |
| ---- | -------- |
| Runtime | Existing zero-dependency Node.js 20 or later |
| Remote query | `git ls-remote <repository> HEAD` |
| Registry | `skills/upstream-sources.json` |
| Existing operational lock | Keep `skills/upstream-lock.json` |
| Refresh | Temporary Git checkout and `git merge-file` |
| Notification | Existing 24-hour `check-update` cache and provider hooks |
| Dependencies | None |

## Affected Surfaces

- Skills: new anydoc skill and source registry.
- Code: upstream source library, upstream CLI, update check, manifest.
- Providers: Claude and Codex session-start hooks.
- Rules: shared document-ingestion and source-freshness guardrails.
- Tests: registry, check, refresh, hook, and anydoc coverage.
- Docs: skill catalog, CLI, source lifecycle, document ingestion, decision
  record, impact note, and delivery digest.

## Approach

1. Add failing tests for registry coverage and refresh behavior.
2. Import and harden the anydoc skill at the pinned source and package version.
3. Add the seven-source registry and verification library.
4. Extend the existing CLI with cached check and explicit update modes.
5. Connect the check to `check-update --remote` and provider startup hooks.
6. Update the shared rules, command registry, and documentation.
7. Run focused and full validation. Review the diff and build evidence.

## Validation

```bash
node --test test/upstream-sources.test.mjs test/upstream-skills.test.mjs \
  test/check-update.test.mjs test/skills-sync.test.mjs
node scripts/cli.mjs upstream-skills --verify
node scripts/cli.mjs catalog --grep convert-documents-to-markdown --md
npm run check
npm run check-companions
git diff --check
```

No typecheck or build command exists in `agent-compass.commands.json`.

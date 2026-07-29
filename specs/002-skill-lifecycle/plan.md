# Plan: Operational Skill Lifecycle

Spec: [spec.md](spec.md)
Date: 2026-07-29

## Summary

Keep four root packs as inventory truth, layer overlapping subpacks for
selection, lock every imported skill to upstream/local hashes, codify the import
transformation, add risk-aware quality checks, generate documentation blocks,
and expose skill discovery through one CLI command.

## Technical Context

| Item | Decision |
| ---- | -------- |
| Runtime | Existing zero-dependency Node.js ≥20 |
| Dependencies | None |
| Storage | `skills/upstream-lock.json` |
| CLI | `upstream-skills`, `check-skill-quality`, `skill-docs`, `skills` |
| Safety | Local checkout only; no network/freshness monitor; risk increases require explicit acceptance |
| Release | `0.7.0`, local commit and annotated tag; no push/publish |

## Affected Surfaces

- Code: `scripts/lib/capability-packs.mjs`, new lifecycle/doc/quality/search
  scripts and supporting libraries
- Tests: focused tests for packs, lock/refresh, quality, docs generation, CLI
  discovery, and command registration
- Docs: root README, skills catalog, CLI/tooling docs, architecture map,
  changelog, command registries
- Release: `package.json`, README version metadata, changelog, local tag

## Approach

1. Add tests defining root/subpack semantics and CLI contracts.
2. Add deterministic import transformation and generate lock from the pinned
   local upstream checkout.
3. Add verification/refresh command with reviewed risk baseline.
4. Add quality gate and wire it into `npm run check`.
5. Add generated documentation markers, writer, and drift checker.
6. Add `skills` search/details CLI and all registrations.
7. Validate and commit feature work.
8. Prepare version metadata, commit release, tag, then validate release.

## Validation

```bash
node --test test/capability-packs.test.mjs test/upstream-skills.test.mjs \
  test/check-skill-quality.test.mjs test/skill-docs.test.mjs \
  test/skills-info.test.mjs
npm run check
npm run check-companions
git diff --check
npm run lint:release
```

No typecheck or build command exists in `agent-compass.commands.json`.

## Docs And Spec Sync

- [x] Spec still matches implemented behavior.
- [x] README/skills generated blocks pass drift check.
- [x] CLI, command registry, catalog, architecture map, and changelog agree.
- [x] No API or environment-variable artifacts are affected.

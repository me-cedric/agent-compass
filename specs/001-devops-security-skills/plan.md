# Plan: DevOps, Security, Infrastructure, And Compliance Skills

Spec: [spec.md](spec.md)
Date: 2026-07-29

## Summary

Flatten selected upstream `SKILL.md` files into Agent Compass, preserve their
MIT provenance, add mandatory Compass metadata and safety gates, then expose
them through four opt-in capability packs. Keep import knowledge-only.

## Technical Context

| Item | Decision |
| ---- | -------- |
| Stack/runtime | Existing zero-dependency Node.js tooling and Markdown skills |
| Dependencies | None |
| Data/storage | 146 `skills/<name>/SKILL.md` files |
| APIs/contracts | `skills-sync --list-packs|--pack|--all`; catalog `capability-pack` type; command registry; `CAPABILITY_PACKS` export |
| Risks | Unsafe/stale operational commands; mitigate with safety gate, pinned provenance, no executable vendoring, and official-doc verification rule |

## Affected Surfaces

- Code: `scripts/lib/profiles.mjs`, `scripts/skills-sync.mjs`
- Tests: `test/profiles.test.mjs`, `test/skills-sync.test.mjs`
- Rules/knowledge: `AGENTS.md`, `docs/guidelines/`, `knowledge/instincts/`
- Docs/specs: `README.md`, `skills/README.md`, `CHANGELOG.md`,
  `THIRD_PARTY_NOTICES.md`, this spec folder

## Approach

1. Build a deterministic selection from the pinned upstream tree.
2. Copy only selected `SKILL.md` files, flattening by skill name.
3. Preserve upstream frontmatter and add Agent Compass metadata, safety, and
   provenance.
4. Add capability pack data and `skills-sync --pack`.
5. Add focused tests before changing sync behavior.
6. Update rules, knowledge, indexes, README, notices, and changelog.
7. Run focused validation, full checks, security scan, and spec convergence.

## Validation

```bash
node --test test/profiles.test.mjs test/skills-sync.test.mjs test/catalog.test.mjs
npm run lint:naming
npm run lint:indexes
npm run lint:docs
npm run check
```

No typecheck or build command exists in `agent-compass.commands.json`.

## Docs And Spec Sync

- [x] Spec still matches intended behavior.
- [x] README and skill catalog updated.
- [x] Agent contract and security guideline updated.
- [x] Third-party notice and changelog updated.
- [x] CLI, catalog, command registry, and default sync behavior updated.
- [x] No API or environment-variable artifacts are affected.

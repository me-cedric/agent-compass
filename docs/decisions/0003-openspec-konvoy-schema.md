---
status: accepted
date: 2026-10-16
decision-makers: [Cédric Meyer]
---

# One spec dialect: OpenSpec with the konvoy-delivery schema

## Context and problem statement

Three spec dialects exist: spec-kit (NE), native OpenSpec (StoryArc) and the konvoy-delivery OpenSpec schema (Konvoy).
Agents and checks cannot support three.

## Considered options

1. OpenSpec at `docs/openspec` with the konvoy-delivery schema.
2. Native OpenSpec with `design.md`.
3. GitHub spec-kit.

## Decision outcome

Chosen: option 1. Konvoy reads it natively, and OpenSpec gives `status --json`, deltas and `archive`.
Compass ships a migration plan for spec-kit and plain OpenSpec repos. A screen registry links specs to Figma nodes.

## Consequences

- Good: one gate (`openspec status`, `validate --strict`) for all repos.
- Bad: NE needs a spec migration later.

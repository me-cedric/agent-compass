# Spec: Operational Skill Lifecycle

Status: Implemented
Owner: Agent Compass maintainers
Created: 2026-07-29

## Goal

Make the 146 imported operational skills maintainable, reviewable, easier to
select, and easier to discover through Agent Compass CLI.

## Why

The initial import is safe and attributable, but a large knowledge catalog can
still fail through broad selection, manual documentation drift, unreproducible
updates, or silent growth in dangerous examples.

## Users And Scenarios

- Maintainer: verify local skill content against a pinned upstream lock.
- Maintainer: refresh from an explicitly provided local upstream checkout,
  review changes, and update hashes without an automatic remote monitor.
- Host adopter: select a focused cloud, Kubernetes, observability, AI
  operations, security, or compliance subpack.
- Agent/user: search the 196-skill catalog and inspect one skill's risk,
  provenance, packs, and path through the unified CLI.
- Reviewer: run one quality gate that detects missing safety controls,
  executable payloads, relative links, or changed dangerous-pattern baselines.

## Requirements

- REQ-001: Add ten fine-grained subpacks: `aws`, `azure`, `gcp`, `kubernetes`,
  `observability`, `ai-ops`, `security-scanning`, `secrets`, `hardening`, and
  `compliance-frameworks`.
- REQ-002: Preserve the four root packs as the non-overlapping canonical
  inventory of 146 imported skills; subpacks may overlap root packs.
- REQ-003: Store a deterministic lock with upstream path, pinned commit,
  upstream hash, local hash, risk level, and reviewed dangerous-pattern counts
  for every imported skill.
- REQ-004: Provide a zero-dependency CLI command that verifies the lock and can
  refresh from an explicitly supplied local checkout. It must not fetch or
  monitor remote state.
- REQ-005: Refresh must use the same metadata, safety, link-rewrite,
  attribution, and whitespace transformation as the initial import.
- REQ-006: Increased dangerous-pattern counts during refresh require an
  explicit acceptance flag.
- REQ-007: Add a quality gate covering safety/provenance text, knowledge-only
  packaging, standalone links, local hashes, and reviewed risk signals.
- REQ-008: README skill count and capability-pack sections must be generated
  from live skill/pack data and checked for drift in `npm run check`.
- REQ-009: Add unified CLI skill listing, search, pack filtering, JSON output,
  and exact skill details.
- REQ-010: Register new commands in CLI, command registries, package scripts,
  CLI docs, catalog, tests, and change-companion checks.
- REQ-011: Release the completed capability as version `0.7.0` with a
  conventional release commit and local annotated tag.

## Non-Goals

- Scheduled, automatic, or remote upstream freshness monitoring.
- Automatic merging of upstream changes.
- Vendoring upstream executable scripts/assets.
- Executing any operational command from an imported skill.
- Publishing, pushing, opening a PR, or creating a hosted release.

## Acceptance Criteria

- [x] Four root packs still contain exactly 146 unique skills.
- [x] Ten subpacks are listed, cataloged, searchable, and syncable.
- [x] Local upstream lock verification passes for all 146 skills.
- [x] Refresh dry-run against the pinned source reports no drift.
- [x] Risk-count increase is rejected without explicit acceptance.
- [x] Skill-quality gate passes current content and fails unsafe fixtures.
- [x] Generated README blocks are current; tampered blocks fail `--check`.
- [x] `agent-compass skills` lists, searches, filters, and explains skills.
- [x] `npm run check` includes new drift/quality gates and passes.
- [x] Version `0.7.0` metadata, commit, and annotated local tag agree.

## Implementation Status

Implemented, merged into `main`, and released as `0.7.0` on 2026-07-29. See
[plan.md](plan.md) and [tasks.md](tasks.md) for exact surfaces and checks.

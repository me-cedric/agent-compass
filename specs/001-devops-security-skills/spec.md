# Spec: DevOps, Security, Infrastructure, And Compliance Skills

Status: Implemented
Owner: Agent Compass maintainers
Created: 2026-07-29

## Goal

Make Agent Compass a usable source for the requested DevOps skills and the
upstream repository's security, infrastructure, and compliance knowledge.

## Why

Agent Compass currently covers coding workflow and application stacks well but
has limited operational depth. Hosts need portable, opt-in guidance for CI/CD,
containers, Kubernetes, observability, AI operations, infrastructure, security,
and compliance without installing an unrelated repository or unsafe executable
payloads.

## Users And Scenarios

- Platform engineer: sync only the DevOps or infrastructure pack needed by a
  host project.
- Security engineer: load focused defensive security guidance without granting
  production write access.
- Compliance owner: use control and evidence guidance without treating agent
  output as an audit or legal opinion.
- Agent Compass maintainer: trace imported content to an exact upstream commit
  and license.

## Requirements

- REQ-001: Include the 22 DevOps skills named by the user.
- REQ-002: Include all 35 security, 70 infrastructure, and 19 compliance skills
  present at upstream commit `0365f57a079b1332f95cf26e31dd2d5332a8399f`.
- REQ-003: Every imported skill must satisfy Agent Compass frontmatter and
  catalog contracts.
- REQ-004: Imported operational guidance must carry a clear authorization,
  dry-run, rollback, least-privilege, and verification safety gate.
- REQ-005: Upstream executable scripts and assets must not be vendored.
- REQ-006: Users must be able to discover and sync the imported skills as four
  opt-in packs through the unified CLI: DevOps platform, security,
  infrastructure, and compliance.
- REQ-007: Agent Compass must retain upstream MIT attribution and the pinned
  source commit.
- REQ-008: Agent rules and knowledge must cover safe infrastructure changes,
  incident evidence preservation, and compliance limitations.
- REQ-009: README and skill catalog must present the new capabilities clearly,
  using the source repository's scan-friendly hero, capability-map, and
  activation-flow style without copying its branding.
- REQ-010: Capability packs must appear in the machine-readable catalog and
  command registry; default project/global sync must exclude them unless a pack
  or `--all` is explicitly selected.

## Non-Goals

- Vendor upstream shell scripts, executable assets, or automation.
- Auto-install all imported skills into every host.
- Claim certification, legal advice, or guaranteed correctness of
  tool/version-specific examples.
- Add cloud credentials, production access, or deployment automation.
- Import the 17 upstream DevOps skills not named by the user.

## Acceptance Criteria

- [x] Catalog reports exactly 146 upstream-derived skills.
- [x] All four packs resolve to existing skills with no overlap or duplicates.
- [x] `skills-sync --pack` accepts one or more pack names and rejects unknown
  packs.
- [x] Unified CLI lists packs, catalogs them, and copies an exact selected pack.
- [x] Default project/global sync excludes packs; explicit `--all` includes them.
- [x] Every imported skill includes Agent Compass safety and provenance text.
- [x] Agentic operational rules are linked from `AGENTS.md`.
- [x] Relevant knowledge instinct and documentation indexes are updated.
- [x] Third-party notice contains the upstream copyright and MIT license.
- [x] README exposes capability counts, opt-in sync examples, and activation
  flow.
- [x] `npm run check` passes.

## Implementation Status

Implemented and validated on 2026-07-29. See [plan.md](plan.md) and
[tasks.md](tasks.md) for exact surfaces and checks.

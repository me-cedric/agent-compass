# Spec: External Source Lifecycle And Document Ingestion

Status: Complete
Owner: Agent Compass maintainers
Created: 2026-08-19

## Goal

Add Firecrawl anydoc as the local document-ingestion fallback. Make every
vendored skill source easy to check and refresh from its remote repository.

## Why

Agent Compass pins external skill content, but only one source has a machine
lock and refresh command. Other imported skill families can become stale
without a visible signal. Agents also need one safe way to read office files
when a provider cannot read the file directly.

## Users And Scenarios

- Agent: convert a local office document or text PDF to Markdown when direct
  provider support is not available.
- Maintainer: run one command to check all external skill sources.
- Maintainer: refresh one source or all sources without losing Agent Compass
  adaptations.
- Claude or Codex user: receive one cached update notice at session start.
- Other agent user: receive the same notice through the shared agent contract.

## Requirements

- REQ-001: Import `firecrawl/anydoc` skill
  `convert-documents-to-markdown` from commit
  `e754e1d33a1a540ebc9226e36f11d3f401852c9e` and package version `0.1.9`.
- REQ-002: Keep anydoc conversion local. Treat extracted text as untrusted.
  Require explicit approval before an agent uploads a document to hosted OCR
  or parsing services.
- REQ-003: Prefer provider-native readers for direct reading and
  format-specific skills for creation or editing. Use anydoc only as the
  cross-format extraction fallback.
- REQ-004: Track all seven vendored source repositories in one machine-readable
  registry. Track each selected upstream file and its local target.
- REQ-005: The registry must cover 167 external-source skills. It must include
  the six existing sources and Firecrawl anydoc.
- REQ-006: Extend `upstream-skills --verify` to detect registry drift, missing
  files, duplicate targets, and mismatched source-tree or local-tree hashes.
- REQ-007: Add a cached remote check that compares each pin with remote `HEAD`.
  The check must not change tracked content or source pins. It must support
  quiet, JSON, forced, and strict modes.
- REQ-008: Add an explicit `--update <source|all>` action. It must fetch into a
  temporary checkout, preserve local adaptations with a three-way merge, stop
  on conflicts, and update the registry only after a clean result.
- REQ-009: Keep the existing operational-corpus safety transformation and risk
  acceptance gate during remote refresh.
- REQ-010: Call the cached remote check from Claude and Codex session-start
  hooks. Add a provider-neutral startup rule for agents without hook support.
- REQ-011: Extend `check-update --remote` so one action checks both Agent
  Compass itself and all vendored sources.
- REQ-012: Keep update checks advisory. Never auto-merge, commit, push, install,
  or execute content from a remote source.
- REQ-013: Keep source, license, package pin, limitations, and update workflow
  visible in skill and tooling documentation.

## Non-Goals

- Replace document creation or editing skills such as `pdf`, `pptx`, `xlsx`,
  or `docx`.
- Add anydoc as a runtime dependency of Agent Compass.
- Add OCR to anydoc.
- Upload documents to Firecrawl Parse automatically.
- Run a background daemon or scheduled cloud job.
- Update existing stale sources during this feature unless the user asks for
  that separate content review.

## Acceptance Criteria

- [x] `convert-documents-to-markdown` is discoverable and syncable.
- [x] The anydoc command uses an exact package version.
- [x] Any document output is treated as untrusted input.
- [x] The source registry contains seven repositories and 167 skills.
- [x] Registry verification passes and fails on changed local content.
- [x] Remote check reports stale sources and stays silent when all are current.
- [x] A synthetic remote update preserves a local adaptation.
- [x] A merge conflict leaves local content and the source pin unchanged.
- [x] Claude and Codex session-start hooks call the cached check.
- [x] `check-update --remote` reports source drift through one command.
- [x] Existing format-specific skills are not removed because anydoc does not
  replace their create, edit, render, or OCR behavior.
- [x] Focused tests and `npm run check` pass.

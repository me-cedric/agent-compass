---
status: accepted
date: 2026-10-16
decision-makers: [Cédric Meyer]
---

# Own lean engine, delivered as a submodule on a release tag

## Context and problem statement

Compass 0.9 installs through a chain of 7 wrapper scripts, two delivery modes (submodule and vendored copy)
and three skill copy paths. Hosts drift (NE on 0.7.0, PP on 0.9.4) and edits get lost or duplicated.
CGI GitLab runners have no internet access.

## Considered options

1. Own lean zero-dependency Node engine with APM-style semantics.
2. Microsoft APM (v0.33, pre-1.0) as the engine.
3. Delivery channel: npm package on a registry, or git submodule on a tag.

## Decision outcome

Chosen: option 1 with a git submodule at `docs/agent-compass`, pinned to a release tag.

The engine keeps a per-file hash lock, removes stale files that it placed, keeps edited files and reports them,
and offers `ac check --frozen` for CI. It has no prompts, a timeout on every network call, and honest exit codes.

## Consequences

- Good: works offline; one writer per file; Renovate can bump the submodule tag.
- Good: the engine also manages non-agent files (CI, env catalog, process-compose).
- Bad: compass owns about 1,500 lines of engine code and its tests.

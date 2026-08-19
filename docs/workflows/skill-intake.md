# Skill Intake

How to decide whether a local or public agent skill belongs in Agent Compass.

## Rule

Import the reusable rule, not the whole personal workflow. Agent Compass should
stay tool-agnostic unless a provider file makes setup materially easier.

## Intake Gate

Add a skill or workflow when all are true:

- It solves a repeated project problem, not one person's preference.
- It has no secret, client, hostname, account, or local path baked in.
- It works as Markdown instructions or a small repo script.
- It has a clear trigger and completion check.
- It improves setup, reasoning, orchestration, validation, or review.

Do not import when:

- It depends on a private global path like `$HOME/.claude/...`.
- It is a document creation, editing, rendering, or media utility better kept
  global (`pdf`, `pptx`, `xlsx`, `docx`) unless a project workflow requires it.
- It duplicates an existing Agent Compass skill with only wording changes.
- It adds ceremony without a runnable check.

## Current Decisions

Imported or already covered:

- `caveman`, `ponytail`: working-style defaults.
- `convert-documents-to-markdown`: local, cross-format extraction fallback for
  providers that cannot read an office file directly. It does not replace the
  format-specific creation, editing, rendering, or OCR skills.
- `diagnosing-bugs`: imported as the smaller `debug-loop` skill.
- GSD phase/workspace ideas: covered by specs, runbook, context-pack, trace, and
  `setup-host`; do not vendor GSD because it depends on private global paths.
- Spec Kit: supported as an optional workflow bridge; keep generated provider
  files in the host when installed, do not vendor upstream internals.
- Figma frontend setup from a production React admin project: generalized in
  `figma-mcp-frontend`, design-system template, and provider capability docs.
- `BagelHole/DevOps-Security-Agent-Skills`: 146 skills imported at pinned commit
  `0365f57a079b1332f95cf26e31dd2d5332a8399f` after explicit user request.
  Import is knowledge-only, split into four opt-in packs, carries a mandatory
  operational safety gate, and excludes upstream executable scripts/assets.
  See [`THIRD_PARTY_NOTICES.md`](../../THIRD_PARTY_NOTICES.md).
- All external skill families: registered in `skills/upstream-sources.json` for
  cached remote checks and explicit reviewed refresh. Remote content is never
  executed or merged automatically.
- Global config scan: keep personal defaults global; Agent Compass already ships
  generic templates for context7, fetch, sequential-thinking, Figma MCP,
  projectmem, headroom, Codex hooks, Claude hooks, and skillshare-style sync.

Candidate imports later:

- `dogfood`: add a generic browser QA skill when the repo has a stable browser
  automation story.
- `review`: add two-axis standards/spec review only if subagent support is
  available in target providers.
- `harness`: add a lighter long-running checkpoint workflow if `.agent/trace`
  is not enough.

## Public Repo Scan

Useful public patterns to track:

- GitHub Spec Kit: spec → plan → tasks → implement provider integrations
  ([repo](https://github.com/github/spec-kit),
  [GitHub blog](https://github.blog/ai-and-ml/generative-ai/spec-driven-development-with-ai-get-started-with-a-new-open-source-toolkit/)).
- Claude/agent skills repositories: single-folder `SKILL.md` packaging with
  progressive loading
  ([Claude docs](https://code.claude.com/docs/en/skills),
  [Anthropic skills repo](https://github.com/anthropics/skills)).
- Skillshare-style sync: one source copied/symlinked into many agent tools
  ([skillshare](https://github.com/runkids/skillshare)).
- Supply-chain caution: third-party skills/repos can be executable
  instructions. Pin, inspect, and import only after review
  ([GitHub changelog](https://github.blog/changelog/2026-04-16-manage-agent-skills-with-github-cli/)).

Keep these as patterns unless their files pass the intake gate above.

## June 2026 GitHub Scan

`gh search repos 'claude code skills'` and `gh search repos 'agent skills SKILL.md'`
showed these useful buckets:

- Already covered: terse style (`caveman`), security review (`verify-security`),
  skill catalogs/sync (`skillshare` pattern), `SKILL.md` validation (`check-naming`
  and `lint:indexes`).
- Too domain-specific for baseline: Android reverse engineering, ads/SEO, .NET,
  video editing, print-on-demand.
- Worth tracking but not vendoring: Trail of Bits security skills, generic
  skill marketplaces, skill lint CLIs, and Spec Kit install helpers.

Decision: import no unreviewed third-party skill wholesale. Default to small,
generic extraction. Broad imports require explicit scope, pinned provenance,
license retention, executable exclusion or audit, safety hardening, opt-in
distribution, and content tests. Current imports: `debug-loop` and the curated
DevOps/security/infrastructure/compliance packs above.

## Integrated Tool Patterns

Patterns now implemented as repo scripts:

- Skill dependency metadata: `check-naming.mjs` enforces `risk_level`,
  `writes_files`, and `requires_tools`.
- Skill distribution: `skills-sync.mjs` copies or symlinks project skills;
  `global-setup.mjs` does the same for user-level installs.
- Policy packs: `policy-pack.mjs` applies opinionated setup gates without
  hardcoding one workflow for every repo.
- MCP readiness: `mcp-probe.mjs` catches missing commands and unfilled
  placeholders before agents rely on tools.
- Spec traceability: `spec-validation-map.mjs` maps specs to plan/tasks/checks.
- Design-system import: `design-importer.mjs` turns Figma/token exports into
  repo docs agents can follow.

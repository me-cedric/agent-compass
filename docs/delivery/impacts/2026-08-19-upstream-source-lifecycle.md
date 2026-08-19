# Impact Analysis: External Source Lifecycle And Document Ingestion

Date: 2026-08-19
Baseline: `fe9d87b36c614802615df7b790b0e585071970c3`
Status: Validated

## Change Summary

Agent Compass now has one pinned registry for all seven external skill sources.
It can check remote heads through one cached action and can refresh one source
or all stale sources only after an explicit request. Firecrawl anydoc is the
local document-to-Markdown fallback.

The change covers 167 externally sourced skills. It preserves the stricter
adapter and risk gate for the 146-skill operations corpus.

## Impact By Area

### Behavior

- Agents can extract text from supported office files and text PDFs when a
  provider-native reader is not available.
- Maintainers get a cached stale-source notice at session start.
- A maintainer can preview or apply a reviewed three-way source refresh.
- A conflict stops the refresh and leaves the local file and pin unchanged.

### Contracts

- The command registry adds `agentTools.upstreamSkillsCheck`.
- The upstream-skill command adds remote check and explicit refresh modes.
- Claude and Codex session-start templates call one managed, non-blocking
  wrapper.
- The shared agent contract asks other providers to run the same cached check.

### Data

- No application data model changes.
- Source metadata now records repository, commit, selected files, local and
  upstream hashes, license, and optional package version.
- Update caches are local and ignored by Git.

### Configuration

- Host sync installs one managed update-check wrapper.
- Claude and Codex hook templates call that wrapper.
- Root and host ignore rules exclude both update-check caches.
- A version migration adds the new cache ignore to existing hosts.
- No environment variable was added or changed.

### Security And Privacy

- Remote checks read Git commit identifiers only.
- Refresh fetches selected content to a temporary checkout and never runs
  upstream scripts, hooks, installers, or package lifecycle commands.
- Anydoc uses an exact package version.
- Agents must treat documents and extracted Markdown as untrusted input.
- Hosted parsing or OCR needs explicit approval and a data-classification
  check.
- The tracked source-repo cache was removed so checks do not dirty the worktree.

### Operations

- A remote check can make network requests once per 24-hour cache period.
- Network failure does not block an agent session.
- No daemon, scheduled cloud task, automatic merge, commit, push, or publish was
  added.
- A follow-up refresh advanced taste-skill, caveman, i-have-adhd, and
  asd-ste100 to their current remote heads.
- Caveman and asd-ste100 had text conflicts. The refresh kept Agent Compass
  metadata, style-contract links, and provenance while accepting reviewed
  upstream rule and example changes.

### Documentation

| Artifact | State | Reason |
| -------- | ----- | ------ |
| Feature spec, plan, tasks, checklist | Updated | Define and track the change. |
| Architecture decision | Updated | Record the source-registry choice. |
| Tooling and CLI guides | Updated | Explain check, verify, and refresh actions. |
| Document-ingestion guide | Updated | Define selection and safety rules. |
| Shared agent contract | Updated | Add provider-neutral startup and ingestion rules. |
| Skill catalog and root README | Updated | Make the new skill discoverable. |
| Provider capability and upgrade guides | Updated | Describe managed startup notices. |
| API, data, and UI documents | Not affected | No API, data-model, or visual behavior changed. |

## Validation

| Command | Result |
| ------- | ------ |
| `npm run check` | Passed: 226 tests and all configured gates. |
| `npm run check-companions` | Passed. |
| `node scripts/cli.mjs upstream-skills --verify` | Passed: 146 locked skills and seven source pins. |
| `node scripts/cli.mjs catalog --grep convert-documents-to-markdown --md` | Passed: skill is discoverable. |
| `node --check scripts/lib/upstream-sources.mjs` and related scripts | Passed. |
| `npm run lint:release` | Passed. |
| `git diff --check` | Passed. |
| `npx -y @firecrawl/anydoc@0.1.9 --help` | Passed: pinned CLI starts and reports supported options. |
| Live remote source check | Passed: four stale pins reported. |
| Live `--update all --dry` | Expected stop: two merge conflicts, no files written. |

No typecheck or build command exists in the command registry.

## Remaining Risks

- A clean text merge can still change meaning. A maintainer must review each
  source refresh and run the full gate.
- Remote `HEAD` reports freshness. It does not establish trust.
- Scanned or image-only PDFs still need an approved OCR path.
- A later source update can conflict with local adaptations and still needs the
  same manual review.

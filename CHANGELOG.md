# Changelog

All notable changes to agent-compass are documented here. Keep entries short.
Format loosely follows [Keep a Changelog](https://keepachangelog.com/).

## [Unreleased]

### Fixed

- **A stale install is no longer silent.** An install is a snapshot of a pin, so
  it now records one: `.agent/external-skills.json` (or
  `~/.agent-compass/external-skills.json` for `--global`) holds the source, the
  commit it came from, the skills, and the targets. `external-skills --check`
  compares that against the current pins offline, and `--upgrade` re-installs
  every record at the current pin. The check runs on three paths without being
  asked — the session-start hook, `recommend`, and `install --doctor` — because
  for the operational corpus a moved pin means the safety gate and the
  argv-secret narrowings were regenerated, which is not cosmetic.
- **A tracked package version is now part of the verified contract.** `anydoc`
  had moved `0.1.9` → `0.2.3` while its commit pin looked current, leaving the
  `convert-documents-to-markdown` skill telling agents to run a version four
  releases old. A reference source can now declare `package` and `version`:
  `--verify` fails when any local file (including a `tool_version` frontmatter
  field) pins a different version, and `--update` rewrites every occurrence when
  the pin moves.
- Refreshed the four stale source pins — `taste-skill`, `caveman`,
  `i-have-adhd`, and `anydoc`. All nine sources are now current, and the anydoc
  package pin advanced to `0.2.3` in the skill along with it.


## [0.9.0] - 2026-08-23

### Fixed

- `release` is idempotent. A second run for the same version inserted a second,
  empty `## [<version>]` heading, and the changelog extractor then matched the
  empty one — so every forge release got a `Release v<version>` placeholder body
  instead of the notes. It now leaves an existing section alone.

### Changed

- **No external skill is stored in this repository any more.** All nine sources
  moved to `"strategy": "reference"`, which removed 166 vendored skill folders
  and `skills/upstream-lock.json`. The registry keeps the pin, the licence, the
  full upstream inventory, and a new `recommended` field holding Agent Compass's
  own curation — 146 of 163 operational skills, 3 of 20 caveman skills, 10 of 13
  design skills. Nothing about the update lifecycle changed: one cached
  `--check-updates` covers all nine, and `--verify` still runs offline.
- **The operational safety adapter moved from vendoring time to install time.**
  The corpus was vendored so Agent Compass could rewrite it — a safety gate on
  every skill and eight passages with the secret taken out of `argv`. Tracking it
  would have lost that, so `scripts/lib/upstream-skills.mjs` now runs inside the
  installer instead. No uncorrected copy exists anywhere, an override whose
  upstream target was reworded still fails rather than being dropped, and the
  guarantee is now asserted against install output for all 146 skills.
- **One install path for local and tracked skills.** `skills-sync --only` routes
  each requested name to the local copy or the tracked source automatically, and
  stack profiles name external skills in an `external` field that `selectAssets`
  merges into `skills`. `recommend`, `adopt`, and `setup-wizard` therefore behave
  exactly as they did when the skills were vendored — a caller passes one list and
  never needs to know which kind a name is. `global-setup --style` does the same
  user-wide.
- **`skills` answers for a tracked skill.** `agent-compass skills <name>` reports
  the source, pin, licence, pack membership, and install command for a skill that
  is not on disk; `--grep` matches a hyphenated slug from a spaced query
  ("github actions" finds `github-actions`); `--pack <id>` reports the pack and
  how to install it.
- `convert-documents-to-markdown` is now compass-authored guidance for the pinned
  `@firecrawl/anydoc` CLI rather than a copy of the upstream skill. The `anydoc`
  source stays tracked so the version pin remains visible.
- Retired `check-skill-quality` and the `lint:skill-quality` gate. What they
  guarded is now covered by `upstream-skills --verify` plus the install-output
  tests.

### Added

- **`external-skills` — one installer for Claude Code, Codex, and Copilot.**
  Fetches a tracked source at its pin and writes `.claude/skills/` and
  `.agents/skills/`, plus a `.github/instructions/` file because Copilot has no
  skills directory. `--global` installs user-wide, `--recommended` takes the
  compass curation, `--skill <a,b>` or `--all` take a selection, `--dry` shows the
  plan. Executable payloads are refused unless `--allow-scripts` is passed, and
  each source's licence notice — including PolyForm's verbatim `Required Notice`
  line — is written beside the install.
- Compass-authored routers replacing the deleted copies:
  [`operational-skills`](skills/operational-skills/SKILL.md),
  [`design-taste-skills`](skills/design-taste-skills/SKILL.md), and
  [`working-style-skills`](skills/working-style-skills/SKILL.md) — each carrying
  the curation reasoning that used to be implicit in which folders existed.
- Pointer documents: [operational-skills.md](docs/tooling/operational-skills.md)
  (the eight narrowings in full) and
  [style-and-design-skills.md](docs/tooling/style-and-design-skills.md).
- **`compass-external-source` mission skill.** The guided path for adding,
  listing, curating, refreshing, or removing a tracked source: the licence gate
  runs first (no licence means refuse; a use restriction is escalated, not
  absorbed), then the registry entry, the computed inventory, the pointer
  document, the narrowings, the fit wiring, and the tests. Routed from
  [`MISSIONS.md`](MISSIONS.md).

- **Native mobile coverage, tracked instead of copied.** Two published skill
  corpora are now registered in `skills/upstream-sources.json`:
  [`android/skills`](https://github.com/android/skills) (21 skills, Apache-2.0,
  Google LLC) and
  [`dpearson2699/swift-ios-skills`](https://github.com/dpearson2699/swift-ios-skills)
  (86 skills, PolyForm Perimeter 1.0.0). Neither is vendored. The Apple corpus
  carries a noncompete term, and Agent Compass redistributes skills to host
  projects, so copying it would engage that term; the Android corpus ships its
  own installer and keeps its mirrored documentation fresher than a mirror would.
  See [ADR 002](docs/decisions/002-tracked-external-reference-sources.md).
- **A third source strategy, `reference`.** A reference source is pinned,
  update-checked, and documented, but owns no local file. It records an `install`
  command, an `inventoryRoot`, an `inventoryDoc`, `pointers`, and the
  `upstreamSkills` inventory at the pinned commit. `upstream-skills --verify`
  fails offline when a pointer disappears, stops naming its repository, or when
  the generated inventory block drifts. `upstream-skills --update <id>` re-reads
  the inventory from the new tree with `git ls-tree` and `git show`, moves the
  pin, rewrites the inventory block, and prints added and removed upstream
  skills — copying nothing and executing nothing. Both new sources join the
  existing cached `--check-updates` path with no separate command.
- **`native-mobile-skills` skill.** Routes a native Android or Apple-platform
  task to the vendor skill that covers it, installs it with the vendor's own
  installer, and keeps the compass gates in force: validation on the real
  toolchain, an emulator or simulator screenshot for a screen change, and no
  third-party skill relaxing §4. Self-contained, so it still routes after
  `skills-sync` copies it into a host without the compass tree.
- **`android-compose` and `swift-ios` stack presets**, with detection.
  `detectStacks` now recognises an Android Gradle plugin, `AndroidManifest.xml`,
  an Xcode project or workspace, `Package.swift`, and `Podfile` — and holds back
  when Expo, React Native, or Flutter is present, because those toolkits generate
  the `android/` and `ios/` trees rather than owning them. A Gradle build only
  counts as Android when a build file applies an Android plugin, so a Kotlin
  service does not match.
- **`platform-skill-before-memory` instinct.** Why recall fails on a
  yearly-release platform, and which of the two failure modes reaches review.


## [0.8.1] - 2026-08-19

### Fixed

- **Every externally sourced skill now carries its MIT notice.** The `LICENSE`
  file reached only the first skill of each multi-skill source, and none of the
  146 skills of the operational corpus. A host that installs one skill folder
  therefore received MIT content without the notice the terms require. 152 skill
  folders gained the file, and the safety gate accepts `LICENSE` beside
  `SKILL.md` while it still refuses every executable payload.
- **The session-start update hook finds a vendored compass again.** It searched
  `docs/agent-compass/scripts/` alone, so a host that vendors anywhere else got
  no notice. It now searches the common locations and honours
  `AGENT_COMPASS_HOME`. A host that installs skill folders alone, and carries no
  compass tree, still leaves quietly.
- **The external source cache is ignored wherever it is written.** The
  `.gitignore` entry held a slash, which anchors a pattern to the directory of
  the `.gitignore`. It therefore never matched
  `docs/agent-compass/.agent/.upstream-source-check.json`. The pattern is now
  unanchored, and migration `0.8.1` widens it for a host that already took the
  anchored form.

## [0.8.0] - 2026-08-19

### Added

- A pinned external-source registry, cached update notices, reviewed refresh
  commands, and provider startup hooks now keep externally sourced skills
  traceable and easy to update without automatic merges.
- `convert-documents-to-markdown` adds a pinned, local document-ingestion
  fallback for office files and text PDFs.
- `codebase-to-specs` drafts explicitly inferred specifications, decision
  records, and architecture sketches from an existing codebase for human review.

### Changed

- Four stale external skill sources were refreshed to their reviewed remote
  heads while local safety metadata and guidance were preserved.
- `diagram-to-adr` and `diagram-to-likec4` supersede the Excalidraw-only skills.
  They add draw.io, embedded draw.io SVG, Mermaid, and appropriate BPMN support.

## [0.7.9] - 2026-08-17

### Fixed

- **An evidence bundle no longer asks to be committed.** `.agent/evidence/` and
  `.agent/changes/` join the generated artifacts the gitignore template already
  lists. Both hold copied screenshots, so a host that adopted that template would
  otherwise have carried megabytes of regenerable images into its history on the
  first run. Publish a bundle as a CI artifact instead.

## [0.7.8] - 2026-08-17

### Added

- **`agent-compass evidence` builds the artifact a completion claim owes.** It
  collects every JUnit report and screenshot into a self-contained bundle at
  `.agent/evidence/` — `index.html` for a human, `summary.md` for the pull
  request — and the status is binary: complete only when nothing failed and the
  promised screenshots exist. Configure it with the `evidence` key of
  `agent-compass.commands.json`. Without that key it discovers the files and
  says so in the report, because a discovered count is a weaker claim than a
  declared one.
- **A before/after report for a spec'd change.** `evidence --change <slug>
  --phase start` records the proof and a SHA-256 snapshot of the workspace;
  `--phase finish` re-runs, diffs the snapshot, lists the changed and tested
  files, reads the acceptance criteria out of the spec, and renders the before
  and after screenshots side by side under `.agent/changes/<slug>/`. It is a
  gate: it exits non-zero unless the after-proof is complete **and** something
  actually changed, so a green suite over an empty diff cannot pass.
- **`docs/guidelines/definition-of-done.md`.** The formalism behind the
  Completion Gate: the `AUTO` / `PR` / `REVIEW` / `N/A` proof types, the rule
  that no level compensates another, the blocking conditions, the actions an
  agent may never take against a test, and an exception procedure that needs an
  owner and a deadline and then expires.
- **`docs/guidelines/accessibility.md`**, the first accessibility rules in the
  compass, plus the `keyboard-path-before-done` instinct. An automated audit
  reads the rendered tree; it cannot tell you that Tab skips your new button.
- **`specs/change-spec-template.md`**, whose `## Acceptance criteria` and
  `## Expected proof scenarios` headings are read literally by the change
  report, and the `evidence-outlives-the-claim` instinct.

### Changed

- **`docs/guidelines/testing-tdd.md` gained the proof half of testing**: a fixed
  screen-profile matrix, the difference between regenerable execution evidence
  and committed visual baselines that only a human may update, the evidence
  commands, and the forbidden anti-patterns.

### Fixed

- **`code-intel status` reports an indexed repository as indexed.** The project
  listing is read for a root path under five key names, and
  `codebase-memory-mcp` 0.10.5 returns the one that was missing, `root_path`.
  Every status read therefore ended on "this repository indexed: no", whatever
  the graph held. `doctor` never read that field and was correct throughout.

## [0.7.7] - 2026-08-15

### Fixed

- **The Windows install path works.** `agent-compass code-intel install` now
  downloads and runs `install.ps1` through `pwsh` or `powershell` instead of
  refusing with "POSIX-only". Upstream parses `$args`, not a `param()` block, so
  the flag is `--skip-config` on both platforms — the manual command previously
  printed `-SkipConfig`, which PowerShell would have ignored while the installer
  rewrote every agent's configuration.
- Windows executable discovery looks in `%LOCALAPPDATA%\Programs\codebase-memory-mcp`
  and its `bin\` subdirectory, the real `install.ps1` default, instead of the
  POSIX `~/.local/bin`. `PATH` splits on `;` on Windows and `:` elsewhere. Every
  platform difference is now a pure function of `(platform, env)` and the whole
  matrix is tested from any host.
- POSIX install falls back to `wget` when `curl` is absent, and a host with
  neither fails with the missing tool named plus the exact manual command. The
  downloaded installer is removed afterwards instead of being left in the
  temporary directory.
- `agent-compass mcp-probe` no longer reports the code-intelligence MCP example
  as a readiness gap on hosts that never opted in. The example ships to every
  host as a catalogue entry; it is probed once the host selects the layer.

### Added

- `docs/tooling/codebase-memory.md` gains a platform matrix, Windows
  troubleshooting rows, and a worked false-positive example: a real
  `detect_changes` run on this repository returned an unrelated shell function
  among eight impacted symbols, with nothing marking the row as wrong.

## [0.7.6] - 2026-08-15

### Added

- **Structural code intelligence via `codebase-memory-mcp` (optional).** A new
  `agent-compass code-intel` command (`status`, `install`, `configure`, `setup`,
  `doctor`) installs the CBM binary with `--skip-config` and lets Agent Compass
  keep ownership of provider and MCP configuration. `scripts/lib/codebase-memory.mjs`
  is the single place that finds, reads, installs, and configures the binary.
  Setup enables `auto_index` and `auto_watch`, creates
  `.mcp/codebase-memory.example.json` from the new template, ignores the
  generated `.codebase-memory/` graph, and records
  `"codeIntelligence": "codebase-memory"` in the answers file.
- `AGENTS.md` §1b **Codebase navigation**: query the code graph before broad
  grep, read the exact files it returns, and never turn one query into an
  exhaustive or negative claim without checking index coverage and corroborating
  in source. Adds the four-source table (code, docs/ADRs, graph, projectmem),
  the query hierarchy, token-discipline rules, and the ADR-ownership rule that
  keeps `docs/decisions/` canonical against CBM's own `manage_adr` feature.
- `docs/tooling/codebase-memory.md` — purpose, when not to use it, install, CLI,
  MCP, auto-index/watch, cache and ignore policy, the opt-in shared graph
  artifact, the projectmem split, ADR ownership, `depgraph` comparison,
  troubleshooting, update/uninstall, and privacy.
- Doctor, `recommend`, `mcp-probe`, and the setup wizard now know the layer.
  Repo-level facts (ignore rule, MCP example) are required once a host selects
  it; machine-level facts stay advisory so a plain clone and CI never fail.
  Five eval scenarios cover navigation, impact, fallback, durable history, and
  the negative-claim rule.

- A release request now ends at a **published forge release**, not at a pushed
  tag. `AGENTS.md` §10 names the three artifacts a release owes: the version in
  the project files, the tag on every remote, and the published release on every
  remote forge. `scripts/release.mjs` gains `--release`, which implies `--push`,
  uses the changelog section of the version as the release body, publishes once
  per repository behind the remotes, and treats an existing release as success.

## [0.7.5] - 2026-08-15

### Added

- **A release request means publish.** `AGENTS.md` §10 now states that "push a
  release", "release a patch", "release a new version", or "cut a release" is
  the explicit ask that the safety rule requires, and that it authorizes the
  whole chain: bump, validate, commit, tag, then push the commit and the tag to
  **every** remote that `git remote` lists. A local tag alone is not a release.
  `scripts/release.mjs` gains `--push` to run that push in one command, and
  `docs/workflows/releasing.md` replaces the `origin`-only push with a loop over
  every remote.
- Three behaviour rules in `AGENTS.md` §2 that no rule covered before: answer a
  question instead of implementing it; act on cheap reversible in-scope work and
  fix a defect you find rather than reporting it back; run independent work in
  parallel with one writer per file. `AGENTS.md` §4 adds the all-items rule —
  deliver every item, or name the exact blocker in one sentence.

### Fixed

- `scripts/release.mjs` now bumps the two `README.md` version markers with
  `package.json` and `CHANGELOG.md`. `scripts/check-release.mjs` requires those
  markers, so `npm run lint:release` used to fail on every release until a
  person edited the file by hand.

## [0.7.4] - 2026-08-13

### Added

- `qa-review-pass` — the tester half of the delivery chain, beside
  `impact-analysis` and `delivery-digest`. A QA tester, a Product Owner or a
  project manager runs one pass against three sources of truth: the
  specifications for the behaviour, the design document and the mockups for the
  look, the contracts for the rest. Every `#### Scenario:` gets a verdict from a
  closed five-word vocabulary, and a requirement with no automated test is
  reported as `not-covered` rather than as `pass`. Every finding is split into a
  defect, which breaches what the specification already says, and a change
  request, which is the specification being wrong or absent — the distinction
  that stops a team arguing about blame instead of about scope. It fixes
  nothing. A pass writes **two files with one stem**: the markdown a person
  reads, and a JSON matrix beside it, because a coverage table an agent typed
  cannot be counted.
- `visual-regression-playwright` — deterministic Playwright screenshots compared
  against a Figma export, a generated HTML preview or a mockup image. Carries the
  viewport matrix, the six determinism fixes that decide whether the check is
  proof or noise, the reference-versus-capture convention, and how to read a diff
  honestly. Ships with every frontend stack.
- `ui-change-needs-visual-proof` instinct: a change the user can see arrives with
  a screenshot that proves it. A class-name assertion is not a rendered pixel.
  Two named exceptions, and silence is not one of them.
- `documentation-chain-followthrough` instinct: the chain edge list, the two
  reports every documentation change owes, and the end-of-turn rule — name what
  went stale, offer to update it, never cascade silently.

### Changed

- `AGENTS.md` §6 now requires visual proof for a change the user can see, and
  names the reviewer skill. A new §6b states the documentation chain rule: the
  agent that changed the first link owns telling the user what has not followed.

## [0.7.3] - 2026-08-11

### Added

- `ai-native-ui-patterns` — the UI skill for agent surfaces: seven behavioural
  laws (no unqualified spinner, work shown but collapsed, provenance on every
  claim, rendered uncertainty, an approval gate before any side effect, propose
  rather than apply, output as material), a catalogue of nineteen primitives
  with the states each must handle, the streaming mechanics that usually break
  (reserved block, one live region, conditional autoscroll, partial text kept on
  error), an accessibility contract, and a bundled two-theme `tokens.css` with
  the surface/ink ladders and the motion contract. Behaviour rather than taste,
  so it joins every frontend stack — `angular-web`, `react-web`, `next-web`,
  `expo-mobile` — alongside either taste group.

## [0.7.2] - 2026-08-10

### Added

- Delivery reporting and specification chain, promoted from a real project: the
  `impact-analysis` / `delivery-digest` pair (one change, told to developers and
  to a Product Owner, with strict redaction rules on the forwardable half),
  `harvest-questions` (a RAID register built from what the specs leave
  undecided), `split-tasks-by-profile` (work split across personas as validated
  JSON, with a bundled validator), `spec-to-tickets`, and `spec-drift-triage`
  (four drift states; a conflicted ticket is never overwritten and an orphan is
  never deleted). All six join `CORE_PROFILE`.
- Sketch and model conversions: `excalidraw-to-adr` (MADR), `excalidraw-to-likec4`
  (bundled deterministic script), `likec4-to-openspec`, and `docs-to-dbml`.
- `docs/guidelines/style-contract.md` — the opt-in always-on contract that binds
  `ponytail`, `i-have-adhd`, `caveman` and `asd-ste100`, with the precedence rule
  that Simplified Technical English overrides compression for durable text, and
  the rule that a sub-agent inherits the contract only when the delegation prompt
  restates it.
- Two style skills to support that contract: `asd-ste100` (Simplified Technical
  English for commits, docs, error messages and agent instructions) and
  `i-have-adhd` (action-first output shape). Both join `STYLE_SKILLS`.
- Ten MIT design skills vendored from `Leonxlnx/taste-skill`, split by surface so
  a stack receives one group and never both: `high-end-visual-design`,
  `minimalist-ui` and `redesign-existing-projects` for a dense product UI;
  `design-taste-frontend`, `industrial-brutalist-ui` and `stitch-design-taste`
  for marketing surfaces; `imagegen-frontend-web`, `imagegen-frontend-mobile`,
  `image-to-code` and `brandkit` for image direction. Plus
  `figma-tokens-to-designmd`, which turns a Figma token export into `design.md`.
- Nine instincts. `vendored-corpus-manifest` (copy a foreign corpus verbatim, read
  a generated manifest, gate drift with `--check`, keep the licence with the
  content), `embedded-tree-lifecycle` (one lifecycle row per embedded tree, and
  when to compile a tree in instead of shipping it as a resource),
  `provisioning-state-registry` (four states over every managed file; never delete
  an orphan), `negative-assertion-precondition` (assert the subject rendered
  before you assert nothing survived, or the test passes on a blank page),
  `credential-host-scoping` (bind a secret to its destination host and re-parse
  that host from the final URL, so a crafted URL cannot redirect the token),
  `untyped-dependency-adapter` (a dependency that returns `any` needs one narrow
  adapter and one shape test, because the compiler cannot see the break),
  `dev-server-route-warmup` (pre-declare lazy route entries or the first
  navigation fails while the optimiser re-runs), `one-artifact-root` (an artifact
  written outside the configured root produces nothing), and `e2e-gate-budget`
  (declare which e2e subset gates a change, with its measured wall-clock).
- Guideline and tooling additions: a rule against passing a secret in `argv` (the
  process list is public), the three non-interactive agent permission tiers with
  their CLI flags, a test-naming rule, a type-check-every-project rule, the two
  `DESIGN.md` sections that are easiest to omit, a Rust toolchain row in
  version-pinning (kept apart from the minimum supported version), release
  behaviour when a matrix build re-uploads an asset, and the empty-selection case
  for a capability flag.
- Template additions: `templates/monorepo/gitattributes.tpl`, two `.gitignore`
  pattern traps documented next to the patterns they affect, a `preinstall`
  package-manager guard, and a packaging rule that strips OS metadata (ignoring a
  junk file in git does not stop a packaging step from copying it).
- `check-naming` now also denies the source-project tokens mined during a
  knowledge pull, so the guard proves the import stayed generic.
- `docs/tooling/rtk.md` now names the binary collision with `reachingforthejack/rtk`,
  gives the `rtk gain` verification, and lists five token-economy habits that
  need no tool at all.
- Prose and terminology linting: `docs/tooling/vale.md` (what Vale is worth in a
  specification repo — imposed vocabulary, required sections, identifier formats
  — and the measure-the-corpus-first rule for structural checks), and
  `templates/docs-lint/` with a runnable `.vale.ini` and a starting `House`
  style (substitution, forbidden terms, single `H1`, one required section).
- `docs/guidelines/documentation.md` now states that vocabulary fixed outside the
  codebase is enforced mechanically; `docs/workflows/validation-defaults.md` now
  requires a declared documentation check to run on docs-only changes.

### Changed

- `caveman` and `ponytail` updated to their newer upstream revisions. `caveman`
  gains tool-call discipline, language preservation, the negation rule, and the
  measured claim that invented abbreviations save no tokens. `ponytail` gains a
  reuse-first rung ("already in this codebase?"), the root-cause rule for a bug
  fix, and the rule that the ladder shortens the solution but never the reading.
  Both now keep their MIT `LICENSE` next to the skill.

### Fixed

- **Shipped examples passed database passwords on the command line**, which the
  new `argv` rule in [security.md](docs/guidelines/security.md) forbids: the
  process list is readable by every other local process. Fixed in the MySQL
  family — `database-backups` (both `mysqldump` and `xtrabackup`) and both `mysql`
  examples now write credentials into a `0600` file inside `( umask 077; … )` and
  pass `--defaults-extra-file` as the first option. `mysqldump` reads `[client]`
  and `xtrabackup` reads `[xtrabackup]`, and the guideline now says so. `gcloud`
  accepts a password only as an argument, so each `gcp-cloud-sql` command block
  now carries the exposure-and-rotate warning. All of these are `LOCAL_OVERRIDES`,
  so a refresh re-applies them; a test re-derives every overridden file from
  upstream text and fails if one is silently dropped.

  The rest of the corpus is now covered too, each mechanism verified against
  official vendor documentation before it was written:

  - `redis` — one `export REDISCLI_AUTH=…` replaces 18 `redis-cli -a <password>`
    calls. The vendor recommends the variable over `-a`.
  - `azure-vms` — omits `--admin-password`, which makes the CLI prompt.
  - `openclaw-local-mac-mini` — a trailing `security … -w` with no value prompts
    for the API key, so it never reaches `argv`.
  - `mdm-device-management` — the upstream `fleet setup` command does not exist in
    the vendor documentation, so it is replaced by the documented web setup screen
    rather than kept as an invented command carrying a password.
  - `azure-sql`, `azure-keyvault`, `identity-access-management` — these CLIs accept
    a password only as an argument, so each command block now names the exposure
    and requires rotation. `azure-sql` also records the documented Entra-only path
    that removes the password entirely.

  A test now enforces the rule as written: a skill may keep an `argv` secret only
  while the same file documents the exposure. It iterates the override table, so a
  future override is covered without editing the test.

  **Two knowingly left alone.** The `redis` Compose healthcheck keeps its inline
  password, because the Compose documentation does not confirm that a healthcheck
  test sees the service `environment:`, and a guess is worse than a known gap. The
  `requirepass` and Sentinel config values are already in their correct home — a
  config file, not `argv`. `riskSignals` still has no argv-secret counter, so
  nothing blocks a future import from adding one.
- **A host that synced an imported skill never received the MIT permission
  notice.** The 146 imported skills carry a `## Provenance` block, and the lock
  forbids extra files in their folders, so no `LICENSE` could travel with them —
  and `manifest.mjs` ships no notices file. `skills-sync` now writes
  `THIRD_PARTY_NOTICES.md` beside the synced skills whenever at least one
  imported skill is included. A skill vendored with its own `LICENSE` is
  unaffected, because that licence already travels inside its folder.
- **The OSV-Scanner suppression table was named wrong, so every host that copied
  the template suppressed nothing.** The table is `IgnoredVulns`; the template
  and the CI example both wrote `IgnoreVulns`, which the scanner rejects. Both
  are corrected, and the template now also records that with a lockfile argument
  the scanner does not read a root config on its own, so `--config` must be
  explicit.
- **`ai-coding-agent-guardrails` no longer reports as drifted, and its local fix
  now survives a refresh.** The skill carries a deliberate narrowing: it permits
  reading `.env.example`, because the unmodified upstream rule forbids every
  `.env.*` file and contradicts [`env-var-sync`](knowledge/instincts/env-var-sync.md).
  That narrowing was applied directly to the file, so the lock hash read it as an
  accidental edit and two tests failed on a clean checkout. The narrowing moved
  into `LOCAL_OVERRIDES` in `scripts/lib/upstream-skills.mjs`, which runs inside
  `adaptSkill`. A later `upstream-skills --refresh` now re-applies it instead of
  reverting it, and stops with a clear error if upstream rewords the target line.
  The lock still catches an accidental edit. Recorded in `THIRD_PARTY_NOTICES.md`.
- **`pull-knowledge.mjs` discovered no agent skills, which are the densest
  reusable asset a project owns.** Against a real project it staged 16 files and
  missed all 17 skills. It now discovers any `skills/<name>/SKILL.md` and stages
  the whole folder — licence, scripts, references, examples — because a skill is
  one asset and not one file. Same run now stages 61 files. Also fixed:
  - A `skills/` tree whose parent carries a generated `manifest.json` naming an
    upstream repository is skipped, so a project that vendors agent-compass no
    longer re-imports the base into itself (197 files).
  - Build output and git worktrees are ignored. One project walked 19131 files,
    18262 of them build output, and staged 6 duplicate configs from a worktree.
  - A digit run inside a commit hash, and a pinned version such as `6.2.1.4610`,
    no longer read as a phone number. That false positive refused whole runs.
  - A symlinked skill folder stages once, not twice. The target path resolves
    through symlinks first, so a macOS `/var` path no longer escapes its own root.
  - New categories: provider agent roles and slash commands, `docs/*.md`, module
    docs beyond `apps/**/src`, CI pipelines, devcontainers, and style contracts.
    Every category carries a cap, and a reached cap is reported, never silent.
  - Staging is cleared first, so a file removed from the source cannot linger and
    read as current. A copy failure now exits non-zero.
  - `INDEX.md` names the base file each row compared against, and resolves a
    skill to its real counterpart instead of the first same-named file.
- `sonar:setup` now reuses valid tokens through the current `issueadmin` API,
  ignores pre-scan CSV drift that its scan will refresh, and delegates to the
  complete `sonar:do` scan/close/report cycle instead of duplicating scans.
  `sonar:do` now waits for Compute Engine success before reading issue state.

## [0.7.1] - 2026-07-31

### Added

- Decision Records (ADR) support: a fuller `docs/decisions/` template (context,
  alternatives with pros & cons, decision, consequences), the `adr-from-meeting`
  skill (draft an ADR from a meeting transcript, rejected paths and their reasons
  preserved), and the `decision-records` workflow. Wired into `CORE_PROFILE` and
  `AGENTS.md`.
- Four review instincts: `react-query-bulk-mutation-reconcile`,
  `entity-picker-label-source`, `frontend-shared-layer-escapes`, and
  `mr-scope-and-green-pipeline`.

### Fixed

- projectmem MCP: pin `mcp<2` in every launch template and the docs so `pjm-mcp`
  starts — `mcp` 2.0.0 relocated FastMCP and broke the import. Added a
  Troubleshooting section to `docs/tooling/projectmem.md`.

## [0.7.0] - 2026-07-29

### Added

- 146 opt-in operational skills adapted from
  `BagelHole/DevOps-Security-Agent-Skills`: 22 requested DevOps platform skills,
  all 35 security skills, all 70 infrastructure skills, and all 19 compliance
  skills. Every skill has pinned MIT provenance and an Agent Compass
  authorization/dry-run/rollback safety gate; upstream executable scripts and
  assets are excluded.
- CLI-integrated capability packs: `skills-sync --list-packs`,
  `skills-sync --pack`, `skills-sync --all`, and
  `catalog --type capability-pack`, plus command-registry entries. Default
  project/global sync excludes broad packs; explicit `--all` includes them.
  Backed by focused inventory/content/sync/dispatch tests.
- Ten focused operational subpacks for AWS, Azure, GCP, Kubernetes,
  observability, AI operations, security scanning, secrets, hardening, and
  compliance frameworks.
- Local-only upstream lifecycle tooling: deterministic pinned lock, dry-run
  comparison, reviewed-risk refresh gate, and lock verification. It never
  fetches or monitors remote state.
- Imported-skill quality and generated-documentation gates, plus unified CLI
  skill search, pack filtering, exact metadata, and provenance details.
- Operational safety contract and `plan-before-operational-change` instinct for
  production changes, incident evidence, least privilege, rollback, and
  compliance limitations.

### Changed

- README now uses a scan-friendly hero, capability map, quick route, pack
  counts, and activation flow inspired by the upstream skills repository.

## [0.6.0] - 2026-07-28

### Changed

- **Provider consolidation: Claude, Codex, Gemini, GitHub Copilot only.**
  Cursor and Windsurf integrations removed (repo rule files, host pointers,
  MCP example, verify/doctor checks, docs). `migrations/0.6.0.mjs` cleans
  compass-authored Cursor/Windsurf pointers out of existing hosts on `sync`
  (user-edited files are never touched). `install` now respects a
  `providers` list from `agent-compass.answers.json`.

- **CLI modernization (still zero-dependency).** New shared strict flag
  parser (`scripts/lib/args.mjs`, on `node:util` `parseArgs`): unknown flags
  error instead of being ignored, `--flag=value` works, `-h` can no longer be
  swallowed as a positional. New terminal UX lib (`scripts/lib/tui.mjs`):
  colors (NO_COLOR-aware), arrow-key select/multi-select, confirm, spinner.
  `wizard` and `bootstrap` are interactive with real menus and no longer hang
  in non-TTY contexts; `cli.mjs` exports `COMMANDS` as data (catalog imports
  it instead of regex-parsing), shows aliases in help, and reports spawn
  failures properly.

### Added

- Gemini parity: `templates/gemini/.gemini/settings.example.json` (recommended
  MCP servers) installed to hosts, enriched `GEMINI.md`, and `provider-verify`
  now checks the Gemini pointer + settings example.

- `docs/architecture/compass-map.md`: a maintained self-map of the repo
  (layout, flows, provider matrix, validation matrix) so agents stop
  re-exploring from scratch.

- Planning skills (`progress-audit`, `completion-plan`, `work-splitting`,
  `implementation-planning`) added to the core fit profile so fit-based
  adoption actually delivers them.

- `spec-status-sync` instinct: when you ship a feature covered by a spec-kit
  spec, sync its status in the same task — update the global
  `implementation-status.md` and the spec's own `## Implementation Status`
  (a verified one-line status + pointer, checked against wired code, not labels)
  — never leave a shipped feature's spec reading "Not implemented".

- `self-review-before-done` instinct: review your own change like an MR before
  calling it done — target the runtime blind spots typecheck and unit mocks miss
  (DI/boot wiring, whether input validation actually runs, response-shape leaks,
  by-id scope), run the fuller checks (full build, whole suite, pre-commit lint),
  and fix findings inline rather than enumerating them.

- `pr-review-governance` skill: a "GitLab MR posting (`glab`)" section
  documenting the two silent `glab api` traps — `-f "body=@file"` posts the
  literal `@path` instead of the file, and inline comments need a JSON body with
  an explicit `Content-Type: application/json` header and a `position` object
  (nested `-f "position[...]"` form fields are dropped, degrading the comment to
  a general thread) — plus the post-hoc anchoring verification step.

### Fixed

- README version drift (badge and "Current version" said 0.4.0);
  `check-release` now guards README against `package.json`.
- `.mcp/angular-cli.example.json` is now installed (hosts previously received
  a README pointing at a file the manifest never placed).
- `docs/tooling/cli.md` documents all CLI commands; `check-indexes` now fails
  on missing command docs, knowledge-index drift, stale skill rows,
  unindexed template files, and unindexed guideline/architecture docs.
- `knowledge/README.md` lists all instincts; host `AGENTS.md` pointer now
  mentions `knowledge/`; `recommend` path-instruction advice includes the
  exact copy command; `mcp-probe` probes all shipped MCP examples.

## [0.5.0] - 2026-07-10

### Added

- Angular AI integration: `stacks/angular-web.md` preset (detected via
  `@angular/*` deps or `angular.json`, offered by bootstrap), the `angular-cli`
  MCP server as template/catalog/tool-contract entries (read-only by default),
  an `angular-patterns` skill with a vendored copy of Angular's official
  best-practices context file (MIT, provenance header) as offline fallback to
  the live MCP tools, and an `angular-ai-assets` instinct preferring live
  sources over training-data recall.

- Project progression pack: `completion-plan`, `implementation-planning`,
  `progress-audit`, and `work-splitting` skills plus a
  `verified-progress-signal` instinct.

- Spec Kit bridge pack: `speckit-*` skills wrapping the Spec Kit
  slash-command flow with a hard stop before implement, a `spec-kit` profile
  (detected via `.specify`), and `spec-kit-bridge` wiring. Security instincts
  `api-security-edge-cases` and `async-external-pipeline`, promoted from a
  real host project.

- `env-var-sync` instinct plus env-management rules in `AGENTS.md` and the
  env tooling doc.

- `pr-review-governance` skill (deep PR review against specs, security, and
  repo rules) and tightened `pr-workflow` guidance.

- `figma-mcp-go` plugin-bridge integration (templates, setup guide,
  `mcp-probe` support): free/local Figma design reads when official Figma
  MCP/API limits block.

- Validation-defaults and long-running-task workflow docs, plus projectmem
  guideline gaps closed across doctor/global-setup.

- `vendor` command (`scripts/vendor.mjs`): create/refresh a plain-copy
  vendoring (the non-submodule path) with `.vendor.json` provenance
  (version/ref/commit), replacing manual `git archive` surgery.

- `spec-kit-workflow` knowledge instinct (Spec Kit slash-command sequence with
  a hard stop before implement) and richer Drizzle-typed mapper instinct, both
  promoted from a real host project.

### Changed

- projectmem is now set up collaboration-safe: commit the append-only
  `events.jsonl` (the source of truth) with a `.gitattributes merge=union`
  driver, and gitignore the regenerated projections (`summary.md`,
  `PROJECT_MAP.md`, `AI_INSTRUCTIONS.md`, `issues/`) — the reverse of the old
  default that committed the regenerated `summary.md` and let the last writer
  overwrite teammates. The `post-merge` hook runs `pjm regenerate` after a pull;
  durable decisions go in committed ADRs. Touches `scripts/doctor-checks.mjs`
  ignore/attribute defaults, `scripts/install.mjs`, `templates/monorepo/`,
  `templates/memory/`, the project-memory skill, and the tooling/workflow docs.

- The five CCG quality-gate skills (`gen-docs`, `verify-module`,
  `verify-quality`, `verify-change`, `verify-security`) are now fully in
  English — SKILL.md docs, script comments, and report output. The `caveman`
  skill's wenyan variants keep their intentional classical-Chinese examples.

### Fixed

- Quality-gate skill scripts are now runnable: they were CommonJS `.js` files
  inside an ESM package (`require is not defined`) and depended on a
  `skills/lib/shared.js` lost in the original import — and unreachable anyway
  once skills sync into hosts as independent folders. Rewritten as
  self-contained `.cjs` with helpers inlined; `.cjs`/`.mjs` now count as code
  in the quality/security scanners.
- Stack detection now aggregates workspace packages (`apps/*`, `packages/*`)
  instead of only the monorepo root, and matches exact dependency names —
  a turbo monorepo with a NestJS API and React app previously detected as
  "Turborepo" only, and `@next/eslint-plugin-next` no longer counts as Next.js.
  Found by upgrading a real host.
- Redaction screens no longer flag RFC-reserved documentation emails
  (`user@example.test`) or bare ISO dates (osv-scanner `ignoreUntil`) as
  personal data — compass's own shipped template previously failed its own
  knowledge-capture screen. Real emails and long digit runs still refuse.
- `pull-knowledge` INDEX status is content-aware (`new` / `differs` /
  `identical`) and staged files no longer match themselves via
  `knowledge/incoming`, which previously reported every pull as "0 new".

## [0.4.0] - 2026-07-01

### Added

- Mission router `MISSIONS.md` plus `compass-adopt`, `compass-bootstrap`, and
  `compass-extend` skills so any agent CLI spawned in this repo can set up an
  existing project, bootstrap a new one from architecture guidelines, or extend
  compass with minimal guidance. Cursor/Windsurf/Gemini pointer files now route
  through the missions in this repo too (previously host-only).
- `adopt` command (`scripts/adopt.mjs`): one-command host adoption — detection,
  non-interactive setup, fit-based skill sync, optional `--policy <pack>`,
  readiness verification, next steps.
- `runbook` and `context-pack` now include detected stacks and fit-based
  compass assets, so host agents see what fits at startup without re-deriving
  it. MISSIONS.md also routes the user-level global setup mission.
- Machine-readable asset catalog (`scripts/catalog.mjs`, `agent-compass catalog`)
  covering skills, stacks, templates, docs, instincts, and CLI commands with
  `--type` / `--grep` / `--md` filters.
- Non-interactive bootstrap: `bootstrap.mjs --answers <file> --out <dir>` with
  `--schema` contract output and validated answers, so agents can drive project
  bootstrap from architecture guidelines.
- Fit-based asset selection as data: `scripts/lib/profiles.mjs` (stack detection
  + per-stack asset profiles), `recommend.mjs` fit-based assets output, and
  `skills-sync.mjs --only a,b,c` subset sync. `setup-wizard` now syncs the
  fit-based subset by default (`skillScope: fit|all`).
- `new.mjs` scaffolds for every extensible asset: `instinct`, `stack`,
  `workflow`, and `tooling` kinds join `skill`/`adr`/`spec`/`arch`, each with a
  post-scaffold wiring checklist.
- Mission-routing guard test: every provider entry file must route through
  `MISSIONS.md`, and every mission playbook/command it references must exist.
- GitHub Actions version guard (`check-actions.mjs`) and CI/tooling guidance for
  required action majors.
- Helper scripts for PR creation/review packets, host readiness reports, agent
  runbooks, release prep, and host submodule upgrades.
- Design-system extraction template for Figma/design-token workflows.

### Changed

- CI and CI templates now use current action majors and the repo now includes
  `.nvmrc` for `actions/setup-node`.
- `setup-wizard.mjs` and `recommend.mjs` share one stack-detection source
  (`scripts/lib/profiles.mjs`); Expo/React Native projects no longer classify
  as React web apps.

### Fixed

- `new.mjs skill` now emits the full required frontmatter
  (`risk_level`, `writes_files`, `requires_tools`) so freshly scaffolded skills
  pass `npm run check` instead of failing `lint:naming`.

## [0.3.0] - 2026-06-23

### Added

- Docs/template guard that checks local Markdown links and catches unknown
  placeholder tokens under `templates/`.
- Release guard that checks `package.json`, `CHANGELOG.md`, and the local
  `v<version>` tag agree before publishing.
- Lightweight native spec workflow: `specs/` templates, workflow doc,
  `spec-workflow` skill, bootstrap prompt support, and install-created
  `specs/README.md` / `specs/constitution.md`.
- Project memory support: projectmem tooling/workflow docs, install-created
  `.projectmem/README.md` / `.projectmem/projectmem-policy.md`, and
  `project-memory` skill.
- Command registry, repo context snapshot script, repo-map/ADR/handoff templates,
  and lightweight conformance smoke template for faster cross-project starts.
- MCP setup guidance and examples, including projectmem and Figma design-context
  flows plus `figma-mcp-frontend` skill.
- PR creation/review workflows and `pr-workflow` skill covering default
  `develop` base, self-assignment, real labels, reviewers, GitHub reviews, and
  implementing submitted review fixes.
- Copilot `.github/instructions/*.instructions.md` templates and PR template.

### Changed

- Installer now copies optional agent workflow templates and supports
  `--doctor --deep` advisory checks.

## [0.2.0] - 2026-06-23

### Added

- Stdlib `node:test` coverage for bootstrap, installer, knowledge-pull, and
  naming/frontmatter checks.
- Bootstrap smoke matrix coverage for API-only, full app, and Next.js-only
  prompts.
- `next-web` stack preset and correct bootstrap mapping.
- Installer `--doctor` verification plus non-destructive front-door pointers for
  Claude, Codex, Copilot, Cursor, Windsurf, and Gemini.
- Index drift guard for stack, workflow, and skill README catalogs.
- Release and upgrade workflows for tagged agent-compass bumps in host projects.

### Changed

- SonarQube tooling overhauled to the consolidated `sonar:do` runner (scan +
  bulk-close stale issues + patched HTML report), gated by a read-only
  `sonar:doctor` preflight. Added `sonar-do.sh`, `sonar-doctor.sh`,
  `bulk-close-stale-issues.mjs`, `patch-sonar-summary.mjs`; `sonar-setup.sh` now
  mints a scoped USER_TOKEN and sets per-project `sonar.scm.provider=git`.
  Replaces the old `sonar:scan` / `sonar:report` scripts.

## [0.1.0] - 2026-06-23

### Added

- Initial extraction from a production monorepo and global agent config.
- Tool-agnostic agent contract (`AGENTS.md`) with thin pointers for Claude, Codex, Copilot.
- Guidelines (`docs/guidelines/`): coding style, TypeScript, TDD/testing, security,
  git workflow, development workflow, documentation, agent behavior.
- Architecture principles (`docs/architecture/`): monorepo, resilience, observability,
  feature flags, API design, shared types.
- Tooling guides (`docs/tooling/`): rtk, pnpm, turbo, sonarqube, docker, husky,
  env management, API contract sync, security scanning, version pinning.
- Portable skills (`skills/`): caveman, ponytail, gen-docs, verify-*, plus
  NestJS / Drizzle / BullMQ / resilience / React-admin / Expo pattern skills.
- Real config templates (`templates/`): turbo, pnpm, tsconfig, prettier, commitlint,
  husky hooks, eslint, docker, sonar, OSV, CI, env.
- Stack presets (`stacks/`) and workflow playbooks (`docs/workflows/`).
- Bootstrap tooling (`scripts/`): interactive `bootstrap`, `pull-knowledge`, `install-into`.

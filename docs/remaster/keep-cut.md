# Compass 0.9.6 audit: keep, merge, cut

Date: 2026-10-16. Baseline: 508 tracked files, 2.5 MB, 250 tests (all pass), 55 CLI commands,
65 local skills, 11 tracked external sources, 56 instincts, 83 docs, 55 host manifest files (18 seed, 37 managed).

## 1. Verdicts

| Area | Item | Verdict | Reason |
|---|---|---|---|
| scripts | cli.mjs (55 commands) | REWRITE as `bin/ac.mjs` | about 11 commands |
| scripts | install, sync, manifest | MERGE into `engine/` | one engine, one lock |
| scripts | adopt, setup-wizard, setup-host, doctor-fix, apply-recommendations, policy-pack, upgrade-host | CUT | five ways to run one flow |
| scripts | vendor.mjs | CUT | channel is a submodule on a tag |
| scripts | check-update | REWRITE in engine | no network timeout today |
| scripts | skills-sync, external-skills, global-setup | MERGE into `ac sync` and the user plugin | three copy paths |
| scripts | doctor-checks, doctor-report, provider-verify, mcp-probe, agent-onboard, quality-gates | MERGE into `ac doctor` | one report, real exit codes |
| scripts | context-pack, runbook, recommend, migration-plan, spec-validation-map, failure-mine, dashboard | CUT | agents do not read generated reports |
| scripts | task-log, agent-trace, trace-to-evals, agent-evals, agent-conformance, agent-drift | CUT | nothing writes the log |
| scripts | check-actions, check-companions, check-docs, check-indexes, check-naming, check-release, release, skill-docs, new | MERGE into `tools/` (compass dev only) | do not ship to hosts |
| scripts | upstream-skills + lib/upstream-*, capability-packs, external-install, catalog, skills-info | REWRITE as `upstream.json` + small installer | keep pins for few sources |
| scripts | bootstrap | REWRITE as `ac init --from-specs` | drop Keycloak and Sonar defaults |
| scripts | lib/profiles | KEEP | the one useful selector |
| scripts | code-intel + lib/codebase-memory | REWRITE in project-memory pack | pin installer, add timeouts |
| scripts | evidence + lib/evidence | KEEP | enforces the proof rule |
| scripts | openspec-guard + lib/openspec | CUT | replaced by `openspec status --json` in `ac check` |
| scripts | spec-kit-bridge | CUT | OpenSpec is the one dialect |
| scripts | pull-knowledge | CUT | replaced by `ac promote` |
| scripts | redact, run-command, lib/args, lib/changelog | KEEP | small, strict |
| scripts | pr, pr-review, design-importer, gen-depgraph, context, lib/tui | CUT | `gh`, `glab`, graph tool and skills cover them; prompts hang headless runs |
| skills | gen-docs, verify-change, verify-module, verify-quality, verify-security (CCG) | CUT from compass | stay user-global; regex scanners overlap lint, osv, Sonar |
| skills | speckit-* (11), openspec-lifecycle | CUT | merged in `spec-flow` |
| skills | spec-workflow, codebase-to-specs, spec-drift-triage | MERGE into `spec-flow` | one spec skill |
| skills | project-memory, debug-loop, long-running-task, architecture-advisor | KEEP (rename: `debug`, `harness-loop`) | core workflow |
| skills | agent-teacher | CUT | upstream `teach` covers it |
| skills | pr-workflow, pr-review-governance, qa-review-pass | MERGE into `review` | three overlapping review paths |
| skills | compass-adopt, compass-bootstrap, compass-extend, compass-external-source | MERGE into `compass` | one router |
| skills | working-style-skills, native-mobile-skills, design-taste-skills | KEEP | thin routers to pins |
| skills | operational-skills | CUT | 146 ops skills out of scope |
| skills | nestjs-patterns, drizzle-postgres-patterns, resilience-observability-patterns, nestjs-monorepo-scaffold, react-admin-dashboard-patterns, expo-react-native-patterns, angular-patterns | MERGE into `rules/stack-*` | path-scoped knowledge, not skills |
| skills | bullmq-patterns, external-service-patterns | CUT (fold key lines into stack rules) | project flavour |
| skills | api-contract-sync | KEEP | add Mockoon and `bru run` |
| skills | visual-regression-playwright, figma-mcp-frontend | MERGE into `ui-conformance` | one UI proof flow |
| skills | figma-tokens-to-designmd, ai-native-ui-patterns, diagram-to-adr, diagram-to-likec4, likec4-to-openspec, docs-to-dbml | CUT | niche; Konvoy keeps its own converters |
| skills | spec-to-tickets, split-tasks-by-profile | MERGE into `task-flow` | tracker flow |
| skills | harvest-questions | MERGE into `grill` | questions flow |
| skills | adr-from-meeting | RENAME `adr` | keep |
| skills | impact-analysis, delivery-digest | KEEP | Konvoy format, placeholders |
| skills | completion-plan, progress-audit, implementation-planning, work-splitting | MERGE into `remaining-work` | five planners |
| skills | convert-documents-to-markdown | MERGE into `spec-flow` | input step |
| templates | gemini/, mcp/gemini.example.json | CUT | provider dropped |
| templates | agent/.github instructions (api, backoffice, mobile-app) | CUT | project residue |
| templates | claude/, codex/ | REWRITE in `core/` | hooks live, not examples |
| templates | mcp/* | REWRITE as `mcp/catalog.json` | one catalog, generated per provider |
| templates | monorepo/ (stack-blind seeds) | CUT | wrong for non-pnpm hosts |
| templates | docker, ci, sonar, checkmarx, security scripts | MOVE to `packs/` | opt-in |
| templates | docs-lint, policies, evals, conformance, trace | CUT | unused |
| templates | specs, questions, architecture, intake, handoff | MOVE to `packs/konvoy` | Konvoy layout |
| knowledge | 56 instincts | CUT about 40; fold about 15 into the contract block and stack rules | orphans and project flavour |
| docs | guidelines, workflows, tooling, architecture (79 files) | REWRITE to ≤12 docs | 60% duplicates |
| docs | delivery, decisions 001-002 | CUT | compass history |
| root | AGENTS.md 493 lines, README 831 lines | REWRITE ≤150 lines each | duplication |
| root | CHANGELOG 1,098 lines | RESET at 1.0.0 | git tags keep history |
| root | GEMINI.md, CODEX.md, MISSIONS.md | CUT / CUT / MERGE into AGENTS.md | provider dropped; Codex reads AGENTS.md |
| root | LICENSE | REWRITE as MIT | conflict with notices |
| migrations | 4 files + runner | CUT | reset at 1.0; `ac migrate` replaces them |
| specs | 001-003 | CUT | compass dev history shipped to hosts |
| .github | agent-drift.yml | CUT | no value |

## 2. Flakiness causes found

1. Skill flood: `apply-recommendations` calls `skills-sync` with no `--only`, so all 65 skills go to two dirs.
2. Three copies per skill (submodule, `.claude/skills`, `.agents/skills`) plus three user dirs; sync does not refresh them.
3. Managed `.codex/config.toml` sets sandbox and approval policy; 13 `.mcp/*` managed files are never active.
4. Two writers of `agent-compass.answers.json` with two schemas; the wizard writes `scope: '@scope'`.
5. Gemini fan-out in 6 scripts while package.json says 3 providers.
6. The wizard ignores the exit status of 11 child runs.
7. Network calls with no timeout (`git ls-remote`, upstream fetch, installer from `main`).
8. Prompts without TTY guard (`global-setup` asks for Jira URL and token).
9. Stack-blind seeds and pnpm-only husky hooks.
10. Submodule update tracks remote HEAD, not a tag.
11. Dead references: retired `check-skill-quality`, missing `skills/caveman/`, "nine" sources versus 11.
12. Licence conflict: LICENSE says all rights reserved, notices say MIT.

## 3. Enforcement today

| Concern | State |
|---|---|
| Style skills | Not shipped; advisory text only; no Claude hook |
| Output style | None |
| Token economy | Advisory docs (rtk, headroom) |
| Claude hooks | Work only after a manual copy of `settings.example.json`; Bash `cat .env` is not blocked |
| Codex hooks | Live, text only |
| Copilot | No hooks; CI only |
| Model routing | Advisory; one `model: sonnet` pin |
| Review gates | Prose; `evidence --phase finish` is the only exit-code gate |

## 4. Feature coverage today

| Feature | State |
|---|---|
| Env vars | doc, instinct, sample seed; no checker |
| Local run | Docker compose example only |
| E2E | guidance and evidence bundle; no launcher |
| CI | 3 GitHub examples; no GitLab template |
| Tracker | global mcp-atlassian setup with plaintext token; GitHub-only sync |
| MCP | examples only, never active |
| Graph | codebase-memory and projectmem; Dual Graph residue conflicts |
| Specs | native, spec-kit and OpenSpec at the same time |
| Usage and cost | none |
| UI | static HTML dashboard |

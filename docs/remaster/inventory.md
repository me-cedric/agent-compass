# Inventory of the team projects

Date: 2026-10-16. Source: read-only scans of 6 local repos and 4 remote infra repos.
This file records what the projects use. Compass 1.0 keeps only what serves these facts.
Host names, tokens and secret values are not recorded here.

Repos: parcus-plus (PP), numeric-emploi (NE), parcus-infra (PI), parcus-helm (PH),
NE infrastructure (NI), NE helm-charts (NH), konvoy-paag (K), StoryArc (S).

## 1. Technologies and tools

| Area | Items | Repos |
|---|---|---|
| Languages | TypeScript 5.9–6.0, Rust 1.92–1.97, Swift 6.2, Kotlin 2.4, C# (.NET 10), Ruby 3.4 (fastlane), Java 21, Python (projectmem venv) | all |
| Runtimes | Node 22–26 (PP: .nvmrc 24, CI 22; NE: 26), JDK 21 | PP NE S |
| Package and build | pnpm 11, Turborepo 2.10, Vite 7–8, XcodeGen, SPM, Gradle 9.7 + AGP 9.4, Cargo, Flatpak | all |
| Backend | NestJS 11 + Fastify 5, Drizzle ORM 0.45 + drizzle-kit 0.31, PostgreSQL 15/16 (+ pgvector), Redis 8, BullMQ 5 + bull-board, Keycloak 26 + keycloakify + nest-keycloak-connect fork, Zod 4 + nestjs-zod, OpenTelemetry SDK, cockatiel, Scalar at `/openapi` | PP NE |
| Frontend | React 19, TanStack Router/Query/Form/Table, react-router 7, Tailwind 4, Radix + shadcn, Storybook 9–10 (NE: one desktop and one mobile story per screen) | PP NE K |
| Mobile | Expo 55, React Native 0.83, expo-router, Zustand, React Query, Firebase, private Monetico SDK, fastlane + Match | PP |
| Native | SwiftUI (iOS 26, macOS 26), Readium, swift-snapshot-testing; Jetpack Compose, Room, media3, Glance; GTK4 + libadwaita; WinUI 3 | S |
| Desktop app | Tauri 2.11, React 19, TypeScript 7, Vite 8, TanStack, xterm, recharts, keyring | K |
| Unit tests | Jest 29–30 (junit), Vitest 4 (sharded in NE), Swift Testing, XCTest, JUnit 4, Robolectric, Roborazzi, Turbine | all |
| E2E | Playwright 1.62 (NE web, 8 shards; K with mocked IPC), Maestro (PP mobile, local only), agent-device 0.21 (S), k6 (PP perf) | PP NE K S |
| Specs | Gherkin `.feature` (PP 77, NE 46, no step runner), spec-kit 0.11 (NE), OpenSpec 1.x (S, K schema) | all |
| Lint | ESLint 9–10, Prettier 3, husky, lint-staged, commitlint 19–21, Vale 3.17 (NE), SwiftLint strict, clippy deny, Android Lint | all |
| API tools | Bruno (PP 350 `.bru`, NE 396 `.bru`, plus `bruno-external` for third-party APIs), Scalar, OpenAPI | PP NE |
| Mocks | Mockoon CLI 9.9 (PP, 113 routes, port 3002, also a dev-only Helm chart), nock, axios-mock-adapter, provider switches (`AI_PROVIDER=fake`, SIREN mock, `MAIL_SANDBOX`), Mailpit, local test IdP | PP NE |
| Data tools | drizzle-kit studio, Beekeeper Studio (PP doc only), DBML generation (PP), ERD check `db:erd:check` (NE) | PP NE |
| Containers | Docker Compose local stacks (PP: pg, keycloak, analytics pg, minio, redis; NE: pg, pgvector, redis, mailpit, minio, keycloak, profiles `presidio` and `observability` with Langfuse) | PP NE |
| Security | osv-scanner 2.3 (PP CI daily, CVSS ≥9 gate, opens an issue; NE config + unwired gate script), SonarQube local (both, not in CI), Checkmarx zip export script (PP), `pnpm audit` nightly (NE), pnpm `overrides` for CVEs | PP NE S K |
| CI | GitHub Actions on self-hosted macOS ARM64 (PP, S); GitLab CI on CGI Forge runners with no internet, Nexus npm proxy, buildah (NE, K) | all |
| Cloud and IaC | Scaleway fr-par (Kapsule, managed PostgreSQL, LB, registry, Secret Manager, TEM), Terraform 1.15 with S3 state, tflint, kubeconform | PI NI |
| GitOps | Helm, ArgoCD (PP: own instance, ApplicationSet per helm dir, auto-sync off in production; NE: shared CGI Forge ArgoCD, browser-cookie token valid about 5 minutes) | PI PH NI NH |
| Secrets | Scaleway Secret Manager → External Secrets Operator → one `<env>-api-env` secret; KeePass file shared by humans; Yopass; OS keychain (K) | all |
| Observability | Grafana LGTM (Loki, Tempo, Mimir) + Alloy + Prometheus, Blackbox probes, tail sampling, 19 dashboards as JSON (PP), Kong basic-auth tenant header (NE), Langfuse and Presidio (NE) | PI NI |
| Agent tooling | Claude Code, Codex, Copilot, Konvoy, codebase-memory-mcp, projectmem, Dual Graph (PP only), claude-mem, rtk, CodexBar, ccusage (Konvoy FinOps), mcp-grafana (PP), Maestro MCP (PP), agent-device (S), Figma MCP, Playwright MCP, context7, sequential-thinking, mcp-atlassian (user level) | all |

## 2. Scripts by group

| Group | PP | NE | S |
|---|---|---|---|
| Dev | `dev`, `dev:api`, `dev:backoffice`, `dev:mobile`, `dev:infra*`, mobile `ios:*`/`android:*` | `dev`, `dev:api`, `dev:web`, `dev:infra[:all]`, `dev:env:copy`, `seed:dev`, `seed:kb` | `build:ios`, `pnpm gradle`, `build:macos`, `build:linux` |
| Quality | `check*`, `typecheck*`, `lint:md`, postinstall package build | `check*`, `check:module-docs`, `keycloak:validate-*`, `docs:vale`, Node version guard | `lint` = 23 checks: line cap 800, tokens, spec guard, delta-drop, partial tasks, preview proof, commitlint guard, `selftests` |
| E2E | `e2e:local:ios/android` (throwaway Docker stack, no secrets), mobile `e2e:*`, API `test:e2e` | `e2e`, `e2e:web`, `test:real` | `test:ios:ui`, `test:android:instrumented`, `capture:*`, `snap:*` |
| Mocks | `mocks`, `mocks:openapi`, `generate:mocks` | none | none |
| Security | `sonar:*`, `checkmarx:package*` | `sonar:*`, `osv-gate.mjs` | `notices:check` |
| DB | about 25 `db:*`, `generate:dbml` | `db:*`, `db:erd[:check]`, `db:kb:*` | n/a |
| Ops | SSH tunnel to the IP-allowlisted host, branch history check | local GitLab runner, Keycloak realm generator, `infra-urls.mjs` | `release`, `store:*` (CI publishes) |

## 3. Env vars

| | NE | PP |
|---|---|---|
| Files | `.env.devkit.example` (117 vars) copied by `dev:env:copy`; `apps/api/.env.example` (146); root `.env.example`; tracked web `.env.development` | `apps/api/.env.example` (172), `.env.docker.example`, root `.env.example`; tracked mobile `.env.{development,staging,production}` |
| Schema | Zod `env.schema.ts` (583 lines), `env.cross-checks.ts` (production rules), `env.validation.ts` | none; missing vars degrade silently |
| Tests | `env.validation.spec.ts` boots from `.env.example` and fails on an undeclared `config.get` or `process.env` read | none |
| Rule | AGENTS §15: schema, `.env.example` and local `.env` change in the same task | instinct only |
| Weak points | 3 overlapping templates; copy overwrites `.env`; KeePass file tracked in git; a `VITE_*SECRET` name ships to the browser | duplicated root example; deny list only in an example file |

## 4. Local run

| Step | PP | NE |
|---|---|---|
| Install | `pnpm install` (postinstall builds shared packages) | `pnpm install` (corporate TLS needs `NODE_OPTIONS=--use-system-ca`) |
| Env | copy example; values from KeePass (human) | `pnpm dev:env:copy` |
| Infra | `pnpm dev:infra:start` (Docker) | `pnpm dev:infra` (realm generation, theme build needs JDK + Maven) |
| DB | build API, then `db:migrate`, `db:analytics:migrate`, `db:seed` | `ALLOW_DEV_SEED=true pnpm seed:dev`, `pnpm seed:kb` |
| Apps | `dev:api`, `dev:backoffice`, `mocks` (+ `adb reverse` for Android) | `dev:api`, `dev:web` |
| Mobile | fastlane downloads artifacts; needs cloud keys, maps key, GitHub PAT, Xcode, Ruby, Java; Zscaler blocks port 8081 | n/a |
| Human inputs | KeePass, SSH key for allowlisted calls, mobile keys | Docker, optional IdP and LLM keys |

StoryArc: `git submodule update --init --recursive && pnpm install`, then `pnpm build:ios` or `pnpm gradle installDebug`, `pnpm check`, `pnpm check:devices`.

## 5. Tracker and delivery

| Item | PP | NE |
|---|---|---|
| Key | `PARCUS-NNN` in commit subject | `OPCOATLAS-NNN`, French commits |
| Branch | `<feature|fix>/<app>/<desc>` | `<fix|feature>/OPCOATLAS-123-desc` |
| Agent flow | PR template `## [PARCUS-000]` | `.claude/skills/jira-ticket`: tiers T0–T3, scope/gate/hygiene/mr-notes scripts, transitions In Review → Request for Approval → Resolve, no time logging, no comment without a yes |
| Remaining work | `specs/<programme>/{tasks,checklist,questions,jira-reconciliation}.md` | `RESTE-A-FAIRE.md`, `implementation-status.md`, `raf/RAF-jira-*.md`, `QUESTIONS-OUVERTES.md`, wave plans |

## 6. Konvoy contract (K)

Konvoy is a Tauri cockpit for "project as a Git repo". Path defaults come from `RepoPaths`
(`src-tauri/src/infrastructure/config.rs`); `.agents/konvoy.json` mirrors them in `paths`.

| Artifact | Default path | Format |
|---|---|---|
| ADR | `docs/decisions/NNNN-slug.md` | MADR 4.0; frontmatter `status`, `date`, optional `decision-makers`, `consulted`, `informed`. Listing skips `readme`, `index`, names that start with `template` or `adr-template`. |
| Specs | `docs/openspec` | `changes/<id>/proposal.md`, `changes/<id>/specs/<cap>/{spec,plan,checklist,tasks}.md`, `changes/archive/`, `constitution.md`, schema `konvoy-delivery` |
| RAID | `docs/delivery/questions/Q-NNN.md` | Keys `id`, `kind`, `status` (open, assigned, answered, folded), `raisedAt`, `raisedBy`, `owner`, `specRef`, `taskRef`, `ticket`. Never delete; fold. |
| Impact note | `docs/delivery/impacts/YYYY-MM-DD-slug.md` | `audience: dev` |
| Digest | `docs/delivery/digests/YYYY-MM-DD-slug.md` | `audience: product`; no paths, names or code |
| Estimates | `docs/costing/*.json` | version 2; agent writes `basis: assistant-suggested`, `reviewed: false` |
| Tickets | `docs/delivery/tickets.json` (+ plan, apply log, sync, worklog) | Konvoy is the only writer |
| QA, test plans | `docs/delivery/qa/`, `docs/delivery/test-plans/*.feature` | tags `@spec(cap/req)`, `@manual`, `@automated(<script>)` |
| Designs | `docs/designs`, `docs/design.md` (UX doc), `docs/DESIGN.md` (Figma tokens) | images and html |
| Diagrams | `docs/diagrams`, `docs/data-models`, `docs/api`, `docs/network/flows.json` | likec4, mermaid, dbml, OpenAPI |

Konvoy also writes `.agents/STYLE-CONTRACT.md`, skills with `{{DELIVERY_DIR}}`-style placeholders,
`AGENTS.md`, `CLAUDE.md`, MCP files and its ledger. It vendors compass 0.9.3.
Konvoy has no glossary and no screen-alias convention.

## 7. Compass integration state in hosts

| Repo | Version | State |
|---|---|---|
| PP | lock 0.9.4 | 34 skills, 29 instincts; `protect-agent-files.sh` and completion hook installed but not wired; AGENTS.md mandates Dual Graph while answers say `codeIntelligence: none`; `scope: "@scope"` placeholder |
| NE | vendored 0.7.0 (542 files) | 43 skills in `.claude/skills` and 41 hand-synced twins in `.agents/skills`; hooks wired; lock drift in 7 of 25 files |
| S | submodule 0.9.6, Konvoy ledger 0.9.1 | 70+ skill dirs from 5 sources; stale `.agent/RUNBOOK.md`; answers say npm, repo uses pnpm |
| K | vendors 0.9.3 inside the app | 25 instincts, 2 edited locally |

Conflicts to resolve: commit policy (Konvoy: never commit; S: commit per piece), two ledgers,
two sources of path truth, three spec dialects, root `specs/` required by compass doctor but forbidden by Konvoy.

## 8. Patterns worth enforcing

1. A contract change updates Scalar, Bruno, Gherkin and mocks in the same task (PP, NE).
2. Env var lives in schema, `.env.example` and local default together; production rejects mock providers (NE).
3. Every generated file has a gate: migration regeneration diff, immutable applied migrations, ERD check (PP, NE).
4. Fixed module layout and per-module README gate (PP, NE).
5. Rebase, never merge; hook and pre-push enforce it (PP).
6. Conventional commits with ticket key; no AI attribution line (PP, NE, S).
7. Completion gate lists files, commands and results; never "done" with a skipped gate (PP).
8. Changelog per app and per tag in the same PR (PP); docs follow code in the same task (K, S).
9. PR body is evidence only (PP, NE).
10. Zero-secret local e2e on a throwaway Docker stack (PP).
11. CI cost control: lockfile caches, scoped installs, sharded tests, digest-pinned images (NE).
12. Every guard ships a self-test that proves it can fail (S).
13. Visual proof: snapshot references, accessibility audit, `Visual-proof:` marker (S).
14. A moved source with an unmoved downstream artifact fails CI (K chain check).
15. Safe writes: never delete (fold), never reuse ids, agents never log time (K).

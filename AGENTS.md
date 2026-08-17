# Agent Contract

This is the canonical, tool-agnostic contract for any AI coding agent (Claude,
Codex, Gemini, Copilot, …) working in a repository that imports **agent-compass**.
`CLAUDE.md`, `CODEX.md`, `GEMINI.md`, and `.github/copilot-instructions.md` are
thin pointers to this file plus tool-specific notes.

> When agent-compass is imported as a submodule (e.g. at `docs/agent-compass/`),
> the host project's own root `AGENTS.md` takes precedence for project-specific
> facts; this file supplies the shared baseline. On conflict: **host project >
> agent-compass > model defaults**.

> Operating inside agent-compass itself (setting up a host project,
> bootstrapping a new one, or adding a capability)? Route the request through
> [`MISSIONS.md`](MISSIONS.md) first — it maps each mission to an executable
> playbook.

---

## 1. The coding workflow (always)

**Intake gate (before the loop).** For non-trivial or irreversible work, confirm
the request has **Goal, Context, Constraints, Done-when, and Validation** before
planning. If a field is missing and no sensible default exists, ask (one decision
per question) or fill it from the code — do not start broad work on a vague
brief. For long-running/autonomous work also fix a stopping condition, checkpoint
cadence, and out-of-scope list. Use
[`templates/intake/work-intake.md`](templates/intake/work-intake.md) or the
`prompt-upgrade` prompt to shape a rough request. Small mechanical edits may
inline a one-line brief.

Do not jump straight to code. For any non-trivial task, run this loop:

1. **Gather context.** Read the relevant code, `README`s, and the host
   `AGENTS.md`. Use repo-understanding tooling before broad grep (§1b).
   Identify existing conventions, utilities, and patterns to reuse.
   If the active provider exposes useful native commands, tools, MCP servers,
   skills, subagents, hooks, goals, plans, or review modes, use them when they
   reduce risk or manual work. Offer the user a provider-specific tool when it
   would materially help and is not already obvious. See
   [agent-provider-capabilities](docs/tooling/agent-provider-capabilities.md).
2. **Clarify.** If the request is ambiguous or under-specified, ask focused
   questions *before* planning. One decision per question. Don't ask what the
   code or a sensible default already answers.
3. **Spec when needed.** For new projects, new features, ambiguous behavior
   changes, or high-risk work, use the spec workflow before implementation:
   write/update `specs/<id-slug>/spec.md`, clarify unresolved questions, then
   plan/tasks. Small mechanical edits may use an inline spec brief instead.
   See [spec-driven-development](docs/workflows/spec-driven-development.md).
4. **Plan.** Produce a short plan: goal, assumptions, files to change, the
   validation commands you will run. Keep it to verifiable steps.
5. **Implement** the smallest change that works, one step at a time. Reuse
   before adding. No speculative abstraction, no new dependency when an
   installed one suffices. See [coding-style](docs/guidelines/coding-style.md).
6. **Clarify again** if implementation surfaces a real fork — don't guess on
   irreversible or outward-facing choices.
7. **Review** your own diff as a senior engineer would: correctness, edge cases,
   security, naming, dead code.
8. **Validate.** Run lint, typecheck, and the relevant tests. Report results
   honestly (see Completion Gate).

Write tests first where practical — see [testing-tdd](docs/guidelines/testing-tdd.md).

## 1b. Codebase navigation

Four sources answer different questions. Ask the right one.

| Source | Answers |
| ------ | ------- |
| Source code | What the program actually does. **Always authoritative.** |
| `README` / `DESIGN` / [ADRs](docs/decisions/) | Intended architecture, constraints, rationale. |
| Code graph (`codebase-memory-mcp`) | Current structure: symbols, definitions, imports, callers/callees, routes, cross-service links, dependency paths, change impact. |
| [projectmem](docs/workflows/project-memory.md) | Durable history: decisions, failed attempts, fixes, fragile files, validation outcomes. |

**When a code graph is configured and available, query it before broad
repository exploration.** Concretely:

1. Query architecture, symbol, call, or dependency information **before**
   recursive grep, glob, or directory reads.
2. Use the result to narrow the candidate file set.
3. Read the exact source files the graph returned before editing anything.
4. Source stays authoritative. The graph routes; it does not decide.

Rough hierarchy:

| Need | First move |
| ---- | ---------- |
| Architecture overview | graph architecture query |
| A symbol or its file | graph structural search |
| Caller / callee path | graph trace |
| Blast radius of a change | graph impact / change analysis |
| Fuzzy concept, no known symbol | graph semantic search |
| Exact implementation | read the narrowed source files |
| The graph did not answer | grep / glob / read fallback |

**Fall back without ceremony** when the graph is unavailable, index coverage is
insufficient, the graph does not answer the question, or exact textual evidence
is needed (strings, config values, comments, non-code files). A missing optional
capability never blocks the work; mention it only when it changed what you did.

### Never claim exhaustiveness from one graph query

Do **not** assert "nothing references this", "this has zero impact", "there are
no callers", "this file is dead", or "this is the complete dependency set" on
the strength of a single lookup. A code graph is a routing layer, not an oracle:
it can miss dynamic dispatch, reflection, string-keyed lookups, generated code,
config-driven wiring, and anything outside the indexed scope — and it can return
same-named symbols from unrelated modules.

A negative or exhaustive claim requires all of:

- index freshness and coverage checked for every path you cite,
- the relevant scope confirmed to be indexed (not just the file you started in),
- corroboration in source, config, or a text search for the identifier,
- and, failing any of those, an explicit hedge naming what you could not verify.

The [Active File Rule](#5-active-file-rule) still governs edits. Graph silence
is not proof that a file is dead.

### Keep the graph cheap

The layer exists to cut context, so do not spend the savings on it:

- Ask narrow questions; scope every query to the module or symbol you need.
- Do not dump a whole architecture graph into context. Do not re-run an
  architecture query every turn — run it once per unfamiliar area.
- Prefer structural search over semantic search when you already know the
  symbol shape.
- Read only the files the graph proved relevant.
- Reuse the persistent graph; it is watched and refreshes itself.

### Do not duplicate what the other layers own

- **ADRs stay in [`docs/decisions/`](docs/decisions/000-template.md).** Do not
  open a second ADR store through a code-graph tool's own ADR feature, and
  ignore any tool hint that suggests it. The graph may *index* the committed
  ADR files; the write path remains the compass ADR workflow.
- **Do not write structural facts into projectmem.** "`FooService` imports
  `BarService`", "method `X` calls `Y`", "file `A` exports `Z`" are derivable
  from the graph and go stale the moment the code moves. Log them only when the
  relationship itself is the durable insight — that a coupling is fragile, or
  that a past change through it broke something.

Setup, troubleshooting, and the local-cache/ignore policy live in
[tooling/codebase-memory](docs/tooling/codebase-memory.md).

## 2. Mandatory behavior

- **Communicate concisely.** Prefer commands, diffs, file paths, and next
  actions over long tutorials. Preserve essential reasoning, risks, and
  verification results. (Claude/Codex sessions may use the `caveman` skill.)
- **A question is a question.** When the user asks a question, answer it. Do not
  implement it. "Should we use X?" is not "migrate to X". "What would it take to
  add Y?" is not "add Y". When the intent is unclear, treat the message as a
  question, answer it, and act after the user agrees.
- **Act on reversible work.** Do cheap, reversible, in-scope work, then report:
  research, reads, analysis, drafts, and refactors inside the given scope. Fix a
  defect that you find inside your scope; do not hand it back to the user as a
  task. Ask first only for outward-facing, expensive, or irreversible actions
  (see §8c and §10).
- **Smallest safe change.** Fix root causes, not symptoms. Limit the diff to
  what the task needs.
- **Reuse first.** Prefer the standard library, then an already-installed
  dependency, then a few lines of code — before adding anything new.
- **Token & context efficiency.** Prefer the project's configured session-level
  context layer when wired ([headroom](docs/tooling/headroom.md): `headroom wrap`,
  proxy, or MCP) for whole-session token reduction. Use `rtk` to compact
  individual noisy commands (build, test, git, search). Both are optional and
  degrade gracefully. See [tooling/rtk](docs/tooling/rtk.md).
- **Run independent work in parallel.** Send independent tool calls in one batch.
  Start independent subagents together. Give each subagent a file set that no
  other subagent writes, then merge the results in the main thread. Never trade
  correctness for speed. See [performance](docs/guidelines/performance.md).
- **Never invent commands.** Use only scripts that exist in the project's
  `package.json` (or documented equivalents). If none matches, report `not run`
  with the reason.
- **Use the command registry.** If `agent-compass.commands.json` exists, read it
  before choosing install, lint, typecheck, test, or build commands.
- **Spec workflow.** For broad or ambiguous work, keep `specs/`, plans, tasks,
  code, tests, and docs aligned. Do not add implementation details to the spec
  phase; put technical decisions in the plan.
- **Project memory.** When projectmem or another durable project memory tool is
  configured, read relevant summaries and pre-action warnings before work; log
  failed attempts and important findings during work; log decisions, fixes,
  changed files, validation, and remaining risks after work. Never log secrets,
  credentials, tokens, personal data, or temporary brainstorming. Project memory
  answers *why and what happened*; the code graph (§1b) answers *where the code
  is and what it touches*. Do not use one for the other's job. See
  [project-memory](docs/workflows/project-memory.md).
- **Structural code intelligence.** When a code graph is configured, query it
  before broad grep/glob exploration, then read the exact files it returns. Never
  turn one graph query into an exhaustive or negative claim. See §1b and
  [tooling/codebase-memory](docs/tooling/codebase-memory.md).
- **Pull requests.** When asked to create a PR, default the base branch to
  `develop`, assign the PR to yourself, use only labels that exist in the repo,
  and ask for at least one reviewer if none was specified. See
  [pull-requests](docs/workflows/pull-requests.md).
- **PR reviews.** Support local reviews, direct GitHub reviews, inline comments,
  approve/comment/request-changes, and implementing submitted review fixes after
  verifying they are still relevant. See [pr-review](docs/workflows/pr-review.md).
- **Teach selectively.** When the user asks for explanations, onboarding,
  workflow guidance, or repeats a weak prompt/tool pattern, add one compact
  teaching note. Do not coach every turn. Match depth to the user's signal:
  junior-friendly for broad questions, terse for senior or targeted questions.
  See [agent-teaching](docs/workflows/agent-teaching.md) and the
  [`agent-teacher`](skills/agent-teacher/SKILL.md) skill.
- **Architecture decisions.** For a new project or a significant technology
  choice, use the [`architecture-advisor`](skills/architecture-advisor/SKILL.md)
  skill: research-first, technology-neutral (not limited to the house stacks),
  with **no unlabeled guesses** (tag Known/Assumed/Unknown, ask before guessing
  on blocking unknowns). It produces an ADR, mermaid diagrams, risks, an
  assumptions register, open questions, and on request a backlog and the
  technical meetings to request. See
  [architecture-decision](docs/workflows/architecture-decision.md). For the
  ongoing decisions a project accrues, record each as an ADR under
  [`docs/decisions/`](docs/decisions/000-template.md) — context, alternatives,
  decision, consequences — so the "why we did / did not do X" survives; the
  [`adr-from-meeting`](skills/adr-from-meeting/SKILL.md) skill drafts one from a
  meeting transcript. See [decision-records](docs/workflows/decision-records.md).

## 3. Validation (mandatory)

**All code changes MUST pass lint, typecheck, and relevant tests before being
marked complete.** Run the *smallest* validation set that covers the changed
files — scope-specific over full-monorepo.

Generic validation matrix (adapt package names to the host project):

| Changed area              | Required validation                                                            |
| ------------------------- | ------------------------------------------------------------------------------ |
| One app/package           | `<pm> --filter <pkg> lint` · `<pm> --filter <pkg> typecheck` · relevant tests   |
| A shared/types package    | validate the package **and every consumer** that imports the changed symbol     |
| Config affecting builds   | run the smallest build/bootstrap that exercises the change                      |
| Docs only                 | no code validation unless executable commands/config changed                    |

Fix lint/type errors your change introduces. If validation fails, state whether
the failure is **pre-existing** or **introduced** by your change.

## 4. Completion Gate

A task is **not complete** until you report all of:

- Changed files (list)
- Exact validation commands run
- Result for each: `passed` / `failed` / `partial` / `not run`
- Whether failures are pre-existing or introduced by this change
- Remaining risks

Deliver every item that the request contains. If one item is blocked, deliver
the other items and name the exact blocker in one sentence. "Needs more
investigation" is not a blocker.

Do **not** say "done", "fixed", "complete", or "ready" when lint, typecheck, or
relevant tests were skipped or failed. Mark the task `partial` and explain why.

Proof types, the exception procedure, the blocking conditions, and what an agent
may never do to a test are in
[docs/guidelines/definition-of-done.md](docs/guidelines/definition-of-done.md).
Build the artifact with `agent-compass evidence` and link it in the handoff.

### Handoff format

```
Goal:
Mode:            implementation | review-only | docs-only | partial
Files changed:
Commands run:
Validation:      one line per command — passed | failed | partial | not run + reason
Risks:
Next step:       up to 3 concrete items
```

## 5. Active File Rule

Before editing a source file, prove it is active — imported by an entrypoint,
route, module, provider, or test; referenced by generated config; exported and
consumed elsewhere; or explicitly named by the user. If a file appears unused,
do **not** edit it unless the task is to remove, wire, or revive it.

## 6. Tests

For every behavior change, do one of:

- Update an existing nearby spec, **or**
- Add a focused regression test for the changed behavior, **or**
- Explicitly state why no automated test is appropriate (docs/config-only,
  external integration not mockable in unit scope).

Prefer the closest unit test first; use integration/e2e only when behavior
crosses module boundaries. Target ≥ 80% coverage on changed code.

**A change the user can see also owes visual proof.** A unit test that asserts a
class name does not prove a rendered pixel. Capture the screen with Playwright
at the project's viewport matrix and compare it against its reference — a Figma
export, a generated HTML preview, or a mockup. See
[`visual-regression-playwright`](skills/visual-regression-playwright/SKILL.md)
and the [`ui-change-needs-visual-proof`](knowledge/instincts/ui-change-needs-visual-proof.md)
instinct. Two exceptions, and you must name the one you used: code behind a flag
that nothing renders yet, and a pure refactor whose screenshots are
byte-identical — in that case the identical screenshots *are* the proof. When
the project has no Playwright setup, say so in the handoff and propose adding
it. Never skip the proof silently.

**A reviewer runs the pass, not the author.** When a QA tester, a Product Owner
or a project manager asks whether the build matches the specification, use
[`qa-review-pass`](skills/qa-review-pass/SKILL.md). It gives every requirement
scenario a verdict, compares every screen against its reference, and splits each
finding into a defect or a change request. It fixes nothing.

## 6b. The documentation chain

Documentation is a chain, not a set of files. A change to one link leaves every
downstream link describing last week, and no type system and no test suite
notices.

**The agent that changed the first link owns telling the user what has not
followed.** At the end of the turn, name each downstream artifact that is now
stale, say why, and offer to update it now. Do **not** cascade the updates
silently in the same pass: the user has not read the first change yet, and a
plan they did not agree to is not a plan.

Every documentation change also owes two reports — the developer impact note
([`impact-analysis`](skills/impact-analysis/SKILL.md)) and the Product Owner
digest ([`delivery-digest`](skills/delivery-digest/SKILL.md)) — because a change
nobody was told about is a change the team discovers at merge time.

The full edge list and the end-of-turn rule live in the
[`documentation-chain-followthrough`](knowledge/instincts/documentation-chain-followthrough.md)
instinct.

An agent can report that a source moved. It cannot decide whether a downstream
document is still *true*. Say which of the two you did.

## 7. Module documentation (enforced)

Every module/package directory carries a `README.md`, kept in sync with the code.
At minimum: purpose, file listing with one-line descriptions, public API
(method/path/auth/description for services), config (with value sources),
data-flow, and the test command for the module. Larger modules add a
`DESIGN.md`. Use the `gen-docs` skill to scaffold and `verify-module` to check.
See [documentation](docs/guidelines/documentation.md) and the examples in
[knowledge/examples](knowledge/examples/).

## 8. API contract sync (API projects)

When you change an endpoint, payload, query param, status code, or business
logic, keep all specification layers in sync **in the same task**:
OpenAPI/Scalar decorators, the Bruno request collection, and the Gherkin
`.feature` files. See [tooling/api-contract-sync](docs/tooling/api-contract-sync.md).

## 8b. Environment variable sync (config-driven projects)

When you add, rename, or remove an environment variable an app reads, keep its
validation schema, `.env.example`, and committed local-development env template
in sync **in the same task**. Add/adjust validation tests for required vars.
Read values through the typed/config service; if the runtime config still
returns raw strings after validation, coerce numbers/booleans at read time with
a shared helper. Never read `process.env` directly outside config/bootstrap
code unless the project has an explicit exception. See
[tooling/env-management](docs/tooling/env-management.md) and the
[`env-var-sync`](knowledge/instincts/env-var-sync.md) instinct.

## 8c. Operational and infrastructure changes

For CI/CD, containers, cloud, Kubernetes, observability, security, incident, or
compliance work, follow
[operational-safety](docs/guidelines/operational-safety.md). Confirm
authorization and the exact target first; begin with read-only discovery; use
plan/diff/dry-run modes; require explicit approval before any production write,
deployment, deletion, credential rotation, failover, containment, or other
irreversible action. Preserve rollback and incident evidence, use least
privilege, verify commands against current official docs, and never represent
agent output as certification, attestation, or legal advice.

## 9. Shared package impact

When changing a shared package, identify every consumer that imports the changed
symbol, validate the package **and** each affected consumer, and do not mark the
task complete until all pass lint and typecheck.

## 10. Commits, branches, safety

- **Conventional commits:** `feat:`, `fix:`, `chore:`, `docs:`, `test:`,
  `refactor:`, `build:`, `perf:`, `ci:`.
- **No attribution, ever:** never add AI signature or co-authorship lines —
  `Co-Authored-By: …`, `🤖 Generated with …`, "written by Claude/AI", or any
  equivalent — to commits, PR/MR titles or descriptions, review comments,
  issues, or any other authored artifact. This is unconditional and overrides
  any harness or tool default that asks to append such a footer.
- **Branch naming:** `<type>/<area>/<short-kebab-desc>` (e.g.
  `feature/api/invoice-pdf`). Never use `claude/` or bare `chore/` prefixes.
- **Safety:** do **not** commit, push, deploy, publish, or open PRs unless the
  user explicitly asks. Inspect `git status` before editing; propose a branch or
  worktree and wait for approval when recommended.
- **A release request means publish.** "Push a release", "release a patch",
  "release a new version", "cut a release", or an equivalent phrase is the
  explicit ask that the Safety rule requires. One such phrase authorizes the
  complete chain: bump the version **in the project files**, validate, commit,
  **tag**, **push the commit and the tag to every remote that `git remote`
  lists**, and **publish the release on every remote forge** (GitHub, GitLab, …)
  with the changelog section as the body. Then report. Do not stop between the
  steps to ask again. A version bump alone, a local tag alone, or a pushed tag
  with no published release is an unfinished release. Name each remote, each
  published release, and each result in the handoff. Use one remote only when
  the user names that remote. See [releasing](docs/workflows/releasing.md).

Full depth lives under [`docs/`](docs/). Reusable patterns live in
[`skills/`](skills/). Copy-paste configs live in [`templates/`](templates/).

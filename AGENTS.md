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
   `AGENTS.md`. Use repo-understanding tooling before broad grep. Identify
   existing conventions, utilities, and patterns to reuse.
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

## 2. Mandatory behavior

- **Communicate concisely.** Prefer commands, diffs, file paths, and next
  actions over long tutorials. Preserve essential reasoning, risks, and
  verification results. (Claude/Codex sessions may use the `caveman` skill.)
- **Smallest safe change.** Fix root causes, not symptoms. Limit the diff to
  what the task needs.
- **Reuse first.** Prefer the standard library, then an already-installed
  dependency, then a few lines of code — before adding anything new.
- **Token & context efficiency.** Prefer the project's configured session-level
  context layer when wired ([headroom](docs/tooling/headroom.md): `headroom wrap`,
  proxy, or MCP) for whole-session token reduction. Use `rtk` to compact
  individual noisy commands (build, test, git, search). Both are optional and
  degrade gracefully. See [tooling/rtk](docs/tooling/rtk.md).
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
  credentials, tokens, personal data, or temporary brainstorming. See
  [project-memory](docs/workflows/project-memory.md).
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

Do **not** say "done", "fixed", "complete", or "ready" when lint, typecheck, or
relevant tests were skipped or failed. Mark the task `partial` and explain why.

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

Full depth lives under [`docs/`](docs/). Reusable patterns live in
[`skills/`](skills/). Copy-paste configs live in [`templates/`](templates/).

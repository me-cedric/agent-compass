# Agent Contract

This is the canonical, tool-agnostic contract for any AI coding agent (Claude,
Codex, Copilot, Cursor, …) working in a repository that imports **agent-compass**.
`CLAUDE.md`, `CODEX.md`, and `.github/copilot-instructions.md` are thin pointers
to this file plus tool-specific notes.

> When agent-compass is imported as a submodule (e.g. at `docs/agent-compass/`),
> the host project's own root `AGENTS.md` takes precedence for project-specific
> facts; this file supplies the shared baseline. On conflict: **host project >
> agent-compass > model defaults**.

---

## 1. The coding workflow (always)

Do not jump straight to code. For any non-trivial task, run this loop:

1. **Gather context.** Read the relevant code, `README`s, and the host
   `AGENTS.md`. Use repo-understanding tooling before broad grep. Identify
   existing conventions, utilities, and patterns to reuse.
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
- **Use `rtk`** to wrap noisy shell commands (build, test, git, search) when it
  is available. See [tooling/rtk](docs/tooling/rtk.md).
- **Never invent commands.** Use only scripts that exist in the project's
  `package.json` (or documented equivalents). If none matches, report `not run`
  with the reason.
- **Spec workflow.** For broad or ambiguous work, keep `specs/`, plans, tasks,
  code, tests, and docs aligned. Do not add implementation details to the spec
  phase; put technical decisions in the plan.
- **Project memory.** When projectmem or another durable project memory tool is
  configured, read relevant summaries and pre-action warnings before work; log
  failed attempts and important findings during work; log decisions, fixes,
  changed files, validation, and remaining risks after work. Never log secrets,
  credentials, tokens, personal data, or temporary brainstorming. See
  [project-memory](docs/workflows/project-memory.md).

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

## 9. Shared package impact

When changing a shared package, identify every consumer that imports the changed
symbol, validate the package **and** each affected consumer, and do not mark the
task complete until all pass lint and typecheck.

## 10. Commits, branches, safety

- **Conventional commits:** `feat:`, `fix:`, `chore:`, `docs:`, `test:`,
  `refactor:`, `build:`, `perf:`, `ci:`.
- **Branch naming:** `<type>/<area>/<short-kebab-desc>` (e.g.
  `feature/api/invoice-pdf`). Never use `claude/` or bare `chore/` prefixes.
- **Safety:** do **not** commit, push, deploy, publish, or open PRs unless the
  user explicitly asks. Inspect `git status` before editing; propose a branch or
  worktree and wait for approval when recommended.

Full depth lives under [`docs/`](docs/). Reusable patterns live in
[`skills/`](skills/). Copy-paste configs live in [`templates/`](templates/).

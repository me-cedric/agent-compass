# Development Workflow

The full pipeline before git. This is the long form of `AGENTS.md §1`.

## 0. Research & reuse (before any new code)

Don't write what already exists. In order:

1. Search the codebase for existing implementations, utilities, and patterns.
2. Search package registries (npm/PyPI/crates) — prefer battle-tested libraries
   over hand-rolled code.
3. Search for adaptable open-source implementations that solve 80%+ of the problem.
4. Check live docs (context7 / official docs) for the library you'll use.

Prefer adopting or porting a proven approach over net-new code.

## 1. Plan first

Produce a plan before coding: goal, assumptions, files to change, validation
commands, risks. For complex features, break into phases. Present it; on
non-trivial work, get approval before editing.

## 2. TDD

Write the test first (RED), implement minimally (GREEN), refactor (IMPROVE),
verify coverage. See [testing-tdd.md](testing-tdd.md).

## 3. Implement

Smallest change that works, one step at a time. Reuse before adding. No
speculative abstraction; no new dependency when an installed one suffices. State
which step you're on.

## 4. Review

Review your own diff as a senior engineer: correctness, edge cases, security,
naming, dead code, doc sync. Use `verify-quality` / `verify-change` skills.

## 5. Validate & report

Run lint + typecheck + relevant tests (smallest covering set). Report against the
[Completion Gate](agent-behavior.md). Keep module READMEs and specs in sync as
part of the same task.

## 6. Commit & push (only when asked)

Conventional commits, comprehensive PR. See [git-workflow.md](git-workflow.md).

---

Optional agent assists (if configured): a **planner** for step 1, a **tdd-guide**
for step 2, a **code-reviewer** for step 4. Parallelize independent work.

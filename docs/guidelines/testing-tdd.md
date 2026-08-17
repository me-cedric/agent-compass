# Testing & TDD

Testing is not optional and not an afterthought. Behavior changes ship with tests.

## The TDD loop (mandatory for non-trivial logic)

1. **RED** — write the test first; run it; watch it fail for the right reason.
2. **GREEN** — write the minimal code to pass.
3. **REFACTOR** — clean up with the test as a safety net.
4. **VERIFY** — coverage on changed code ≥ 80%.

Trivial one-liners don't need a test (YAGNI applies to tests too), but any
branch, loop, parser, money path, or security path leaves at least one runnable
check behind.

## Test types

- **Unit** — functions, utilities, components in isolation. The default; reach
  for it first.
- **Integration** — API endpoints, database operations, module wiring.
- **E2E** — critical user flows. Use **Playwright** for web; the framework-native
  runner for mobile (e.g. Detox/Maestro for Expo).

## Test selection rule

For every behavior change, do one of: update a nearby spec, add a focused
regression test, or explicitly justify why no automated test fits (docs/config
only, external integration not mockable in unit scope). Prefer the closest unit
test; escalate to integration/e2e only when behavior crosses module boundaries.

## Name a test after the rule it defends

Write the test name as a sentence that states the rule. A failure then names the
broken rule, and not the mechanism that broke.

Four names from one command-line integration module show the shape:

- `only_the_bypass_tier_carries_a_blanket_bypass`
- `an_unknown_mode_resolves_to_the_safest_tier`
- `a_refused_permission_names_the_tool_that_was_refused`
- `the_rate_limit_event_is_read_instead_of_guessed_from_an_error`

Each name is an invariant. A reader who sees one of them in a failing run knows
what the code must guarantee, without opening the file.

Prefer this over a name that repeats the function under test (`test_parse_mode`,
`handles_error`). Keep the ecosystem convention: `snake_case` for Rust and
Python, and a `describe` plus `it` sentence for Jest and Vitest.

## Patterns (NestJS / TS reference)

- Prefer `jest-mock-extended` + `Test.createTestingModule()`.
- When code uses transactional decorators, mock the transaction library in tests.
- Keep typed fixtures near the top of the spec.
- Co-locate `*.spec.ts` with the source file.

## Coverage & reporting

- ≥ 80% on changed code; produce coverage for the Sonar pipeline
  (`test:cov`) — see [tooling/sonarqube.md](../tooling/sonarqube.md).
- A failing or skipped test means the task is `partial`, never "done" — see
  [agent-behavior.md](agent-behavior.md).

## Screen profiles

Run every reference UI journey against a fixed matrix, so a proof is
reproducible by someone else on another machine:

| Profile | Viewport |
| --- | ---: |
| `desktop` | 1440 × 900 |
| `mobile` | 390 × 844 |

Pin the dimensions, the locale, the timezone, the colour scheme and reduced
motion. Never depend on a named device profile: those shift between tool
versions, and a proof that moves is not a proof.

## Two kinds of screenshot

They are not interchangeable and the difference decides who may update them.

1. **Execution evidence** — captured during a passing run to show what the user
   sees. Regenerable, gitignored, collected into the bundle. An agent creates
   these freely.
2. **Visual baselines** — committed alongside the tests and compared
   automatically. Updating one requires a human who looked at the diff. Never
   auto-accept baselines in CI, and never let a healer accept one.

`screenshot: 'only-on-failure'` is for diagnosis. It does not replace explicit
evidence of the scenarios that passed.

## Evidence

A completion claim owes an artifact someone else can open.

```bash
agent-compass evidence --run --strict
```

That runs the configured command, then collects every JUnit report and
screenshot into a self-contained bundle at `.agent/evidence/` — `index.html` for
a human, `summary.md` for the pull request and for agents, plus the raw results.
The status is binary: it is complete only when nothing failed and the promised
screenshots exist. Declare `evidence` in `agent-compass.commands.json` — the
command, the report paths, the screenshot directory and how many screenshots the
project promises. Without it the tool discovers files and says so, which is a
weaker claim.

For a change with a spec under `specs/changes/<slug>.md`, record both sides:

```bash
agent-compass evidence --change <slug> --phase start --run   # before any edit
agent-compass evidence --change <slug> --phase finish --run  # after the work
```

`finish` diffs a SHA-256 snapshot of the workspace, lists the changed and tested
files, reads the spec's acceptance criteria, and renders the before and after
screenshots side by side at `.agent/changes/<slug>/`. It is a gate: it exits
non-zero unless the after-proof is complete **and** something actually changed.
Start from [`specs/change-spec-template.md`](../../templates/specs/change-spec-template.md);
`finish` parses two of its headings literally.

A complete bundle proves the run happened. It does not prove the result looks
right — see [definition-of-done.md](definition-of-done.md).

## Troubleshooting flaky tests

Check isolation first (shared state, ordering), then mocks, then the
implementation. Fix the implementation, not the test — unless the test is wrong.

Quarantine is a decision with an owner and a date, not a place tests go to die.
A quarantined test with no follow-up blocks Done.

## Anti-patterns

- a sleep or fixed timeout used to win a race — wait for the condition
- re-running a test until it passes, with no diagnosis
- editing a fixture so it hides a mapping defect
- asserting on class names, hook names or React internals instead of behaviour
- one long end-to-end test standing in for a combinatorial rule
- disabling an accessibility rule globally to go green
- letting a healer delete, skip or weaken a test
- calling a real third-party API from the pull-request suite
- reading a coverage percentage as a quality measure

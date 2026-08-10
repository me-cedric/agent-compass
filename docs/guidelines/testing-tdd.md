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

## Troubleshooting flaky tests

Check isolation first (shared state, ordering), then mocks, then the
implementation. Fix the implementation, not the test — unless the test is wrong.

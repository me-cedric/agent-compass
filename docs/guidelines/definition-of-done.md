# Definition of Done

`AGENTS.md` §4 is the Completion Gate: the short list you report every time.
This file is the formalism behind it — how a criterion is proved, when the work
is genuinely finished, and what to do when a rule cannot be met.

A change is done when its behaviour is satisfied, its risks are covered, its
proof exists, it hides no debt, and another person can read, run and maintain
it. "The code is written", "it works on my machine" and "the existing tests
pass" are not any of those.

## Proof types

Every criterion carries one:

| Type | Meaning |
| --- | --- |
| `AUTO` | A blocking check a tool or the pipeline runs. |
| `PR` | Evidence attached to the pull request or the handoff. |
| `REVIEW` | An explicit human decision, recorded. |
| `N/A` | Genuinely not applicable, **with the reason written down**. |

An `N/A` with no reason is not verified. It is a criterion nobody looked at.

## The completeness rule

```
every applicable AUTO gate green
      + every applicable PR evidence present
      + every required human review approved
      + no open, unaccepted deviation
```

One level never compensates another. A faithful screenshot does not excuse an
unreachable control. High coverage does not excuse a missing acceptance
criterion. A green suite does not excuse an unreviewed visual baseline.

## Blocking conditions

Done is forbidden while any of these is true:

- an applicable acceptance criterion is unmet
- a secret sits in the code, the bundle, the logs or an artifact
- a blocking pipeline gate is red
- an unexpected console error appears
- keyboard or focus behaviour regressed
- a known accessibility violation has no accepted exception
- a test is skipped, quarantined or flaky with no follow-up
- a visual baseline changed without review
- a contract or the documentation that owns it is stale
- a dependency or import contradicts the architecture
- external data reaches the code unvalidated
- a `TODO` is required for the behaviour being shipped
- a piece of requested evidence is missing

## What an agent may never do

A planner, a generator or a healer may not:

- change the spec so it follows a bug
- delete or weaken an assertion without review
- skip, quarantine or `fixme` a test
- raise a timeout to make a race pass
- accept a visual baseline
- hide a console, accessibility or type error
- declare Done because the suite is green

Any of these is a request to the human, never an action.

## Exceptions

A deviation is acceptable only when all six are true, and written down:

1. the criterion cannot reasonably be met inside this scope
2. the risk is stated concretely
3. a compensating measure exists
4. an owner is named
5. a deadline is set
6. the person entitled to accept it did so explicitly

```markdown
### DoD exception
- Criterion:
- Cause:
- Impact and risk:
- Compensating measure:
- Owner:
- Deadline:
- Approved by:
```

Not valid on their own: lack of time, an undiagnosed flaky test, "it works on my
machine", automation that was never analysed, or the fact that an agent produced
the result.

**An exception expires.** Past its deadline it blocks any change that depends on
or worsens the debt it covers.

## When a gate fails

1. Keep the artifact and find the first causal defect.
2. Decide which is at fault: the product, the test, the fixture or the
   environment.
3. Fix the cause at that level.
4. Re-run the targeted check, then the suite around it.
5. Confirm the test can still detect the original defect.

A repair that leaves the test unable to fail is not a repair.

## Definition of Ready

Not the Definition of Done — the check that stops work starting blind. Ready
means: the expected behaviour and its criteria are understood, the visual source
is identified or explicitly absent, the needed states are listed, the existing
components were examined, the API contract exists, the risks and dependencies
are known, and no unmade decision can still change the implementation.

A gap found mid-implementation is raised. It is never filled silently.

## Proving it

The evidence bundle is the artifact this file expects. See
[testing-tdd.md](testing-tdd.md#evidence) for the commands and the layout.

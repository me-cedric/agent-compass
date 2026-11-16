---
name: untangle-codebase
description: Untangle a whole codebase in one planned pass, so each later change reads less, breaks less without notice, and debugs faster. Start it yourself; it edits many files.
risk_level: high
writes_files: true
requires_tools: []
disable-model-invocation: true
argument-hint: "[optional area or concern to focus on]"
---

# Untangle codebase

Adapted from `caldoai/skills` (MIT, Maze). This is a planned refactor of many files. Do not start it for a small task.

Goal: pieces that change together sit together. Pieces that change for different reasons are not tied. Everything depends on what changes less.

## Before you start

1. Check the branch and its base. Work on a branch, not on the default branch. Do not commit unless the user asks.
2. Run the project checks. Record the result. A red check before the start is a blocker: report it and stop.
3. Ask one question: do you also want **Comments** (remove comments that only restate the code) or **Tests** (see step 4)? Do only what the user picks.

## 1. List every problem

Change nothing yet. Ask one question about each piece: should these pieces change together? Write each wrong answer in a decision log (see `references/decision-log.md`). There are three kinds.

**Hidden links**: pieces that must change together, with nothing in the code that shows it.
- Copies of logic or values.
- A module that reads a global or file that another module sets.
- A feature split across folders by layer.
- A call order or convention that callers must know.

**Needless links**: pieces that are tied but change for different reasons.
- Callers that depend on internals.
- Stable code that imports volatile code.
- A general function with a parameter that only one workflow understands.
- A shallow module: its interface changes when its internals change.

**Surplus**: pieces with no reason of their own to change.
- Wrappers that only pass calls through.
- Extension points and config for things that never vary.
- Dead code.

Also write each **special case**: code that exists for one situation and does not follow from how the system works. Examples: an `if` for one value, a parameter for one caller, a swallowed exception, a retry or sleep, a disabled test. Each one is a requirement that the design did not plan for.

## 2. Redesign from first principles

Work out the fixes as if the system had known today's requirements from the start. Look for the one fix behind several problems. Do not fix special cases one by one. Write each fix above the problems that it solves.

## 3. Show the plan, then fix

Show the user the decision log. Wait for a yes. Then fix everything on the list. Keep a special case that the system still needs. Do not hunt for bugs separately. Keep input validation, data-loss handling, security controls and accessibility basics.

## 4. Optional parts

**Comments**:
- Remove a comment that restates the implementation, even if it is phrased as a why.
- Keep a comment about something outside the code, such as a proxy that drops websockets.
- Remove a workaround comment when the redesign removes the problem behind it.

**Tests** (do this last; tests are the safety net):
- Remove a test that cannot fail, or that repeats the implementation.
- Rewrite a test that is tied to internals so it checks behavior.
- Never remove or weaken a test to make a check pass. Run the checks after each change.

## 5. Check, and repeat

Run the project checks again. Use subagents (two or fewer at a time) to search for special cases, hidden links, needless links and surplus. Fix what they find. Stop after 3 passes, or earlier when a pass finds nothing worth fixing. Report anything left.

Done when:
- Few special cases are left, and each has a reason.
- A typical change lands in one place.
- Every import is reasonable, and nothing imports code that is more volatile than itself.
- The project checks give the same result as before the start. Behavior is the same, apart from bugs that the refactor fixed.

The summary gives the decision log path, the fixes made, each check with its result, and the problems left.

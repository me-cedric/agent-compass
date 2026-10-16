---
name: e2e
description: Run end-to-end suites through ac run, read the result and the reports, and fix failures. Covers Playwright with its test agents, Maestro and agent-device. Use when you run, write or heal e2e tests.
risk_level: medium
writes_files: true
requires_tools: [ac, npx]
---

# e2e

Run each suite through the registry. Read the result file. Do not guess the cause of a failure.

## Run a suite

1. Run `ac run --list`. Look for the suite name.
2. If the suite is not there, add an entry to `agent-compass.commands.json` first. Never invent a command.
3. Run `ac run <name>`. Add `--timeout <seconds>` for a long suite.

```json
{
  "e2e": {
    "web": "npx playwright test",
    "smoke": { "cmd": "npx playwright test --grep @smoke", "timeout": 600 },
    "mobile": "maestro test .maestro"
  }
}
```

The registry runs a command without a shell. A pipe, a redirect, a glob or a `$VAR` is an error.
Put a filter in a quoted argument.

## Read the result

`ac run` writes `.agents/runs/<timestamp>-<name>/`:

- `result.json` has `exitCode`, `timedOut`, `durationMs`, the last 100 lines in `tail`, and the paths in `junit` and `html`.
- `output.log` has the full output. Secret-like lines are redacted.

1. Read `tail` first. Then read the `junit` XML for the names of the failed tests.
2. Open the `html` report path for traces and screenshots.
3. Fix one failure at a time. Run only that test again, with a registry entry that has the filter.
4. A test that fails on one run and passes on the next is flaky. Find the cause. Do not add a retry or a sleep.

## Playwright and its test agents

Set up the agents once with `npx playwright init-agents`. Use the option that matches your client (`--help` lists them).

- The planner explores the app and writes a test plan.
- The generator turns the plan into test files.
- The healer runs the failed tests and edits them.

Review every healer edit as a code change. Read the diff before you accept it.
Reject an edit that removes or weakens an assertion, adds a sleep, widens a selector, or skips a test.
A failing test can show a real bug in the app. Fix the app, not the test.

## Screenshots

Create and update `toHaveScreenshot` baselines only on the pinned CI image. That is the Playwright Docker image at the version in `package.json`.
A baseline from a laptop differs in fonts and rendering. Never commit one.
Review each changed baseline image as a code change.

## Mobile and native apps

- Write stable flows as Maestro YAML files in the flow folder. Run them through a registry entry.
- Use the agent-device skill to drive a native app on a simulator or a device. Use it to explore and to reproduce a failure.
- Turn a flow that works into a Maestro flow. Then run it through `ac run`.

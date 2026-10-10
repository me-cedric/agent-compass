---
id: shell-refusal-goes-to-stderr
trigger: 'when an Android instrumented test runs a shell command (am broadcast, settings, cmd) through UiAutomation and decides from its output'
confidence: 0.85
domain: testing
source: host-project-promotion
---

# Read the error stream of a shell command, or a refusal looks like success

## Action

Run the command with `UiAutomation.executeShellCommandRwe(...)` and read both
streams. When the error stream holds a refusal (for example `Security exception`
for a protected broadcast sent by the shell user), skip the test with
`assumeTrue(...)` and the refusal text, as its comment says it should. Never
wait on the effect of a command whose refusal you did not read.

```kotlin
val (out, err) = automation.executeShellCommandRwe(cmd).let { pfds ->
    pfds[0].read() to pfds[2].read()
}
assumeTrue("shell refused: $err", err.isBlank())
```

## Why

`executeShellCommand` returns standard output only. Android writes the refusal
to standard error, so the test saw nothing, did not skip, waited 20 seconds for
an effect that could never come, and failed CI on every push for three days.

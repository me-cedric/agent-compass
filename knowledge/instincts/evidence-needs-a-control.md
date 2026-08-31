---
id: evidence-needs-a-control
trigger: 'when a screenshot, a log excerpt, a benchmark number or a query result is your proof that something changed — especially when the claim is that one thing now differs from another'
confidence: 0.85
domain: testing
source: host-project-promotion
---

# Evidence that could look the same for a boring reason needs a control

## Action

Before you attach a piece of evidence, ask: **what else would produce this exact
picture?** If a mundane cause would, capture the control in the same run.

A reader's dark theme photographed in cream proves nothing on its own — the app
might simply not have been set to a dark appearance. The same device, at the same
moment, with a screen that *should* be true black beside it, is what turns the
first picture into evidence.

| The claim | The control |
| --------- | ----------- |
| This screen disagrees with the rest of the app | A screen that agrees, same device, same moment |
| The fix removed the error | The same log window from before, showing it present |
| This is faster now | The old build measured on the same machine in the same session |
| The cache is being hit | The cold run beside the warm one |
| The flag turns the feature off | The screenshot with the flag on |

Two rules that follow:

1. **Capture the pair in one session.** A control from yesterday, another
   machine, or another dataset re-introduces the boring explanation it was
   supposed to rule out.
2. **Say what the control rules out**, in one sentence, next to the evidence. A
   reader who has to reconstruct the argument will not.

Reach for a control when the claim is comparative — *now* differs from *before*,
*here* differs from *there*, *with* differs from *without*. A single absolute
observation ("the button renders") does not need one.

## Why

An agent's evidence is usually genuine and frequently unpersuasive, because it is
consistent with both the change working and the setup being wrong. A green test
run proves nothing if the suite never selected the new case. A dark screenshot
proves nothing if the device was in dark mode. The reviewer either accepts it on
trust or reproduces the whole thing — and in both cases the evidence did no work.

A control costs one more capture and converts the artifact from an illustration
into an argument. This matters most for exactly the changes hardest to test
automatically: appearance, timing, caching, and feature flags.

Related: [[evidence-outlives-the-claim]] (the artifact ships with the claim),
[[ui-change-needs-visual-proof]] (a visible change owes a rendered picture), and
[[negative-assertion-precondition]] — the same logic inside a test, where an
absence assertion needs a presence precondition to prove it can fail.

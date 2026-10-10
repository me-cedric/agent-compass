---
id: platform-a11y-audit-is-lenient
trigger: 'when an automated accessibility check is the gate for touch-target size on iOS or Android, and nothing has proved that the check fails a target that is too small'
confidence: 0.85
domain: testing
source: host-project-promotion
---

# Prove the accessibility check can fail before you trust it as a gate

## Action

Before a platform accessibility check becomes a gate, add one test that draws a target that is too small and asserts that the check fails. If the platform check does not fail, measure the targets yourself in the same test run.

- **iOS:** `XCUIApplication.performAccessibilityAudit()` with the hit-region type flagged an 18 pt button and passed 24, 30, 36, 40 and 44 pt buttons (iOS 26.2). Measure each app-drawn button and link against 44 x 44 pt in the UI test. Leave out what the system sizes: bars, segments, switches, sliders, the sheet grabber.
- **Android:** the Accessibility Test Framework (`enableAccessibilityChecks()`) checks nothing under Robolectric. Its view hierarchy ends at `AndroidComposeView`, and every check reports `NOT_RUN`. Read the Compose semantics tree instead: touch bounds at least 48 x 48 dp, a label on every clickable node, drawn text at least 4.5:1 against its background.
- Draw the proof targets behind a debug launch argument or in a test-only screen: one under the floor that must fail, one at the floor that must pass.

## Why

A gate that cannot fail is worse than no gate, because it reports green. The platform checks are tuned against false alarms, so they pass targets that a finger misses. In one project both platform checks passed a crowd of 30 pt and 37 dp targets that a person found in one look.

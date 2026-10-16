# Mobile Visual Check

A change a user can see is looked at, and checked against the Apple Human
Interface Guidelines and Material 3, by the one who made it, before it lands.
This workflow does that at the lowest cost that shows the screen as a user sees
it. It replaces a separate "frames" phase after each merge, which cost one host
project 2 to 5 hours and about one million agent tokens a wave. Every tool here
is free and open source.

It applies to native iOS (SwiftUI, UIKit), native Android (Compose, Views) and
React Native or Expo apps. AGENTS.md section 6 holds the rule; this page holds
the method.

## 1. Look at your own screen while you build

After a UI change, look at the screen in light and dark, at the default text
size, and fix what is wrong before you commit.

| Platform | First choice | Where it runs |
| -------- | ------------ | ------------- |
| iOS | [swift-snapshot-testing](https://github.com/pointfreeco/swift-snapshot-testing) (MIT) | An app-hosted unit-test bundle on one pinned simulator |
| Android | [Roborazzi](https://github.com/takahirom/roborazzi) (Apache 2.0) | Robolectric on the JVM, `@GraphicsMode(NATIVE)`, no emulator |
| React Native, Expo | [agent-device](../tooling/device-automation.md) screenshots on a simulator or emulator, kept as replayable `.ad` scripts | The device; there is no host renderer for a native view tree |

- Draw each screen state with fixture data. Open each image and look at it.
  Record a reference again only after you looked.
- Use the running app where a snapshot cannot show the screen: navigation,
  system materials (Liquid Glass over content), insets, system interface (the
  notification shade, widgets, CarPlay, Android Auto) and web view content.
  Drive it with [agent-device](https://github.com/callstack/agent-device) ([setup](../tooling/device-automation.md)): `open <app>
  --foreground` prints an accessibility snapshot with refs, `settings appearance
  dark` switches the appearance, `snapshot -i` gives element bounds, `screenshot
  <path>` saves a small image.
- Take light and dark at the default text size. Add one snapshot per screen in
  light at the largest text size (iOS `.dynamicTypeSize(.accessibility5)`,
  Android font scale 2.0, for example `RuntimeEnvironment.setFontScale(2f)` under
  Robolectric) and look at it too. It costs seconds and finds what the default
  size hides: on its first run in one host it found seven layout faults (labels
  one letter per line, a button split over three lines, titles cut to one line).
  No device screenshot is needed for it.

## 2. Machines check the guidelines

Keep a screen catalogue: one entry per screen and state, with the same names on
both platforms. Each entry has a snapshot in light and dark and an
accessibility check. A new screen adds its entry.

The checks fail the test on a hit target under 44 x 44 pt (iOS) or 48 x 48 dp
(Android), a clickable element with no label, and text under 4.5:1 against what
is behind it. **Prove each check can fail** with one target that is too small
and one label that is too faint: the platform checks are lenient (see
platform-a11y-audit-is-lenient).

- Fail on a finding that names an element. Print a finding that names none, or
  one on an element that a bar covers or the window cuts.
- Put a real fault you cannot fix now on a per-element known-fault list with its
  reason. A listed fault that no longer occurs fails the test, so the list drains
  (see [cap-as-ratchet-with-baseline](../../knowledge/instincts/cap-as-ratchet-with-baseline.md)).
  Mark a finding that comes and goes between clean runs as not steady, so the
  gate does not fail at random.
- Run the checks in CI with the fixtures they need (seed the corpus in a step of
  its own). Keep the pixel comparison out of CI when its references belong to a
  local renderer.

## 3. What to look for in each image

Each of these is a fault, not a remark. Fix it or record it as a task.

- A hit target under the floor, or two Android targets less than 8 dp apart.
- Two or more related actions drawn side by side or stacked (for example up,
  down, edit and delete on one row). They become one menu (`Menu`,
  `DropdownMenu`) or a platform pattern (swipe actions, a drag handle). A row
  whose title wraps because its actions take the width is this fault, even when
  each target passes the size rule.
- A destructive action that is not last, alone, in the destructive style, and
  confirmed (unless it can be undone).
- Text under 4.5:1 (3:1 for large text), in light or dark.
- Clipped, truncated or one-letter-per-line text; content under a bar or
  outside the safe area.
- A look-alike of a system component (a hand-made menu, sheet, alert or switch).
- A control in the other platform's idiom: a Material tonal capsule on iOS, an
  iOS-style control on Android. On iOS 26 a close action is
  `Button(role: .close)`.
- A larger hit region that changed the drawn size of a control (see
  hit-region-keeps-drawn-size).
- A screen that is wrong in one appearance only.

## 4. Commit little

A snapshot reference is the proof for a screen state. Commit a device
screenshot only for what a snapshot cannot draw: one light and one dark per
changed screen, downscaled (`sips -Z 1200` on macOS). No frames agent and no
photo per task. A preview (`#Preview`, `@Preview`) is a development aid, not
proof.

## 5. Gates and where they run

- Run the snapshot comparison where the references were recorded (see
  snapshot-references-are-os-bound).
- A proof gate that refuses a branch which changes drawing code and adds no
  proof accepts a changed snapshot reference as proof.
- After a merge, a failing snapshot is looked at, never recorded again blind.

## 6. Machine resources

A 24 GB machine runs one Android emulator at a time: boot it with `-memory 2048
-no-window`, kill it when the step ends, and stop the Gradle daemons. Remove the
build caches of worktrees that no longer exist. Snapshot tests need no emulator,
which is most of the saving.

## 7. Orchestration

When subagents do this work, each worker checks its own screens and reports
what it saw under one heading; the reviewer opens the same images. Shared steps
run in the session worktree (see
subagent-worktree-fence).

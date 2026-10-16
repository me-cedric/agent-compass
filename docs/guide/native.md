# Native, mobile and design

Platform APIs change each year. Your memory of them mixes old and new patterns. Compass keeps no platform text. It pins third-party sources and routes the task to them.

## Native skills

| Router skill | Use for | Source ids |
|---|---|---|
| `native-mobile-skills` | Kotlin, Compose, Gradle, Swift, SwiftUI, Xcode, an emulator or a simulator. | `android`, `swift-ios`, `dimillian`, `agent-device` |
| `design-taste-skills` | A landing page, redesign, brand system or mockup-to-code task. Not a bug fix. | `taste` |
| `working-style-skills` | A request for terse, minimal or unambiguous output. See [agents.md](agents.md#style-contract). | `ponytail`, `caveman`, `i-have-adhd`, `asd-ste100` |
| `ui-conformance` | Proof that a screen matches its design. Desktop review skills come from `apple-macos`, `winui` and `gtk`. | See [assets.md](assets.md#upstream-sources) |

Add the source id to `upstream` in `.agents/compass.json`, then run `ac sync`. Each router skill has the table that maps a task to the narrowest upstream skill.

- `swift-ios` and `dimillian` both ship `swiftui-liquid-glass`. They install to one folder. Choose one source for each project.
- `swift-ios` has a PolyForm Perimeter licence. It is source-available, and its noncompete term binds the installing project. Read it first.
- An Expo or React Native project has generated `android/` and `ios/` folders. Use the `stack-expo` rule. Use the native skills only for a native module or the native build.
- Read an installed upstream skill once before you follow it. It cannot relax a compass rule.
- A step that builds, signs, uploads or writes to a device is an operational action. Do read-only discovery first. Get approval before anything that you cannot undo.
- Validate on the platform with the real project command and report each result:
  `./gradlew :<module>:lint :<module>:testDebugUnitTest` for Android, and `xcodebuild test -scheme <scheme> -destination 'platform=iOS Simulator,name=<device>'` or `swift test` for Apple.
- When a vendor doc and the SDK disagree, the SDK and the compiler win.
- A design direction needs a named style, a source for palette and type, and what must not change. A design system wins over a skill. Prove the result with `ui-conformance`.

## Device automation

[agent-device](https://github.com/callstack/agent-device) (Callstack, MIT) lets an agent drive a running app on an iOS simulator or device and on an Android emulator or device.
It is a CLI, an MCP server and a Node API. The MCP catalog entry `agent-device` installs for `expo-mobile`, `android-compose` and `swift-ios`.

- A CLI works in each agent, including a fenced subagent, with no session restart.
- Each git worktree claims its own device, so parallel lanes do not collide.
- A snapshot lists the accessibility tree with refs and element bounds. An agent acts through names and measures hit targets with no screenshot.
- A run saves as an `.ad` script for replay, or exports as Maestro YAML.

Pin the version in one place, for example a package script `"device": "npx -y agent-device@<version>"`. Then:

```bash
pnpm device open <bundle-or-package> --platform ios --udid <simulator> --session <lane> --foreground
pnpm device settings appearance dark      # and light
pnpm device press @e12 --settle           # act on a ref from the last snapshot
pnpm device snapshot -i                   # interactive elements with bounds
pnpm device screenshot <path>
pnpm device close
```

Android takes `--platform android --serial <emulator-or-device>`. Start with `open <app> --foreground` and continue from the diff that it prints.
For a control with no label, take a screenshot and use `press <x> <y>`.

## Mobile visual check

The builder looks at each visible change, and checks it against the Apple Human Interface Guidelines and Material 3, before it lands. This is cheaper than a separate review phase.
It applies to native iOS, native Android, React Native and Expo.

### Look while you build

| Platform | First choice | Runs on |
|---|---|---|
| iOS | `swift-snapshot-testing` | An app-hosted unit-test bundle on one pinned simulator. |
| Android | Roborazzi | Robolectric on the JVM with `@GraphicsMode(NATIVE)`. No emulator. |
| React Native, Expo | agent-device screenshots, kept as replayable `.ad` scripts | The device. No host renderer draws a native view tree. |

- Draw each screen state with fixture data. Open each image. Record a reference again only after you looked.
- Use the running app where a snapshot cannot draw the screen: navigation, system materials, insets, system interface and web view content.
- Take light and dark at the default text size. Add one snapshot in light at the largest text size (iOS `.dynamicTypeSize(.accessibility5)`, Android font scale 2.0).
  It finds faults that the default size hides: one letter for each line, a button split over three lines, titles cut to one line.

### Machines check the guidelines

- Keep a screen catalogue: one entry for each screen and state, with the same names on both platforms. Each entry has a snapshot in light and dark and an accessibility check.
- The checks fail on a hit target below 44 × 44 pt (iOS) or 48 × 48 dp (Android). They fail on a clickable element with no label and on text below 4.5:1.
  Prove that each check can fail: add one target that is too small and one label that is too faint. The platform audits are lenient.
- Fail on a finding that names an element. Print a finding that names none. Put a real fault that you cannot fix now on a known-fault list with its reason.
  A listed fault that no longer occurs fails the test, so the list drains. Mark a finding that comes and goes as not steady.
- Run the checks in CI with the fixtures that they need. Keep the pixel comparison out of CI when its references belong to a local renderer.

### Faults to look for in each image

- A hit target below the floor, or two Android targets less than 8 dp apart.
- Two or more related actions side by side or stacked. They become one menu or a platform pattern (swipe actions, a drag handle).
- A destructive action that is not last, alone, in the destructive style and confirmed (unless an undo exists).
- Text below 4.5:1 (3:1 for large text), in light or dark.
- Clipped or truncated text, and content under a bar or outside the safe area.
- A look-alike of a system component: a hand-made menu, sheet, alert or switch.
- A control in the idiom of the other platform. On iOS 26, a close action is `Button(role: .close)`.
- A larger hit region that changed the drawn size of a control.
- A screen that is wrong in one appearance only.

### Commit little

A snapshot reference is the proof for a screen state. Commit a device screenshot only for what a snapshot cannot draw: one light and one dark for each changed screen, downscaled (`sips -Z 1200`).
A preview (`#Preview`, `@Preview`) is a development aid, not proof. Run the snapshot comparison where the references were recorded.
After a merge, look at a failing snapshot. Never record it again without looking.

A 24 GB machine runs one Android emulator at a time. Boot it with `-memory 2048 -no-window`, kill it when the step ends and stop the Gradle daemons.
Remove the build caches of worktrees that no longer exist. When subagents do this work, each worker reports what it saw, and the reviewer opens the same images.

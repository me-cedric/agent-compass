# Preset: Swift iOS

Native Apple-platform app. Swift, SwiftUI, Xcode.

Use this preset for a real Apple target. A React Native or Expo app has an
`ios/` directory too, but that is generated output — use
[expo-mobile.md](expo-mobile.md) for it.

## Components

- **Swift 6** with strict concurrency checking; **SwiftUI** as the UI layer.
- **Swift Package Manager** for modules; one package target per feature.
- **Observation** (`@Observable`) for view state; UIKit interop only where a
  SwiftUI equivalent does not exist yet.
- **SwiftData** for local persistence; **URLSession** with `async`/`await` for
  the network layer; **Codable** for wire types.
- **Keychain** for tokens — never `UserDefaults`.
- **Swift Testing** for unit tests, **XCUITest** for critical flows,
  **Instruments** when startup, hangs, or memory are the subject.
- **SwiftLint** and **swift-format** wired into the build, not run by hand.

## agent-compass pieces

- Skill: [`native-mobile-skills`](../skills/native-mobile-skills/SKILL.md) —
  routes each task to the pinned Apple-platform skill that holds current guidance.
- Doc: [native-mobile-skills.md](../docs/tooling/native-mobile-skills.md) —
  install commands, full inventory, licence posture, and the gates that survive.
- Instinct:
  [`platform-skill-before-memory`](../knowledge/instincts/platform-skill-before-memory.md).
- Guidelines: [coding-style](../docs/guidelines/coding-style.md),
  [testing-tdd](../docs/guidelines/testing-tdd.md),
  [accessibility](../docs/guidelines/accessibility.md).

## Tracked platform skills

The Apple-platform corpus lives at
<https://github.com/dpearson2699/swift-ios-skills>. Agent Compass pins it and
checks it for updates; it does not copy it, because the corpus is licensed under
PolyForm Perimeter 1.0.0 — source-available with a noncompete term. Read the
licence before installing, then pull one skill into the project:

```bash
npx skills add dpearson2699/swift-ios-skills --skill <skill>
```

Common picks: `swiftui-patterns`, `swiftui-liquid-glass`, `swiftui-navigation`,
`swift-concurrency`, `swiftdata`, `ios-networking`, `swift-testing`,
`ios-accessibility`, `app-store-review`, `ios-memgraph-analysis`.

## Module layout

One SPM target per feature, each with its own `README.md` (`AGENTS.md` §7).

```
App/                          app target: entry point, DI wiring, routing
Packages/
  DesignSystem/               tokens, shared views, theme
  Networking/  Persistence/   infrastructure targets
  <Feature>/
    Sources/<Feature>/        <Feature>View.swift  <Feature>Model.swift
    Tests/<Feature>Tests/
Package.swift                 single source of module + dependency graph
```

## Validate

```bash
xcodebuild test -scheme <scheme> -destination 'platform=iOS Simulator,name=<device>'
```

Use `swift test` when the change is confined to a package with no app target.
A screen change also owes a screenshot from a booted simulator
(`xcrun simctl io booted screenshot screen.png`) — a SwiftUI `#Preview` is not
proof.

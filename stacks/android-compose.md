# Preset: Android Compose

Native Android app. Kotlin, Jetpack Compose, Gradle.

Use this preset for a real Android target. A React Native or Expo app has an
`android/` directory too, but that is generated output — use
[expo-mobile.md](expo-mobile.md) for it.

## Components

- **Kotlin** + **Jetpack Compose** (Material 3).
- **Gradle** with the Kotlin DSL and a version catalog (`gradle/libs.versions.toml`).
- **Navigation 3** for routes, deep links, and back stacks.
- **Hilt** for dependency injection; ViewModel per screen.
- **Room** or **DataStore** for local persistence.
- **Retrofit** or **Ktor** + **kotlinx.serialization** for the network layer.
- **R8** in release, with keep rules audited rather than inherited.
- **JUnit** + **Turbine** for unit tests, **Compose UI test** for screens,
  **Macrobenchmark** when startup or jank is the subject.

## agent-compass pieces

- Skill: [`native-mobile-skills`](../skills/native-mobile-skills/SKILL.md) —
  routes each task to the pinned Google skill that holds current guidance.
- Doc: [native-mobile-skills.md](../docs/tooling/native-mobile-skills.md) —
  install commands, full inventory, licence posture, and the gates that survive.
- Instinct:
  [`platform-skill-before-memory`](../knowledge/instincts/platform-skill-before-memory.md).
- Guidelines: [coding-style](../docs/guidelines/coding-style.md),
  [testing-tdd](../docs/guidelines/testing-tdd.md),
  [documentation](../docs/guidelines/documentation.md).

## Tracked platform skills

Google publishes the platform guidance at <https://github.com/android/skills>.
Agent Compass pins it and checks it for updates; it does not copy it. Install one
skill into the project when the task needs it:

```bash
android skills add --skill=<skill> --project=.
```

Common picks: `adaptive`, `styles`, `navigation-3`, `edge-to-edge`,
`migrate-xml-views-to-jetpack-compose`, `agp-9-upgrade`, `r8-analyzer`,
`android-intent-security`, `testing-setup`, `android-profiler`.

## Module layout

One Gradle module per feature, each with its own `README.md` (`AGENTS.md` §7).

```
app/                      (application module: navigation host, DI root)
core/
  designsystem/           theme, tokens, shared composables
  network/   database/    infrastructure
feature/<feature>/
  src/main/kotlin/.../<Feature>Screen.kt      <Feature>ViewModel.kt
  src/main/kotlin/.../data/   domain/
  src/test/   src/androidTest/
gradle/libs.versions.toml  (single source of dependency versions)
```

## Validate

```bash
./gradlew :<module>:lint :<module>:testDebugUnitTest
```

Widen to `./gradlew lint test` only when the change crosses modules. A screen
change also owes a screenshot from a booted emulator
(`adb exec-out screencap -p > screen.png`) — a Compose `@Preview` is not proof.

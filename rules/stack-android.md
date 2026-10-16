---
description: Android rules for Kotlin, Jetpack Compose, Gradle modules, Hilt, persistence, R8, touch targets and tests. Applies when you edit Kotlin, Compose or Gradle files in a native Android app.
paths:
  - "**/*.kt"
  - "**/*.kts"
  - "**/gradle/libs.versions.toml"
  - "**/AndroidManifest.xml"
stacks: [android-compose]
---
# Android rules

## Architecture
- Use Kotlin and Jetpack Compose with Material 3.
- Use Gradle with the Kotlin DSL. Declare every dependency version in `gradle/libs.versions.toml`.
- Use Navigation 3 for routes, deep links and back stacks.
- Use Hilt for dependency injection. Give each screen one ViewModel.
- Use Room or DataStore for local persistence.
- Use Retrofit or Ktor with `kotlinx.serialization` for the network layer.
- Build with R8 in release. Audit the keep rules. Do not inherit them blindly.
- Create one Gradle module per feature, each with its own `README.md`.
- Keep the `app` module for the navigation host and the dependency root. Put theme and shared composables in `core/designsystem`.
- Split a feature module into the screen, the ViewModel, `data/` and `domain/`.

## Touch targets
- Grow the area that receives the tap. Keep the chip, icon button or control at its system size.
- Keep `Modifier.minimumInteractiveComponentSize()`. Material components apply it.
- Do not set a smaller `height` or `size` on a chip or an icon button. It defeats the minimum.
- Prove it with two checks: a snapshot at system size, and a measure that shows a 48 dp touch target.

## Tests and checks
- Use JUnit and Turbine for unit tests. Use Compose UI tests for screens. Use Macrobenchmark when startup or jank is the subject.
- Snapshot with Roborazzi on Robolectric (`@GraphicsMode(NATIVE)`).
- Read the Compose semantics tree for accessibility. The Accessibility Test Framework checks nothing under Robolectric.
- Run `./gradlew :<module>:lint :<module>:testDebugUnitTest`. Widen to `./gradlew lint test` only when the change crosses modules.
- Attach a screenshot from a booted emulator for a screen change: `adb exec-out screencap -p > screen.png`. A Compose `@Preview` is not proof.
- Drive the running app with the `agent-device` skill. Pin one version.
- When the host installs the `android` upstream skills, read the matching skill before you write platform API code from memory.

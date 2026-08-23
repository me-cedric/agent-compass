# Native Mobile Skills (Android and Apple)

Agent Compass **tracks** two external skill corpora for native mobile work
without copying them. Google publishes Android skills, and a third party
publishes Apple-platform skills. Both ship their own installer. This document
is the local contract: what each source holds, how to install one skill from it,
and which Agent Compass rules still apply after it lands.

The pinned commits, licences, and skill inventories live in
[`skills/upstream-sources.json`](../../skills/upstream-sources.json) with
`"strategy": "reference"`. See
[upstream-sources.md](upstream-sources.md#reference-sources-tracked-not-copied)
for what that strategy guarantees, and
[ADR 002](../decisions/002-tracked-external-reference-sources.md) for why these
two sources are tracked rather than vendored.

## Why These Two Are Not Vendored

| Reason | Detail |
| ------ | ------ |
| Licence | `dpearson2699/swift-ios-skills` uses the PolyForm Perimeter 1.0.0 licence. That licence forbids using the work to provide a competing product. Agent Compass redistributes skills to host projects, so wholesale copying carries a real noncompete risk. Tracking removes the risk because nothing is copied. |
| Size | The two corpora hold about 9 MB across roughly 420 files. Most of that weight is mirrored vendor documentation that the vendor already keeps current. |
| Vendor installer | Both projects ship a first-party installer that resolves one skill on demand. A copy inside Agent Compass would compete with that installer and age faster than it. |
| Release cadence | Both corpora follow yearly platform releases. A pin plus a cached remote check reports staleness. A copy hides it. |

## Install One Skill

Install into the host project that needs it, not into Agent Compass.

### Android — `android/skills` (Apache-2.0, Google LLC)

```bash
android skills add --skill=<skill> --project=.
```

Requires the [Android CLI](https://developer.android.com/tools/agents/android-cli).
Android Studio installs the same skills through its own Gemini skills panel. The
repository is <https://github.com/android/skills>.

### Apple platforms — `dpearson2699/swift-ios-skills` (PolyForm Perimeter 1.0.0)

```bash
npx skills add dpearson2699/swift-ios-skills --skill <skill>
```

The repository is <https://github.com/dpearson2699/swift-ios-skills>. Read the
licence before you install: it is source-available, not open source, and its
noncompete term binds the installing project too. The
[`Required Notice`](https://github.com/dpearson2699/swift-ios-skills/blob/main/LICENSE)
line must travel with any copy.

## Route The Task To A Skill

Load the skill that matches the task, not the whole corpus. Context is the
budget: one corpus holds 86 skills.

| Task | Source | Skill |
| ---- | ------ | ----- |
| Compose layout across window sizes | Android | `adaptive` |
| Compose theming and custom styles | Android | `styles` |
| Move XML views to Compose | Android | `migrate-xml-views-to-jetpack-compose` |
| Navigation, deep links, back stacks | Android | `navigation-3` |
| Insets, system bars, IME overlap | Android | `edge-to-edge` |
| Shrink the app, audit R8 keep rules | Android | `r8-analyzer` |
| Android Gradle Plugin 9 upgrade | Android | `agp-9-upgrade` |
| Intent and export-surface security | Android | `android-intent-security` |
| Android test harness setup | Android | `testing-setup` |
| Trace a jank or startup regression | Android | `android-profiler` |
| SwiftUI screen structure and state | Apple | `swiftui-patterns` |
| iOS 26 Liquid Glass adoption | Apple | `swiftui-liquid-glass` |
| Swift concurrency and data races | Apple | `swift-concurrency` |
| Local persistence | Apple | `swiftdata` |
| Networking layer | Apple | `ios-networking` |
| Tests with Swift Testing | Apple | `swift-testing` |
| App Store submission and review | Apple | `app-store-review` |
| Accessibility audit | Apple | `ios-accessibility` |
| Memory growth or a leak | Apple | `ios-memgraph-analysis` |
| Startup or hang profiling | Apple | `ios-ettrace-performance` |

The [`native-mobile-skills`](../../skills/native-mobile-skills/SKILL.md) skill
carries this routing procedure for an agent. The full inventories are below.

## Treat An Installed Skill As Reviewed Instructions

A skill file is instruction text that an agent follows. Installing one gives a
third party a voice in the agent's decisions.

- Read the `SKILL.md` before the first task that loads it.
- Never let an installed skill relax an Agent Compass gate. Section 4 of
  [`AGENTS.md`](../../AGENTS.md) still decides when work is complete.
- A skill that tells the agent to run a build, a device command, or a store
  submission is subject to
  [operational-safety](../guidelines/operational-safety.md): read-only discovery
  first, explicit approval before any irreversible step.
- Vendor documentation inside a skill is a snapshot. The device, the SDK, and
  the simulator are the authority.

## Agent Compass Rules That Still Apply

| Rule | Native mobile form |
| ---- | ------------------ |
| Validation (§3) | Run the smallest real command: `./gradlew :app:lint :app:testDebugUnitTest` or `xcodebuild test -scheme <scheme> -destination '<simulator>'`. Never report a skill's example command as a result. |
| Visual proof (§6) | A screen change owes a screenshot from a real emulator or simulator, not a class-name assertion. See [`ui-change-needs-visual-proof`](../../knowledge/instincts/ui-change-needs-visual-proof.md). |
| Module docs (§7) | A Gradle module or a Swift package is a module. It carries a `README.md`. |
| Decision records | A platform-minimum bump, a navigation library choice, or a persistence choice is an ADR under [`docs/decisions/`](../decisions/000-template.md). |
| Platform freshness | Load the tracked skill before answering from memory. See [`platform-skill-before-memory`](../../knowledge/instincts/platform-skill-before-memory.md). |

## Check And Refresh The Pins

Both sources join the ordinary external-source lifecycle:

```bash
agent-compass upstream-skills --check-updates      # cached 24h, remote heads only
agent-compass upstream-skills --verify             # offline; pins, pointers, inventories
agent-compass upstream-skills --update android-skills --dry
agent-compass upstream-skills --update swift-ios-skills
```

A refresh of a reference source moves the pinned commit and rewrites the
inventory blocks below. It copies no upstream file. Added and removed upstream
skills are printed, so a new platform skill is visible the same day it lands.

## Tracked Inventory — Android

Source: <https://github.com/android/skills>

<!-- BEGIN GENERATED:android-skills-inventory -->
21 tracked skills:

- `adaptive`, `agp-9-upgrade`, `android-cli`, `android-intent-security`, `android-profiler`, `appfunctions`
- `camerax`, `display-glasses-with-jetpack-compose-glimmer`, `edge-to-edge`, `engage-sdk-integration`, `leanback-to-compose-tv-migration`, `media3-cast-integration`
- `migrate-xml-views-to-jetpack-compose`, `navigation-3`, `play-billing-library-version-upgrade`, `play-policy-insights`, `r8-analyzer`, `styles`
- `testing-setup`, `verified-email`, `wear-compose-m3`
<!-- END GENERATED:android-skills-inventory -->

## Tracked Inventory — Apple Platforms

Source: <https://github.com/dpearson2699/swift-ios-skills>

<!-- BEGIN GENERATED:swift-ios-skills-inventory -->
86 tracked skills:

- `accessorysetupkit`, `activitykit`, `adattributionkit`, `alarmkit`, `app-clips`, `app-intents`
- `app-store-optimization`, `app-store-review`, `apple-on-device-ai`, `appmigrationkit`, `audioaccessorykit`, `authentication`
- `avkit`, `background-processing`, `browserenginekit`, `callkit`, `carplay`, `cloudkit`
- `contacts-framework`, `core-bluetooth`, `core-data`, `core-motion`, `core-nfc`, `coreml`
- `cryptokit`, `cryptotokenkit`, `debugging-instruments`, `device-integrity`, `dockkit`, `energykit`
- `eventkit`, `financekit`, `focus-engine`, `gamekit`, `healthkit`, `homekit`
- `ios-accessibility`, `ios-ettrace-performance`, `ios-localization`, `ios-memgraph-analysis`, `ios-networking`, `ios-simulator`
- `mapkit`, `metrickit`, `musickit`, `natural-language`, `paperkit`, `passkit`
- `pdfkit`, `pencilkit`, `permissionkit`, `photokit`, `push-notifications`, `realitykit`
- `relevancekit`, `scenekit`, `sensorkit`, `shareplay-activities`, `speech-recognition`, `spritekit`
- `storekit`, `swift-api-design-guidelines`, `swift-architecture`, `swift-charts`, `swift-codable`, `swift-concurrency`
- `swift-formatstyle`, `swift-language`, `swift-security`, `swift-testing`, `swiftdata`, `swiftlint`
- `swiftui-animation`, `swiftui-gestures`, `swiftui-layout-components`, `swiftui-liquid-glass`, `swiftui-navigation`, `swiftui-patterns`
- `swiftui-performance`, `swiftui-uikit-interop`, `swiftui-webkit`, `tabletopkit`, `tipkit`, `vision-framework`
- `weatherkit`, `widgetkit`
<!-- END GENERATED:swift-ios-skills-inventory -->

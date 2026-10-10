---
id: snapshot-references-are-os-bound
trigger: 'when you add screenshot or snapshot tests (swift-snapshot-testing, Roborazzi, Paparazzi, Playwright) and choose where the comparison runs'
confidence: 0.8
domain: testing
source: host-project-promotion
---

# A snapshot reference belongs to one renderer; compare it only there

## Action

Record and compare references on one fixed renderer, and run the comparison only where that renderer runs.

- **iOS:** pin one simulator model and one OS version in the snapshot script. Run the snapshots in an app-hosted test bundle: without a window scene, Liquid Glass, blur and `backgroundExtensionEffect` draw wrong. Record in 8-bit sRGB to keep the references small.
- **Android:** references recorded on macOS differ from a Linux render (fonts). Keep the comparison in the local gate (for example `pnpm test:android` with the verify flag), not in a Linux CI step that runs `./gradlew test`.
- Set a tolerance (for example 99 % of pixels, 98 % perceptual), and keep the parts that change from run to run (glass bars, clocks) out of the comparison or in a device-screenshot check.
- When a reference fails after a merge, open the reference, the new render and the diff, and look. Record it again only when a change meant it.

## Why

A comparison on the wrong renderer fails for fonts and blur, and the team learns to record again without looking, which turns the gate off.

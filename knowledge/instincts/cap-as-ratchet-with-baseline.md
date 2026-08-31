---
id: cap-as-ratchet-with-baseline
trigger: 'when you add a numeric or structural limit to a repository that already violates it — a file-length cap, a bundle budget, a coverage floor, a lint rule, a new required artifact'
confidence: 0.9
domain: workflow
source: host-project-promotion
---

# A limit the repository cannot meet today is a ratchet, never a lowered floor

## Action

Set the limit where it belongs, then record the existing violations with the
value each one has right now:

```js
// line-cap.mjs — the cap is 800. These five predate it and are recorded with
// the length they had. They may shrink. They may not grow. A sixth file
// crossing 800 fails the build.
const BASELINE = {
  'apps/ios/Sources/LibraryView.swift': 914,
  'apps/android/.../ReaderScreen.kt': 862,
}
```

Three properties make it a ratchet rather than an exemption list:

1. **A baselined file may shrink, never grow.** Compare against the recorded
   number, not against the cap.
2. **A new violation fails.** The gate is live for everything not recorded.
3. **A baseline entry that now passes is itself a failure.** Otherwise the file
   accumulates dead entries and stops describing anything. Make the check say
   "delete this entry", so the file drains on its own.

Give every entry a reason, and a date when the exemption is expected to close:

```json
{ "grandfathered": { "old-change": "predates the verify gate; closed by 2026-09-15" } }
```

The same shape works for a required artifact, not only a number: record which
items predate the new requirement, fail everything after them, and fail an entry
that no longer needs to be there.

## Why

The two instincts an agent reaches for are both wrong. Lowering the limit to what
the worst file already does means the limit protects nothing — it is a
description, not a constraint. Fixing every violation first turns a ten-minute
guard into a refactor of files the current task never touched, so the guard does
not get added at all.

A recorded baseline gets the gate live today at its real value, converts every
existing violation into a visible, dated debt, and makes the trend
one-directional. The entry that refuses to be stale is what keeps it honest: an
exemption list nobody prunes is indistinguishable from having no gate.

Related: [[e2e-gate-budget]] declares what a gate costs;
[[openspec-artifact-chain]] uses this shape for a newly required planning
artifact; [[verified-progress-signal]] is why the recorded number must come from
measurement and not from a guess.

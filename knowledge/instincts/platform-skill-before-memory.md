---
id: platform-skill-before-memory
trigger: 'when the task touches a platform that ships one big release a year — Android, iOS, iPadOS, watchOS, visionOS, macOS — and the answer would otherwise come from recall'
confidence: 0.9
domain: build
source: local-repo-analysis
---

# On a yearly-release platform, load the tracked skill before you answer

## Action

Before writing native Android or Apple-platform code, load the pinned vendor
skill for that task. Do not answer from recall, and do not answer from a search
result that carries no version.
[`native-mobile-skills`](../../skills/native-mobile-skills/SKILL.md) routes the
task to the right skill and installs it.

## Why recall fails here specifically

A web framework publishes continuously, so a model's memory of it degrades
gradually. A platform SDK publishes once a year and renames things when it does.
Two failure modes follow, and both look like a confident answer:

1. **The API did not exist yet.** iOS 26 Liquid Glass, Navigation 3, AGP 9. The
   model has never seen the current shape, so it produces the previous one and
   the code does not compile.
2. **The API exists but is deprecated.** Training data holds a decade of
   `Camera1`, XML layouts, `NavHost` string routes, `ObservableObject`,
   `UserDefaults` token storage. All of it once appeared in official
   documentation, so it reads as correct and it still compiles. This one reaches
   review.

The second mode is the expensive one. A compile error is caught in seconds; a
deprecated-but-working pattern ships and becomes the house style.

## Load one skill, not the corpus

The tracked corpora hold 21 and 86 skills. Pulling either one in whole spends the
context budget on files that do not touch the task, and buries the one that does.
Pick the narrowest skill from the routing table in
[native-mobile-skills.md](../../docs/tooling/native-mobile-skills.md), then read
it.

## What still outranks the skill

The skill is documentation, and documentation is a snapshot:

- The compiler and the SDK headers decide what exists.
- The device and the simulator decide what it does.
- The host project's own conventions decide which allowed option to use.

When the skill and the compiler disagree, the compiler is right and the skill is
stale. Say so in the handoff — that is how the pin gets refreshed.

## Freshness is a command, not a hope

Both corpora are pinned in
[`skills/upstream-sources.json`](../../skills/upstream-sources.json) and checked
by `agent-compass upstream-skills --check-updates`. A stale pin on a platform
corpus usually means a new SDK generation landed. Treat that notice as a signal
to re-read, not as noise.

## The generalization

This applies to any dependency whose release cadence is slower and coarser than
the model's training cadence: platform SDKs, LTS runtimes, database majors,
cloud API versions. The rule is the same — pin a current source, load it for the
task, and let the toolchain settle disputes.

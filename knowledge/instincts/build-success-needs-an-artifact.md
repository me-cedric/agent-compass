---
id: build-success-needs-an-artifact
trigger: 'when you run a packaging or bundling build — an installer, a disk image, an APK or IPA, a container image, a native binary, a published tarball — and are about to report the result'
confidence: 0.9
domain: build
source: host-project-promotion
---

# An exit code is not a build result — prove the artifact

## Action

After a packaging build, check the artifact before you report anything:

1. **It exists**, at the path the build declares.
2. **It is from this run.** Compare against a marker created when the run
   started, not against a source file — a bundler often copies the binary before
   the source gets its final mtime, so timestamp comparison reports a false
   failure on a good build.
3. **It opens.** Verify the container: `hdiutil verify`, `unzip -t`,
   `docker image inspect`, `tar -tf`. A truncated archive has a normal size.

```bash
touch "$BUILD_DIR/.run-marker"
rm -rf "$BUNDLE_DIR/App.app"      # a bundler that finds one often reuses it
<the build command>
[ "$BUNDLE_DIR/App.app" -nt "$BUILD_DIR/.run-marker" ] || { echo "stale bundle" >&2; exit 1; }
```

Two asymmetries to hold in mind, because they point opposite ways:

- **A zero exit can ship the previous build.** Several bundlers do not replace an
  existing app directory. The compiled binary updates; the copy inside the bundle
  does not. Delete the bundle before the build and prove the new one is younger.
- **A non-zero exit can still have produced the artifact you need.** Packaging
  runs last. A failure in image compression or notarisation leaves a correct,
  testable application behind. Look before you report the build as failed.

Clean the leftover state at the **start** of every build, not as a repair after a
failure — a mounted scratch volume or a stale temporary image makes the next
build fail too, so the problem grows until somebody clears it. And use a form
that is silent on no match (`find … -delete`), because a shell that aborts a
command when a glob matches nothing will skip the deletions that would have
worked.

## Why

Packaging is the step where the exit code stops describing the outcome. Every
other stage either produces its output or fails loudly; a bundler has a dozen
ways to succeed at the wrong thing — reuse a cached directory, fail a sub-script
whose stderr the wrapper swallows, or lose a good artifact to a busy unmount at
the very last step.

The cost lands on somebody else: a build reported green ships last week's binary,
and the bug that "would not reproduce" is a version nobody built. One existence
check, one freshness marker and one container verification cost a second and turn
the exit code back into a signal.

Related: [[evidence-outlives-the-claim]] — the completion claim travels with the
artifact that proves it; [[generated-file-whole-run]] for the other build step
where a passing command silently destroys output.

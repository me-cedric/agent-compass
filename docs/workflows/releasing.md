# Releasing Agent Compass

Use this when publishing a reviewed agent-compass state for host projects to
pin by tag.

## What a release request means

"Push a release", "release a patch", "release a new version", "cut a release",
or an equivalent phrase is the explicit ask that `AGENTS.md` §10 requires. One
such phrase authorizes and requires the complete chain below in a single pass.

A release has **three** artifacts. All three must exist before the task is
complete:

1. The version in the project files — `package.json`, `CHANGELOG.md`, and the
   two `README.md` markers.
2. The annotated `v<version>` tag, pushed to every remote.
3. The **published release on every remote forge**, with the changelog section
   as the body.

- Do not stop between the steps to ask again.
- **A local tag is not a release. A pushed tag is not a release either.** A
  reader of the forge sees the release page, not the tag.
- Use **every** remote that `git remote` lists, not `origin` alone. Use one
  remote only when the user names that remote.
- Report each remote, each published release, and its result in the handoff.

`scripts/run-command.mjs` blocks a command that matches `push`, `release`, or
`publish` until the caller adds `--confirm`. The user's release request is that
confirmation, so pass `--confirm` when the dispatcher runs the command.

## Steps

1. Prepare the version. This bumps `package.json`, `CHANGELOG.md`, and the two
   `README.md` version markers that `npm run lint:release` checks:

```bash
node scripts/release.mjs 0.3.0
```

2. Run local validation:

```bash
npm run check
```

3. Commit the release changes with a conventional commit.
4. Create an annotated tag and verify the release metadata:

```bash
git tag -a v0.3.0 -m "v0.3.0"
npm run lint:release
```

5. Push the commit and the tag to every remote:

```bash
for remote in $(git remote); do
  git push "$remote" HEAD
  git push "$remote" v0.3.0
done
```

6. Publish the release on every forge. The body is the changelog section for
   this version:

```bash
gh release create v0.3.0 --repo <owner>/<repo> --title v0.3.0 --notes-file <notes>
```

Repeat for each repository behind a remote. A release that already exists is
success, not a failure — leave it and report it.

7. Tell host projects to bump their submodule using
   [`upgrading.md`](upgrading.md).

Shortcut after review and validation. This runs steps 1, 3, 4, 5, and 6 in one
command — `--release` implies `--push`, extracts the changelog section as the
body, and skips a release that already exists:

```bash
node scripts/release.mjs 0.3.0 --commit --tag --release
```

Do not tag an unvalidated tree.

## Host projects: a release that attaches build artifacts

A host project that ships binaries builds one artifact per operating system.
Each job uploads to the **same** release tag, so the jobs race each other. One
job creates the release. The others arrive after it. These rules keep that safe.

- **Treat "release already exists" as success.** The forge answers `HTTP 409`
  when the tag already carries a release. Catch that one status, then attach the
  asset links to the existing release. Any other status is still a failure.
- **Create or amend, never create only.** A job that fails on 409 makes the
  release depend on job order. The last platform to finish then has no assets.
- **Re-point an asset on a re-run.** A forge keeps asset names unique inside one
  release, so a second link of the same name fails. Delete the old link first.
- **Upload the file first, create the release second.** The release description
  links to artifacts that already exist, so a reader never meets a dead link.
- **Fail on a missing artifact before the upload.** Say which directory was
  empty and which build command produces it.

### Check the system build dependencies first

A native build needs system libraries that `npm` or `cargo` never installs.
Probe for them at the start of the script, and stop with the install command:

```bash
if ! pkg-config --exists <library>; then
  echo "<library> not found. Run: <the install command for this platform>" >&2
  exit 1
fi
```

A missing library surfaces deep inside the compile, as a build-script or linker
error. The reader cannot act on it. A preflight check gives one line and one
command.

## Manual fallback

1. Ensure `CHANGELOG.md` has a dated section for the release.
2. Run local validation:

```bash
npm run check
```

3. Commit the release changes with a conventional commit.
4. Create an annotated tag:

```bash
git tag -a v0.3.0 -m "v0.3.0"
npm run lint:release
```

5. Push the commit and the tag to every remote:

```bash
for remote in $(git remote); do
  git push "$remote" HEAD
  git push "$remote" v0.3.0
done
```

6. Publish the release on every forge behind those remotes:

```bash
gh release create v0.3.0 --repo <owner>/<repo> --title v0.3.0 --notes-file <notes>
```

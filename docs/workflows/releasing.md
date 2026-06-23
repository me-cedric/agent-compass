# Releasing Agent Compass

Use this when publishing a reviewed agent-compass state for host projects to
pin by tag.

## Steps

1. Ensure `CHANGELOG.md` has a dated section for the release.
2. Run local validation:

```bash
npm run check
```

3. Commit the release changes with a conventional commit.
4. Create an annotated tag:

```bash
git tag -a v0.2.0 -m "v0.2.0"
npm run lint:release
```

5. Push the commit and tag:

```bash
git push origin HEAD
git push origin v0.2.0
```

6. Tell host projects to bump their submodule using
   [`upgrading.md`](upgrading.md).

Do not tag an unvalidated or uncommitted tree.

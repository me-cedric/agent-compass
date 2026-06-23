# Upgrading Agent Compass

Use this when a host project already imports agent-compass as a submodule and
wants newer standards without surprise changes.

## Steps

1. Read [`CHANGELOG.md`](../../CHANGELOG.md) from the current pinned SHA to the
   target SHA or tag.
2. Update the submodule:

```bash
git submodule update --remote docs/agent-compass
```

3. Re-run the installer from the host root:

```bash
node docs/agent-compass/scripts/install.mjs --dry
node docs/agent-compass/scripts/install.mjs
node docs/agent-compass/scripts/install.mjs --doctor
```

4. Review the diff. Keep host-specific rules in the host root `AGENTS.md`; keep
   shared rules in `docs/agent-compass/`.
5. Run the host project's normal validation gate before committing the submodule
   SHA bump.

## Release tags

Prefer updating hosts to a tag when one exists. If no tag exists yet, pin to a
reviewed commit SHA and record the SHA in the host change description.

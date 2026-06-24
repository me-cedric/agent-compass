# Upgrading Agent Compass

Use this when a host project already imports agent-compass as a submodule and
wants newer standards without surprise changes.

For one-time adoption without a submodule, use a standalone clone as the source
and copy/install only the shared files the host needs.

## Steps

1. Read [`CHANGELOG.md`](../../CHANGELOG.md) from the current pinned SHA to the
   target SHA or tag.
2. Update the submodule:

```bash
git submodule update --remote docs/agent-compass
```

Or use the helper from an agent-compass checkout:

```bash
node scripts/upgrade-host.mjs /path/to/host docs/agent-compass --dry
node scripts/upgrade-host.mjs /path/to/host docs/agent-compass
```

3. Re-run the installer from the host root:

```bash
node docs/agent-compass/scripts/install.mjs --dry
node docs/agent-compass/scripts/install.mjs
node docs/agent-compass/scripts/install.mjs --doctor
node docs/agent-compass/scripts/install.mjs --doctor --fix
node docs/agent-compass/scripts/install.mjs --doctor --deep
```

4. Review the diff. Keep host-specific rules in the host root `AGENTS.md`; keep
   shared rules in `docs/agent-compass/`.
5. Run the host project's normal validation gate before committing the submodule
   SHA bump.

## No-submodule adoption

Use this when the host project should not import agent-compass as a submodule.

```bash
git clone <agent-compass-url> /tmp/agent-compass
node /tmp/agent-compass/scripts/install.mjs --dry /path/to/host
node /tmp/agent-compass/scripts/install.mjs /path/to/host
node /tmp/agent-compass/scripts/install.mjs --doctor --fix /path/to/host
node /tmp/agent-compass/scripts/install.mjs --doctor --deep /path/to/host
```

Then review and commit only host-local files:

- `AGENTS.md` and tool pointers
- `agent-compass.commands.json`
- `specs/`, `.projectmem/README.md`, `.projectmem/projectmem-policy.md`
- `.mcp/*.example.json` and `.mcp/README.md`
- `.github/PULL_REQUEST_TEMPLATE.md` and instruction files
- repo map, ADR template, and ignore updates

Do not commit the standalone clone or local MCP client config. Copy
`.mcp/*.example.json` into your local MCP client config, replace
`/absolute/path/to/repo`, and keep that local config out of git.

## Release tags

Prefer updating hosts to a tag when one exists. If no tag exists yet, pin to a
reviewed commit SHA and record the SHA in the host change description.

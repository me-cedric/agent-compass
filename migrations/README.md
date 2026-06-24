# Migrations

Structural changes a plain file copy can't express — renames, moved files, config
key changes, added ignores. [`sync.mjs`](../scripts/sync.mjs) applies every
migration whose version is in `(host lock version, current version]`, in order.

## Format

One file per version, named `<semver>[-slug].mjs`:

```js
export default {
  version: '0.4.0',
  describe: 'One line shown in the sync report.',
  apply({ host, log }) {
    // Idempotent: safe to run twice. `host` is the host project root.
    log('what changed')
  },
}
```

## Rules

- **Idempotent.** A migration may run on a host that already has the change.
- **No secrets, no network, no git.** File edits inside `host` only.
- **Additive/safe by default.** Prefer adding/renaming over deleting; never drop
  host-owned content.
- Test it: add a case to [`../test/sync.test.mjs`](../test/sync.test.mjs).

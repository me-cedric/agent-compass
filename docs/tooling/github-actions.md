# GitHub Actions

Keep workflow actions current. This repo enforces the supported major versions
with:

```bash
node scripts/check-actions.mjs
```

Current policy:

| Action | Required major |
| ------ | -------------- |
| `actions/checkout` | `v7` |
| `actions/setup-node` | `v6` |
| `actions/upload-artifact` | `v7` |
| `actions/github-script` | `v9` |

Rules:

- Use `.nvmrc` for Node version selection in repo workflows.
- Pin action majors, not floating branches.
- Update `.github/workflows/` and `templates/ci/` together.
- When an action major changes upstream, update this policy and
  `scripts/check-actions.mjs` in the same change.

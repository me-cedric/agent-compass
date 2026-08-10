# Third-Party Notices

## BagelHole/DevOps-Security-Agent-Skills

Selected DevOps skills and all security, infrastructure, and compliance skills
under `skills/` were adapted from
[BagelHole/DevOps-Security-Agent-Skills](https://github.com/BagelHole/DevOps-Security-Agent-Skills)
at commit `0365f57a079b1332f95cf26e31dd2d5332a8399f`.

Agent Compass retains the original knowledge, adds portable metadata,
authorization and production-safety gates, and excludes upstream executable
scripts and assets.

Four upstream passages are narrowed at import time. Each narrowing lives in
`LOCAL_OVERRIDES` in `scripts/lib/upstream-skills.mjs`, so a later
`upstream-skills --refresh` re-applies it instead of reverting it.

| Skill | Narrowing | Agent Compass rule |
| ----- | --------- | ------------------ |
| `ai-coding-agent-guardrails` | permits reading `.env.example` and `.env.*.example` | [`env-var-sync`](knowledge/instincts/env-var-sync.md) requires an agent to keep those templates in sync |
| `database-backups` | `mysqldump` and `xtrabackup` read credentials from a `0600` defaults file | [security.md](docs/guidelines/security.md) forbids a secret in `argv` |
| `mysql` | same, for both `xtrabackup` examples | same |
| `redis` | one `REDISCLI_AUTH` export replaces 18 `redis-cli -a <password>` calls | same; the vendor recommends the variable over `-a` |
| `azure-vms` | omits `--admin-password`, so the CLI prompts | same |
| `openclaw-local-mac-mini` | trailing `security … -w` with no value, so the tool prompts | same |
| `mdm-device-management` | replaces an invented `fleet setup` command with the documented web setup screen | same; the vendor documents no such command |
| `gcp-cloud-sql`, `azure-sql`, `azure-keyvault`, `identity-access-management` | state that the password is exposed and must be rotated | same; these CLIs accept a password only in `argv` |

This file is the notice for the imported corpus, so it travels with the copies.
`skills-sync` writes it beside the synced skills whenever at least one imported
skill is included, because an imported skill carries no `LICENSE` of its own. A
skill vendored from another project keeps its own `LICENSE` inside its folder and
needs no corpus-wide notice.

MIT License

Copyright (c) 2026 Toby Miller

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

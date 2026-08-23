# Third-Party Notices

## Every External Source Is Tracked, Not Redistributed

Agent Compass carries **no copy** of any external skill. All nine sources in
[`skills/upstream-sources.json`](skills/upstream-sources.json) use
`"strategy": "reference"`: Agent Compass pins them, checks them for updates,
curates which of their skills it endorses, and installs them on request with
`agent-compass external-skills`. The copy is made into the host project or the
user's config, and the licence notice is written beside it at that moment.

This file therefore records what is tracked, not what is shipped. A host that
installs from one of these sources takes on that source's terms directly.

| Source | Licence | Holder | Curated |
| ------ | ------- | ------ | ------: |
| [`BagelHole/DevOps-Security-Agent-Skills`](https://github.com/BagelHole/DevOps-Security-Agent-Skills) | MIT | Toby Miller | 146 of 163 |
| [`android/skills`](https://github.com/android/skills) | Apache-2.0 | Google LLC | 21 of 21 |
| [`dpearson2699/swift-ios-skills`](https://github.com/dpearson2699/swift-ios-skills) | PolyForm Perimeter 1.0.0 | dpearson2699 | 86 of 86 |
| [`Leonxlnx/taste-skill`](https://github.com/Leonxlnx/taste-skill) | MIT | Leonxlnx | 10 of 13 |
| [`DietrichGebert/ponytail`](https://github.com/DietrichGebert/ponytail) | MIT | DietrichGebert | 5 of 6 |
| [`JuliusBrussee/caveman`](https://github.com/JuliusBrussee/caveman) | MIT | JuliusBrussee | 3 of 20 |
| [`ayghri/i-have-adhd`](https://github.com/ayghri/i-have-adhd) | MIT | ayghri | 1 of 1 |
| [`danyuchn/asd-ste100-skill`](https://github.com/danyuchn/asd-ste100-skill) | MIT | Dustin Yuchen Teng | 1 of 1 |
| [`firecrawl/anydoc`](https://github.com/firecrawl/anydoc) | MIT | Sideguide Technologies Inc. | 1 of 1 |

Two licences carry an obligation worth stating plainly:

- **PolyForm Perimeter 1.0.0** (`swift-ios-skills`) permits distribution only for
  a non-competing purpose, and requires its `Required Notice` line to travel with
  every copy. Agent Compass distributes nothing from it; the installer writes that
  line verbatim beside anything a host installs:
  `Required Notice: Copyright (c) 2025 dpearson2699 (https://github.com/dpearson2699)`.
- **Apache-2.0** (`android/skills`) requires attribution with any copy. The
  installer writes it.

## Corrections Agent Compass Applies At Install Time

The operational corpus is the one source Agent Compass rewrites on the way
through. `scripts/lib/upstream-skills.mjs` prepends a safety gate to every skill
and narrows eight passages that conflict with a compass rule. Because no
corrected copy is stored here, the correction happens on every install and the
install **fails** rather than silently dropping a narrowing whose upstream target
was reworded.

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

Full detail: [operational-skills.md](docs/tooling/operational-skills.md) and
[ADR 002](docs/decisions/002-tracked-external-reference-sources.md).

## Agent Compass Itself

MIT License

Copyright (c) 2026 CGI

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

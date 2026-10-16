# Quality

## Security pack

The `security` pack installs the `vuln-triage` skill and a seed `.osv-scanner.toml`. The skill collects, ranks, fixes and suppresses findings.

| Layer | Tool | Notes |
|---|---|---|
| Dependencies | `osv-scanner` 2.x | Offline database: add `--offline-vulnerabilities --download-offline-databases`. `OSV_SCANNER_LOCAL_DB_CACHE_DIRECTORY` keeps the database between runs. |
| Code | SonarQube | Use the `sonarqube` MCP server (read-only) for issues and hotspots. SonarQube has no SARIF export. |
| Code | Checkmarx One | Read a scan with `cx results show --report-format sarif`. Do not start a scan without the user. |

`osv-scanner` exits 1 when it finds a vulnerability. That is a result, not a scanner failure.

### SARIF merge and gate

```bash
node .agents/skills/vuln-triage/scripts/sarif-merge.mjs --out merged.sarif --fail-at 9 osv.sarif cx.sarif
```

The script keeps one run for each tool and drops duplicates. The fingerprint is the rule id, the path and a hash of the snippet,
so a finding keeps its fingerprint when its line moves. It exits 1 and lists each finding at or above `--fail-at`. CI uses 9, so a CVSS 9.0 finding fails the build.

| CVSS | Action |
|---|---|
| 9.0 or more | Fix now. The CI gate fails. |
| 7.0 to 8.9 | Fix in this sprint. |
| 4.0 to 6.9 | Make a ticket. |
| Below 4.0 | Fix in a batch upgrade. |

A finding in a dev-only dependency goes down. A finding with a known exploit goes up.

### Two traps in the osv config

- The table is `[[IgnoredVulns]]`. Version 1 used `IgnoreVulns`. Version 2 does not accept the old key, so a config that uses it suppresses nothing.
- The scanner reads `osv-scanner.toml` from the folder of each scanned file. A nested lockfile never sees a root config. Pass `--config .osv-scanner.toml` to apply one config everywhere.

A suppression has a reason and an `ignoreUntil` date. Prove that the config loads: add one entry and check that the finding count drops.

### Local SonarQube and Checkmarx

`packs/security/extras/` holds scripts and properties files for a SonarQube server on a developer machine, and for a Checkmarx source archive.
Sync does not install them. Copy the files you need into the project.

| File | Role |
|---|---|
| `sonar-setup.sh` | First setup: starts the container, creates projects, makes a token with the `issueadmin` right, writes `SONAR_TOKEN` to `.env`, runs the first scan. |
| `sonar-do.sh` | Per project: scan with coverage, fetch the issue CSV, close stale issues, write the patched HTML report. |
| `sonar-doctor.sh` | Read-only preflight: token right, server-side `sonar.scm.provider=git`, CSV drift, no running Compute Engine task. |
| `bulk-close-stale-issues.mjs` | Closes issues that are open on the server and absent from the latest scan. A dry run by default. `--apply` makes the change. |
| `patch-sonar-summary.mjs` | Rewrites the HTML report with the modern severity bins (BLOCKER, CRITICAL, MAJOR, MINOR, INFO). |
| `sonar-project.api.properties`, `sonar-project.web.properties` | One properties file for each app: project key, sources, coverage paths, exclusions. |
| `checkmarx-package.sh` | Zips the source of each app, without dependencies, build output and secrets, for a Checkmarx upload. |

- Put the scripts in `scripts/` of the project. Wire `sonar:setup`, `sonar:do` and `sonar:doctor` as package scripts.
- The HTML counts are the authoritative ones. Fix Critical and High findings before delivery.
- Defer a noisy rule with an ignore entry in `sonar-project.properties`. Scope its `resourceKey` to named files, never to `**/*`.
- Keep `sonar-report-*.html`, `sonar-issues-*.csv` and `.scannerwork/` out of git.
- With the SonarQube MCP server, follow its rules: switch automatic analysis off while you edit, then analyze the edited files.

## CI packs

`ci-github` seeds `.github/workflows/compass-*.yml`. `ci-gitlab` seeds `.gitlab/compass/*.yml`. Include each GitLab file from `.gitlab-ci.yml`.
A line that ends in `# edit:` is a value you set. After the first sync, the project owns the files.

| Job | Runs | Fails when |
|---|---|---|
| `compass-check` | Each pull request. | `ac check --frozen` finds drift. |
| `compass-security` | A weekday schedule and by hand. | A finding has a CVSS score of 9.0 or more. The merged SARIF file is an artifact. |
| `compass-e2e` | Each pull request. Playwright in 4 shards. | A test fails. The job merges the shard reports into one HTML report and one JUnit file. |
| `compass-migrations` | Each pull request. | A pull request changes or deletes a migration that the base branch has. Or the generator gives a new file. |
| `compass-helm-bump` | GitHub: by hand, or called after an image push. GitLab: on a tag. | It opens a pull request (merge request) in the chart repository that sets the image tag. It needs the secret `HELM_REPO_TOKEN`. |

- The security job needs the `security` pack. On GitHub, set the repository variable `CODE_SCANNING` to `true` to upload the findings to code scanning.
- A runner without internet access cannot download the osv database. Put the database in `.osv-db` with another job or a mirror, and use mirror images.
- The migrations job needs a generator that runs without a database.

## GitHub Actions versions

Pin an action to a major version, never to a branch. `npm run lint:actions` runs `scripts/check-actions.mjs`.
It fails on a stale major in `.github/workflows/` and `packs/`. When an action changes its major, update the script and the workflows in one change.

| Action | Required major |
|---|---|
| `actions/checkout` | `v7` |
| `actions/setup-node` | `v7` |
| `actions/upload-artifact` | `v7` |
| `actions/download-artifact` | `v8` |
| `actions/github-script` | `v9` |

## Version pinning

Pin the toolchain, so that laptops, CI and agents run the same versions.

| File | Pins |
|---|---|
| `.nvmrc` | The Node version. |
| `packageManager` in `package.json` | The package manager and its hash. |
| `engines` in `package.json` | The allowed Node range. |
| `.npmrc` | Registry and install behavior. Reference tokens as `${NPM_TOKEN}`. |
| `tsconfig.base.json` | The compiler target. Apps extend it. |
| `rust-toolchain.toml` | The Rust channel and its components. |

- Bump a version on purpose, in one commit with the lockfile. Name the change in the PR.
- CI reads the same files, for example `node-version-file: .nvmrc`.
- The Rust channel is the compiler that builds. `rust-version` in `Cargo.toml` is the oldest compiler that you support. Never copy the channel into it.
  Keep the channel at or above `rust-version`. Raising it is a decision and, for a library, a breaking change.

## Quality skills

Use `review` before you report done, `ci-triage` for a red pipeline, `ui-conformance` for a UI change and `api-contract-sync` for an API change.
The list of skills is in [skills/README.md](../../skills/README.md).

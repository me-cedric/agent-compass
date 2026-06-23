# SonarQube

Static analysis for bugs, code smells, security hotspots, and coverage. Runs
locally against a self-hosted SonarQube. A single `sonar:do` runner scans,
auto-closes stale issues, and emits a patched HTML report; `sonar:doctor` is a
read-only preflight that fails fast on the common misconfigurations.

## Scripts

Copy these from [`templates/scripts/`](../../templates/scripts/) into the project
`scripts/` dir and wire the package.json scripts below:

| Script | Role |
| --- | --- |
| `sonar-setup.sh` | First-time setup: starts the container, creates projects, mints a scoped `USER_TOKEN` (with `administerIssues`), sets per-project `sonar.scm.provider=git`, persists `SONAR_TOKEN` to `.env`, runs an initial scan. |
| `sonar-do.sh` | Per-project cycle: scan (`test:cov` + scanner) → fetch issue CSV → bulk-close stale issues → regenerate + patch HTML. |
| `sonar-doctor.sh` | Read-only preflight: token has `issueadmin`, server-side `scm.provider=git`, CSV-vs-server drift, no in-progress Compute Engine task. |
| `bulk-close-stale-issues.mjs` | Closes issues still OPEN server-side but absent from the latest scan CSV. Dry-run by default; `--apply` transitions. |
| `patch-sonar-summary.mjs` | Rewrites the `sonar-report` HTML to modern severity bins (BLOCKER/CRITICAL/MAJOR/MINOR/INFO) from the CSV. |

```jsonc
// package.json
"scripts": {
  "sonar:setup": "./scripts/sonar-setup.sh",
  "sonar:do": "bash scripts/sonar-do.sh",
  "sonar:do:api": "bash scripts/sonar-do.sh api",
  "sonar:do:backoffice": "bash scripts/sonar-do.sh backoffice",
  "sonar:do:mobile": "bash scripts/sonar-do.sh mobile",
  "sonar:doctor": "bash scripts/sonar-doctor.sh"
}
```

## One-time setup

```bash
pnpm sonar:setup   # starts SonarQube, creates projects, mints USER_TOKEN, writes .env, initial scan
```

`sonar:setup` is idempotent: on re-run it detects a stale `.env` token (e.g. an
old `GLOBAL_ANALYSIS_TOKEN` that 403s on issue transitions), revokes prior
`<project>-scanner-*` tokens, and mints a fresh `USER_TOKEN`. The token must carry
`administerIssues` — that is what lets `bulk-close` resolve stale issues.

Per-project config lives in each app's `sonar-project.properties`
([api template](../../templates/sonar/sonar-project.api.properties),
[web template](../../templates/sonar/sonar-project.web.properties)) — project key,
sources, coverage paths, exclusions, and `sonar.scm.provider=git` for native
auto-close.

## Run

```bash
pnpm sonar:do                # all projects
pnpm sonar:do:api            # one project
```

Each `sonar:do` is a 4-step pipeline per project: (1) scan with coverage, (2)
fetch the current issue CSV from the server, (3) `bulk-close-stale-issues.mjs
--apply` resolves keys no longer in the CSV, (4) regenerate the HTML and patch
it. Both `sonar:do` and `sonar:do:<project>` run `sonar-doctor.sh` first and
abort before any upload if a check fails; set `SONAR_SKIP_DOCTOR=1` to bypass.

```bash
pnpm sonar:doctor            # read-only preflight, run anytime to diagnose
```

## Outputs

- **HTML:** `sonar-report-<project>.html` at the repo root (patched).
- **CSV:** `sonar-issues-<project>.csv` at the repo root (filtered to `OPEN,REOPENED,CONFIRMED`).
- **JSON:** `/tmp/sonar-<projectKey>.json` (raw API cache, e.g. `sonar-<project>-api.json`).

The patched HTML Summary uses modern severity bins; upstream `sonar-report`
stdout still prints legacy HIGH/MEDIUM/LOW — **the HTML counts are
authoritative**. Triage from the CSV; only **Critical/High** must be fixed
before delivery (see [guidelines/security.md](../guidelines/security.md)).

## Deferring noisy rules

When a finding (e.g. cognitive complexity `S3776`) needs a multi-PR refactor,
add an ignore entry in `sonar-project.properties` — but scope its `resourceKey`
to the specific files, **not** `**/*`, so new code still trips the rule.

## Agent etiquette

If a SonarQube MCP is configured, follow its rules — typically: disable automatic
analysis while editing, then run the analyze-file-list call after edits. See the
per-path instruction template in
[`templates/agent/.github/instructions/`](../../templates/agent/.github/instructions/).
Don't commit generated `sonar-report-*.html` / `sonar-issues-*.csv` or
`.scannerwork/`.

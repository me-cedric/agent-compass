# SonarQube

Static analysis for bugs, code smells, security hotspots, and coverage. Runs
locally against a self-hosted SonarQube, with HTML + CSV reports.

## One-time setup

```bash
pnpm sonar:setup        # scripts/sonar-setup.sh — starts/links SonarQube, generates a token
# token lands in .env as SONAR_TOKEN (see templates/monorepo/env.example.tpl)
```

Per-project config lives in each app's `sonar-project.properties`
([api template](../../templates/sonar/sonar-project.api.properties),
[web template](../../templates/sonar/sonar-project.web.properties)) — project key,
sources, test/coverage paths, exclusions.

## Scan (with coverage)

```bash
pnpm sonar:scan            # all projects
pnpm sonar:scan:api        # one project: runs test:cov, then sonar-scanner
```

Each scan runs the app's coverage (`test:cov` / `test --coverage`) and feeds
`lcov` to the scanner with `-Dsonar.token=$SONAR_TOKEN`.

## Reports

```bash
pnpm sonar:report          # HTML (vulnerabilities) + CSV (all issues), per project
```

Reports pull from the local instance (`http://localhost:9002`), emit
`sonar-report-*.html` and `sonar-issues-*.csv`, and patch in a summary header
(application + branch). Triage from the CSV; only **Critical/High** must be fixed
before delivery (see [guidelines/security.md](../guidelines/security.md)).

## Agent etiquette

If a SonarQube MCP is configured, follow its rules — typically: disable automatic
analysis while editing, then run the analyze-file-list call after edits. See the
per-path instruction template in
[`templates/agent/.github/instructions/`](../../templates/agent/.github/instructions/).
Don't commit generated `sonar-report-*.html` / `sonar-issues-*.csv` or
`.scannerwork/`.

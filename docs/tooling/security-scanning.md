# Security Scanning

Three layers, all runnable locally and in CI. See also
[guidelines/security.md](../guidelines/security.md).

## OSV — dependency vulnerabilities

[`templates/security/.osv-scanner.toml`](../../templates/security/.osv-scanner.toml)
configures [osv-scanner](https://google.github.io/osv-scanner/). A **baseline**
file records already-triaged findings so CI only fails on *new* ones.

```bash
osv-scanner scan --config .osv-scanner.toml .
```

When a real vuln appears: upgrade the dep, or — if unfixable now — add it to the
baseline with a dated comment and a tracking issue. Never blanket-ignore.

## Checkmarx — SAST packaging

[`templates/scripts/checkmarx-package.sh`](../../templates/scripts/checkmarx-package.sh)
builds the source archive Checkmarx scans, per app:

```bash
pnpm checkmarx:package           # all
pnpm checkmarx:package:api       # one app
```

It zips the relevant sources (excluding `node_modules`, build output, secrets)
into an upload artifact. Keep the include/exclude list current as the tree
changes.

## CI

[`templates/ci/security-scan.example.yml`](../../templates/ci/security-scan.example.yml)
runs the scans on PRs. Gate on **new** Critical/High only — pre-existing,
baselined findings don't block unrelated work.

## Secrets

No secret scanner replaces discipline: never commit `.env`, ship only
`.env.example`, and reference tokens from the environment. A pre-commit secret
check (gitleaks/trufflehog) is a good optional add.

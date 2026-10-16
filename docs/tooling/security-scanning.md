# Security Scanning

Three layers, all runnable locally and in CI. See also
[guidelines/security.md](../guidelines/security.md).

## OSV — dependency vulnerabilities

[`packs/security/seed/.osv-scanner.toml`](../../packs/security/seed/.osv-scanner.toml)
configures [osv-scanner](https://google.github.io/osv-scanner/). A **baseline**
file records already-triaged findings so CI only fails on *new* ones.

```bash
osv-scanner scan --config .osv-scanner.toml .
```

When a real vuln appears: upgrade the dep, or — if unfixable now — add it to the
baseline with a dated comment and a tracking issue. Never blanket-ignore.

### Two ways a suppression does nothing

- **The table is `[[IgnoredVulns]]`.** Version 1 used `IgnoreVulns`. Version 2
  renamed it, and the old key is not accepted: the run reports an unknown key in
  the config file. Read that message, then rename the table. A config that keeps
  the old name suppresses nothing, and every run looks worse than it is.
- **The config does not live at the repository root.** The scanner reads
  `osv-scanner.toml` from the directory of each scanned file, and that lookup does
  **not** propagate to child directories. A nested lockfile therefore never sees a
  root config. Pass `--config` to apply one config to every parsed file:

```bash
osv-scanner scan --config .osv-scanner.toml --lockfile=pnpm-lock.yaml
```

`--config` overrides every local `osv-scanner.toml`, which is what makes one
repository-root config work at all.

The second failure is quiet: the scan reports every advisory the config meant to
suppress, and prints no warning about the config it never read. Prove the config
loads: add one entry, run the scan, and confirm the finding count drops.

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

The `ci-github` and `ci-gitlab` packs run osv-scanner with the offline database
on a schedule. The gate fails on a finding with a CVSS score of 9.0 or more.
The `security` pack has the `vuln-triage` skill and its SARIF merge script.

## Secrets

No secret scanner replaces discipline: never commit `.env`, ship only
`.env.example`, and reference tokens from the environment. A pre-commit secret
check (gitleaks/trufflehog) is a good optional add.

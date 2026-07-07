# Security

## Before any commit

- [ ] No hardcoded secrets (API keys, passwords, tokens)
- [ ] All user input validated at the boundary
- [ ] SQL injection prevented (parameterized queries / query builder)
- [ ] XSS prevented (sanitized/escaped output)
- [ ] CSRF protection where relevant
- [ ] AuthN/AuthZ verified on protected paths
- [ ] Rate limiting on public endpoints
- [ ] Error messages don't leak sensitive data

## Secret management

Never hardcode secrets. Use environment variables or a secret manager. Validate
required secrets are present at startup and fail fast if missing. Ship only
`.env.example` (see [tooling/env-management.md](../tooling/env-management.md)).
Rotate anything that may have been exposed.

## Dependency & code scanning

- **OSV scanner** for dependency vulnerabilities — config in
  [`templates/security/.osv-scanner.toml`](../../templates/security/.osv-scanner.toml),
  with a baseline file to suppress triaged findings.
- **Checkmarx** packaging for SAST — see
  [`templates/scripts/checkmarx-package.sh`](../../templates/scripts/checkmarx-package.sh)
  and [tooling/security-scanning.md](../tooling/security-scanning.md).
- **SonarQube** for code smells, hotspots, and coverage — see
  [tooling/sonarqube.md](../tooling/sonarqube.md).
- A `security-scan` CI workflow runs these on PRs — see
  [`templates/ci/security-scan.example.yml`](../../templates/ci/security-scan.example.yml).

## Response protocol

If you find a security issue: stop, fix Critical/High before continuing, rotate
exposed secrets, and sweep the codebase for the same class of bug. Use the
`verify-security` skill to scan a changed path.

## API edge cases

For API changes touching authorization scope, sensitive tokens, uploads,
encrypted secrets, external-provider cleanup, or background jobs, also check the
[`api-security-edge-cases`](../../knowledge/instincts/api-security-edge-cases.md)
instinct. It covers common BOLA/IDOR scope gaps, token logging, encrypted lookup
columns, and cleanup failure semantics.

## For agents

Treat dual-use security work as legitimate only with clear authorization
(pentest engagement, CTF, defensive use). Refuse destructive techniques and
malware. Flag a high-confidence vulnerability you spot in passing rather than
letting it slip.

# Operational Safety

Use this gate for CI/CD, containers, registries, Kubernetes, cloud, IaC,
observability, security, incident response, business continuity, and compliance
work.

## Before action

1. Confirm authorization and exact target: repository, environment, account,
   region, cluster, namespace, resource, and data classification.
2. Read current state first. Separate observation from mutation.
3. Verify tool version, command syntax, flags, API versions, and framework
   requirements against current official documentation.
4. Define intended change, blast radius, validation, rollback, and stop
   condition.
5. Use least-privilege and short-lived credentials. Never expose secrets in
   prompts, output, logs, command history, screenshots, or committed files.

## Change gate

- Prefer declarative, reviewable, idempotent changes.
- Run formatter, validator, plan, diff, policy check, or server-side dry-run
  before apply.
- Do not write to production, deploy, delete, rotate credentials, fail over,
  isolate systems, or run destructive commands without explicit approval.
- Back up state and data before destructive or hard-to-reverse work.
- Use progressive rollout: development/test first, then canary or limited
  scope, then wider rollout with measured health gates.
- Stop and roll back when the agreed health or security threshold fails.

## Incident work

- Preserve evidence before remediation when safe: timestamps, logs, volatile
  state, hashes, identity, chain of custody, and access record.
- Contain only within authorized scope. Do not destroy evidence.
- Keep an append-only action timeline and record every assumption.
- Rotate exposed credentials through the owning secret system; do not paste
  replacement values into agent context.

## Compliance work

- Treat framework mappings as preparation aids, not certification,
  attestation, legal advice, or proof that a control operates effectively.
- Mark each claim as documented, configured, observed, tested, or missing.
- Store evidence with owner, source, collection time, retention, and access
  controls.
- Have the accountable security/compliance owner and qualified counsel or
  auditor review framework-specific conclusions.

## Completion

Report target, change, exact validation, observed result, rollback status,
remaining risk, and evidence location. Redact secrets and personal data.

## Related assets

- [`plan-before-operational-change`](../../knowledge/instincts/plan-before-operational-change.md)
- [`verify-security`](../../skills/verify-security/SKILL.md)
- Opt-in capability packs in [`skills/README.md`](../../skills/README.md)

This gate distills and hardens operational patterns adapted from
[BagelHole/DevOps-Security-Agent-Skills](https://github.com/BagelHole/DevOps-Security-Agent-Skills)
at commit `0365f57a079b1332f95cf26e31dd2d5332a8399f`.

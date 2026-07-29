---
name: openclaw-deployment-hardening
description: Secure OpenClaw deployments with preflight hardening checks, CI/CD guardrails, container runtime restrictions, and post-deploy verification. Use when shipping OpenClaw with Docker, Kubernetes, or automated release pipelines.
license: MIT
risk_level: high
writes_files: true
requires_tools: []
source: https://github.com/BagelHole/DevOps-Security-Agent-Skills
source_commit: 0365f57a079b1332f95cf26e31dd2d5332a8399f
metadata:
  author: devops-skills
  version: "1.0"
---

# OpenClaw Deployment Hardening

## Agent Compass safety gate

- Confirm authorization and exact target: environment, account, cluster, namespace, repository, and data classification.
- Start read-only. Use plan, diff, check, or dry-run modes before mutation. Never deploy, delete, rotate credentials, fail over, contain, or write to production without explicit approval.
- Preserve rollback and evidence. Back up state or data before destructive operations; during incidents, collect evidence before remediation when safe.
- Use least privilege. Never print, commit, or copy secrets into prompts, logs, commands, or examples.
- Verify commands, flags, API versions, and controls against current official documentation before use; imported examples can age.
- Treat compliance mappings as preparation guidance, not certification, attestation, or legal advice.


Use this skill to add repeatable security gates around OpenClaw build and deployment workflows.

## Enforce a Secure Build Pipeline

Add mandatory controls to CI before artifacts are promoted:

1. Dependency and lockfile vulnerability scan (fail on critical CVEs).
2. Image scan for OS/package vulnerabilities.
3. Secret scanning across source and build context.
4. SBOM generation and artifact signing.
5. Policy check that blocks deploy when controls fail.

Example CI step order:

```bash
# Build
npm ci
npm run build

# Security gates
trivy fs .
trivy image my-registry/openclaw:${GIT_SHA}
syft my-registry/openclaw:${GIT_SHA} -o spdx-json > sbom.json
cosign sign --key cosign.key my-registry/openclaw:${GIT_SHA}
```

## Lock Down Container Runtime

Run OpenClaw with restrictive defaults:

- Non-root user in container
- Read-only root filesystem where possible
- Drop all Linux capabilities, add back only required
- `no-new-privileges` enabled
- Constrained CPU/memory limits to reduce abuse impact
- Seccomp/AppArmor (or equivalent) profile enforced

Kubernetes-oriented expectations:

- `runAsNonRoot: true`
- `allowPrivilegeEscalation: false`
- `readOnlyRootFilesystem: true`
- network policy deny-all baseline with explicit allow rules

## Gate Production Promotion

Require explicit promotion checks:

- Security sign-off on CVE exceptions.
- Signed artifact verification in deployment stage.
- Drift check between expected and live manifest values.
- Deployment only from immutable tags or digests.

Avoid mutable `latest` tags for production OpenClaw services.

## Protect Data and Session Surfaces

- Minimize prompt/response retention by policy.
- Mask secrets and PII in logs before shipping to SIEM.
- Encrypt persistent volumes and backups.
- Isolate tenant/session data boundaries when serving multiple teams.

## Post-Deploy Verification

Run a hardening smoke test immediately after rollout:

```bash
kubectl get pods -n openclaw
kubectl auth can-i --as=system:serviceaccount:openclaw:default list secrets -n openclaw
kubectl get networkpolicy -n openclaw
kubectl logs deploy/openclaw -n openclaw --tail=200
```

Verify:

- Pod security context matches policy.
- Service account permissions are least privilege.
- Ingress auth/rate limits are effective.
- No plaintext secrets appear in logs.

## Incident-Ready Rollback Pattern

Maintain a hardened rollback workflow:

1. Freeze further rollouts.
2. Revoke suspect tokens and rotate secrets.
3. Roll back to last signed known-good image digest.
4. Re-run post-deploy hardening verification.
5. Capture timeline and artifacts for forensics.

## Related Skills

- [container-hardening](https://github.com/BagelHole/DevOps-Security-Agent-Skills/tree/0365f57a079b1332f95cf26e31dd2d5332a8399f/security/hardening/container-hardening) - Container security baseline controls
- [kubernetes-hardening](https://github.com/BagelHole/DevOps-Security-Agent-Skills/tree/0365f57a079b1332f95cf26e31dd2d5332a8399f/security/hardening/kubernetes-hardening) - Pod and cluster hardening patterns
- [sbom-supply-chain](https://github.com/BagelHole/DevOps-Security-Agent-Skills/tree/0365f57a079b1332f95cf26e31dd2d5332a8399f/security/scanning/sbom-supply-chain) - SBOM, signing, and provenance controls

## Provenance

Adapted from [BagelHole/DevOps-Security-Agent-Skills](https://github.com/BagelHole/DevOps-Security-Agent-Skills/blob/0365f57a079b1332f95cf26e31dd2d5332a8399f/security/hardening/openclaw-deployment-hardening/SKILL.md) at commit `0365f57a079b1332f95cf26e31dd2d5332a8399f`. Original content © 2026 Toby Miller, used under the MIT License. Agent Compass added metadata and the safety gate above.

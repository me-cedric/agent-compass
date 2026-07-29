---
name: container-hardening
description: Secure Docker images and container runtime configurations. Implement non-root users, read-only filesystems, and security contexts. Use when building secure container images or hardening container deployments.
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

# Container Hardening

## Agent Compass safety gate

- Confirm authorization and exact target: environment, account, cluster, namespace, repository, and data classification.
- Start read-only. Use plan, diff, check, or dry-run modes before mutation. Never deploy, delete, rotate credentials, fail over, contain, or write to production without explicit approval.
- Preserve rollback and evidence. Back up state or data before destructive operations; during incidents, collect evidence before remediation when safe.
- Use least privilege. Never print, commit, or copy secrets into prompts, logs, commands, or examples.
- Verify commands, flags, API versions, and controls against current official documentation before use; imported examples can age.
- Treat compliance mappings as preparation guidance, not certification, attestation, or legal advice.


Secure container images and runtime configurations.

## When to Use This Skill

Use this skill when:
- Building secure container images
- Hardening container deployments
- Meeting container security requirements
- Implementing defense in depth

## Dockerfile Security

```dockerfile
# Use minimal base image
FROM alpine:3.18

# Don't run as root
RUN addgroup -g 1001 -S appgroup && \
    adduser -u 1001 -S appuser -G appgroup

# Copy with specific ownership
COPY --chown=appuser:appgroup . /app

# Remove unnecessary packages
RUN apk del --purge build-dependencies && \
    rm -rf /var/cache/apk/*

# Use non-root user
USER appuser

# Read-only filesystem support
WORKDIR /app
```

## Runtime Security

```bash
# Run with security options
docker run -d \
  --read-only \
  --tmpfs /tmp \
  --security-opt=no-new-privileges:true \
  --cap-drop=ALL \
  --cap-add=NET_BIND_SERVICE \
  --user 1001:1001 \
  myapp:latest
```

## Kubernetes Security Context

```yaml
apiVersion: v1
kind: Pod
spec:
  securityContext:
    runAsNonRoot: true
    runAsUser: 1001
    fsGroup: 1001
  containers:
  - name: app
    securityContext:
      allowPrivilegeEscalation: false
      readOnlyRootFilesystem: true
      capabilities:
        drop: ["ALL"]
```

## Image Scanning

```bash
# Scan with Trivy
trivy image --severity HIGH,CRITICAL myapp:latest

# Use distroless images
FROM gcr.io/distroless/static-debian11
```

## Best Practices

- Use minimal base images
- Run as non-root user
- Enable read-only filesystem
- Drop all capabilities
- Scan images regularly
- Sign and verify images
- Use secrets management

## Related Skills

- [container-scanning](https://github.com/BagelHole/DevOps-Security-Agent-Skills/tree/0365f57a079b1332f95cf26e31dd2d5332a8399f/security/scanning/container-scanning) - Vulnerability scanning
- [kubernetes-hardening](https://github.com/BagelHole/DevOps-Security-Agent-Skills/tree/0365f57a079b1332f95cf26e31dd2d5332a8399f/security/hardening/kubernetes-hardening) - K8s security

## Provenance

Adapted from [BagelHole/DevOps-Security-Agent-Skills](https://github.com/BagelHole/DevOps-Security-Agent-Skills/blob/0365f57a079b1332f95cf26e31dd2d5332a8399f/security/hardening/container-hardening/SKILL.md) at commit `0365f57a079b1332f95cf26e31dd2d5332a8399f`. Original content © 2026 Toby Miller, used under the MIT License. Agent Compass added metadata and the safety gate above.

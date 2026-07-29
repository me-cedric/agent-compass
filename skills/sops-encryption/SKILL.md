---
name: sops-encryption
description: Encrypt files and configs with Mozilla SOPS. Integrate with AWS KMS, GCP KMS, or PGP for key management. Use when encrypting configuration files, Kubernetes secrets, or implementing GitOps with encrypted secrets.
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

# SOPS Encryption

## Agent Compass safety gate

- Confirm authorization and exact target: environment, account, cluster, namespace, repository, and data classification.
- Start read-only. Use plan, diff, check, or dry-run modes before mutation. Never deploy, delete, rotate credentials, fail over, contain, or write to production without explicit approval.
- Preserve rollback and evidence. Back up state or data before destructive operations; during incidents, collect evidence before remediation when safe.
- Use least privilege. Never print, commit, or copy secrets into prompts, logs, commands, or examples.
- Verify commands, flags, API versions, and controls against current official documentation before use; imported examples can age.
- Treat compliance mappings as preparation guidance, not certification, attestation, or legal advice.


Encrypt secrets in configuration files while keeping structure visible.

## When to Use This Skill

Use this skill when:
- Encrypting secrets in Git
- Implementing GitOps with secrets
- Managing Kubernetes secrets as code
- Encrypting configuration files

## Prerequisites

- SOPS installed
- KMS access (AWS, GCP, Azure) or PGP key

## Installation

```bash
# macOS
brew install sops

# Linux
wget https://github.com/getsops/sops/releases/download/v3.8.0/sops-v3.8.0.linux.amd64
chmod +x sops-v3.8.0.linux.amd64
mv sops-v3.8.0.linux.amd64 /usr/local/bin/sops
```

## Basic Usage

```bash
# Encrypt with AWS KMS
sops --encrypt --kms arn:aws:kms:region:account:key/key-id secrets.yaml > secrets.enc.yaml

# Decrypt
sops --decrypt secrets.enc.yaml

# Edit encrypted file
sops secrets.enc.yaml

# Encrypt in place
sops --encrypt --in-place secrets.yaml
```

## Configuration

```yaml
# .sops.yaml
creation_rules:
  - path_regex: .*\.prod\.yaml$
    kms: arn:aws:kms:us-east-1:account:key/prod-key
  - path_regex: .*\.dev\.yaml$
    kms: arn:aws:kms:us-east-1:account:key/dev-key
  - path_regex: .*
    pgp: fingerprint
```

## Kubernetes Integration

```yaml
# encrypted secret
apiVersion: v1
kind: Secret
metadata:
  name: myapp-secrets
type: Opaque
stringData:
  password: ENC[AES256_GCM,data:encrypted...]
sops:
  kms:
    - arn: arn:aws:kms:region:account:key/key-id
```

```bash
# With ArgoCD
# Install ksops plugin for ArgoCD to decrypt secrets
```

## Best Practices

- Store .sops.yaml in repository
- Use different keys per environment
- Rotate encryption keys regularly
- Never commit unencrypted secrets
- Use key aliases for readability

## Related Skills

- [hashicorp-vault](https://github.com/BagelHole/DevOps-Security-Agent-Skills/tree/0365f57a079b1332f95cf26e31dd2d5332a8399f/security/secrets/hashicorp-vault) - Centralized secrets
- [argocd-gitops](https://github.com/BagelHole/DevOps-Security-Agent-Skills/tree/0365f57a079b1332f95cf26e31dd2d5332a8399f/devops/orchestration/argocd-gitops) - GitOps integration

## Provenance

Adapted from [BagelHole/DevOps-Security-Agent-Skills](https://github.com/BagelHole/DevOps-Security-Agent-Skills/blob/0365f57a079b1332f95cf26e31dd2d5332a8399f/security/secrets/sops-encryption/SKILL.md) at commit `0365f57a079b1332f95cf26e31dd2d5332a8399f`. Original content © 2026 Toby Miller, used under the MIT License. Agent Compass added metadata and the safety gate above.

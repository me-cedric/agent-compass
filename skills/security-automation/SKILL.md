---
name: security-automation
description: Automate security workflows and remediation. Build security pipelines, automate compliance checks, and implement SOAR capabilities. Use when scaling security operations or implementing DevSecOps.
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

# Security Automation

## Agent Compass safety gate

- Confirm authorization and exact target: environment, account, cluster, namespace, repository, and data classification.
- Start read-only. Use plan, diff, check, or dry-run modes before mutation. Never deploy, delete, rotate credentials, fail over, contain, or write to production without explicit approval.
- Preserve rollback and evidence. Back up state or data before destructive operations; during incidents, collect evidence before remediation when safe.
- Use least privilege. Never print, commit, or copy secrets into prompts, logs, commands, or examples.
- Verify commands, flags, API versions, and controls against current official documentation before use; imported examples can age.
- Treat compliance mappings as preparation guidance, not certification, attestation, or legal advice.


Automate security operations for scale and efficiency.

## Security Pipeline

```yaml
# .github/workflows/security.yml
name: Security Pipeline

on: [push, pull_request]

jobs:
  security:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Secret Scanning
        uses: trufflesecurity/trufflehog@main

      - name: SAST
        uses: returntocorp/semgrep-action@v1

      - name: Dependency Scan
        run: npm audit --audit-level=high

      - name: Container Scan
        uses: aquasecurity/trivy-action@master
        with:
          scan-type: 'fs'

      - name: Compliance Check
        run: |
          checkov -d . --framework terraform
```

## Automated Remediation

```python
# Auto-remediation script
def remediate_public_s3(bucket_name):
    """Remove public access from S3 bucket."""
    s3 = boto3.client('s3')
    s3.put_public_access_block(
        Bucket=bucket_name,
        PublicAccessBlockConfiguration={
            'BlockPublicAcls': True,
            'IgnorePublicAcls': True,
            'BlockPublicPolicy': True,
            'RestrictPublicBuckets': True
        }
    )
```

## SOAR Integration

```yaml
playbook:
  name: Suspicious Login Response
  trigger: alert.type == "suspicious_login"
  actions:
    - enrich_ip:
        source: threat_intel
    - if_condition: ip.is_malicious
      then:
        - block_ip:
            firewall: cloudflare
        - disable_user:
            duration: 1h
        - notify:
            channel: security
        - create_ticket:
            priority: high
```

## Compliance as Code

```python
# Checkov custom check
from checkov.terraform.checks.resource.base_resource_check import BaseResourceCheck

class S3Encryption(BaseResourceCheck):
    def __init__(self):
        name = "Ensure S3 bucket has encryption enabled"
        id = "CUSTOM_S3_1"
        supported_resources = ['aws_s3_bucket']
        super().__init__(name=name, id=id, ...)

    def scan_resource_conf(self, conf):
        if 'server_side_encryption_configuration' in conf:
            return CheckResult.PASSED
        return CheckResult.FAILED
```

## Best Practices

- Start with high-impact automations
- Test in staging first
- Include manual review gates
- Monitor automation effectiveness
- Regular rule updates

## Related Skills

- [github-actions](https://github.com/BagelHole/DevOps-Security-Agent-Skills/tree/0365f57a079b1332f95cf26e31dd2d5332a8399f/devops/ci-cd/github-actions) - CI/CD automation
- [policy-as-code](https://github.com/BagelHole/DevOps-Security-Agent-Skills/tree/0365f57a079b1332f95cf26e31dd2d5332a8399f/compliance/governance/policy-as-code) - Policy enforcement

## Provenance

Adapted from [BagelHole/DevOps-Security-Agent-Skills](https://github.com/BagelHole/DevOps-Security-Agent-Skills/blob/0365f57a079b1332f95cf26e31dd2d5332a8399f/security/operations/security-automation/SKILL.md) at commit `0365f57a079b1332f95cf26e31dd2d5332a8399f`. Original content © 2026 Toby Miller, used under the MIT License. Agent Compass added metadata and the safety gate above.

---
name: cis-benchmarks
description: Audit and remediate CIS benchmark violations. Use automated tools to assess compliance and implement hardening recommendations. Use when meeting compliance requirements or implementing security baselines.
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

# CIS Benchmarks

## Agent Compass safety gate

- Confirm authorization and exact target: environment, account, cluster, namespace, repository, and data classification.
- Start read-only. Use plan, diff, check, or dry-run modes before mutation. Never deploy, delete, rotate credentials, fail over, contain, or write to production without explicit approval.
- Preserve rollback and evidence. Back up state or data before destructive operations; during incidents, collect evidence before remediation when safe.
- Use least privilege. Never print, commit, or copy secrets into prompts, logs, commands, or examples.
- Verify commands, flags, API versions, and controls against current official documentation before use; imported examples can age.
- Treat compliance mappings as preparation guidance, not certification, attestation, or legal advice.


Implement and audit CIS security benchmarks.

## When to Use This Skill

Use this skill when:
- Assessing security compliance
- Implementing security baselines
- Meeting regulatory requirements
- Hardening systems to standards

## Assessment Tools

### OpenSCAP

```bash
# Install
apt install openscap-scanner scap-security-guide

# Run CIS benchmark scan
oscap xccdf eval \
  --profile xccdf_org.ssgproject.content_profile_cis \
  --results results.xml \
  --report report.html \
  /usr/share/xml/scap/ssg/content/ssg-ubuntu2204-ds.xml
```

### Lynis

```bash
# Install
apt install lynis

# Run audit
lynis audit system

# Generate report
lynis audit system --report-file /tmp/lynis-report.dat
```

### InSpec

```ruby
# cis-profile/controls/ssh.rb
control 'cis-ssh-1' do
  impact 1.0
  title 'Ensure SSH root login is disabled'

  describe sshd_config do
    its('PermitRootLogin') { should eq 'no' }
  end
end

control 'cis-ssh-2' do
  impact 0.7
  title 'Ensure SSH password authentication is disabled'

  describe sshd_config do
    its('PasswordAuthentication') { should eq 'no' }
  end
end
```

```bash
# Run InSpec
inspec exec cis-profile -t ssh://user@target
```

### Kubernetes CIS

```bash
# kube-bench
docker run --rm -v /etc:/etc:ro -v /var:/var:ro \
  aquasec/kube-bench:latest run --targets node

# Check specific sections
kube-bench run --targets master --check 1.1,1.2
```

## Remediation Workflow

```yaml
workflow:
  1_scan:
    - Run automated assessment
    - Generate baseline report

  2_analyze:
    - Review findings
    - Identify false positives
    - Prioritize by risk

  3_remediate:
    - Apply fixes
    - Document exceptions
    - Verify changes

  4_validate:
    - Re-run assessment
    - Confirm remediation
    - Generate compliance report
```

## Best Practices

- Baseline before hardening
- Document exceptions
- Automate assessments
- Track compliance over time
- Regular re-assessment
- Version control configurations

## Related Skills

- [linux-hardening](https://github.com/BagelHole/DevOps-Security-Agent-Skills/tree/0365f57a079b1332f95cf26e31dd2d5332a8399f/security/hardening/linux-hardening) - Linux security
- [vulnerability-scanning](https://github.com/BagelHole/DevOps-Security-Agent-Skills/tree/0365f57a079b1332f95cf26e31dd2d5332a8399f/security/scanning/vulnerability-scanning) - Security scanning

## Provenance

Adapted from [BagelHole/DevOps-Security-Agent-Skills](https://github.com/BagelHole/DevOps-Security-Agent-Skills/blob/0365f57a079b1332f95cf26e31dd2d5332a8399f/security/hardening/cis-benchmarks/SKILL.md) at commit `0365f57a079b1332f95cf26e31dd2d5332a8399f`. Original content © 2026 Toby Miller, used under the MIT License. Agent Compass added metadata and the safety gate above.

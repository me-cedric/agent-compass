---
name: penetration-testing
description: Perform basic penetration testing and security assessments. Use reconnaissance, vulnerability discovery, and exploitation techniques. Use when validating security controls or assessing system security.
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

# Penetration Testing

## Agent Compass safety gate

- Confirm authorization and exact target: environment, account, cluster, namespace, repository, and data classification.
- Start read-only. Use plan, diff, check, or dry-run modes before mutation. Never deploy, delete, rotate credentials, fail over, contain, or write to production without explicit approval.
- Preserve rollback and evidence. Back up state or data before destructive operations; during incidents, collect evidence before remediation when safe.
- Use least privilege. Never print, commit, or copy secrets into prompts, logs, commands, or examples.
- Verify commands, flags, API versions, and controls against current official documentation before use; imported examples can age.
- Treat compliance mappings as preparation guidance, not certification, attestation, or legal advice.


Validate security controls through authorized testing.

## Phases

```yaml
pentest_phases:
  1_reconnaissance:
    - Passive information gathering
    - DNS enumeration
    - Network mapping

  2_scanning:
    - Port scanning
    - Service identification
    - Vulnerability scanning

  3_exploitation:
    - Attempt exploitation
    - Verify vulnerabilities
    - Document findings

  4_post_exploitation:
    - Privilege escalation
    - Lateral movement
    - Data access

  5_reporting:
    - Document findings
    - Risk assessment
    - Remediation recommendations
```

## Reconnaissance

```bash
# DNS enumeration
dig example.com ANY
host -l example.com

# Subdomain discovery
subfinder -d example.com

# WHOIS
whois example.com
```

## Scanning

```bash
# Port scan
nmap -sV -sC -p- target.com

# Web scanning
nikto -h https://target.com
dirb https://target.com

# Vulnerability scan
nmap --script vuln target.com
```

## Web Testing

```bash
# SQL injection test
sqlmap -u "http://target.com/page?id=1"

# XSS testing
# Use Burp Suite or manual testing

# Directory traversal
curl "http://target.com/file?path=../../../etc/passwd"
```

## Rules of Engagement

```yaml
scope:
  in_scope:
    - target.com
    - api.target.com
  out_of_scope:
    - production-db.target.com
    - third-party services

  testing_window: "Weekdays 2-6 AM UTC"
  emergency_contact: "security@target.com"
```

## Best Practices

- Always get written authorization
- Define clear scope
- Document everything
- Report critical findings immediately
- Safe exploitation techniques only

## Related Skills

- [dast-scanning](https://github.com/BagelHole/DevOps-Security-Agent-Skills/tree/0365f57a079b1332f95cf26e31dd2d5332a8399f/security/scanning/dast-scanning) - Automated testing
- [vulnerability-scanning](https://github.com/BagelHole/DevOps-Security-Agent-Skills/tree/0365f57a079b1332f95cf26e31dd2d5332a8399f/security/scanning/vulnerability-scanning) - Vulnerability discovery

## Provenance

Adapted from [BagelHole/DevOps-Security-Agent-Skills](https://github.com/BagelHole/DevOps-Security-Agent-Skills/blob/0365f57a079b1332f95cf26e31dd2d5332a8399f/security/operations/penetration-testing/SKILL.md) at commit `0365f57a079b1332f95cf26e31dd2d5332a8399f`. Original content © 2026 Toby Miller, used under the MIT License. Agent Compass added metadata and the safety gate above.

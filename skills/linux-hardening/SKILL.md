---
name: linux-hardening
description: Apply CIS benchmarks and secure Linux servers. Configure SSH, manage users, implement firewall rules, and enable security features. Use when hardening Linux systems for production or meeting security compliance requirements.
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

# Linux Hardening

## Agent Compass safety gate

- Confirm authorization and exact target: environment, account, cluster, namespace, repository, and data classification.
- Start read-only. Use plan, diff, check, or dry-run modes before mutation. Never deploy, delete, rotate credentials, fail over, contain, or write to production without explicit approval.
- Preserve rollback and evidence. Back up state or data before destructive operations; during incidents, collect evidence before remediation when safe.
- Use least privilege. Never print, commit, or copy secrets into prompts, logs, commands, or examples.
- Verify commands, flags, API versions, and controls against current official documentation before use; imported examples can age.
- Treat compliance mappings as preparation guidance, not certification, attestation, or legal advice.


Secure Linux servers following CIS benchmarks and security best practices.

## When to Use This Skill

Use this skill when:
- Hardening production servers
- Meeting compliance requirements
- Implementing security baselines
- Configuring secure SSH access

## SSH Hardening

```bash
# /etc/ssh/sshd_config
PermitRootLogin no
PasswordAuthentication no
PubkeyAuthentication yes
MaxAuthTries 3
ClientAliveInterval 300
ClientAliveCountMax 2
AllowUsers deploy admin
Protocol 2
```

## User Security

```bash
# Password policy
sudo apt install libpam-pwquality
# /etc/security/pwquality.conf
minlen = 14
dcredit = -1
ucredit = -1
ocredit = -1
lcredit = -1

# Lock inactive accounts
useradd -D -f 30

# Audit sudo usage
echo "Defaults logfile=/var/log/sudo.log" >> /etc/sudoers
```

## Firewall Configuration

```bash
# UFW setup
ufw default deny incoming
ufw default allow outgoing
ufw allow ssh
ufw allow 443/tcp
ufw enable

# Or iptables
iptables -P INPUT DROP
iptables -P FORWARD DROP
iptables -A INPUT -i lo -j ACCEPT
iptables -A INPUT -m conntrack --ctstate ESTABLISHED,RELATED -j ACCEPT
iptables -A INPUT -p tcp --dport 22 -j ACCEPT
```

## Kernel Hardening

```bash
# /etc/sysctl.d/99-security.conf
net.ipv4.conf.all.send_redirects = 0
net.ipv4.conf.all.accept_redirects = 0
net.ipv4.conf.all.accept_source_route = 0
net.ipv4.icmp_echo_ignore_broadcasts = 1
kernel.randomize_va_space = 2
fs.suid_dumpable = 0

# Apply
sysctl -p
```

## File Permissions

```bash
# Critical files
chmod 600 /etc/shadow
chmod 644 /etc/passwd
chmod 700 /root
chmod 600 /etc/ssh/sshd_config

# Find world-writable files
find / -type f -perm -0002 -ls

# Find SUID files
find / -perm -4000 -type f -ls
```

## Audit Configuration

```bash
# Install auditd
apt install auditd

# /etc/audit/rules.d/audit.rules
-w /etc/passwd -p wa -k identity
-w /etc/shadow -p wa -k identity
-w /etc/sudoers -p wa -k actions
-a always,exit -F arch=b64 -S execve -k exec
```

## Best Practices

- Disable unused services
- Keep system updated
- Use fail2ban for intrusion prevention
- Enable SELinux/AppArmor
- Regular security audits
- Monitor log files
- Implement least privilege

## Related Skills

- [cis-benchmarks](https://github.com/BagelHole/DevOps-Security-Agent-Skills/tree/0365f57a079b1332f95cf26e31dd2d5332a8399f/security/hardening/cis-benchmarks) - Compliance scanning
- [firewall-config](https://github.com/BagelHole/DevOps-Security-Agent-Skills/tree/0365f57a079b1332f95cf26e31dd2d5332a8399f/security/network/firewall-config) - Firewall rules

## Provenance

Adapted from [BagelHole/DevOps-Security-Agent-Skills](https://github.com/BagelHole/DevOps-Security-Agent-Skills/blob/0365f57a079b1332f95cf26e31dd2d5332a8399f/security/hardening/linux-hardening/SKILL.md) at commit `0365f57a079b1332f95cf26e31dd2d5332a8399f`. Original content © 2026 Toby Miller, used under the MIT License. Agent Compass added metadata and the safety gate above.

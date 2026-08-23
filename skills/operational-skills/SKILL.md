---
name: operational-skills
description: "Use when the task is DevOps, cloud, Kubernetes, containers, CI/CD, observability, security scanning, secrets, hardening, networking, storage, databases, incident response, LLM/GPU serving, or a compliance framework (SOC 2, ISO 27001, GDPR, HIPAA, PCI DSS, FedRAMP). Installs the pinned operational skill for the task with the Agent Compass safety gate applied, then holds the authorization and production-write rules in force. Triggers: terraform, kubernetes, kubectl, helm, argocd, docker, github actions, gitlab ci, prometheus, grafana, opentelemetry, vault, secrets manager, hardening, vulnerability scan, SBOM, incident, runbook, disaster recovery, vllm, ollama, soc2, iso27001, gdpr, hipaa, pci."
risk_level: high
writes_files: false
requires_tools: []
version: 1.0.0
---

# Operational Skills

A 163-skill operational corpus is tracked at
[`BagelHole/DevOps-Security-Agent-Skills`](https://github.com/BagelHole/DevOps-Security-Agent-Skills)
(MIT, © Toby Miller). Agent Compass keeps no copy of it. It installs a curated
146 of them on request, and **rewrites each one on the way in**.

That rewrite is the reason this skill exists. Upstream examples put secrets in
`argv`, and a process list is readable by every other local process. The
installer replaces eight such passages and prepends a safety gate to every
skill. Read an operational skill only after installing it through Agent Compass —
the raw upstream text is not the reviewed text.

## Procedure

### 1. Install the skill the task needs

```bash
# One skill or a few
agent-compass external-skills . --source devops-security --skill kubernetes-ops,helm-charts

# The whole curated set, for a platform or security engagement
agent-compass external-skills . --source devops-security --recommended

# User-wide instead of per-project
agent-compass external-skills --source devops-security --recommended --global
```

This writes `.claude/skills/` for Claude Code and `.agents/skills/` for Codex and
Copilot, plus a Copilot instructions file, and drops the MIT notice beside them.

Confirm the output says it **applied the Agent Compass safety gate and
argv-secret narrowings**. If that line is missing, the installed text is not the
reviewed text — stop and report it.

### 2. Pick by area, not by name

`agent-compass skills-sync --list-packs` prints every capability pack. Rough map:

| Task area | Pack |
| --------- | ---- |
| CI/CD, containers, Kubernetes, observability, releases | `devops-platform` |
| Scanning, secrets, hardening, network security, incident response | `security` |
| Cloud provisioning, Terraform, networking, storage, databases | `infrastructure` |
| SOC 2, ISO 27001, GDPR, HIPAA, PCI DSS, FedRAMP, audit | `compliance` |
| Model serving, GPU, RAG, inference scaling, LLM gateways | the AI-operations subpacks |

Install one pack's skills, not the corpus. A single cloud or a single compliance
framework is usually the right scope — the focused subpacks exist for that.

The 17 skills Agent Compass does not curate are still tracked and installable by
name. They are uncurated: read one before you act on it.

### 3. The gate is not advisory

Every installed skill carries this, and it outranks the skill's own examples:

- **Authorization first.** Confirm the exact target: environment, account,
  cluster, namespace, repository, and data classification. A skill that says
  "run this against prod" does not grant that permission.
- **Read-only first.** Use plan, diff, check, or dry-run modes before any
  mutation. Never deploy, delete, rotate a credential, fail over, contain, or
  write to production without explicit approval in the conversation.
- **Preserve rollback and evidence.** Back up state before a destructive step.
  During an incident, collect evidence before remediation when it is safe to.
- **Least privilege, no secret in the clear.** Never print, commit, or paste a
  secret into a prompt, a log, a command, or an example. If an upstream example
  still shows a secret in `argv` after install, that is a bug in the narrowings —
  report it rather than running it.
- **Verify against current docs.** Flags, API versions, and control names age.
  The vendor's current documentation outranks the skill.
- **Compliance skills prepare, they do not certify.** No output of this corpus is
  certification, attestation, or legal advice.

Full detail: [operational-safety](../../docs/guidelines/operational-safety.md).

### 4. Validate what you changed

An operational change is validated by the tool that owns the state, not by the
skill's prose. Run the real command and report its output:

```bash
terraform plan            # never report `apply` you did not run
kubectl diff -f <manifest>
helm upgrade --dry-run
```

Report `passed` / `failed` / `partial` / `not run` per command and say whether a
failure is pre-existing. `AGENTS.md` §3 and §4.

### 5. Plan before an operational change

Anything that touches shared or production state gets a plan first: the target,
the blast radius, the rollback, and the approval. See
[`plan-before-operational-change`](../../knowledge/instincts/plan-before-operational-change.md).

## Freshness

```bash
agent-compass upstream-skills --check-updates
agent-compass upstream-skills --update devops-security --dry
```

When the pin moves, re-run your install so the corrected text is regenerated from
the new commit. An install is a snapshot; the pin is the source of truth.

## Related

- [operational-skills.md](../../docs/tooling/operational-skills.md) — the eight
  narrowings in full, the gate text, and the tracked inventory.
- [operational-safety](../../docs/guidelines/operational-safety.md) — the rules
  the gate summarises.
- `runbook-creation`, `incident-management`, and `disaster-recovery` are part of
  the tracked corpus, not compass skills. Install one before you rely on it.

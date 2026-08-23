# Operational Skills (DevOps, Security, Infrastructure, Compliance)

Agent Compass **tracks** a 163-skill operational corpus without copying it, and
installs a curated 146 of them into a project or a user config on request. The
source is
[`BagelHole/DevOps-Security-Agent-Skills`](https://github.com/BagelHole/DevOps-Security-Agent-Skills)
(MIT, © Toby Miller), pinned in
[`skills/upstream-sources.json`](../../skills/upstream-sources.json).

Agent Compass does not read these skills raw. It **rewrites them on the way in**:
a safety gate is prepended to every skill, and eight upstream passages that put a
secret in `argv` are replaced. That correction used to happen when the corpus was
vendored; it now happens at install time, so the corrected text is what lands in
the project and no uncorrected copy exists anywhere.

## Install

```bash
# The 146 curated skills, into a project, for Claude + Codex + Copilot
agent-compass external-skills . --source devops-security --recommended

# One pack's worth, or one skill
agent-compass external-skills . --source devops-security --skill kubernetes-ops,helm-charts

# User-wide instead of per-project
agent-compass external-skills --source devops-security --recommended --global

# Everything the source holds, including the 17 skills Agent Compass does not curate
agent-compass external-skills . --source devops-security --all
```

Every install prints that it applied the safety gate and the narrowings. If it
does not print that line, the skills are not corrected — stop and check the
`adapter` field on the source.

## What The Adapter Adds

Each installed skill gains this section directly under its H1, plus compass
frontmatter (`risk_level`, `writes_files`, `requires_tools`, `source`,
`source_commit`) and a provenance block:

- Confirm authorization and the exact target before acting.
- Start read-only; use plan, diff, check, or dry-run modes before mutation.
- Preserve rollback and evidence; back up before a destructive operation.
- Use least privilege; never print, commit, or copy a secret.
- Verify commands and API versions against current official documentation.
- Treat compliance mappings as preparation guidance, not certification.

The gate text is the single definition in
[`scripts/lib/upstream-skills.mjs`](../../scripts/lib/upstream-skills.mjs)
(`SAFETY_GATE`). Risk level comes from the owning capability pack.

## The Eight Narrowings

Each entry rewrites a specific upstream passage that conflicts with an Agent
Compass rule. They live in `LOCAL_OVERRIDES` in the same file, and the install
**fails** rather than silently skipping one when upstream rewords the target
passage — a reworded line needs a maintainer to re-aim the override.

| Skill | Upstream passage | Replacement and rule |
| ----- | ---------------- | -------------------- |
| `ai-coding-agent-guardrails` | forbids reading every `.env.*` | permits `.env.example` / `.env.*.example`, which hold no secrets — [`env-var-sync`](../../knowledge/instincts/env-var-sync.md) requires an agent to keep those templates in sync |
| `database-backups` | `mysqldump -p"$DB_PASS"`, `xtrabackup --password=…` | a `0600` defaults file written under `umask 077` — [security.md](../guidelines/security.md) forbids a secret in `argv`, and the process list is public |
| `mysql` | two `xtrabackup --password=secret` examples | same defaults-file pattern; `--defaults-extra-file` must be the first option |
| `redis` | 18 `redis-cli -a <password>` calls | one `REDISCLI_AUTH` export, which the vendor itself recommends over `-a` |
| `azure-vms` | `--admin-password` in `argv` | flag omitted so the CLI prompts |
| `openclaw-local-mac-mini` | `security … -w <secret>` | trailing `-w` with no value, so the tool prompts |
| `mdm-device-management` | an invented `fleet setup` command | the documented web setup screen; the vendor documents no such command |
| `gcp-cloud-sql`, `azure-sql`, `azure-keyvault`, `identity-access-management` | password only accepted in `argv` | an explicit warning that the password is exposed and must be rotated |

## Capability Packs

The 146 curated skills are grouped so a host installs one area, not the corpus.
List the packs and their contents:

```bash
agent-compass skills-sync --list-packs
```

Pack membership is defined in
[`scripts/lib/capability-packs.mjs`](../../scripts/lib/capability-packs.mjs) and
catalogued in [`skills/README.md`](../../skills/README.md).

## Rules That Survive An Install

An installed skill is third-party instruction text. It never relaxes an Agent
Compass gate.

- [operational-safety](../guidelines/operational-safety.md) governs every
  operational action the skill suggests: authorization first, read-only
  discovery, explicit approval before any production write, deletion, credential
  rotation, failover, or containment.
- `AGENTS.md` §3 and §4 still decide when work is validated and complete.
- A compliance skill prepares evidence. It does not certify, attest, or give
  legal advice.
- Executable payloads are refused by default. `--allow-scripts` installs them
  only after you have read each one.

## Freshness

```bash
agent-compass upstream-skills --check-updates      # cached 24h, remote heads only
agent-compass upstream-skills --verify             # offline: pins, pointers, inventories
agent-compass upstream-skills --update devops-security --dry
```

A refresh moves the pin and rewrites the inventory below, copying nothing. When
the pin moves, re-run any install you depend on so the corrected text is
regenerated from the new commit.

## Tracked Inventory

Source: <https://github.com/BagelHole/DevOps-Security-Agent-Skills>

Agent Compass curates 146 of these. The rest are tracked so a new upstream skill
is visible, but they are not part of any pack — install one explicitly with
`--skill` after reading it.

<!-- BEGIN GENERATED:devops-security-inventory -->
163 tracked skills:

- `access-review`, `agent-evals`, `agent-observability`, `ai-agent-security`, `ai-coding-agent-guardrails`, `ai-inference-service-mesh`
- `ai-pipeline-orchestration`, `ai-red-teaming`, `ai-security-hardening`, `ai-sre-incident-response`, `alerting-oncall`, `argocd-gitops`
- `arm-templates`, `asset-inventory`, `audit-logging`, `aws-cloudtrail`, `aws-cost-optimization`, `aws-ec2`
- `aws-ecs-fargate`, `aws-iam`, `aws-lambda`, `aws-rds`, `aws-s3`, `aws-secrets-manager`
- `aws-vpc`, `azure-aks`, `azure-devops`, `azure-functions`, `azure-keyvault`, `azure-monitor-audit`
- `azure-networking`, `azure-sql`, `azure-vms`, `backup-recovery`, `block-storage`, `blue-green-deploy`
- `business-continuity`, `cdn-setup`, `change-management`, `circleci`, `cis-benchmarks`, `cloudflare-pages`
- `cloudflare-r2`, `cloudflare-workers`, `cloudflare-zero-trust`, `cloudformation`, `container-hardening`, `container-registries`
- `container-scanning`, `convex-backend`, `dast-scanning`, `database-backups`, `datadog`, `dependency-scanning`
- `devcontainers-nix`, `disaster-recovery`, `dns-management`, `docker-compose`, `docker-management`, `ebpf-observability`
- `elk-stack`, `feature-flags`, `fedramp-compliance`, `firebase-app-platform`, `firewall-config`, `gcp-audit-logs`
- `gcp-cloud-functions`, `gcp-cloud-sql`, `gcp-compute`, `gcp-gke`, `gcp-networking`, `gcp-secret-manager`
- `gdpr-compliance`, `git-workflow`, `github-actions`, `gitlab-ci`, `gpu-kubernetes-operations`, `gpu-server-management`
- `hashicorp-vault`, `helm-charts`, `hipaa-compliance`, `identity-access-management`, `incident-management`, `incident-response`
- `iso27001-compliance`, `jenkins`, `kubernetes-hardening`, `kubernetes-ops`, `kustomize`, `linux-administration`
- `linux-hardening`, `llm-app-security`, `llm-caching`, `llm-cost-optimization`, `llm-fine-tuning`, `llm-gateway`
- `llm-inference-scaling`, `llmops-platform-engineering`, `load-balancing`, `loki-logging`, `mac-mini-llm-lab`, `mcp-server-security`
- `mdm-device-management`, `model-registry-governance`, `model-serving-kubernetes`, `model-supply-chain-security`, `mongodb`, `multi-tenant-llm-hosting`
- `mysql`, `new-relic`, `nfs-storage`, `object-storage`, `ollama-stack`, `openclaw-deployment-hardening`
- `openclaw-local-mac-mini`, `openclaw-security-hardening`, `openshift`, `opentelemetry`, `opentofu-migration`, `pci-dss-compliance`
- `penetration-testing`, `performance-tuning`, `planetscale`, `platform-engineering`, `podman`, `policy-as-code`
- `postgresql`, `prometheus-grafana`, `prompt-injection-defense`, `rag-infrastructure`, `rag-observability-evals`, `redis`
- `reverse-proxy`, `runbook-creation`, `saas-security-posture`, `sast-scanning`, `sbom-supply-chain`, `security-automation`
- `semantic-versioning`, `service-mesh`, `soc2-compliance`, `sops-encryption`, `sre-dashboards`, `ssh-configuration`
- `ssl-tls-management`, `startup-it-troubleshooting`, `supply-chain-attack-response`, `systemd-services`, `terraform-aws`, `terraform-azure`
- `terraform-gcp`, `threat-modeling`, `user-management`, `vector-database-ops`, `vendor-management`, `vercel-deployments`
- `vllm-server`, `vpn-setup`, `vulnerability-scanning`, `waf-setup`, `windows-hardening`, `windows-server`
- `zero-trust`
<!-- END GENERATED:devops-security-inventory -->

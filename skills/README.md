# Skills

Portable agent skills — self-contained `SKILL.md` folders an agent loads on
demand. They work in Claude Code directly, and the patterns transfer to Codex /
Copilot as referenced context.

## Catalog

### Compass missions

Playbooks for operating agent-compass itself — routed from [`MISSIONS.md`](../MISSIONS.md).

| Skill               | What it does                                                            |
| ------------------- | ----------------------------------------------------------------------- |
| `compass-adopt`     | Wire agent-compass into an existing project end-to-end with minimal input. |
| `compass-bootstrap` | Bootstrap a new project from architecture guidelines, spec-first.        |
| `compass-extend`    | Add a skill/instinct/template/stack/script to compass with full wiring.  |

### Working style

| Skill            | What it does                                                        |
| ---------------- | ------------------------------------------------------------------ |
| `caveman`        | Ultra-compressed communication (~75% fewer tokens, full accuracy). |
| `caveman-commit` | Conventional-commit message generator, terse.                      |
| `caveman-review` | One-line, actionable PR review comments.                           |
| `agent-teacher`  | Level-aware explanations and selective prompt/tool coaching.        |
| `ponytail`       | Forces the laziest solution that actually works (YAGNI, reuse-first). |
| `ponytail-audit` / `ponytail-review` / `ponytail-debt` / `ponytail-help` | Ponytail variants for auditing/reviewing/tracking simplification debt. |

### Architecture

| Skill                  | What it does                                                        |
| ---------------------- | ------------------------------------------------------------------ |
| `architecture-advisor` | Choose & justify a new project's architecture — research-first, technology-neutral, no unlabeled guesses; produces ADR, mermaid diagrams, risks, assumptions, open questions, and optionally a backlog and meeting list. |

### Planning & delivery

Chainable playbooks for taking a project from "where are we?" to build-ready
work: audit → scope → split → detail.

| Skill                     | What it does                                                        |
| ------------------------- | ------------------------------------------------------------------ |
| `progress-audit`          | Diffs specs/requirements against real code into an honest, verified per-feature + global progress matrix. |
| `completion-plan`         | Turns the audit/specs into an ordered backlog of remaining work-items (plan, rules, matched ticket, deps, gates) and flags work missing from the tracker. |
| `work-splitting`          | Splits a backlog across owners with clear separation of concern, minimal file overlap, coordination seams, and a shareable assignment brief. |
| `implementation-planning` | Produces a detailed, production-ready, plug-and-play implementation spec per work-item that a dev or agent can one-shot. |

### Quality gates

| Skill             | What it does                                              |
| ----------------- | -------------------------------------------------------- |
| `gen-docs`        | Scaffolds `README.md` + `DESIGN.md` for a module.        |
| `figma-mcp-frontend` | Uses Figma MCP context for design-system-driven UI implementation. |
| `debug-loop`     | Builds a tight failing feedback loop before diagnosing hard bugs. |
| `api-contract-sync` | Keeps OpenAPI/Scalar or Swagger, Bruno, Gherkin, mocks, and shared types aligned with API changes. |
| `long-running-task` | Runs broad autonomous work with intake, checkpoints, phase loops, validation, and hard stops. |
| `project-memory`  | Reads and writes durable projectmem context safely.      |
| `pr-review-governance` | Deep PR/MR review checklist for specs, security, repo rules, docs sync, UI evidence, summary, and inline comments. |
| `pr-workflow`     | Creates PRs, reviews PRs, and implements review fixes.   |
| `spec-workflow`   | Guides idea → spec → clarify → plan → tasks → docs sync. |
| `verify-module`   | Checks module structure/doc completeness.                |
| `verify-quality`  | Complexity, code smells, naming, function length.        |
| `verify-change`   | Analyzes a diff's impact and doc-sync status.            |
| `verify-security` | Scans a path for vulnerabilities (OWASP-style).          |

<!-- BEGIN GENERATED:OPERATIONAL_SKILLS -->
### Operational capability packs

146 upstream-derived skills stay opt-in so normal host/global adoption remains
small. Sync one or more root packs or focused subpacks:

```bash
node scripts/cli.mjs skills-sync --list-packs
node scripts/cli.mjs skills-sync /path/to/host --pack devops-platform
node scripts/cli.mjs skills-sync /path/to/host --pack aws,kubernetes,observability
node scripts/cli.mjs catalog --type capability-pack --md
```

#### Root packs

| Pack | Skills | Covers |
| ---- | -----: | ------ |
| **devops-platform** | 22 | CI/CD, containers, Kubernetes, observability, AI pipelines, developer environments, and release operations. |
| **security** | 35 | Defensive scanning, secrets, hardening, network security, incident response, and AI security. |
| **infrastructure** | 70 | Cloud, IaC, servers, networking, databases, storage, platforms, IT, and AI infrastructure operations. |
| **compliance** | 19 | Framework mapping, governance, evidence, continuity, auditing, and incident management. |

#### Focused subpacks

| Pack | Skills | Covers |
| ---- | -----: | ------ |
| **aws** | 12 | AWS compute, containers, IAM, networking, data, secrets, auditing, cost, CloudFormation, and Terraform. |
| **azure** | 9 | Azure compute, AKS, networking, SQL, functions, Key Vault, audit monitoring, ARM/Bicep, and Terraform. |
| **gcp** | 8 | GCP compute, GKE, networking, Cloud SQL, functions, secrets, audit logs, and Terraform. |
| **kubernetes** | 9 | Kubernetes operations, packaging, GitOps, managed clusters, GPU workloads, scaling, and hardening. |
| **observability** | 8 | Metrics, traces, logs, alerts, audit telemetry, and cloud audit trails. |
| **ai-ops** | 14 | AI pipelines, model serving, GPU operations, gateways, caching, cost, RAG, vector stores, and inference scaling. |
| **security-scanning** | 7 | Dependency, source, dynamic, container, vulnerability, SBOM, and supply-chain scanning. |
| **secrets** | 5 | Vault, cloud secret managers, and encrypted GitOps secrets. |
| **hardening** | 6 | CIS, Linux, Windows, container, Kubernetes, and agent deployment hardening. |
| **compliance-frameworks** | 6 | FedRAMP, GDPR, HIPAA, ISO 27001, PCI DSS, and SOC 2 framework guidance. |

Every imported skill includes an Agent Compass operational safety gate and pinned MIT provenance. Upstream executable scripts and assets are not vendored.

#### Root-pack contents

<details>
<summary><strong>DevOps platform (22)</strong></summary>

- `ai-pipeline-orchestration`, `alerting-oncall`, `argocd-gitops`, `blue-green-deploy`, `container-registries`, `devcontainers-nix`
- `docker-compose`, `docker-management`, `feature-flags`, `git-workflow`, `github-actions`, `gitlab-ci`
- `helm-charts`, `kubernetes-ops`, `kustomize`, `llm-caching`, `llm-cost-optimization`, `loki-logging`
- `opentelemetry`, `podman`, `prometheus-grafana`, `semantic-versioning`

</details>

<details>
<summary><strong>Security (35)</strong></summary>

- `ai-agent-security`, `ai-coding-agent-guardrails`, `ai-red-teaming`, `ai-security-hardening`, `aws-secrets-manager`, `azure-keyvault`
- `cis-benchmarks`, `container-hardening`, `container-scanning`, `dast-scanning`, `dependency-scanning`, `firewall-config`
- `gcp-secret-manager`, `hashicorp-vault`, `incident-response`, `kubernetes-hardening`, `linux-hardening`, `llm-app-security`
- `mcp-server-security`, `model-supply-chain-security`, `openclaw-deployment-hardening`, `penetration-testing`, `prompt-injection-defense`, `sast-scanning`
- `sbom-supply-chain`, `security-automation`, `sops-encryption`, `ssl-tls-management`, `supply-chain-attack-response`, `threat-modeling`
- `vpn-setup`, `vulnerability-scanning`, `waf-setup`, `windows-hardening`, `zero-trust`

</details>

<details>
<summary><strong>Infrastructure (70)</strong></summary>

- `ai-inference-service-mesh`, `arm-templates`, `aws-cost-optimization`, `aws-ec2`, `aws-ecs-fargate`, `aws-iam`
- `aws-lambda`, `aws-rds`, `aws-s3`, `aws-vpc`, `azure-aks`, `azure-functions`
- `azure-networking`, `azure-sql`, `azure-vms`, `backup-recovery`, `block-storage`, `cdn-setup`
- `cloudflare-pages`, `cloudflare-r2`, `cloudflare-workers`, `cloudflare-zero-trust`, `cloudformation`, `convex-backend`
- `database-backups`, `dns-management`, `firebase-app-platform`, `gcp-cloud-functions`, `gcp-cloud-sql`, `gcp-compute`
- `gcp-gke`, `gcp-networking`, `gpu-kubernetes-operations`, `gpu-server-management`, `identity-access-management`, `linux-administration`
- `llm-fine-tuning`, `llm-gateway`, `llm-inference-scaling`, `load-balancing`, `mac-mini-llm-lab`, `mdm-device-management`
- `mongodb`, `multi-tenant-llm-hosting`, `mysql`, `nfs-storage`, `object-storage`, `ollama-stack`
- `openclaw-local-mac-mini`, `openclaw-security-hardening`, `opentofu-migration`, `performance-tuning`, `planetscale`, `postgresql`
- `rag-infrastructure`, `redis`, `reverse-proxy`, `saas-security-posture`, `service-mesh`, `ssh-configuration`
- `startup-it-troubleshooting`, `systemd-services`, `terraform-aws`, `terraform-azure`, `terraform-gcp`, `user-management`
- `vector-database-ops`, `vercel-deployments`, `vllm-server`, `windows-server`

</details>

<details>
<summary><strong>Compliance (19)</strong></summary>

- `access-review`, `asset-inventory`, `audit-logging`, `aws-cloudtrail`, `azure-monitor-audit`, `business-continuity`
- `change-management`, `disaster-recovery`, `fedramp-compliance`, `gcp-audit-logs`, `gdpr-compliance`, `hipaa-compliance`
- `incident-management`, `iso27001-compliance`, `pci-dss-compliance`, `policy-as-code`, `runbook-creation`, `soc2-compliance`
- `vendor-management`

</details>

#### Focused-subpack contents

<details>
<summary><strong>AWS (12)</strong></summary>

- `aws-cloudtrail`, `aws-cost-optimization`, `aws-ec2`, `aws-ecs-fargate`, `aws-iam`, `aws-lambda`
- `aws-rds`, `aws-s3`, `aws-secrets-manager`, `aws-vpc`, `cloudformation`, `terraform-aws`

</details>

<details>
<summary><strong>Azure (9)</strong></summary>

- `arm-templates`, `azure-aks`, `azure-functions`, `azure-keyvault`, `azure-monitor-audit`, `azure-networking`
- `azure-sql`, `azure-vms`, `terraform-azure`

</details>

<details>
<summary><strong>GCP (8)</strong></summary>

- `gcp-audit-logs`, `gcp-cloud-functions`, `gcp-cloud-sql`, `gcp-compute`, `gcp-gke`, `gcp-networking`
- `gcp-secret-manager`, `terraform-gcp`

</details>

<details>
<summary><strong>Kubernetes (9)</strong></summary>

- `argocd-gitops`, `azure-aks`, `gcp-gke`, `gpu-kubernetes-operations`, `helm-charts`, `kubernetes-hardening`
- `kubernetes-ops`, `kustomize`, `llm-inference-scaling`

</details>

<details>
<summary><strong>Observability (8)</strong></summary>

- `alerting-oncall`, `audit-logging`, `aws-cloudtrail`, `azure-monitor-audit`, `gcp-audit-logs`, `loki-logging`
- `opentelemetry`, `prometheus-grafana`

</details>

<details>
<summary><strong>AI operations (14)</strong></summary>

- `ai-inference-service-mesh`, `ai-pipeline-orchestration`, `gpu-kubernetes-operations`, `gpu-server-management`, `llm-caching`, `llm-cost-optimization`
- `llm-fine-tuning`, `llm-gateway`, `llm-inference-scaling`, `multi-tenant-llm-hosting`, `ollama-stack`, `rag-infrastructure`
- `vector-database-ops`, `vllm-server`

</details>

<details>
<summary><strong>Security scanning (7)</strong></summary>

- `container-scanning`, `dast-scanning`, `dependency-scanning`, `sast-scanning`, `sbom-supply-chain`, `supply-chain-attack-response`
- `vulnerability-scanning`

</details>

<details>
<summary><strong>Secrets management (5)</strong></summary>

- `aws-secrets-manager`, `azure-keyvault`, `gcp-secret-manager`, `hashicorp-vault`, `sops-encryption`

</details>

<details>
<summary><strong>Hardening (6)</strong></summary>

- `cis-benchmarks`, `container-hardening`, `kubernetes-hardening`, `linux-hardening`, `openclaw-deployment-hardening`, `windows-hardening`

</details>

<details>
<summary><strong>Compliance frameworks (6)</strong></summary>

- `fedramp-compliance`, `gdpr-compliance`, `hipaa-compliance`, `iso27001-compliance`, `pci-dss-compliance`, `soc2-compliance`

</details>
<!-- END GENERATED:OPERATIONAL_SKILLS -->
### Spec Kit bridge

Optional command skills for hosts that use GitHub Spec Kit. Use them with
`spec-kit-bridge` provider prompts/agents, or sync them with `skills-sync` when
a repo has `.specify/`.

| Skill | What it does |
| ----- | ------------ |
| `speckit-constitution` | Create/update project constitution rules. |
| `speckit-specify` | Create/update behavior-focused feature specs. |
| `speckit-clarify` | Resolve open spec questions before planning. |
| `speckit-plan` | Produce technical plan, research, contracts, and validation. |
| `speckit-tasks` | Generate ordered, test-first implementation tasks. |
| `speckit-analyze` | Review Spec Kit artifacts for drift and gaps. |
| `speckit-checklist` | Create feature readiness checklists. |
| `speckit-implement` | Execute approved tasks under Agent Compass gates. |
| `speckit-converge` | Reconcile code, tests, docs, and specs after work. |
| `speckit-agent-context-update` | Refresh Spec Kit context markers without clobbering host guidance. |
| `speckit-taskstoissues` | Convert tasks into deduped GitHub issues when explicitly approved. |

### Stack patterns (backend)

| Skill                              | What it does                                               |
| ---------------------------------- | --------------------------------------------------------- |
| `nestjs-patterns`                  | Module/controller/service/repository/mapper/DTO patterns. |
| `nestjs-monorepo-scaffold`         | Turbo + NestJS + Drizzle + BullMQ monorepo scaffolding.   |
| `drizzle-postgres-patterns`        | Schema, migrations, transactions, type inference.         |
| `bullmq-patterns`                  | Processors, schedulers, job spans, dedupe.                |
| `resilience-observability-patterns`| Circuit breaker, retry, OTel tracing, structured logs.    |
| `external-service-patterns`        | SFTP, payment gateways, auth, resilient HTTP clients.     |

### Stack patterns (frontend / mobile)

| Skill                          | What it does                                          |
| ------------------------------ | ----------------------------------------------------- |
| `angular-patterns`             | Standalone components, signals, native control flow, inject() DI. |
| `react-admin-dashboard-patterns` | TanStack Router, MUI, MVVM, RBAC, React Query CRUD. |
| `expo-react-native-patterns`   | Expo Router, MVVM, Zustand auth, React Query, theming. |

## Using them

- **Claude Code:** reference a skill in a prompt ("use the `verify-security`
  skill on `src/modules/payments`"), or sync them into your global config with
  `skillshare` so they auto-trigger.
- **Codex / Copilot:** point the agent at the relevant `SKILL.md` as context;
  the patterns and checklists apply the same way.

## Metadata

Every `SKILL.md` frontmatter must include:

- `name`: kebab-case skill id.
- `description`: trigger summary.
- `risk_level`: `low`, `medium`, or `high`.
- `writes_files`: `true` or `false`.
- `requires_tools`: inline list, e.g. `[]` or `[web, gh]`.

`npm run lint:naming` enforces this so skills are safe to sync into project or
global provider directories.

## Provenance & maintenance

The stack-pattern skills were extracted from a production monorepo and may carry
light project-specific naming in examples — that's fine as illustration; the
triggers and rules are generic. Keep them current with
[`scripts/pull-knowledge.mjs`](../scripts/pull-knowledge.mjs). Adding a skill?
Create `skills/<name>/SKILL.md` and add a row here (see
[CONTRIBUTING](../CONTRIBUTING.md)).

The DevOps platform, security, infrastructure, and compliance packs were
adapted from
[BagelHole/DevOps-Security-Agent-Skills](https://github.com/BagelHole/DevOps-Security-Agent-Skills)
at pinned commit `0365f57a079b1332f95cf26e31dd2d5332a8399f`.
Agent Compass adds safety metadata and rules, and does not vendor upstream
executables. Verify the current lock with `agent-compass upstream-skills
--verify`; compare or refresh only from an explicit local checkout with
`--source`. The command never fetches or monitors remote state. See
[`THIRD_PARTY_NOTICES.md`](../THIRD_PARTY_NOTICES.md).

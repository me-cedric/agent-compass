// Opt-in operational capability packs — Agent Compass's curation of the tracked
// operational corpus (BagelHole/DevOps-Security-Agent-Skills). These skills are
// NOT stored in this repository: `external-skills` installs them from the pinned
// commit with the safety gate applied. A pack is therefore a selection to install,
// not a directory to copy. See docs/tooling/operational-skills.md.

export const CAPABILITY_PACKS = {
  "devops-platform": {
    "kind": "root",
    "label": "DevOps platform",
    "description": "CI/CD, containers, Kubernetes, observability, AI pipelines, developer environments, and release operations.",
    "skills": [
      "ai-pipeline-orchestration",
      "alerting-oncall",
      "argocd-gitops",
      "blue-green-deploy",
      "container-registries",
      "devcontainers-nix",
      "docker-compose",
      "docker-management",
      "feature-flags",
      "git-workflow",
      "github-actions",
      "gitlab-ci",
      "helm-charts",
      "kubernetes-ops",
      "kustomize",
      "llm-caching",
      "llm-cost-optimization",
      "loki-logging",
      "opentelemetry",
      "podman",
      "prometheus-grafana",
      "semantic-versioning"
    ]
  },
  "security": {
    "kind": "root",
    "label": "Security",
    "description": "Defensive scanning, secrets, hardening, network security, incident response, and AI security.",
    "skills": [
      "ai-agent-security",
      "ai-coding-agent-guardrails",
      "ai-red-teaming",
      "ai-security-hardening",
      "aws-secrets-manager",
      "azure-keyvault",
      "cis-benchmarks",
      "container-hardening",
      "container-scanning",
      "dast-scanning",
      "dependency-scanning",
      "firewall-config",
      "gcp-secret-manager",
      "hashicorp-vault",
      "incident-response",
      "kubernetes-hardening",
      "linux-hardening",
      "llm-app-security",
      "mcp-server-security",
      "model-supply-chain-security",
      "openclaw-deployment-hardening",
      "penetration-testing",
      "prompt-injection-defense",
      "sast-scanning",
      "sbom-supply-chain",
      "security-automation",
      "sops-encryption",
      "ssl-tls-management",
      "supply-chain-attack-response",
      "threat-modeling",
      "vpn-setup",
      "vulnerability-scanning",
      "waf-setup",
      "windows-hardening",
      "zero-trust"
    ]
  },
  "infrastructure": {
    "kind": "root",
    "label": "Infrastructure",
    "description": "Cloud, IaC, servers, networking, databases, storage, platforms, IT, and AI infrastructure operations.",
    "skills": [
      "ai-inference-service-mesh",
      "arm-templates",
      "aws-cost-optimization",
      "aws-ec2",
      "aws-ecs-fargate",
      "aws-iam",
      "aws-lambda",
      "aws-rds",
      "aws-s3",
      "aws-vpc",
      "azure-aks",
      "azure-functions",
      "azure-networking",
      "azure-sql",
      "azure-vms",
      "backup-recovery",
      "block-storage",
      "cdn-setup",
      "cloudflare-pages",
      "cloudflare-r2",
      "cloudflare-workers",
      "cloudflare-zero-trust",
      "cloudformation",
      "convex-backend",
      "database-backups",
      "dns-management",
      "firebase-app-platform",
      "gcp-cloud-functions",
      "gcp-cloud-sql",
      "gcp-compute",
      "gcp-gke",
      "gcp-networking",
      "gpu-kubernetes-operations",
      "gpu-server-management",
      "identity-access-management",
      "linux-administration",
      "llm-fine-tuning",
      "llm-gateway",
      "llm-inference-scaling",
      "load-balancing",
      "mac-mini-llm-lab",
      "mdm-device-management",
      "mongodb",
      "multi-tenant-llm-hosting",
      "mysql",
      "nfs-storage",
      "object-storage",
      "ollama-stack",
      "openclaw-local-mac-mini",
      "openclaw-security-hardening",
      "opentofu-migration",
      "performance-tuning",
      "planetscale",
      "postgresql",
      "rag-infrastructure",
      "redis",
      "reverse-proxy",
      "saas-security-posture",
      "service-mesh",
      "ssh-configuration",
      "startup-it-troubleshooting",
      "systemd-services",
      "terraform-aws",
      "terraform-azure",
      "terraform-gcp",
      "user-management",
      "vector-database-ops",
      "vercel-deployments",
      "vllm-server",
      "windows-server"
    ]
  },
  "compliance": {
    "kind": "root",
    "label": "Compliance",
    "description": "Framework mapping, governance, evidence, continuity, auditing, and incident management.",
    "skills": [
      "access-review",
      "asset-inventory",
      "audit-logging",
      "aws-cloudtrail",
      "azure-monitor-audit",
      "business-continuity",
      "change-management",
      "disaster-recovery",
      "fedramp-compliance",
      "gcp-audit-logs",
      "gdpr-compliance",
      "hipaa-compliance",
      "incident-management",
      "iso27001-compliance",
      "pci-dss-compliance",
      "policy-as-code",
      "runbook-creation",
      "soc2-compliance",
      "vendor-management"
    ]
  },
  "aws": {
    "kind": "subpack",
    "parent": "infrastructure",
    "label": "AWS",
    "description": "AWS compute, containers, IAM, networking, data, secrets, auditing, cost, CloudFormation, and Terraform.",
    "skills": [
      "aws-cloudtrail",
      "aws-cost-optimization",
      "aws-ec2",
      "aws-ecs-fargate",
      "aws-iam",
      "aws-lambda",
      "aws-rds",
      "aws-s3",
      "aws-secrets-manager",
      "aws-vpc",
      "cloudformation",
      "terraform-aws"
    ]
  },
  "azure": {
    "kind": "subpack",
    "parent": "infrastructure",
    "label": "Azure",
    "description": "Azure compute, AKS, networking, SQL, functions, Key Vault, audit monitoring, ARM/Bicep, and Terraform.",
    "skills": [
      "arm-templates",
      "azure-aks",
      "azure-functions",
      "azure-keyvault",
      "azure-monitor-audit",
      "azure-networking",
      "azure-sql",
      "azure-vms",
      "terraform-azure"
    ]
  },
  "gcp": {
    "kind": "subpack",
    "parent": "infrastructure",
    "label": "GCP",
    "description": "GCP compute, GKE, networking, Cloud SQL, functions, secrets, audit logs, and Terraform.",
    "skills": [
      "gcp-audit-logs",
      "gcp-cloud-functions",
      "gcp-cloud-sql",
      "gcp-compute",
      "gcp-gke",
      "gcp-networking",
      "gcp-secret-manager",
      "terraform-gcp"
    ]
  },
  "kubernetes": {
    "kind": "subpack",
    "parent": "devops-platform",
    "label": "Kubernetes",
    "description": "Kubernetes operations, packaging, GitOps, managed clusters, GPU workloads, scaling, and hardening.",
    "skills": [
      "argocd-gitops",
      "azure-aks",
      "gcp-gke",
      "gpu-kubernetes-operations",
      "helm-charts",
      "kubernetes-hardening",
      "kubernetes-ops",
      "kustomize",
      "llm-inference-scaling"
    ]
  },
  "observability": {
    "kind": "subpack",
    "parent": "devops-platform",
    "label": "Observability",
    "description": "Metrics, traces, logs, alerts, audit telemetry, and cloud audit trails.",
    "skills": [
      "alerting-oncall",
      "audit-logging",
      "aws-cloudtrail",
      "azure-monitor-audit",
      "gcp-audit-logs",
      "loki-logging",
      "opentelemetry",
      "prometheus-grafana"
    ]
  },
  "ai-ops": {
    "kind": "subpack",
    "parent": "infrastructure",
    "label": "AI operations",
    "description": "AI pipelines, model serving, GPU operations, gateways, caching, cost, RAG, vector stores, and inference scaling.",
    "skills": [
      "ai-inference-service-mesh",
      "ai-pipeline-orchestration",
      "gpu-kubernetes-operations",
      "gpu-server-management",
      "llm-caching",
      "llm-cost-optimization",
      "llm-fine-tuning",
      "llm-gateway",
      "llm-inference-scaling",
      "multi-tenant-llm-hosting",
      "ollama-stack",
      "rag-infrastructure",
      "vector-database-ops",
      "vllm-server"
    ]
  },
  "security-scanning": {
    "kind": "subpack",
    "parent": "security",
    "label": "Security scanning",
    "description": "Dependency, source, dynamic, container, vulnerability, SBOM, and supply-chain scanning.",
    "skills": [
      "container-scanning",
      "dast-scanning",
      "dependency-scanning",
      "sast-scanning",
      "sbom-supply-chain",
      "supply-chain-attack-response",
      "vulnerability-scanning"
    ]
  },
  "secrets": {
    "kind": "subpack",
    "parent": "security",
    "label": "Secrets management",
    "description": "Vault, cloud secret managers, and encrypted GitOps secrets.",
    "skills": [
      "aws-secrets-manager",
      "azure-keyvault",
      "gcp-secret-manager",
      "hashicorp-vault",
      "sops-encryption"
    ]
  },
  "hardening": {
    "kind": "subpack",
    "parent": "security",
    "label": "Hardening",
    "description": "CIS, Linux, Windows, container, Kubernetes, and agent deployment hardening.",
    "skills": [
      "cis-benchmarks",
      "container-hardening",
      "kubernetes-hardening",
      "linux-hardening",
      "openclaw-deployment-hardening",
      "windows-hardening"
    ]
  },
  "compliance-frameworks": {
    "kind": "subpack",
    "parent": "compliance",
    "label": "Compliance frameworks",
    "description": "FedRAMP, GDPR, HIPAA, ISO 27001, PCI DSS, and SOC 2 framework guidance.",
    "skills": [
      "fedramp-compliance",
      "gdpr-compliance",
      "hipaa-compliance",
      "iso27001-compliance",
      "pci-dss-compliance",
      "soc2-compliance"
    ]
  }
}

export const ROOT_CAPABILITY_PACK_IDS = Object.keys(CAPABILITY_PACKS)
  .filter((id) => CAPABILITY_PACKS[id].kind === "root")
export const SUBPACK_IDS = Object.keys(CAPABILITY_PACKS)
  .filter((id) => CAPABILITY_PACKS[id].kind === "subpack")
export const rootCapabilitySkills = () => ROOT_CAPABILITY_PACK_IDS
  .flatMap((id) => CAPABILITY_PACKS[id].skills)

export const selectCapabilityPacks = (ids) => {
  const unknown = ids.filter((id) => !CAPABILITY_PACKS[id])
  if (unknown.length) throw new Error(`Unknown capability pack(s): ${unknown.join(", ")}`)
  return [...new Set(ids.flatMap((id) => CAPABILITY_PACKS[id].skills))]
}

---
name: terraform-aws
description: Provision AWS infrastructure with Terraform. Create modules, manage state, and implement IaC best practices. Use when deploying AWS resources declaratively.
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

# Terraform AWS

## Agent Compass safety gate

- Confirm authorization and exact target: environment, account, cluster, namespace, repository, and data classification.
- Start read-only. Use plan, diff, check, or dry-run modes before mutation. Never deploy, delete, rotate credentials, fail over, contain, or write to production without explicit approval.
- Preserve rollback and evidence. Back up state or data before destructive operations; during incidents, collect evidence before remediation when safe.
- Use least privilege. Never print, commit, or copy secrets into prompts, logs, commands, or examples.
- Verify commands, flags, API versions, and controls against current official documentation before use; imported examples can age.
- Treat compliance mappings as preparation guidance, not certification, attestation, or legal advice.


Provision and manage AWS infrastructure with Terraform.

## Provider Configuration

```hcl
terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  backend "s3" {
    bucket = "terraform-state"
    key    = "prod/terraform.tfstate"
    region = "us-east-1"
  }
}

provider "aws" {
  region = var.region

  default_tags {
    tags = {
      Environment = var.environment
      ManagedBy   = "terraform"
    }
  }
}
```

## Example Resources

```hcl
resource "aws_vpc" "main" {
  cidr_block           = "10.0.0.0/16"
  enable_dns_hostnames = true

  tags = { Name = "main-vpc" }
}

resource "aws_instance" "web" {
  ami           = data.aws_ami.amazon_linux.id
  instance_type = "t3.micro"
  subnet_id     = aws_subnet.public.id

  tags = { Name = "web-server" }
}
```

## Modules

```hcl
module "vpc" {
  source = "terraform-aws-modules/vpc/aws"

  name = "my-vpc"
  cidr = "10.0.0.0/16"

  azs             = ["us-east-1a", "us-east-1b"]
  private_subnets = ["10.0.1.0/24", "10.0.2.0/24"]
  public_subnets  = ["10.0.101.0/24", "10.0.102.0/24"]

  enable_nat_gateway = true
}
```

## Commands

```bash
terraform init
terraform plan -out=plan.tfplan
terraform apply plan.tfplan
terraform destroy
```

## Best Practices

- Use remote state with locking
- Implement module structure
- Use workspaces or separate states per environment
- Pin provider versions
- Use data sources for AMIs

## Related Skills

- [aws-vpc](https://github.com/BagelHole/DevOps-Security-Agent-Skills/tree/0365f57a079b1332f95cf26e31dd2d5332a8399f/infrastructure/cloud-aws/aws-vpc) - VPC networking
- [aws-iam](https://github.com/BagelHole/DevOps-Security-Agent-Skills/tree/0365f57a079b1332f95cf26e31dd2d5332a8399f/infrastructure/cloud-aws/aws-iam) - IAM policies

## Provenance

Adapted from [BagelHole/DevOps-Security-Agent-Skills](https://github.com/BagelHole/DevOps-Security-Agent-Skills/blob/0365f57a079b1332f95cf26e31dd2d5332a8399f/infrastructure/cloud-aws/terraform-aws/SKILL.md) at commit `0365f57a079b1332f95cf26e31dd2d5332a8399f`. Original content © 2026 Toby Miller, used under the MIT License. Agent Compass added metadata and the safety gate above.

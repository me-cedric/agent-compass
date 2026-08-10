import { createHash } from 'node:crypto'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { basename, dirname, join, posix, relative } from 'node:path'

import {
  CAPABILITY_PACKS,
  ROOT_CAPABILITY_PACK_IDS,
  rootCapabilitySkills,
} from './capability-packs.mjs'

export const UPSTREAM_REPOSITORY = 'https://github.com/BagelHole/DevOps-Security-Agent-Skills'

export const SAFETY_GATE = `## Agent Compass safety gate

- Confirm authorization and exact target: environment, account, cluster, namespace, repository, and data classification.
- Start read-only. Use plan, diff, check, or dry-run modes before mutation. Never deploy, delete, rotate credentials, fail over, contain, or write to production without explicit approval.
- Preserve rollback and evidence. Back up state or data before destructive operations; during incidents, collect evidence before remediation when safe.
- Use least privilege. Never print, commit, or copy secrets into prompts, logs, commands, or examples.
- Verify commands, flags, API versions, and controls against current official documentation before use; imported examples can age.
- Treat compliance mappings as preparation guidance, not certification, attestation, or legal advice.
`

export const sha256 = (text) => createHash('sha256').update(text).digest('hex')

const HIGH_RISK_DEVOPS = new Set([
  'kubernetes-ops', 'helm-charts', 'argocd-gitops', 'kustomize',
  'blue-green-deploy', 'docker-management', 'docker-compose', 'podman',
  'container-registries',
])

export const riskLevelFor = (packId, name) => {
  if (packId === 'security' || packId === 'infrastructure') return 'high'
  if (packId === 'compliance') return 'medium'
  return HIGH_RISK_DEVOPS.has(name) ? 'high' : 'medium'
}

const countLines = (text, predicate) => text.split('\n').filter(predicate).length

export const riskSignals = (text) => ({
  remoteShell: countLines(text, (line) => /(?:curl|wget)[^|\n]*\|\s*(?:sh|bash)\b/i.test(line)),
  destructive: countLines(text, (line) => /\bterraform\s+destroy\b|\bkubectl\s+delete\b|\bhelm\s+uninstall\b|\brm\s+-rf\b|\bmkfs(?:\.\w+)?\b|\bDROP\s+(?:TABLE|DATABASE)\b|\b(?:aws|az|gcloud)\b[^\n]*\bdelete\b/i.test(line)),
  floatingVersion: countLines(text, (line) => /:latest\b|@(main|master|latest)\b/i.test(line)),
  mutableActionRef: countLines(text, (line) => {
    const ref = line.match(/\buses:\s*[\w./-]+@([^\s#]+)/)?.[1]
    return Boolean(ref && !/^[a-f0-9]{40}$/i.test(ref))
  }),
  deprecatedApi: countLines(text, (line) => /\bapiVersion:\s*(?:extensions\/v1beta1|apps\/v1beta[12]|networking\.k8s\.io\/v1beta1)\b/.test(line)),
})

const rewriteRelativeLinks = (text, sourceRel, repository, commit) => text.replace(
  /(!?\[[^\]]*\]\()((?:\.\.\/|\.\/)[^)]*)(\))/g,
  (all, open, target, close) => {
    const hashAt = target.indexOf('#')
    const rawPath = hashAt === -1 ? target : target.slice(0, hashAt)
    const hash = hashAt === -1 ? '' : target.slice(hashAt)
    const resolved = posix.normalize(posix.join(posix.dirname(sourceRel), rawPath)).replace(/\/$/, '')
    const kind = rawPath.endsWith('/') ? 'tree' : 'blob'
    return `${open}${repository}/${kind}/${commit}/${resolved}${hash}${close}`
  },
)

// Local overrides run on the way out of the upstream tree, so a later --refresh
// re-applies them instead of reverting them. An edit made directly to a file
// under skills/ does not survive a refresh — see
// knowledge/instincts/vendored-corpus-manifest.md, section 6. Record why each
// override exists: it must name the Agent Compass rule that upstream contradicts.
export const LOCAL_OVERRIDES = {
  // Agent Compass requires an agent to read and update .env.example. The
  // upstream rule forbids reading every .env.* file, which contradicts
  // knowledge/instincts/env-var-sync.md and docs/tooling/env-management.md.
  'ai-coding-agent-guardrails': [[
    'contents of .env, .env.*, secrets.yaml',
    'contents of .env, .env.* (except .env.example / .env.*.example, which hold no secrets), secrets.yaml',
  ]],
  // The entries below hold shell snippets with backticks, `${...}` and line
  // continuations, so they are written as escaped double-quoted strings rather
  // than template literals.
  // A secret in argv is readable from the process list; docs/guidelines/security.md
  // forbids it. mysqldump reads the [client] group, xtrabackup reads [xtrabackup].
  // The umask subshell matters: a chmod after the write leaves a readable window.
  "database-backups": [
    [
      "mysqldump -u \"$DB_USER\" -p\"$DB_PASS\" \\\n",
      "# Credentials go in a 0600 file, never in argv: the process list is public.\n# Create it with a tight umask; a chmod after the write leaves a readable window.\n( umask 077; printf '[client]\\nuser=%s\\npassword=%s\\n' \"$DB_USER\" \"$DB_PASS\" > \"$HOME/.my-dump.cnf\" )\n\n# --defaults-extra-file must be the first option on the command line.\nmysqldump --defaults-extra-file=\"$HOME/.my-dump.cnf\" \\\n",
    ],
    [
      "xtrabackup --backup \\\n  --user=backup_user \\\n  --password=\"${MYSQL_BACKUP_PASSWORD}\" \\\n  --target-dir=\"$BACKUP_DIR\"",
      "# Credentials go in a 0600 file, never in argv: the process list is public.\n# Create it with a tight umask; a chmod after the write leaves a readable window.\n( umask 077; printf '[xtrabackup]\\nuser=backup_user\\npassword=%s\\n' \\\n  \"${MYSQL_BACKUP_PASSWORD}\" > \"$HOME/.my-backup.cnf\" )\n\n# --defaults-extra-file must be the first option on the command line.\nxtrabackup --defaults-extra-file=\"$HOME/.my-backup.cnf\" --backup \\\n  --target-dir=\"$BACKUP_DIR\"",
    ],
  ],
  // Same argv rule. xtrabackup requires --defaults-extra-file to be its first
  // option, and the incremental example reuses the file the full backup wrote.
  "mysql": [
    [
      "xtrabackup --backup --user=root --password=secret \\\n  --target-dir=/backups/full_$(date +%F)",
      "# Credentials go in a 0600 file, never in argv: the process list is public.\n# Export MYSQL_ROOT_PASSWORD from your secret store first, never a literal here.\n( umask 077; printf '[xtrabackup]\\nuser=root\\npassword=%s\\n' \\\n  \"$MYSQL_ROOT_PASSWORD\" > \"$HOME/.my-backup.cnf\" )\n\n# --defaults-extra-file must be the first option on the command line.\nxtrabackup --defaults-extra-file=\"$HOME/.my-backup.cnf\" --backup \\\n  --target-dir=/backups/full_$(date +%F)",
    ],
    [
      "xtrabackup --backup --user=root --password=secret \\\n  --target-dir=/backups/inc_$(date +%F) \\",
      "# Reuses the 0600 defaults file written in the full-backup step above.\nxtrabackup --defaults-extra-file=\"$HOME/.my-backup.cnf\" --backup \\\n  --target-dir=/backups/inc_$(date +%F) \\",
    ],
  ],
  // gcloud accepts a password only in argv, so no flag can satisfy the rule. Each
  // command block gets the exposure warning that security.md prescribes.
  "gcp-cloud-sql": [
    [
      "gcloud sql users create appuser --instance=prod-db \\\n  --password=$(openssl rand -base64 24)\n```",
      "gcloud sql users create appuser --instance=prod-db \\\n  --password=$(openssl rand -base64 24)\n```\n\n> `gcloud sql` accepts a password only as a command-line argument, and the\n> process list is readable by every other local process. Treat any password in\n> these commands as exposed: generate it, use it once, and rotate it through\n> Secret Manager as soon as the instance exists.",
    ],
    [
      "  --root-password=$(openssl rand -base64 24)\n```",
      "  --root-password=$(openssl rand -base64 24)\n```\n\n> `gcloud sql` accepts a password only as a command-line argument, and the\n> process list is readable by every other local process. Treat any password in\n> these commands as exposed: generate it, use it once, and rotate it through\n> Secret Manager as soon as the instance exists.",
    ],
  ],
  // redis-cli reads REDISCLI_AUTH, which the vendor recommends over -a:
  // "For security reasons, provide the password to redis-cli automatically via
  // the REDISCLI_AUTH environment variable." One export replaces 18 argv secrets.
  "redis": [
    [
      "# Connect with authentication",
      "# Put the password in the environment before the first command.\n# redis-cli reads REDISCLI_AUTH and keeps the password out of the command line.\nexport REDISCLI_AUTH=strong_redis_password\n\n# Connect with authentication",
    ],
    [
      " -a strong_redis_password",
      "",
    ],
  ],
  // az sql server create offers no non-argv password for SQL authentication, so
  // the rule falls back to naming the exposure. The comment also gives the
  // documented Entra-only path, which removes the password entirely.
  "azure-sql": [
    [
      "  --location westus \\\n  --admin-user sqladmin \\\n  --admin-password 'S3cur3P@ssw0rd!'",
      "  --location westus \\\n  --admin-user sqladmin \\\n  --admin-password 'S3cur3P@ssw0rd!'\n\n> The Azure CLI accepts this secret only as a command-line argument, and the\n> process list is readable by every other local process. Treat any secret in\n> these commands as exposed: generate it, use it once, and rotate it as soon as\n> the operation is complete.",
    ],
    [
      "  --storage-uri \"https://mystorageacct.blob.core.windows.net/backups/myapp-db.bacpac\"\n```",
      "  --storage-uri \"https://mystorageacct.blob.core.windows.net/backups/myapp-db.bacpac\"\n```\n\n> The Azure CLI accepts this secret only as a command-line argument, and the\n> process list is readable by every other local process. Treat any secret in\n> these commands as exposed: generate it, use it once, and rotate it as soon as\n> the operation is complete.",
    ],
    [
      "  --admin-user sqladmin \\\n  --admin-password 'S3cur3P@ssw0rd!' \\\n  --enable-public-network false \\\n  --minimal-tls-version 1.2",
      "  --admin-user sqladmin \\\n  --admin-password 'S3cur3P@ssw0rd!' \\\n  --enable-public-network false \\\n  --minimal-tls-version 1.2\n\n# The password above is visible in the process list. To remove it entirely, create\n# the server with Microsoft Entra-only authentication and no SQL admin login:\n#   az sql server create --enable-ad-only-auth \\\n#     --external-admin-principal-type Group --external-admin-name \"SQL Admins\" \\\n#     --external-admin-sid \"{aad-group-object-id}\" ...\n# https://learn.microsoft.com/en-us/cli/azure/sql/server#az-sql-server-create",
    ],
  ],
  // az vm create prompts for the password when --admin-password is omitted, so the
  // secret never reaches argv. The prompt needs an interactive terminal.
  "azure-vms": [
    [
      "az vm create \\\n  --resource-group compute-rg \\\n  --name myapp-win-vm \\\n  --image Win2022Datacenter \\\n  --size Standard_D4s_v5 \\\n  --admin-username azureadmin \\\n  --admin-password 'S3cur3P@ssw0rd!' \\\n  --vnet-name myapp-vnet \\\n  --subnet app-subnet \\\n  --public-ip-address \"\" \\\n  --os-disk-size-gb 128 \\\n  --storage-sku Premium_LRS \\\n  --zone 1\n```",
      "# Omit --admin-password. The CLI prompts for the password at the command line.\naz vm create \\\n  --resource-group compute-rg \\\n  --name myapp-win-vm \\\n  --image Win2022Datacenter \\\n  --size Standard_D4s_v5 \\\n  --admin-username azureadmin \\\n  --vnet-name myapp-vnet \\\n  --subnet app-subnet \\\n  --public-ip-address \"\" \\\n  --os-disk-size-gb 128 \\\n  --storage-sku Premium_LRS \\\n  --zone 1\n```\n\n> The prompt works only in an interactive terminal. A script or a CI job must\n> pass `--admin-password`, and the process list is readable by every other local\n> process. Treat a password passed that way as exposed: generate it, use it once,\n> and rotate it as soon as the VM exists. Linux images need no password at all \u2014\n> use `--generate-ssh-keys`, as the Linux example above does.",
    ],
  ],
  // az keyvault certificate import accepts the PFX password only in argv.
  "azure-keyvault": [
    [
      "# List certificates\naz keyvault certificate list --vault-name myapp-vault-prod -o table\n```",
      "# List certificates\naz keyvault certificate list --vault-name myapp-vault-prod -o table\n```\n\n> The Azure CLI accepts this secret only as a command-line argument, and the\n> process list is readable by every other local process. Treat any secret in\n> these commands as exposed: generate it, use it once, and rotate it as soon as\n> the operation is complete.",
    ],
  ],
  // az ad user create accepts --password only in argv. A $(...) substitution does
  // not help: the shell expands it before exec, so the value still lands in argv.
  "identity-access-management": [
    [
      "# List group members\naz ad group member list --group \"SG-Engineering\" --query '[].{name:displayName, email:userPrincipalName}' -o table\n```",
      "# List group members\naz ad group member list --group \"SG-Engineering\" --query '[].{name:displayName, email:userPrincipalName}' -o table\n```\n\n> The Azure CLI accepts this secret only as a command-line argument, and the\n> process list is readable by every other local process. Treat any secret in\n> these commands as exposed: generate it, use it once, and rotate it as soon as\n> the operation is complete.",
    ],
    [
      "  --action-group \"/subscriptions/SUB_ID/resourceGroups/security-rg/providers/microsoft.insights/actionGroups/SecurityTeam\"\n```",
      "  --action-group \"/subscriptions/SUB_ID/resourceGroups/security-rg/providers/microsoft.insights/actionGroups/SecurityTeam\"\n```\n\n> The Azure CLI accepts this secret only as a command-line argument, and the\n> process list is readable by every other local process. Treat any secret in\n> these commands as exposed: generate it, use it once, and rotate it as soon as\n> the operation is complete.",
    ],
  ],
  // The upstream `fleet setup` command does not exist in the vendor documentation,
  // and no documented flag supplies that password. Point at the documented web
  // setup screen instead of teaching an invented command with a secret in argv.
  "mdm-device-management": [
    [
      "docker compose exec fleet fleet setup \\\n  --email admin@yourcompany.com \\\n  --name \"IT Admin\" \\\n  --password \"${FLEET_ADMIN_PASSWORD}\" \\\n  --org-name \"YourCompany\"",
      "# Create the admin account in the Fleet web setup screen.\n# Open https://fleet.yourcompany.com:8080 in a browser.\n# Fleet documents this path: \"You'll see the Fleet setup screen. Follow the\n# prompts to: Create your first admin account\".\n# https://fleetdm.com/guides/deploy-fleet-on-docker-compose\n#\n# WARNING - do not pass the admin password on the command line.\n# fleetdm.com/docs documents no `fleet setup` command. It documents no password\n# prompt, no environment variable, and no config file for that command.\n# A command-line password is visible to every user on the host through `ps`.\n# The shell also writes it to history.\n# If you script account creation with a password flag, treat that password as\n# exposed. Rotate it after the first login.",
    ],
  ],
  // security(1): "-w password  Specify password to be added. Put at end of command
  // to be prompted (recommended)". A trailing -w with no value keeps the API key
  // out of argv.
  "openclaw-local-mac-mini": [
    [
      "# Store API keys in macOS Keychain instead of plaintext .env\nsecurity add-generic-password -a openclaw -s \"OPENAI_API_KEY\" -w \"sk-your-key-here\"\nsecurity add-generic-password -a openclaw -s \"ANTHROPIC_API_KEY\" -w \"sk-ant-your-key-here\"",
      "# Store API keys in macOS Keychain instead of plaintext .env\n# Put -w last. Give it no value. `security` then prompts for the key, and no\n# secret reaches argv.\n# security(1) states: \"-w password  Specify password to be added. Put at end of\n# command to be prompted (recommended)\".\n# The command prompts twice: \"password data for new item:\" and then \"retype\n# password for new item:\". It reads both prompts from stdin. An unattended\n# script therefore blocks unless it pipes the value in twice.\nsecurity add-generic-password -a openclaw -s \"OPENAI_API_KEY\" -w\nsecurity add-generic-password -a openclaw -s \"ANTHROPIC_API_KEY\" -w",
    ],
  ],
}

export const adaptSkill = ({
  raw,
  name,
  sourceRel,
  packId,
  commit,
  repository = UPSTREAM_REPOSITORY,
}) => {
  let text = raw.replace(/[ \t]+$/gm, '')
  for (const [from, to] of LOCAL_OVERRIDES[name] || []) {
    // Stop the refresh rather than drop the override silently. A reworded
    // upstream line needs a maintainer to re-target it.
    if (!text.includes(from)) throw new Error(`${sourceRel}: local override target missing: ${from}`)
    text = text.replaceAll(from, to)
  }
  const riskLevel = riskLevelFor(packId, name)
  text = text.replace(
    /^license:\s*MIT\s*$/m,
    `license: MIT
risk_level: ${riskLevel}
writes_files: true
requires_tools: []
source: ${repository}
source_commit: ${commit}`,
  )
  const heading = text.match(/^# .+$/m)?.[0]
  if (!heading) throw new Error(`${sourceRel}: missing H1`)
  text = text.replace(`${heading}\n`, `${heading}\n\n${SAFETY_GATE}\n`)
  text = rewriteRelativeLinks(text, sourceRel, repository, commit)
  const sourceUrl = `${repository}/blob/${commit}/${sourceRel}`
  return `${text.trimEnd()}

## Provenance

Adapted from [BagelHole/DevOps-Security-Agent-Skills](${sourceUrl}) at commit \`${commit}\`. Original content © 2026 Toby Miller, used under the MIT License. Agent Compass added metadata and the safety gate above.
`
}

const packBySkill = () => {
  const out = new Map()
  for (const id of ROOT_CAPABILITY_PACK_IDS) {
    for (const name of CAPABILITY_PACKS[id].skills) {
      if (out.has(name)) throw new Error(`root capability packs overlap at ${name}`)
      out.set(name, id)
    }
  }
  return out
}

export const discoverUpstreamSkills = (sourceRoot) => {
  const found = new Map()
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name)
      if (entry.isDirectory()) walk(full)
      else if (entry.name === 'SKILL.md') {
        const name = basename(dirname(full))
        if (found.has(name)) throw new Error(`duplicate upstream skill name: ${name}`)
        found.set(name, full)
      }
    }
  }
  for (const domain of ['devops', 'security', 'infrastructure', 'compliance']) {
    const dir = join(sourceRoot, domain)
    if (!existsSync(dir)) throw new Error(`missing upstream domain: ${dir}`)
    walk(dir)
  }
  return found
}

export const buildUpstreamSnapshot = ({
  sourceRoot,
  commit,
  repository = UPSTREAM_REPOSITORY,
}) => {
  const sources = discoverUpstreamSkills(sourceRoot)
  const packs = packBySkill()
  const names = [...rootCapabilitySkills()].sort()
  const skills = {}
  const contents = new Map()

  for (const name of names) {
    const source = sources.get(name)
    if (!source) throw new Error(`selected skill missing upstream: ${name}`)
    const sourceRel = relative(sourceRoot, source).replaceAll('\\', '/')
    const raw = readFileSync(source, 'utf8')
    const packId = packs.get(name)
    const adapted = adaptSkill({ raw, name, sourceRel, packId, commit, repository })
    contents.set(name, adapted)
    skills[name] = {
      source: sourceRel,
      pack: packId,
      riskLevel: riskLevelFor(packId, name),
      upstreamSha256: sha256(raw),
      localSha256: sha256(adapted),
      riskSignals: riskSignals(adapted),
    }
  }

  return {
    lock: {
      schema: 1,
      upstream: {
        repository,
        commit,
        license: 'MIT',
        copyright: 'Copyright (c) 2026 Toby Miller',
      },
      selection: {
        rootPacks: ROOT_CAPABILITY_PACK_IDS,
        skillCount: names.length,
      },
      transformation: {
        // 2: adaptSkill applies LOCAL_OVERRIDES.
        version: 2,
        safetyGateSha256: sha256(SAFETY_GATE),
      },
      skills,
    },
    contents,
  }
}

export const compareRiskBaselines = (before, after) => {
  const increases = []
  for (const [skill, next] of Object.entries(after?.skills || {})) {
    const prior = before?.skills?.[skill]?.riskSignals || {}
    for (const [signal, count] of Object.entries(next.riskSignals || {})) {
      const previous = prior[signal] || 0
      if (count > previous) increases.push({ skill, signal, before: previous, after: count })
    }
  }
  return increases
}

export const verifyLocalLock = (root, lock, expectedNames = rootCapabilitySkills()) => {
  const hits = []
  const lockedNames = Object.keys(lock?.skills || {}).sort()
  const expected = [...expectedNames].sort()
  if (JSON.stringify(lockedNames) !== JSON.stringify(expected)) {
    hits.push(`lock selection drift: expected ${expected.length}, locked ${lockedNames.length}`)
  }
  if (lock?.transformation?.safetyGateSha256 && lock.transformation.safetyGateSha256 !== sha256(SAFETY_GATE)) {
    hits.push('safety gate transformation drift')
  }

  for (const name of lockedNames) {
    const entry = lock.skills[name]
    const dir = join(root, 'skills', name)
    const file = join(dir, 'SKILL.md')
    if (!existsSync(file)) {
      hits.push(`${name}: missing local SKILL.md`)
      continue
    }
    const extras = readdirSync(dir).filter((item) => item !== 'SKILL.md')
    if (extras.length) hits.push(`${name}: executable/extra payloads present: ${extras.join(', ')}`)
    const text = readFileSync(file, 'utf8')
    if (sha256(text) !== entry.localSha256) hits.push(`${name}: local hash drift`)
    if (!text.includes(`source_commit: ${lock.upstream.commit}`)) hits.push(`${name}: source commit drift`)
    if (JSON.stringify(riskSignals(text)) !== JSON.stringify(entry.riskSignals)) hits.push(`${name}: risk signal drift`)
  }
  return hits
}

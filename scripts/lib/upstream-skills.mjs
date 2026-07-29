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

export const adaptSkill = ({
  raw,
  name,
  sourceRel,
  packId,
  commit,
  repository = UPSTREAM_REPOSITORY,
}) => {
  let text = raw.replace(/[ \t]+$/gm, '')
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
        version: 1,
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

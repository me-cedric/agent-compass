import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { dirname, join } from 'node:path'
import { tmpdir } from 'node:os'

export const SOURCE_REGISTRY_REL = 'skills/upstream-sources.json'

export const sha256 = (value) => createHash('sha256').update(value).digest('hex')

const treeHash = (rows) => sha256(rows
  .sort(([left], [right]) => left.localeCompare(right))
  .map(([key, value]) => `${key}\0${sha256(value)}`)
  .join('\n'))

const runGit = (args, options = {}) => {
  const result = spawnSync('git', args, { encoding: 'utf8', ...options })
  if (result.status !== 0) {
    const message = (result.stderr || result.stdout || 'git command failed').trim()
    throw new Error(message)
  }
  return (result.stdout || '').trim()
}

const runGitRaw = (args) => {
  const result = spawnSync('git', args, { encoding: 'utf8' })
  if (result.status !== 0) throw new Error((result.stderr || result.stdout || 'git command failed').trim())
  return result.stdout || ''
}

export const readSourceRegistry = (root) => JSON.parse(
  readFileSync(join(root, SOURCE_REGISTRY_REL), 'utf8'),
)

export const registrySkillNames = (registry) => new Set(
  Object.values(registry?.sources || {}).flatMap((source) => source.skills || []),
)

export const hashLocalAssets = (root, source, contents = null) => treeHash(
  (source.assets || []).map((asset) => {
    const value = contents?.get(asset.target) ?? readFileSync(join(root, asset.target))
    return [`${asset.source}\0${asset.target}`, value]
  }),
)

const gitShow = (checkout, commit, path) => runGitRaw(['-C', checkout, 'show', `${commit}:${path}`])

export const hashUpstreamAssets = (checkout, source, commit = source.commit) => treeHash(
  (source.assets || []).map((asset) => {
    let value
    try {
      value = gitShow(checkout, commit, asset.source)
    } catch {
      value = readFileSync(join(checkout, asset.source))
    }
    return [`${asset.source}\0${asset.target}`, value]
  }),
)

const externalSkillNames = (root) => {
  const names = new Set()
  const skillsDir = join(root, 'skills')
  if (!existsSync(skillsDir)) return names
  for (const entry of readdirSync(skillsDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    const file = join(skillsDir, entry.name, 'SKILL.md')
    if (!existsSync(file)) continue
    const text = readFileSync(file, 'utf8')
    const frontmatterSource = /^source:\s*https:\/\/github\.com\//m.test(text)
    const provenanceSource = /## Provenance[\s\S]*(?:Vendored|Adapted) from[\s\S]*https:\/\/github\.com\//i.test(text)
    if (frontmatterSource || provenanceSource) names.add(entry.name)
  }
  return names
}

export const verifySourceRegistry = (root, registry) => {
  const hits = []
  if (registry?.schema !== 1) hits.push('source registry schema must be 1')
  const targets = new Map()
  const skillOwners = new Map()
  const registeredSkills = registrySkillNames(registry)

  for (const [id, source] of Object.entries(registry?.sources || {})) {
    if (!/^https:\/\/github\.com\//.test(source.repository || '') && !existsSync(source.repository || '')) {
      hits.push(`${id}: invalid repository`)
    }
    if (!/^[a-f0-9]{40}$/i.test(source.commit || '')) hits.push(`${id}: invalid commit`)
    if (!['merge', 'operational'].includes(source.strategy)) hits.push(`${id}: invalid strategy`)
    for (const name of source.skills || []) {
      if (skillOwners.has(name)) hits.push(`${id}: duplicate skill ${name} (also ${skillOwners.get(name)})`)
      skillOwners.set(name, id)
      if (!existsSync(join(root, 'skills', name, 'SKILL.md'))) hits.push(`${id}: missing skill ${name}`)
    }
    for (const asset of source.assets || []) {
      if (!asset.source || !asset.target) {
        hits.push(`${id}: asset needs source and target`)
        continue
      }
      if (targets.has(asset.target)) hits.push(`${id}: duplicate target ${asset.target} (also ${targets.get(asset.target)})`)
      targets.set(asset.target, id)
      if (!existsSync(join(root, asset.target))) hits.push(`${id}: missing target ${asset.target}`)
    }
    if (source.strategy === 'merge') {
      if (!source.assets?.length) hits.push(`${id}: merge source has no assets`)
      if (!/^[a-f0-9]{64}$/i.test(source.upstreamSha256 || '')) hits.push(`${id}: invalid upstream tree hash`)
      if (!/^[a-f0-9]{64}$/i.test(source.localSha256 || '')) hits.push(`${id}: invalid local tree hash`)
      else if (source.assets?.every((asset) => existsSync(join(root, asset.target)))) {
        const actual = hashLocalAssets(root, source)
        if (actual !== source.localSha256) hits.push(`${id}: local tree hash drift`)
      }
    }
    if (source.strategy === 'operational') {
      const lockPath = join(root, source.lock || '')
      if (!source.lock || !existsSync(lockPath)) {
        hits.push(`${id}: missing operational lock`)
      } else {
        const lock = JSON.parse(readFileSync(lockPath, 'utf8'))
        if (lock.upstream?.repository !== source.repository) hits.push(`${id}: operational repository drift`)
        if (lock.upstream?.commit !== source.commit) hits.push(`${id}: operational commit drift`)
        const lockedSkills = Object.keys(lock.skills || {}).sort()
        const sourceSkills = [...(source.skills || [])].sort()
        if (JSON.stringify(lockedSkills) !== JSON.stringify(sourceSkills)) hits.push(`${id}: operational skill inventory drift`)
      }
    }
  }

  for (const name of externalSkillNames(root)) {
    if (!registeredSkills.has(name)) hits.push(`unregistered external skill: ${name}`)
  }
  return hits
}

export const remoteHead = (repository) => {
  const output = runGit(['ls-remote', repository, 'HEAD'])
  const commit = output.split(/\s+/)[0]
  if (!/^[a-f0-9]{40}$/i.test(commit || '')) throw new Error('remote HEAD did not return a commit')
  return commit
}

export const checkSourceUpdates = (registry, resolver = remoteHead) => {
  const updates = []
  const errors = []
  for (const [id, source] of Object.entries(registry?.sources || {})) {
    try {
      const latest = resolver(source.repository)
      if (latest !== source.commit) updates.push({
        id,
        repository: source.repository,
        current: source.commit,
        latest,
      })
    } catch (error) {
      errors.push({ id, repository: source.repository, message: error.message })
    }
  }
  return { updates, errors }
}

export const checkoutSource = (repository, commits) => {
  const root = mkdtempSync(join(tmpdir(), 'agent-compass-source-'))
  try {
    runGit(['-C', root, 'init', '-q'])
    runGit(['-C', root, 'remote', 'add', 'origin', repository])
    for (const commit of [...new Set(commits)]) {
      runGit(['-C', root, 'fetch', '-q', '--depth', '1', 'origin', commit])
    }
    runGit(['-C', root, 'checkout', '-q', '--detach', commits.at(-1)])
    return { root, cleanup: () => rmSync(root, { recursive: true, force: true }) }
  } catch (error) {
    rmSync(root, { recursive: true, force: true })
    throw error
  }
}

const mergeText = (current, base, next, labels) => {
  const root = mkdtempSync(join(tmpdir(), 'agent-compass-merge-'))
  try {
    const currentPath = join(root, 'current')
    const basePath = join(root, 'base')
    const nextPath = join(root, 'next')
    writeFileSync(currentPath, current)
    writeFileSync(basePath, base)
    writeFileSync(nextPath, next)
    const result = spawnSync('git', [
      'merge-file', '-p',
      '-L', labels.current,
      '-L', labels.base,
      '-L', labels.next,
      currentPath, basePath, nextPath,
    ], { encoding: 'utf8' })
    if (![0, 1].includes(result.status)) throw new Error((result.stderr || 'git merge-file failed').trim())
    return { text: result.stdout, conflict: result.status === 1 }
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
}

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

export const planMergeSourceUpdate = ({ root, source, latest }) => {
  const checkout = checkoutSource(source.repository, [source.commit, latest])
  try {
    const pinnedHash = hashUpstreamAssets(checkout.root, source, source.commit)
    if (pinnedHash !== source.upstreamSha256) {
      throw new Error(`pinned upstream tree hash drift: expected ${source.upstreamSha256}, got ${pinnedHash}`)
    }
    let nextVersion = source.version || null
    if (source.package?.manifest) {
      nextVersion = JSON.parse(gitShow(checkout.root, latest, source.package.manifest)).version
      if (!nextVersion) throw new Error(`${source.package.manifest}: missing package version`)
    }

    const outputs = new Map()
    const upstream = new Map()
    const conflicts = []
    for (const asset of source.assets || []) {
      const base = gitShow(checkout.root, source.commit, asset.source)
      const next = gitShow(checkout.root, latest, asset.source)
      const current = readFileSync(join(root, asset.target), 'utf8')
      let text = next
      let conflict = false
      if ((asset.mode || 'merge') === 'merge') {
        const merged = mergeText(current, base, next, {
          current: asset.target,
          base: `${asset.source}@${source.commit.slice(0, 7)}`,
          next: `${asset.source}@${latest.slice(0, 7)}`,
        })
        text = merged.text
        conflict = merged.conflict
      }
      text = text.replaceAll(source.commit, latest)
      if (source.package?.name && source.version && nextVersion) {
        const exactPackage = new RegExp(`${escapeRegExp(source.package.name)}@${escapeRegExp(source.version)}`, 'g')
        text = text.replace(exactPackage, `${source.package.name}@${nextVersion}`)
        text = text.replaceAll(`source_version: "${source.version}"`, `source_version: "${nextVersion}"`)
        text = text.replaceAll(`package version\n\`${source.version}\``, `package version\n\`${nextVersion}\``)
      }
      outputs.set(asset.target, text)
      upstream.set(asset.target, next)
      if (conflict) conflicts.push(asset.target)
    }

    const nextSource = {
      ...source,
      commit: latest,
      ...(nextVersion ? { version: nextVersion } : {}),
    }
    nextSource.upstreamSha256 = hashLocalAssets(root, nextSource, upstream)
    nextSource.localSha256 = hashLocalAssets(root, nextSource, outputs)
    return { outputs, conflicts, source: nextSource }
  } finally {
    checkout.cleanup()
  }
}

export const writeMergePlan = (root, plan) => {
  for (const [target, text] of plan.outputs) {
    const file = join(root, target)
    mkdirSync(dirname(file), { recursive: true })
    writeFileSync(file, text)
  }
}

export const writeConflictFiles = (root, plan) => {
  for (const target of plan.conflicts) {
    const file = join(root, `${target}.acnew`)
    mkdirSync(dirname(file), { recursive: true })
    writeFileSync(file, plan.outputs.get(target))
  }
}

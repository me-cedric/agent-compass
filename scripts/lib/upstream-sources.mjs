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
import { basename, dirname, join } from 'node:path'
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

const gitShow = (checkout, commit, path) => runGitRaw(['-C', checkout, 'show', `${commit}:${path}`])

export const SKILL_SLUG_RE = /^[a-z0-9][a-z0-9-]*$/

export const inventoryBlockKey = (id) => `${id}-inventory`

const frontmatterName = (text) => {
  const block = text.match(/^---\n([\s\S]*?)\n---/)
  if (!block) return null
  const name = block[1].match(/^name:\s*(.+)$/m)?.[1]
  return name ? name.trim().replace(/^["']|["']$/g, '') : null
}

// List every file in a Git tree under one prefix. Metadata only — nothing is
// checked out into the working tree and nothing upstream is executed.
export const treeFiles = (checkout, commit, prefix = '') => runGitRaw(
  ['-C', checkout, 'ls-tree', '-r', '--name-only', commit],
).split('\n').map((line) => line.trim()).filter((line) => line && line.startsWith(prefix))

const inventoryPrefix = (inventoryRoot) => (
  inventoryRoot === '.' || !inventoryRoot ? '' : `${inventoryRoot.replace(/\/$/, '')}/`
)

// Map each upstream skill to its slug and its directory. The slug is the
// frontmatter `name` when it is a usable slug, because that is the name an agent
// harness keys the skill by; the directory name is the fallback.
export const inventoryEntriesFromTree = (checkout, commit, inventoryRoot = '.') => {
  const prefix = inventoryPrefix(inventoryRoot)
  const entries = new Map()
  for (const path of treeFiles(checkout, commit, prefix)) {
    if (basename(path) !== 'SKILL.md') continue
    const declared = frontmatterName(gitShow(checkout, commit, path))
    const slug = declared && SKILL_SLUG_RE.test(declared) ? declared : basename(dirname(path))
    // A repository whose SKILL.md sits at the root has no directory to name it.
    const dir = dirname(path) === '.' ? '' : dirname(path)
    if (!entries.has(slug)) entries.set(slug, { slug, dir, file: path })
  }
  return [...entries.values()].sort((left, right) => left.slug.localeCompare(right.slug))
}

export const inventoryFromTree = (checkout, commit, inventoryRoot = '.') => inventoryEntriesFromTree(
  checkout, commit, inventoryRoot,
).map((entry) => entry.slug)

// The inventory body written into a pointer document. Six slugs per row keeps
// the diff readable when one upstream skill is added or renamed.
export const renderInventory = (slugs) => {
  const rows = []
  for (let index = 0; index < slugs.length; index += 6) {
    rows.push(`- ${slugs.slice(index, index + 6).map((slug) => `\`${slug}\``).join(', ')}`)
  }
  return `${slugs.length} tracked skill${slugs.length === 1 ? '' : 's'}:\n\n${rows.join('\n')}`
}

export const applyGeneratedBlock = (text, key, body) => {
  const start = `<!-- BEGIN GENERATED:${key} -->`
  const end = `<!-- END GENERATED:${key} -->`
  const from = text.indexOf(start)
  const to = text.indexOf(end)
  if (from === -1 || to === -1 || to < from) return null
  return `${text.slice(0, from + start.length)}\n${body}\n${text.slice(to)}`
}

export const hashLocalAssets = (root, source, contents = null) => treeHash(
  (source.assets || []).map((asset) => {
    const value = contents?.get(asset.target) ?? readFileSync(join(root, asset.target))
    return [`${asset.source}\0${asset.target}`, value]
  }),
)


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

// A reference source is tracked, never copied. Nothing upstream lands in the
// tree, so the local contract is the pointer set: the documents that tell an
// agent the source exists, how to install from it, and what it currently holds.
const verifyReferenceSource = (root, id, source) => {
  const hits = []
  if (source.assets?.length) hits.push(`${id}: reference source must not declare assets`)
  if (source.skills?.length) hits.push(`${id}: reference source must use upstreamSkills, not skills`)
  if (!source.install) hits.push(`${id}: reference source needs an install command`)
  const slugs = source.upstreamSkills || []
  if (!slugs.length) hits.push(`${id}: reference source has no upstreamSkills`)
  const invalid = slugs.filter((slug) => !SKILL_SLUG_RE.test(slug))
  if (invalid.length) hits.push(`${id}: invalid upstream skill slug ${invalid.join(', ')}`)
  if (JSON.stringify(slugs) !== JSON.stringify([...slugs].sort())) {
    hits.push(`${id}: upstreamSkills must be sorted`)
  }
  // `recommended` is Agent Compass's own curation of a source that holds more
  // than Agent Compass endorses. It must stay a subset of what the pin records,
  // so a skill that disappears upstream cannot keep being recommended.
  const recommended = source.recommended || []
  const unknown = recommended.filter((slug) => !slugs.includes(slug))
  if (unknown.length) hits.push(`${id}: recommended skill not in inventory: ${unknown.join(', ')}`)
  if (JSON.stringify(recommended) !== JSON.stringify([...recommended].sort())) {
    hits.push(`${id}: recommended must be sorted`)
  }
  if (!source.inventoryDoc) {
    hits.push(`${id}: reference source needs an inventoryDoc`)
    return hits
  }
  // A source whose skill drives a published package pins that version in prose.
  // Nothing else would notice the version going stale, so the pin is part of the
  // verified contract: every `<pkg>@<version>` written locally must be the
  // recorded one.
  if (source.package?.name && source.version) {
    const escaped = source.package.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const anyVersion = new RegExp(`${escaped}@(\\d[\\w.-]*)`, 'g')
    for (const pointer of [source.inventoryDoc, ...(source.pointers || [])]) {
      const file = join(root, pointer)
      if (!existsSync(file)) continue
      const text = readFileSync(file, 'utf8')
      const wrong = [...text.matchAll(anyVersion)]
        .map((match) => match[1])
        .filter((version) => version !== source.version)
      if (wrong.length) {
        hits.push(`${id}: ${pointer} pins ${source.package.name}@${[...new Set(wrong)].join(', ')} but the source records ${source.version}`)
      }
      if (/^tool_version:\s*"([^"]+)"/m.test(text)) {
        const declared = text.match(/^tool_version:\s*"([^"]+)"/m)[1]
        if (declared !== source.version) {
          hits.push(`${id}: ${pointer} declares tool_version ${declared} but the source records ${source.version}`)
        }
      }
    }
  }
  for (const pointer of [source.inventoryDoc, ...(source.pointers || [])]) {
    const file = join(root, pointer)
    if (!existsSync(file)) {
      hits.push(`${id}: missing pointer ${pointer}`)
      continue
    }
    const text = readFileSync(file, 'utf8')
    if (!text.includes(source.repository)) {
      hits.push(`${id}: pointer ${pointer} does not name ${source.repository}`)
    }
    if (pointer !== source.inventoryDoc) continue
    const applied = applyGeneratedBlock(text, inventoryBlockKey(id), renderInventory(slugs))
    if (applied === null) hits.push(`${id}: ${pointer} has no ${inventoryBlockKey(id)} block`)
    else if (applied !== text) hits.push(`${id}: ${pointer} inventory block is stale`)
  }
  return hits
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
    if (!['merge', 'operational', 'reference'].includes(source.strategy)) hits.push(`${id}: invalid strategy`)
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
    if (source.strategy === 'reference') {
      hits.push(...verifyReferenceSource(root, id, source))
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

// Refresh a tracked source without copying it. The pin moves, the recorded
// inventory is re-read from the new tree, and the pointer document's generated
// block is rewritten. No upstream file is written into the repository.
export const planReferenceSourceUpdate = ({ root, id, source, latest }) => {
  const checkout = checkoutSource(source.repository, [source.commit, latest])
  try {
    const pinned = inventoryFromTree(checkout.root, source.commit, source.inventoryRoot)
    const recorded = source.upstreamSkills || []
    if (JSON.stringify(pinned) !== JSON.stringify(recorded)) {
      throw new Error(`pinned inventory drift: ${recorded.length} recorded, ${pinned.length} in ${source.commit.slice(0, 7)}`)
    }
    const slugs = inventoryFromTree(checkout.root, latest, source.inventoryRoot)
    if (!slugs.length) throw new Error(`no SKILL.md found under ${source.inventoryRoot || '.'} at ${latest.slice(0, 7)}`)
    const before = new Set(recorded)
    const after = new Set(slugs)
    const added = slugs.filter((slug) => !before.has(slug))
    const removed = recorded.filter((slug) => !after.has(slug))

    // A tracked published package moves independently of the skill text, so read
    // the new version and carry it into every place the pin is written.
    let nextVersion = source.version || null
    if (source.package?.manifest) {
      nextVersion = JSON.parse(gitShow(checkout.root, latest, source.package.manifest)).version
      if (!nextVersion) throw new Error(`${source.package.manifest}: missing package version`)
    }

    const outputs = new Map()
    const rewritePin = (text) => {
      if (!source.package?.name || !source.version || nextVersion === source.version) return text
      const escaped = source.package.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      return text
        .replace(new RegExp(`${escaped}@${source.version.replace(/\./g, '\\.')}`, 'g'), `${source.package.name}@${nextVersion}`)
        .replace(/^tool_version:\s*"[^"]+"/m, `tool_version: "${nextVersion}"`)
    }

    for (const pointer of [source.inventoryDoc, ...(source.pointers || [])]) {
      const file = join(root, pointer)
      if (!existsSync(file)) continue
      const text = readFileSync(file, 'utf8')
      let next = rewritePin(text)
      if (pointer === source.inventoryDoc) {
        const applied = applyGeneratedBlock(next, inventoryBlockKey(id), renderInventory(slugs))
        if (applied === null) throw new Error(`${source.inventoryDoc}: no ${inventoryBlockKey(id)} block`)
        next = applied
      }
      if (next !== text) outputs.set(pointer, next)
    }

    return {
      outputs,
      added,
      removed,
      version: nextVersion,
      source: {
        ...source,
        commit: latest,
        upstreamSkills: slugs,
        ...(nextVersion ? { version: nextVersion } : {}),
      },
    }
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

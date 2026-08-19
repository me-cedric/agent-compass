#!/usr/bin/env node
// Verify, check, or refresh pinned external skill sources. Remote checks are
// read-only and cached. Refresh is explicit, stages content in a temporary Git
// checkout, and never executes upstream files.

import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { parseCliArgs, resolveRoot } from './lib/args.mjs'
import {
  UPSTREAM_REPOSITORY,
  buildUpstreamSnapshot,
  compareRiskBaselines,
  verifyLocalLock,
} from './lib/upstream-skills.mjs'
import {
  checkSourceUpdates,
  checkoutSource,
  planMergeSourceUpdate,
  readSourceRegistry,
  remoteHead,
  verifySourceRegistry,
  writeConflictFiles,
  writeMergePlan,
} from './lib/upstream-sources.mjs'

const AC = dirname(dirname(fileURLToPath(import.meta.url)))
const { values, positionals } = parseCliArgs({
  name: 'upstream-skills',
  script: 'upstream-skills.mjs',
  summary: `Verify pinned external skills, check every source for updates, or
refresh reviewed content. Checks are cached for 24 hours. Refresh never executes
upstream files.`,
  positionals: [{ name: 'root', required: false }],
  options: {
    verify: { type: 'boolean', desc: 'Verify local files against source registries (default).' },
    'check-updates': { type: 'boolean', desc: 'Compare every pinned source with remote HEAD.' },
    update: { type: 'string', value: '<source|all>', desc: 'Refresh one source or all stale sources from remote HEAD.' },
    source: { type: 'string', value: '<dir>', desc: 'Local operational-corpus checkout used for dry-run or refresh.' },
    refresh: { type: 'boolean', desc: 'Write adapted operational skills and locks from --source.' },
    dry: { type: 'boolean', desc: 'Show a refresh result; write nothing.' },
    force: { type: 'boolean', desc: 'Ignore the 24-hour remote-check cache.' },
    quiet: { type: 'boolean', desc: 'Print nothing when all sources are current.' },
    json: { type: 'boolean', desc: 'Print remote-check result as JSON.' },
    strict: { type: 'boolean', desc: 'Exit 1 when a source is stale or a remote check fails.' },
    'accept-risk': { type: 'boolean', desc: 'Accept increased dangerous-pattern counts during operational refresh.' },
  },
})

const root = resolveRoot(positionals)
const lockPath = join(root, 'skills', 'upstream-lock.json')
const registryPath = join(root, 'skills', 'upstream-sources.json')
const cachePath = join(root, '.agent', '.upstream-source-check.json')
const TTL_MS = 24 * 60 * 60 * 1000
const readJson = (path) => {
  try { return JSON.parse(readFileSync(path, 'utf8')) } catch { return null }
}
const readLock = () => readJson(lockPath)
const readRegistry = () => {
  try { return readSourceRegistry(root) } catch { return null }
}
const writeRegistry = (registry) => writeFileSync(registryPath, `${JSON.stringify(registry, null, 2)}\n`)

const checkUpdates = () => {
  const registry = readRegistry()
  if (!registry) {
    console.error(`Missing ${registryPath}.`)
    process.exit(1)
  }
  const cache = readJson(cachePath)
  const fresh = cache?.lastCheck && Date.parse(cache.lastCheck) > Date.now() - TTL_MS
  let result = cache
  if (values.force || !fresh) {
    result = {
      lastCheck: new Date().toISOString(),
      ...checkSourceUpdates(registry),
    }
    try {
      mkdirSync(dirname(cachePath), { recursive: true })
      writeFileSync(cachePath, `${JSON.stringify(result, null, 2)}\n`)
    } catch {}
  }
  if (values.json) {
    console.log(JSON.stringify(result, null, 2))
  } else {
    if (result.updates.length) {
      const list = result.updates
        .map((item) => `${item.id} ${item.current.slice(0, 7)}..${item.latest.slice(0, 7)}`)
        .join(', ')
      console.log(`external skill updates available: ${list} — run: agent-compass upstream-skills --update <source|all>`)
    } else if (!values.quiet) {
      console.log(`verified remote heads for ${Object.keys(registry.sources).length} external skill sources; all current`)
    }
    if (result.errors.length && !values.quiet) {
      result.errors.forEach((item) => console.error(`remote check skipped for ${item.id}: ${item.message}`))
    }
  }
  if (values.strict && (result.updates.length || result.errors.length)) process.exit(1)
  process.exit(0)
}

const planOperationalUpdate = ({ source, latest }) => {
  const before = readJson(join(root, source.lock))
  if (!before) throw new Error(`${source.lock}: missing operational lock`)
  const checkout = checkoutSource(source.repository, [latest])
  try {
    const snapshot = buildUpstreamSnapshot({
      sourceRoot: checkout.root,
      commit: latest,
      repository: source.repository,
    })
    const increases = compareRiskBaselines(before, snapshot.lock)
    return { type: 'operational', source: { ...source, commit: latest }, snapshot, increases }
  } finally {
    checkout.cleanup()
  }
}

const updateSources = () => {
  const registry = readRegistry()
  if (!registry) {
    console.error(`Missing ${registryPath}.`)
    process.exit(1)
  }
  const registryHits = verifySourceRegistry(root, registry)
  if (registryHits.length) {
    registryHits.forEach((hit) => console.error(`- ${hit}`))
    console.error('Refusing refresh until local source-registry drift is resolved.')
    process.exit(1)
  }
  const requested = values.update === 'all' ? Object.keys(registry.sources) : [values.update]
  const unknown = requested.filter((id) => !registry.sources[id])
  if (unknown.length) {
    console.error(`Unknown source: ${unknown.join(', ')}. Known: ${Object.keys(registry.sources).join(', ')}`)
    process.exit(1)
  }

  const plans = []
  try {
    for (const id of requested) {
      const source = registry.sources[id]
      const latest = remoteHead(source.repository)
      if (latest === source.commit) continue
      const plan = source.strategy === 'operational'
        ? planOperationalUpdate({ source, latest })
        : { type: 'merge', ...planMergeSourceUpdate({ root, source, latest }) }
      plans.push({ id, latest, ...plan })
    }
  } catch (error) {
    console.error(`Source refresh failed: ${error.message}`)
    process.exit(1)
  }

  if (!plans.length) {
    console.log('all requested external skill sources are current')
    process.exit(0)
  }
  const conflicts = plans.filter((plan) => plan.conflicts?.length)
  if (conflicts.length) {
    if (!values.dry) conflicts.forEach((plan) => writeConflictFiles(root, plan))
    for (const plan of conflicts) {
      console.error(`${plan.id}: merge conflict in ${plan.conflicts.join(', ')}`)
      if (!values.dry) console.error(`${plan.id}: review the matching .acnew file; source pin was not changed`)
    }
    process.exit(1)
  }
  const riskIncreases = plans.flatMap((plan) => (plan.increases || []).map((item) => ({ id: plan.id, ...item })))
  if (riskIncreases.length && !values['accept-risk']) {
    console.error('Dangerous-pattern counts increased:')
    riskIncreases.forEach((item) => console.error(`- ${item.id}/${item.skill}: ${item.signal} ${item.before} -> ${item.after}`))
    console.error('Review changes, then re-run with --accept-risk if intentional.')
    process.exit(1)
  }

  for (const plan of plans) {
    const changed = plan.type === 'merge' ? plan.outputs.size : plan.snapshot.contents.size
    console.log(`${plan.id}: ${registry.sources[plan.id].commit.slice(0, 7)} -> ${plan.latest.slice(0, 7)} (${changed} tracked files)`)
  }
  if (values.dry) {
    console.log('dry-run: no files written')
    process.exit(0)
  }

  for (const plan of plans) {
    if (plan.type === 'merge') {
      writeMergePlan(root, plan)
    } else {
      for (const [name, text] of plan.snapshot.contents) {
        const file = join(root, 'skills', name, 'SKILL.md')
        mkdirSync(dirname(file), { recursive: true })
        writeFileSync(file, text)
      }
      writeFileSync(join(root, registry.sources[plan.id].lock), `${JSON.stringify(plan.snapshot.lock, null, 2)}\n`)
    }
    registry.sources[plan.id] = plan.source
  }
  writeRegistry(registry)
  rmSync(cachePath, { force: true })
  console.log(`refreshed ${plans.length} external skill source(s)`)
  process.exit(0)
}

if (values['check-updates']) checkUpdates()
if (values.update) updateSources()

if (!values.source) {
  if (values.refresh) {
    console.error('--refresh requires --source <local-checkout>.')
    process.exit(1)
  }
  const lock = readLock()
  const registry = readRegistry()
  if (!lock || !registry) {
    console.error(`Missing ${!lock ? lockPath : registryPath}.`)
    process.exit(1)
  }
  const hits = [...verifyLocalLock(root, lock), ...verifySourceRegistry(root, registry)]
  if (hits.length) {
    hits.forEach((hit) => console.error(`- ${hit}`))
    process.exit(1)
  }
  console.log(`verified ${Object.keys(lock.skills).length} locked skills and ${Object.keys(registry.sources).length} source pins at ${lock.upstream.commit}`)
  process.exit(0)
}

const sourceRoot = resolve(values.source)
if (!existsSync(sourceRoot)) {
  console.error(`Source checkout not found: ${sourceRoot}`)
  process.exit(1)
}
const git = spawnSync('git', ['-C', sourceRoot, 'rev-parse', 'HEAD'], { encoding: 'utf8' })
if (git.status !== 0 || !/^[a-f0-9]{40}$/i.test(git.stdout.trim())) {
  console.error(`Cannot resolve source checkout commit: ${git.stderr.trim()}`)
  process.exit(1)
}
const commit = git.stdout.trim()
const before = readLock()
const registry = readRegistry()
const repository = before?.upstream?.repository || UPSTREAM_REPOSITORY
let snapshot
try {
  snapshot = buildUpstreamSnapshot({ sourceRoot, commit, repository })
} catch (error) {
  console.error(error.message)
  process.exit(1)
}

const increases = before ? compareRiskBaselines(before, snapshot.lock) : []
if (increases.length) {
  console.error('Dangerous-pattern counts increased:')
  increases.forEach((item) => console.error(`- ${item.skill}: ${item.signal} ${item.before} -> ${item.after}`))
  if (!values['accept-risk']) {
    console.error('Review changes, then re-run with --accept-risk if intentional.')
    process.exit(1)
  }
}

const changed = [...snapshot.contents].filter(([name, text]) => {
  const file = join(root, 'skills', name, 'SKILL.md')
  return !existsSync(file) || readFileSync(file, 'utf8') !== text
}).map(([name]) => name)
const lockChanged = JSON.stringify(before) !== JSON.stringify(snapshot.lock)

console.log(`source commit: ${commit}`)
console.log(`skill changes: ${changed.length}`)
if (changed.length) console.log(changed.join(', '))
console.log(`lock change: ${lockChanged ? 'yes' : 'no'}`)

if (!values.refresh || values.dry) {
  console.log('dry-run: no files written')
  process.exit(0)
}

for (const [name, text] of snapshot.contents) {
  const file = join(root, 'skills', name, 'SKILL.md')
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, text)
}
writeFileSync(lockPath, `${JSON.stringify(snapshot.lock, null, 2)}\n`)
if (registry?.sources?.['devops-security']) {
  registry.sources['devops-security'].commit = commit
  writeRegistry(registry)
}
rmSync(cachePath, { force: true })
console.log(`refreshed ${snapshot.contents.size} skills and ${lockPath}`)

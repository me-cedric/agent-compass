#!/usr/bin/env node
// Verify, check, or refresh pinned external skill sources. Remote checks are
// read-only and cached. Refresh is explicit, stages content in a temporary Git
// checkout, and never executes upstream files.

import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { parseCliArgs, resolveRoot } from './lib/args.mjs'
import {
  checkSourceUpdates,
  planMergeSourceUpdate,
  planReferenceSourceUpdate,
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
    dry: { type: 'boolean', desc: 'Show a refresh result; write nothing.' },
    force: { type: 'boolean', desc: 'Ignore the 24-hour remote-check cache.' },
    quiet: { type: 'boolean', desc: 'Print nothing when all sources are current.' },
    json: { type: 'boolean', desc: 'Print remote-check result as JSON.' },
    strict: { type: 'boolean', desc: 'Exit 1 when a source is stale or a remote check fails.' },
  },
})

const root = resolveRoot(positionals)
const registryPath = join(root, 'skills', 'upstream-sources.json')
const cachePath = join(root, '.agent', '.upstream-source-check.json')
const TTL_MS = 24 * 60 * 60 * 1000
const readJson = (path) => {
  try { return JSON.parse(readFileSync(path, 'utf8')) } catch { return null }
}
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
      const plan = source.strategy === 'reference'
        ? { type: 'reference', ...planReferenceSourceUpdate({ root, id, source, latest }) }
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
    const from = registry.sources[plan.id].commit.slice(0, 7)
    const to = plan.latest.slice(0, 7)
    if (plan.type === 'reference') {
      const delta = [
        plan.added.length ? `+${plan.added.length}` : null,
        plan.removed.length ? `-${plan.removed.length}` : null,
      ].filter(Boolean).join(' ') || 'inventory unchanged'
      console.log(`${plan.id}: ${from} -> ${to} (tracked only, no file copied; ${delta})`)
      if (plan.added.length) console.log(`${plan.id}: new upstream skills: ${plan.added.join(', ')}`)
      if (plan.removed.length) console.log(`${plan.id}: upstream skills gone: ${plan.removed.join(', ')}`)
      continue
    }
    console.log(`${plan.id}: ${from} -> ${to} (${plan.outputs.size} tracked files)`)
  }
  if (values.dry) {
    console.log('dry-run: no files written')
    process.exit(0)
  }

  for (const plan of plans) {
    writeMergePlan(root, plan)
    registry.sources[plan.id] = plan.source
  }
  writeRegistry(registry)
  rmSync(cachePath, { force: true })
  console.log(`refreshed ${plans.length} external skill source(s)`)
  process.exit(0)
}

if (values['check-updates']) checkUpdates()
if (values.update) updateSources()

const registry = readRegistry()
if (!registry) {
  console.error(`Missing ${registryPath}.`)
  process.exit(1)
}
const hits = verifySourceRegistry(root, registry)
if (hits.length) {
  hits.forEach((hit) => console.error(`- ${hit}`))
  process.exit(1)
}
const counts = Object.values(registry.sources).reduce((acc, source) => {
  acc[source.strategy] = (acc[source.strategy] || 0) + 1
  return acc
}, {})
const tracked = Object.values(registry.sources).reduce(
  (total, source) => total + (source.upstreamSkills?.length || 0), 0,
)
console.log(`verified ${Object.keys(registry.sources).length} source pins (${Object.entries(counts).map(([k, v]) => `${v} ${k}`).join(', ')}) covering ${tracked} tracked upstream skills`)
process.exit(0)

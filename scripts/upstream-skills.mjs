#!/usr/bin/env node
// Verify or refresh vendored operational skill knowledge from an explicitly
// supplied local checkout. This command never fetches or monitors remote state.

import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { parseCliArgs, resolveRoot } from './lib/args.mjs'
import {
  UPSTREAM_REPOSITORY,
  buildUpstreamSnapshot,
  compareRiskBaselines,
  verifyLocalLock,
} from './lib/upstream-skills.mjs'

const AC = dirname(dirname(fileURLToPath(import.meta.url)))
const { values, positionals } = parseCliArgs({
  name: 'upstream-skills',
  script: 'upstream-skills.mjs',
  summary: `Verify the pinned operational-skill lock, or refresh it from a local
upstream checkout. Never fetches or monitors remote state.`,
  positionals: [{ name: 'root', required: false }],
  options: {
    verify: { type: 'boolean', desc: 'Verify local files against skills/upstream-lock.json (default).' },
    source: { type: 'string', value: '<dir>', desc: 'Local upstream checkout used for dry-run or refresh.' },
    refresh: { type: 'boolean', desc: 'Write adapted skills and a new lock from --source.' },
    dry: { type: 'boolean', desc: 'Compare --source with local lock; write nothing.' },
    'accept-risk': { type: 'boolean', desc: 'Accept increased dangerous-pattern counts during refresh.' },
  },
})

const root = resolveRoot(positionals)
const lockPath = join(root, 'skills', 'upstream-lock.json')
const readLock = () => {
  try { return JSON.parse(readFileSync(lockPath, 'utf8')) } catch { return null }
}

if (!values.source) {
  if (values.refresh) {
    console.error('--refresh requires --source <local-checkout>.')
    process.exit(1)
  }
  const lock = readLock()
  if (!lock) {
    console.error(`Missing ${lockPath}. Provide --source <local-checkout> --refresh to create it.`)
    process.exit(1)
  }
  const hits = verifyLocalLock(root, lock)
  if (hits.length) {
    hits.forEach((hit) => console.error(`- ${hit}`))
    process.exit(1)
  }
  console.log(`verified ${Object.keys(lock.skills).length} locked skills at ${lock.upstream.commit}`)
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
writeFileSync(lockPath, JSON.stringify(snapshot.lock, null, 2) + '\n')
console.log(`refreshed ${snapshot.contents.size} skills and ${lockPath}`)

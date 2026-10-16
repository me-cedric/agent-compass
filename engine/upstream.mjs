// upstream.mjs — pinned upstream skill sources (upstream.json) and their user cache.
// A source installs into a host only when .agents/compass.json lists its id in "upstream".
// An optional "stacks" list on a source names the stacks that it fits. assets.mjs recommends it for those stacks only.
// The cache key is the commit sha, so a cached source never changes and a second fetch does nothing.

import { existsSync, mkdirSync, renameSync, rmSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { isDir, isObj, readJson, run, safeRel } from './util.mjs'

export const UPSTREAM = 'upstream.json'
const SHA = /^[0-9a-f]{40}$/
const REPO = /^(https:\/\/|file:\/\/|\/)/

export const cacheRoot = () => process.env.AC_CACHE ||
  join(process.env.XDG_CACHE_HOME || join(homedir(), '.cache'), 'agent-compass', 'upstream')

export const sourceDir = (id, src) => join(cacheRoot(), id, src.sha)

export const loadUpstream = (AC) => {
  if (!existsSync(join(AC, UPSTREAM))) return { sources: {}, errors: [] }
  const data = readJson(join(AC, UPSTREAM))
  if (!isObj(data) || !isObj(data.sources)) return { sources: {}, errors: [`${UPSTREAM}: "sources" must be an object`] }
  const errors = []
  for (const [id, s] of Object.entries(data.sources)) {
    const ok = /^[a-z0-9-]+$/.test(id) && isObj(s) && REPO.test(s.repo) && SHA.test(s.sha) && typeof s.licence === 'string' &&
      Array.isArray(s.skills) && s.skills.length > 0 && s.skills.every((e) => e === '.' || safeRel(e)) &&
      (s.stacks === undefined || (Array.isArray(s.stacks) && s.stacks.every((x) => typeof x === 'string')))
    if (!ok) errors.push(`${UPSTREAM}: source "${id}" needs a repo (an https URL or a local path), a 40-character sha, a licence and a list of skills (and a list of stack ids, if any)`)
  }
  return { sources: errors.length ? {} : data.sources, errors }
}

const fetchOne = (id, src) => {
  const dir = sourceDir(id, src)
  if (isDir(dir)) return null
  const tmp = `${dir}.part-${process.pid}`
  rmSync(tmp, { recursive: true, force: true })
  mkdirSync(tmp, { recursive: true })
  const steps = [
    ['init', '--quiet'],
    ['fetch', '--quiet', '--depth', '1', '--no-tags', src.repo, src.sha],
    ['-c', 'advice.detachedHead=false', 'checkout', '--quiet', src.sha],
  ]
  for (const args of steps) {
    const r = run('git', ['-C', tmp, ...args], { timeout: 120_000 })
    if (!r.ok) {
      rmSync(tmp, { recursive: true, force: true })
      return `upstream ${id}: the fetch failed (${r.err.split('\n')[0] || 'no output'}); the installed copy stays as it is`
    }
  }
  rmSync(join(tmp, '.git'), { recursive: true, force: true })
  try { renameSync(tmp, dir) } catch (err) {
    rmSync(tmp, { recursive: true, force: true })
    if (!isDir(dir)) return `upstream ${id}: ${err.message}`
  }
  return null
}

// Fetch the listed sources that are not in the cache. A failure is a warning: offline work goes on.
export const fetchUpstream = (AC, ids) => {
  const { sources } = loadUpstream(AC)
  return ids.filter((id) => Object.hasOwn(sources, id)).map((id) => fetchOne(id, sources[id])).filter(Boolean)
}

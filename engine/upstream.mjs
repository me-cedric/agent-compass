// upstream.mjs — pinned upstream skill sources (upstream.json) and their user cache.
// A source installs into a host only when .agents/compass.json lists its id in "upstream".
// An optional "stacks" list on a source names the stacks that it fits. assets.mjs recommends it for those stacks only.
// An optional "recommend": "user" (the compass-user plugin covers it) or "manual" (a large set) keeps it out of the recommended set.
// An optional "licenceText" holds the licence for a repository that has no licence file; the engine writes it as LICENSE beside each skill.
// The cache key is the commit sha, so a cached source never changes and a second fetch does nothing.
// A fetched text file with hidden Unicode (bidi controls, zero-width or tag characters) stops the sync: the text can hide
// instructions from a reviewer. A byte order mark at the start of a file is allowed.

import { existsSync, mkdirSync, readFileSync, renameSync, rmSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { isDir, isObj, readJson, run, safeRel, walk } from './util.mjs'

export const UPSTREAM = 'upstream.json'
const SHA = /^[0-9a-f]{40}$/
const REPO = /^(https:\/\/|file:\/\/|\/|[A-Za-z]:[\\/])/
// Bidi controls can reverse what the model reads; tag characters can hide an instruction. The zero-width characters
// (U+200B to U+200D, U+2060) stay allowed: they come from copied web text, scripts and emoji sequences, and they hide nothing.
const HIDDEN = /[\u202A-\u202E\u2066-\u2069\u200E\u200F\u{E0000}-\u{E007F}]|(?<!^)\uFEFF/u

// The files of the listed skill dirs of a fetched tree that hold hidden Unicode. A file with a NUL byte is binary and is not checked.
// Other files of the repository are not installed, so they are not checked.
export const hiddenText = (dir, skills = ['.']) => walk(dir).filter((rel) => skills.some((s) => s === '.' || rel === s || rel.startsWith(`${s}/`) || rel.split('/').includes(s))).filter((rel) => {
  const buf = readFileSync(join(dir, rel))
  return !buf.includes(0) && HIDDEN.test(buf.toString('utf8'))
})

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
      (s.stacks === undefined || (Array.isArray(s.stacks) && s.stacks.every((x) => typeof x === 'string'))) &&
      (s.recommend === undefined || ['user', 'manual'].includes(s.recommend)) &&
      (s.licenceText === undefined || (typeof s.licenceText === 'string' && s.licenceText.trim() !== ''))
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
  const hidden = hiddenText(tmp, src.skills)
  if (hidden.length) {
    rmSync(tmp, { recursive: true, force: true })
    // A warning for this source only: the other sources install, and this one stays out of the cache.
    return `upstream ${id}: ${hidden.join(', ')} ${hidden.length > 1 ? 'hold' : 'holds'} hidden Unicode characters (bidi or tag); compass does not install the source`
  }
  try { renameSync(tmp, dir) } catch (err) {
    rmSync(tmp, { recursive: true, force: true })
    if (!isDir(dir)) return `upstream ${id}: ${err.message}`
  }
  return null
}

// Fetch the listed sources that are not in the cache. A failed fetch is a warning: offline work goes on.
// A source with hidden Unicode is an error and stays out of the cache.
export const fetchUpstream = (AC, ids) => {
  const { sources } = loadUpstream(AC)
  const results = ids.filter((id) => Object.hasOwn(sources, id)).map((id) => fetchOne(id, sources[id])).filter(Boolean)
  return { warnings: results.filter((r) => typeof r === 'string'), errors: results.filter((r) => r.error).map((r) => r.error) }
}

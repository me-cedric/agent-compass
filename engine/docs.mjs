// docs.mjs — the docs layout checks of `ac check`: the RAID register, the ADRs, a root specs/ folder,
// the screens registry, the OpenSpec changes (changes.mjs) and the OpenSpec CLI. Konvoy reads these files (docs/contract/ownership.md). Read only.

import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { basename, dirname, join } from 'node:path'
import { checkChanges } from './changes.mjs'
import { projectPaths } from './config.mjs'
import { frontmatter, isDir, isObj, run, walk } from './util.mjs'

// The Konvoy RAID codec (Konvoy src/lib/raid.ts): nine keys in this order, two closed vocabularies.
export const RAID_KEYS = ['id', 'kind', 'status', 'raisedAt', 'raisedBy', 'owner', 'specRef', 'taskRef', 'ticket']
export const KINDS = ['question', 'risk', 'assumption', 'issue', 'dependency']
export const STATUSES = ['open', 'assigned', 'answered', 'folded']
export const SCREENS_SEED = '{\n  "version": 1,\n  "screens": []\n}\n'

export const questionsDir = (paths) => `${paths.delivery}/questions`
export const screensFile = (paths) => `${paths.designs}/screens.json`
// 000-template.md, adr-template.md and template*.md are templates, not decisions.
export const isTemplate = (name) => /^(0+-|adr-)?template/i.test(name)
export const isFence = (line) => /^\s{0,3}(```|~~~)/.test(line)

const MADR_STATUS = /^(proposed|accepted|rejected|deprecated|superseded)\b/i
const SCREEN_ID = /^SCR-\d{3,}$/
const SCREEN_TAG = /^\s*(?:[-*+]\s+)?(?:\*\*|__)?Screens?(?:\*\*|__)?:(?:\*\*|__)?\s*(.+?)\s*$/

const read = (root, rel) => readFileSync(join(root, rel), 'utf8').replace(/^﻿/, '')
const strings = (v) => Array.isArray(v) && v.every((s) => typeof s === 'string' && s.trim() !== '')

const checkRaid = (root, paths, out) => {
  const dir = questionsDir(paths)
  if (!isDir(join(root, dir))) return
  const files = readdirSync(join(root, dir), { withFileTypes: true }).filter((e) => e.isFile() && /\.(md|markdown)$/i.test(e.name))
  for (const name of files.map((e) => e.name).sort()) {
    const rel = `${dir}/${name}`
    if (!/^Q-\d{3,}\.md$/.test(name)) { out.warnings.push(`${rel}: the name of a RAID file is Q-NNN.md; Konvoy shows this file as a draft`); continue }
    const { data } = frontmatter(read(root, rel))
    const keys = Object.keys(data).filter((k) => RAID_KEYS.includes(k))
    const missing = RAID_KEYS.filter((k) => !keys.includes(k))
    if (missing.length) out.errors.push(`${rel}: the frontmatter needs the keys ${missing.join(', ')}`)
    else if (keys.join() !== RAID_KEYS.join()) out.errors.push(`${rel}: write the frontmatter keys in this order: ${RAID_KEYS.join(', ')}`)
    if ('id' in data && data.id !== name.slice(0, -3)) out.errors.push(`${rel}: the id must be ${name.slice(0, -3)}, the same as the file name`)
    if ('kind' in data && !KINDS.includes(data.kind.toLowerCase())) out.errors.push(`${rel}: kind "${data.kind}" is not one of ${KINDS.join(', ')}`)
    if ('status' in data && !STATUSES.includes(data.status.toLowerCase())) out.errors.push(`${rel}: status "${data.status}" is not one of ${STATUSES.join(', ')}`)
  }
}

const checkAdrs = (root, paths, out) => {
  const numbers = new Map()
  for (const rel of walk(join(root, paths.adr)).filter((f) => /\.(md|markdown)$/i.test(f))) {
    const name = basename(rel)
    if (/^(readme|index)\.(md|markdown)$/i.test(name) || isTemplate(name)) continue
    const path = `${paths.adr}/${rel}`
    const m = /^(\d{4})-[a-z0-9]+(?:-[a-z0-9]+)*\.md$/.exec(name)
    if (!m) { out.errors.push(`${path}: the name of an ADR is NNNN-slug.md (four digits, then a lower-case slug)`); continue }
    numbers.set(m[1], [...(numbers.get(m[1]) || []), path])
    const { data } = frontmatter(read(root, path))
    if (!MADR_STATUS.test(data.status || '')) out.errors.push(`${path}: the MADR frontmatter needs "status": proposed, accepted, rejected, deprecated or superseded`)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data.date || '')) out.errors.push(`${path}: the MADR frontmatter needs "date" as YYYY-MM-DD`)
  }
  for (const [n, list] of numbers) if (list.length > 1) out.errors.push(`ADR number ${n} is in more than one file: ${list.join(', ')}`)
}

const checkRootSpecs = (root, paths, out) => {
  if (!isDir(join(root, 'specs')) || paths.openspec === 'specs' || paths.openspec.startsWith('specs/')) return
  out.warnings.push(`specs/ is at the project root, but Konvoy reads specs only from ${paths.openspec}; run "ac migrate --docs --dry" for a plan`)
}

// `Screen: SCR-014` or `Screen: login, SCR-015` lines in the specs, outside code fences.
export const screenTags = (root, paths) => {
  const tags = []
  for (const rel of walk(join(root, paths.openspec)).filter((f) => f.endsWith('.md') && !/^(schemas|inbox)\//.test(f))) {
    const path = `${paths.openspec}/${rel}`
    let fenced = false
    read(root, path).split(/\r?\n/).forEach((line, i) => {
      if (isFence(line)) { fenced = !fenced; return }
      const m = !fenced && SCREEN_TAG.exec(line)
      if (m) tags.push({ path, line: i + 1, values: m[1].split(',').map((v) => v.trim().replace(/^[`*]+|[`*]+$/g, '')).filter(Boolean) })
    })
  }
  return tags
}

const checkScreens = (root, paths, out) => {
  const file = screensFile(paths)
  const tags = screenTags(root, paths)
  let data
  try {
    data = JSON.parse(read(root, file))
  } catch (err) {
    if (err.code !== 'ENOENT') out.errors.push(`${file}: ${err.message}`)
    else if (tags.length) out.errors.push(`the specs have ${tags.length} "Screen:" tag(s), but ${file} does not exist`)
    return
  }
  if (!isObj(data) || !Array.isArray(data.screens)) { out.errors.push(`${file}: the file must hold an object with a "screens" list`); return }
  const ids = new Set()
  const aliases = new Map()
  data.screens.forEach((s, i) => {
    const at = `${file}: screens[${i}]`
    if (!isObj(s) || typeof s.id !== 'string' || !SCREEN_ID.test(s.id)) { out.errors.push(`${at}: "id" must be SCR- and three or more digits`); return }
    if (ids.has(s.id)) out.errors.push(`${at}: the id ${s.id} is in the registry more than once`)
    ids.add(s.id)
    for (const k of ['aliases', 'stories', 'specRefs']) if (s[k] !== undefined && !strings(s[k])) out.errors.push(`${at}: "${k}" must be a list of strings`)
    if (s.route !== undefined && typeof s.route !== 'string') out.errors.push(`${at}: "route" must be a string`)
    if (s.figma !== undefined && !(isObj(s.figma) && typeof s.figma.fileKey === 'string' && typeof s.figma.nodeId === 'string')) {
      out.errors.push(`${at}: "figma" must be { "fileKey": "<key>", "nodeId": "<node id>" }`)
    }
    for (const alias of strings(s.aliases) ? s.aliases : []) {
      const key = alias.trim().toLowerCase()
      const other = aliases.get(key)
      if (other && other !== s.id) out.errors.push(`${file}: the alias "${alias}" is on ${other} and on ${s.id}`)
      if (/^scr-/.test(key)) out.errors.push(`${at}: the alias "${alias}" looks like a screen id`)
      aliases.set(key, other || s.id)
    }
  })
  for (const t of tags) {
    for (const v of t.values) {
      if (/^SCR-/i.test(v)) { if (!ids.has(v)) out.errors.push(`${t.path}:${t.line}: the screen ${v} is not in ${file}`) }
      else if (!aliases.has(v.toLowerCase())) out.errors.push(`${t.path}:${t.line}: "${v}" is not a screen id or alias in ${file}`)
    }
  }
}

// The OpenSpec CLI reads ./openspec, so it runs in the parent of the OpenSpec dir.
const OPENSPEC_ENV = { DO_NOT_TRACK: '1', OPENSPEC_TELEMETRY: '0', NO_COLOR: '1' }

const message = (v) => (typeof v?.message === 'string' ? v.message : isObj(v) || Array.isArray(v) ? Object.values(v).map(message).find(Boolean) : undefined)

const summary = (r) => {
  try {
    const data = JSON.parse(r.out)
    const bad = Array.isArray(data.items) ? data.items.filter((i) => i && i.valid === false).map((i) => i.id || i.name) : []
    if (bad.length) return `${bad.length} item(s) are not valid: ${bad.slice(0, 5).join(', ')}${bad.length > 5 ? ' …' : ''}`
    if (message(data)) return message(data)
  } catch {}
  return (r.err || r.out || 'no output').split('\n')[0]
}

// A project that pins the CLI as a dev dependency has it in node_modules/.bin, not on PATH.
// Not on Windows: there the shim is a .cmd file, which spawnSync runs only through a shell.
const openspecCli = (root) => {
  const local = join(root, 'node_modules', '.bin', 'openspec')
  return process.platform !== 'win32' && existsSync(local) ? local : 'openspec'
}

const checkOpenspec = (root, paths, out) => {
  if (!isDir(join(root, paths.openspec))) return
  const cli = openspecCli(root)
  if (!run(cli, ['--version'], { timeout: 10_000, env: OPENSPEC_ENV }).ok) {
    out.warnings.push('the openspec CLI is not installed, so "openspec validate" did not run')
    return
  }
  if (basename(paths.openspec) !== 'openspec') {
    out.warnings.push(`the openspec CLI reads a folder named openspec, so it cannot check ${paths.openspec}`)
    return
  }
  const cwd = join(root, dirname(paths.openspec))
  const validate = run(cli, ['validate', '--all', '--strict', '--json'], { cwd, timeout: 120_000, env: OPENSPEC_ENV })
  if (!validate.ok) out.errors.push(`openspec validate --all --strict: ${summary(validate)}`)
  // ponytail: `status` needs --change or --all; --all is from a review run on OpenSpec 1.14.2.
  const status = run(cli, ['status', '--all', '--json'], { cwd, timeout: 60_000, env: OPENSPEC_ENV })
  if (!status.ok) out.warnings.push(`openspec status: ${summary(status)}`)
}

export const checkDocs = ({ AC, root }) => {
  const { paths, from, warnings, errors } = projectPaths(root, AC)
  if (errors.length) return { ok: false, errors, warnings, paths: {}, pathsFrom: null }
  const out = { errors: [], warnings: [...warnings] }
  try {
    for (const check of [checkRaid, checkAdrs, checkRootSpecs, checkScreens, checkChanges, checkOpenspec]) check(root, paths, out)
  } catch (err) {
    out.errors.push(err.message)
  }
  return { ok: !out.errors.length, ...out, paths, pathsFrom: from }
}

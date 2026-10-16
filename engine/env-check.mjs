// env-check.mjs — ac env check: compare the catalog, the env templates, the code reads and the local env files.
// An env value stays in memory. Output holds names, files and line numbers only.

import { spawnSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { basename, dirname, join } from 'node:path'
import { parseEnv } from 'node:util'
import { isObj, readJson } from './util.mjs'

export const CATALOG = 'env.catalog.json'
export const ENV_FILE = /^\.env(\..+)?$/
export const TEMPLATE = /^\.env(\.[\w-]+)*\.(example|sample|template)$/
const PUBLIC = /^(VITE_|NEXT_PUBLIC_|EXPO_PUBLIC_|REACT_APP_|NUXT_PUBLIC_|PUBLIC_)/
const STRONG = /SECRET|PASSWORD|PASSWD|PASSPHRASE|PRIVATE/i
const WEAK = /TOKEN|API_?KEY|ACCESS_KEY|CREDENTIAL/i
const MAX_LINE = 2000
const CODE = /\.(ts|tsx|js|jsx|mjs|cjs|vue|svelte)$/
const BUILTIN = new Set(['NODE_ENV', 'CI', 'TZ', 'HOME', 'PATH', 'PWD', 'USER', 'SHELL', 'TERM', 'LANG', 'MODE', 'DEV', 'PROD', 'SSR', 'BASE_URL'])
const READS = [
  /process\.env(?:\?\.|\.)([A-Z][A-Z0-9_]*)\b/g,
  /process\.env\[\s*['"`]([A-Z][A-Z0-9_]*)['"`]\s*\]/g,
  /import\.meta\.env(?:\?\.|\.)([A-Z][A-Z0-9_]*)\b/g,
  /\b\w*[cC]onfig\w*\??\.(?:get|getOrThrow)(?:<[^>()]*>)?\(\s*['"`]([A-Z][A-Z0-9_]*)['"`]/g, // ponytail: no nested type argument
]
const DESTRUCTURE = /\{([^{}]*)\}\s*=\s*(?:process|import\.meta)\.env\b/g
const CAT_KEYS = new Set(['name', 'apps', 'description', 'default', 'example', 'allowed', 'pattern', 'secret', 'required'])
const CAT_ENVS = new Set(['local', 'ci', 'staging', 'prod'])

// ponytail: a destructuring that spans several lines, or has a default value with braces, is not found.
const destructured = (line) => [...line.matchAll(DESTRUCTURE)]
  .flatMap((m) => m[1].split(',').map((part) => /^\s*([A-Z][A-Z0-9_]*)\s*(?::|=|$)/.exec(part)?.[1]).filter(Boolean))

const has = (o, n) => Object.hasOwn(o, n)
const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0)
const dirOf = (f) => (dirname(f) === '.' ? '' : dirname(f))
const strings = (a) => Array.isArray(a) && a.length > 0 && a.every((s) => typeof s === 'string')

export const catalogErrors = (c) => {
  if (!isObj(c) || c.version !== 1 || !Array.isArray(c.vars)) return ['the file is not valid JSON of the form { "version": 1, "vars": [ ... ] }']
  const errors = []
  const seen = new Set()
  c.vars.forEach((v, i) => {
    const at = `vars[${i}]${isObj(v) && typeof v.name === 'string' ? ` (${v.name})` : ''}`
    if (!isObj(v)) return errors.push(`${at} must be an object`)
    const bad = (key, what) => key in v && errors.push(`${at}: "${key}" must be ${what}`)
    for (const k of Object.keys(v)) if (!CAT_KEYS.has(k)) errors.push(`${at} has the unknown key "${k}"`)
    if (typeof v.name !== 'string' || !/^[A-Z_][A-Z0-9_]*$/.test(v.name)) errors.push(`${at} needs a name in UPPER_SNAKE_CASE`)
    else if (seen.has(v.name)) errors.push(`${at} repeats a name`)
    else seen.add(v.name)
    for (const k of ['description', 'default', 'example', 'pattern']) if (typeof v[k] !== 'string') bad(k, 'a string')
    if ('apps' in v && !(Array.isArray(v.apps) && v.apps.every((a) => typeof a === 'string'))) bad('apps', 'a list of strings')
    if (typeof v.secret !== 'boolean') bad('secret', 'true or false')
    if (!strings(v.allowed)) bad('allowed', 'a list of strings')
    if ('allowed' in v && 'pattern' in v) errors.push(`${at}: use "allowed" or "pattern", not both`)
    if (typeof v.pattern === 'string') try { new RegExp(v.pattern) } catch { errors.push(`${at}: "pattern" is not a valid regular expression`) }
    if (!(isObj(v.required) && Object.entries(v.required).every(([k, b]) => CAT_ENVS.has(k) && typeof b === 'boolean'))) bad('required', 'an object with local, ci, staging and prod set to true or false')
  })
  return errors
}

const ls = (p) => { try { return readdirSync(p, { withFileTypes: true }) } catch { return [] } }
// Files below dir as relative paths, to a depth. node_modules and .git are skipped. Symlinks are skipped.
const scan = (root, depth, keep, dir = '') => ls(join(root, dir)).flatMap((e) => {
  if (e.isDirectory()) return depth > 0 && e.name !== 'node_modules' && e.name !== '.git' ? scan(root, depth - 1, keep, `${dir}${e.name}/`) : []
  return e.isFile() && keep(e.name) ? [`${dir}${e.name}`] : []
})

// Tracked files, or null when the folder is no git work tree. A big monorepo lists more than the 1 MB that run() allows.
const gitFiles = (root, ...flags) => {
  const r = spawnSync('git', ['-c', 'core.quotepath=off', 'ls-files', '-z', ...flags], {
    cwd: root, encoding: 'utf8', timeout: 30_000, maxBuffer: 256 << 20, stdio: ['ignore', 'pipe', 'ignore'], env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
  })
  if (r.error && r.error.code !== 'ENOENT') throw r.error
  return r.status === 0 ? r.stdout.split('\0').filter(Boolean) : null
}
const tracked = (root) => gitFiles(root)

// ponytail: the walk stops at depth 4. A deeper ignored env file is not seen; a tracked one always is.
export const discover = (root) => {
  const git = tracked(root)
  const set = new Set(git ?? [])
  const files = [...new Set([...scan(root, 4, (n) => ENV_FILE.test(n)), ...(git ?? []).filter((f) => ENV_FILE.test(basename(f)))])].sort()
  const tpl = (f) => TEMPLATE.test(basename(f))
  return { git, templates: files.filter(tpl), committed: files.filter((f) => !tpl(f) && set.has(f)), local: files.filter((f) => !tpl(f) && !set.has(f)) }
}

const codeReads = (root, git) => {
  const files = (git ? [...git, ...(gitFiles(root, '--others', '--exclude-standard') ?? [])] : scan(root, 10, () => true)).filter((f) => CODE.test(f) && !/(^|\/)(node_modules|dist)\//.test(f))
  const reads = new Map()
  for (const rel of files) {
    let text
    try {
      if (statSync(join(root, rel)).size > 1_000_000) continue
      text = readFileSync(join(root, rel), 'utf8')
    } catch { continue }
    text.split('\n').forEach((line, i) => {
      if (line.length > MAX_LINE) return
      const found = [...READS.flatMap((re) => [...line.matchAll(re)].map((m) => m[1])), ...destructured(line)]
      for (const n of found) if (!BUILTIN.has(n)) reads.set(n, [...(reads.get(n) ?? []), `${rel}:${i + 1}`])
    })
  }
  return reads
}

const analyze = ({ vars, env, templates, committed, local, unreadable, reads }) => {
  const out = []
  const add = (level, kind, name, files, detail) => out.push({ level, kind, ...(name && { name }), files, detail })
  const catalog = vars && new Map(vars.map((v) => [v.name, v]))
  const names = (files) => new Set(files.flatMap((f) => Object.keys(env[f])))
  const where = (n, files) => files.filter((f) => has(env[f], n))
  for (const f of unreadable) add('warn', 'unreadable', null, [f], 'the file cannot be read, so it is not checked')
  const all = [...templates, ...committed, ...local]
  const declared = catalog ? new Set(catalog.keys()) : names([...templates, ...committed])

  const nested = (a, b) => a === '' || b === '' || a === b || a.startsWith(`${b}/`) || b.startsWith(`${a}/`)
  templates.forEach((a, i) => templates.slice(i + 1).forEach((b) => {
    if (!nested(dirOf(a), dirOf(b))) return
    const shared = Object.keys(env[a]).filter((n) => has(env[b], n)).length
    const same = shared === Object.keys(env[a]).length && shared === Object.keys(env[b]).length
    if (shared) add('warn', same ? 'duplicate' : 'overlap', null, [a, b], `${shared} shared name(s)`)
  }))

  for (const n of new Set([...names(all), ...(catalog?.keys() ?? [])])) {
    const prefix = PUBLIC.exec(n)
    if (!prefix) continue
    const rest = n.slice(prefix[0].length)
    const level = catalog?.get(n)?.secret || STRONG.test(rest) ? 'error' : WEAK.test(rest) ? 'warn' : null
    if (level) add(level, 'public-secret', n, [...where(n, all), ...(catalog?.has(n) ? [CATALOG] : [])], 'the public prefix puts this name in the client bundle')
  }

  for (const [n, sites] of reads) if (!declared.has(n)) add(catalog ? 'error' : 'warn', 'undeclared', n, sites, 'code reads this name; nothing declares it')

  if (catalog) {
    const needed = vars.filter((v) => v.required?.local && v.default === undefined)
    if (!local.length && needed.length) add('warn', 'missing', null, [CATALOG], `no local env file; ${needed.length} name(s) are required for local`)
    for (const v of vars) {
      if (local.length && needed.includes(v) && !local.some((f) => env[f][v.name])) add('error', 'missing', v.name, local, 'required for local; no local file sets it and no default exists')
      if (!where(v.name, templates).length) add('warn', 'missing', v.name, [CATALOG], 'no template lists this name')
    }
  } else {
    for (const d of new Set(local.map(dirOf))) {
      const set = names(local.filter((f) => dirOf(f) === d))
      const missing = new Map()
      for (const t of templates.filter((f) => dirOf(f) === d)) for (const n of Object.keys(env[t])) if (!set.has(n)) missing.set(n, [...(missing.get(n) ?? []), t])
      for (const [n, files] of missing) add('warn', 'missing', n, files, `no local file in ${d || 'the root'} sets it`)
    }
  }

  const extra = new Map()
  for (const f of catalog ? [...local, ...templates] : local) for (const n of Object.keys(env[f])) if (!declared.has(n)) extra.set(n, [...(extra.get(n) ?? []), f])
  for (const [n, files] of extra) add('warn', 'extra', n, files, catalog ? 'the catalog does not list this name' : 'no template or committed file declares this name')

  for (const v of vars ?? []) {
    if (!v.allowed && v.pattern === undefined) continue
    const re = v.pattern === undefined ? null : new RegExp(v.pattern)
    const bad = local.filter((f) => env[f][v.name] && (re ? !re.test(env[f][v.name]) : !v.allowed.includes(env[f][v.name])))
    if (bad.length) add('error', 'invalid', v.name, bad, re ? 'the value does not match the pattern' : 'the value is not in the allowed list')
  }
  const rank = { error: 0, warn: 1 }
  return out.sort((a, b) => rank[a.level] - rank[b.level] || cmp(a.kind, b.kind) || cmp(a.name ?? '', b.name ?? '') || cmp(a.files.join(), b.files.join()))
}

const line = (f) => `  ${f.level.padEnd(5)} ${f.kind.padEnd(13)} ${f.name ? `${f.name}  ` : ''}${f.detail}` +
  (f.files.length ? ` (${f.files.slice(0, 3).join(', ')}${f.files.length > 3 ? `, +${f.files.length - 3} more` : ''})` : '')

export const checkCmd = ({ root, v }) => {
  const present = existsSync(join(root, CATALOG))
  const data = present ? readJson(join(root, CATALOG)) : null
  const errors = present ? catalogErrors(data) : []
  const found = discover(root)
  const env = {}
  const unreadable = []
  for (const f of [...found.templates, ...found.committed, ...found.local]) {
    try { env[f] = parseEnv(readFileSync(join(root, f), 'utf8')) } catch { unreadable.push(f) }
  }
  const readable = (list) => list.filter((f) => f in env)
  const reads = codeReads(root, found.git)
  const findings = errors.length
    ? errors.map((detail) => ({ level: 'error', kind: 'catalog', files: [CATALOG], detail }))
    : analyze({
      vars: present ? data.vars : null, env, unreadable, reads,
      templates: readable(found.templates), committed: readable(found.committed), local: readable(found.local),
    })
  const failed = findings.filter((f) => f.level === 'error').length
  const sites = [...reads.values()].reduce((sum, l) => sum + l.length, 0)
  const result = { catalog: present ? CATALOG : null, templates: found.templates, committed: found.committed, local: found.local, reads: sites, findings }
  if (v.json) console.log(JSON.stringify({ ok: failed === 0, ...result }, null, 2))
  else {
    console.log(`ac env check → ${root}`)
    for (const f of findings) console.log(line(f))
    console.log(`${failed} error(s), ${findings.length - failed} warning(s). Catalog: ${present ? 'yes' : 'no'}. ${found.templates.length} template(s), ${found.committed.length} committed, ${found.local.length} local, ${sites} code read(s).`)
  }
  return failed ? 1 : 0
}

// util.mjs — small helpers shared by the engine modules.

import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdirSync, readdirSync, readFileSync, realpathSync, statSync, writeFileSync } from 'node:fs'
import { dirname, isAbsolute, join, resolve } from 'node:path'
import { parseArgs } from 'node:util'

export const sha = (data) => createHash('sha256').update(data).digest('hex').slice(0, 16)

export const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v)

export const isDir = (path) => { try { return statSync(path).isDirectory() } catch { return false } }

export const readJson = (path) => { try { return JSON.parse(readFileSync(path, 'utf8')) } catch { return null } }

const byName = (a, b) => (a < b ? -1 : a > b ? 1 : 0)

// Recursive key sort, so the lock text is the same on every run.
export const sorted = (v) => (isObj(v)
  ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => byName(a, b)).map(([k, x]) => [k, sorted(x)]))
  : v)

// A repo-relative path from config or lock data. Refuse anything that can leave the root.
export const safeRel = (rel) => typeof rel === 'string' && rel !== '' && !isAbsolute(rel) && !rel.includes('\\') &&
  rel.split('/').every((part) => part !== '' && part !== '.' && part !== '..')

// Files below dir as sorted, '/'-joined relative paths.
export const walk = (dir, base = '') => {
  if (!isDir(dir)) return []
  return readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.name !== '.DS_Store')
    .sort((a, b) => byName(a.name, b.name))
    .flatMap((e) => {
      if (e.isDirectory()) return walk(join(dir, e.name), `${base}${e.name}/`)
      return e.isFile() ? [`${base}${e.name}`] : []
    })
}

export const dirs = (dir) => (isDir(dir)
  ? readdirSync(dir, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name).sort(byName)
  : [])

const unquote = (s) => s.trim().replace(/^"(.*)"$|^'(.*)'$/, '$1$2')

// ponytail: flat YAML only. Nested keys (metadata.stacks) read as top-level keys; block scalars are not parsed.
export const frontmatter = (text) => {
  const m = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(text)
  if (!m) return { data: {}, body: text }
  const data = {}
  for (const line of m[1].split(/\r?\n/)) {
    const kv = /^\s*([\w-]+):\s*(.*)$/.exec(line)
    if (kv && !(kv[1] in data)) data[kv[1]] = unquote(kv[2])
  }
  return { data, body: text.slice(m[0].length) }
}

export const list = (v) => (v ? v.replace(/^\[|\]$/g, '').split(',').map(unquote).filter(Boolean) : [])

// Run a command with no prompt and a timeout. Git reads GIT_TERMINAL_PROMPT; ssh reads BatchMode.
export const run = (cmd, args, { cwd, timeout = 30_000, env } = {}) => {
  const r = spawnSync(cmd, args, {
    cwd,
    timeout,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, GIT_TERMINAL_PROMPT: '0', GIT_SSH_COMMAND: process.env.GIT_SSH_COMMAND || 'ssh -o BatchMode=yes', ...env },
  })
  return { ok: r.status === 0, out: (r.stdout || '').trim(), err: (r.stderr || r.error?.message || '').trim() }
}

// The host project root for a command: --root or the current directory. Never the compass checkout itself.
export const hostRoot = (AC, dir) => {
  const root = resolve(dir || process.cwd())
  let same
  try { same = realpathSync(root) === realpathSync(AC) } catch { return { error: `the project root ${root} does not exist` } }
  return same ? { error: 'run ac from the project root, not from the compass checkout' } : { root }
}

// Write a new file below root. It never overwrites: an existing file is an error (flag wx).
export const writeNew = (root, rel, content) => {
  mkdirSync(dirname(join(root, rel)), { recursive: true })
  writeFileSync(join(root, rel), content, { flag: 'wx' })
}

// The usage error of a command: the message and the help on stderr. Exit 2.
export const usageError = (help, message, prefix = '') => { console.error(`${prefix}${message}\n\n${help}`); return 2 }

// The options of a command module, with --help added. Returns { values, positionals }, or { exit } when the command is done:
// --help prints the help (exit 0), a bad option prints the usage error (exit 2).
export const parseCommand = (argv, help, options, { allowPositionals = true, prefix } = {}) => {
  const stop = (exit) => ({ exit, values: {}, positionals: [] })
  let parsed
  try {
    parsed = parseArgs({ args: argv, strict: true, allowPositionals, options: { ...options, help: { type: 'boolean', short: 'h' } } })
  } catch (err) { return stop(usageError(help, err.message, prefix)) }
  if (!parsed.values.help) return parsed
  console.log(help)
  return stop(0)
}

// An error for a command: JSON with --json, else "error: <message>" on stderr. Exit 1.
export const failCommand = (json, message) => {
  if (json) console.log(JSON.stringify({ ok: false, errors: [message] }, null, 2))
  else console.error(`error: ${message}`)
  return 1
}

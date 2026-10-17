// env.mjs — ac env check | export | import | run. An env value never reaches stdout, stderr, a log or a plain file.
// The check lives in env-check.mjs.

import { spawn, spawnSync } from 'node:child_process'
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { constants, homedir, tmpdir } from 'node:os'
import { basename, dirname, join, relative, resolve, sep } from 'node:path'
import { parseEnv } from 'node:util'
import { checkCmd, discover, ENV_FILE, TEMPLATE } from './env-check.mjs'
import { outside } from './sync.mjs'
import { command, failCommand, hostRoot, isObj, parseCommand, run, safeRel, usageError } from './util.mjs'

const USAGE = `Usage: ac env <command> [options]

Commands:
  check                      Compare the catalog, the templates, the code reads and the local env files.
  export --to <r1,r2,..>     Encrypt the local env values with age. Write env-bundle.age.
  import <file.age>          Decrypt a bundle. Merge it into git-ignored env files.
  run -- <command> [args]    Start a command with the env values. Write no file.

Options:
  --root <dir>         Use this project root. The default is the current directory. A relative path starts there.
  --json               Print the result as JSON.
  --to <r1,r2,..>      With export: key files (.pub), host/user, or user. A bare user uses --forge.
  --forge <host>       With export: the forge for a bare user. The default is github.com.
  --only <A,B>         With export: keep only these names.
  --file <path>        With export and run: use this env file. Repeat the option for more files.
  --out <file.age>     With export: the bundle path. The default is env-bundle.age.
  --identity <key>     With import and run: the SSH private key. The default is ~/.ssh/id_ed25519, then id_rsa.
  --overwrite          With import: replace a name that has another value (one-line entries only).
  --bundle <file.age>  With run: add the values of a bundle. They stay in memory.
  --help, -h           Show this help.

The age binary is "age", or the path in AC_AGE.`

const NAME = /^[A-Za-z_][A-Za-z0-9_]*$/
const isFile = (p) => statSync(p, { throwIfNoEntry: false })?.isFile() === true
const has = (o, n) => Object.hasOwn(o, n)
const splitList = (s) => (s ?? '').split(',').map((x) => x.trim()).filter(Boolean)

const show = (v, data, text) => { console.log(v.json ? JSON.stringify({ ok: true, ...data }, null, 2) : text); return 0 }

// A value that parseEnv reads back unchanged and that a shell `source` cannot run. Single quotes come first.
// Double quotes only without $, ` and \, because a shell expands them. No backticks: a shell runs them.
// parseEnv has no \" escape and expands \n in double quotes only. Any other value is refused (null).
const QUOTES = [["'", /['\n]/], ['"', /["$`\\]/]]
export const encodeValue = (x) => QUOTES.filter(([, bad]) => !bad.test(x))
  .map(([q]) => `${q}${q === '"' ? x.replaceAll('\n', '\\n') : x}${q}`)
  .find((e) => parseEnv(`K=${e}`).K === x) ?? null

// ---- age ----

const age = (args, input, timeout) => {
  const [cmd, ...pre] = command(process.env.AC_AGE || 'age')
  const r = spawnSync(cmd, [...pre, ...args], {
    input, timeout, encoding: 'utf8', maxBuffer: 8 << 20, stdio: ['pipe', 'pipe', 'pipe'], env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
  })
  if (r.error?.code === 'ENOENT') return { error: 'age is not installed; install age 1.3 or later' }
  if (r.error) return { error: `age did not finish: ${r.error.message}` }
  return r.status === 0 ? { out: r.stdout } : { error: `age failed: ${(r.stderr || '').trim().split('\n')[0]}` }
}

const USER_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,38}$/
const HOST_RE = /^[a-z0-9.-]+(:\d+)?$/
const KEY_CAP = 64 * 1024

export const recipientKeys = async (spec, { forge = 'github.com', root = process.cwd(), fetchFn = fetch } = {}) => {
  let text
  if (isFile(resolve(root, spec)) || spec.endsWith('.pub')) {
    if (!isFile(resolve(root, spec))) throw new Error(`the key file ${spec} does not exist`)
    text = readFileSync(resolve(root, spec), 'utf8')
  } else {
    const parts = spec.split('/')
    const [host, user] = parts.length === 1 ? [forge, spec] : parts
    if (parts.length > 2 || !HOST_RE.test(host) || !USER_RE.test(user)) throw new Error(`"${spec}" is not a key file, a user or a host/user pair`)
    const url = `https://${host}/${user}.keys`
    // ponytail: no redirects. A forge that redirects its key list needs a key file instead.
    const res = await fetchFn(url, { signal: AbortSignal.timeout(10_000), redirect: 'error' })
    if (!res.ok) throw new Error(`${url} answered ${res.status}`)
    const chunks = []
    let size = 0
    for await (const chunk of res.body) {
      size += chunk.length
      if (size > KEY_CAP) throw new Error(`${url} sent more than 64 KB`)
      chunks.push(chunk)
    }
    text = Buffer.concat(chunks).toString('utf8')
  }
  const keys = text.split(/\r?\n/).filter((l) => /^ssh-(ed25519|rsa) /.test(l))
  if (!keys.length) throw new Error(`no SSH key found for ${spec}`)
  return keys
}

const decrypt = (root, file, identity) => {
  const id = identity ? resolve(root, identity) : [join(homedir(), '.ssh/id_ed25519'), join(homedir(), '.ssh/id_rsa')].find(isFile)
  if (!id || !isFile(id)) return { error: 'no SSH identity found; use --identity <private key>' }
  if (!isFile(file)) return { error: `the bundle ${relative(root, file)} does not exist` }
  const r = age(['-d', '-i', id, file], undefined, 60_000)
  if (r.error) return r
  let b
  try { b = JSON.parse(r.out) } catch { return { error: 'the bundle is not valid JSON' } }
  const ok = isObj(b) && b.version === 1 && isObj(b.files) &&
    Object.values(b.files).every((f) => isObj(f) && Object.entries(f).every(([n, x]) => NAME.test(n) && typeof x === 'string'))
  return ok ? { files: b.files } : { error: 'the bundle has an incorrect shape' }
}

// ---- export ----

const exportCmd = async ({ root, v }) => {
  const { local } = discover(root)
  const want = v.file?.length ? v.file.map((f) => relative(root, resolve(root, f)).split(sep).join('/')) : local
  const stray = want.find((f) => !local.includes(f))
  if (stray) return failCommand(v.json, `${stray} is not a local env file`)
  const only = new Set(splitList(v.only))
  const files = {}
  for (const f of want) {
    const vals = Object.entries(parseEnv(readFileSync(join(root, f), 'utf8'))).filter(([n]) => !only.size || only.has(n))
    if (vals.length) files[f] = Object.fromEntries(vals)
  }
  const count = Object.values(files).reduce((sum, x) => sum + Object.keys(x).length, 0)
  const bad = Object.values(files).flatMap(Object.keys).find((n) => !NAME.test(n))
  if (bad) return failCommand(v.json, `the name ${bad} is not a valid env name`)
  if (!count) return failCommand(v.json, 'there are no values to export')
  const out = resolve(root, v.out ?? 'env-bundle.age')
  if (!out.endsWith('.age')) return failCommand(v.json, '--out must end with .age')
  const outRel = relative(root, out).split(sep).join('/')
  if (!safeRel(outRel) || outside(root, outRel)) return failCommand(v.json, '--out must be a path inside the project, without a symlink')
  const recipients = []
  try {
    for (const spec of splitList(v.to)) recipients.push({ recipient: spec, keys: await recipientKeys(spec, { forge: v.forge, root }) })
  } catch (err) { return failCommand(v.json, err.message) }
  const tmp = mkdtempSync(join(tmpdir(), 'ac-env-'))
  try {
    const rfile = join(tmp, 'recipients')
    writeFileSync(rfile, `${recipients.flatMap((r) => r.keys).join('\n')}\n`, { mode: 0o600 })
    mkdirSync(dirname(out), { recursive: true })
    const r = age(['-R', rfile, '-o', out], JSON.stringify({ version: 1, files }), 30_000)
    if (r.error) return failCommand(v.json, r.error)
  } finally { rmSync(tmp, { recursive: true, force: true }) }
  const summary = recipients.map((r) => ({ recipient: r.recipient, keys: r.keys.length }))
  return show(v, { out: outRel, files: Object.keys(files).length, values: count, recipients: summary },
    `Exported ${count} value(s) from ${Object.keys(files).length} file(s) to ${outRel}.\n${summary.map((r) => `  ${r.recipient}: ${r.keys} key(s)`).join('\n')}`)
}

// ---- import ----

const targetError = (root, rel) => {
  if (!safeRel(rel)) return 'is not a path inside the project'
  if (!ENV_FILE.test(basename(rel)) || TEMPLATE.test(basename(rel))) return 'is not a local env file name'
  if (outside(root, rel)) return 'goes through a symlink'
  if (existsSync(join(root, rel)) && !isFile(join(root, rel))) return 'is not a regular file'
  if (!run('git', ['check-ignore', '-q', '--', rel], { cwd: root }).ok) return 'is not ignored by git'
  return null
}

const merge = (text, vals, overwrite) => {
  const have = parseEnv(text)
  const lines = text.split('\n')
  const add = []
  const r = { added: [], same: [], replaced: [], kept: [], bad: [] }
  for (const [n, x] of Object.entries(vals)) {
    if (has(have, n) && have[n] === x) { r.same.push(n); continue }
    const enc = encodeValue(x)
    if (enc === null) r.bad.push(n)
    else if (!has(have, n)) { add.push(`${n}=${enc}`); r.added.push(n) } else {
      const at = lines.flatMap((l, i) => (new RegExp(`^\\s*(?:export\\s+)?${n}\\s*=`).test(l) ? [i] : []))
      // ponytail: only a one-line entry is replaced. A multi-line or repeated entry stays.
      if (overwrite && at.length === 1 && parseEnv(lines[at[0]])[n] === have[n]) { lines[at[0]] = `${n}=${enc}`; r.replaced.push(n) } else r.kept.push(n)
    }
  }
  const body = lines.join('\n')
  return { ...r, text: add.length ? `${body}${body === '' || body.endsWith('\n') ? '' : '\n'}${add.join('\n')}\n` : body }
}

const importCmd = ({ root, v, positionals }) => {
  const b = decrypt(root, resolve(root, positionals[0]), v.identity)
  if (b.error) return failCommand(v.json, b.error)
  const errors = Object.keys(b.files).map((rel) => [rel, targetError(root, rel)]).filter(([, e]) => e).map(([rel, e]) => `${rel} ${e}`)
  const plans = errors.length ? [] : Object.entries(b.files).map(([rel, vals]) => {
    const text = existsSync(join(root, rel)) ? readFileSync(join(root, rel), 'utf8') : ''
    return { rel, old: text, ...merge(text, vals, v.overwrite) }
  })
  for (const p of plans) for (const n of p.bad) errors.push(`${p.rel}: the value of ${n} has no safe quote style`)
  if (errors.length) return failCommand(v.json, `${errors.join('; ')}. Nothing was written.`)
  for (const p of plans.filter((x) => x.text !== x.old)) {
    mkdirSync(dirname(join(root, p.rel)), { recursive: true })
    writeFileSync(join(root, p.rel), p.text, { mode: 0o600 })
    chmodSync(join(root, p.rel), 0o600)
  }
  const files = plans.map((p) => ({ path: p.rel, added: p.added, replaced: p.replaced, kept: p.kept, same: p.same.length }))
  return show(v, { files }, files.map((f) => `${f.path}: ${f.added.length} added, ${f.replaced.length} replaced, ${f.same} same, ${f.kept.length} kept${f.kept.length ? ` (${f.kept.join(', ')}; use --overwrite)` : ''}`).join('\n'))
}

// ---- run ----

const runCmd = ({ root, v, cmd }) => {
  const files = v.file?.length ? v.file.map((f) => resolve(root, f)) : ['.env', '.env.local'].map((f) => join(root, f)).filter(isFile)
  const gone = files.find((f) => !isFile(f))
  if (gone) return failCommand(v.json, `${relative(root, gone)} does not exist`)
  let vals = {}
  for (const f of files) vals = { ...vals, ...parseEnv(readFileSync(f, 'utf8')) }
  if (v.bundle) {
    const b = decrypt(root, resolve(root, v.bundle), v.identity)
    if (b.error) return failCommand(v.json, b.error)
    // ponytail: every file of the bundle merges into one set; the last file wins.
    for (const f of Object.values(b.files)) vals = { ...vals, ...f }
  }
  return new Promise((done) => {
    const child = spawn(cmd[0], cmd.slice(1), { cwd: root, stdio: 'inherit', env: { ...vals, ...process.env } })
    const forward = (sig) => () => child.kill(sig)
    const handlers = ['SIGINT', 'SIGTERM'].map((sig) => [sig, forward(sig)])
    for (const [sig, fn] of handlers) process.on(sig, fn)
    child.on('error', (err) => done(failCommand(v.json, `cannot start ${cmd[0]}: ${err.message}`)))
    child.on('close', (code, signal) => {
      for (const [sig, fn] of handlers) process.off(sig, fn)
      done(code ?? (signal ? 128 + constants.signals[signal] : 1))
    })
  })
}

// ---- cli ----

const COMMON = { root: { type: 'string' }, json: { type: 'boolean' } }
const COMMANDS = {
  check: { run: checkCmd, options: {} },
  export: { run: exportCmd, options: { to: { type: 'string' }, forge: { type: 'string' }, only: { type: 'string' }, file: { type: 'string', multiple: true }, out: { type: 'string' } } },
  import: { run: importCmd, options: { identity: { type: 'string' }, overwrite: { type: 'boolean' } } },
  run: { run: runCmd, options: { file: { type: 'string', multiple: true }, bundle: { type: 'string' }, identity: { type: 'string' } } },
}

export const cli = async (argv, { AC }) => {
  const [sub, ...rest] = argv
  if (sub === '--help' || sub === '-h') { console.log(USAGE); return 0 }
  if (!Object.hasOwn(COMMANDS, sub)) return usageError(USAGE, sub ? `Unknown command: ${sub}` : 'A command is necessary.')
  const cut = sub === 'run' ? rest.indexOf('--') : -1
  const { values: v, positionals, exit } = parseCommand(cut < 0 ? rest : rest.slice(0, cut), USAGE, { ...COMMON, ...COMMANDS[sub].options })
  if (exit !== undefined) return exit
  const cmd = cut < 0 ? [] : rest.slice(cut + 1)
  if (positionals.length !== (sub === 'import' ? 1 : 0)) return usageError(USAGE, sub === 'import' ? 'import needs one bundle file.' : `Unexpected argument: ${positionals[0]}`)
  if (sub === 'run' && !cmd.length) return usageError(USAGE, 'run needs -- <command>.')
  if (sub === 'export' && !splitList(v.to).length) return usageError(USAGE, 'export needs --to <recipients>.')
  const host = hostRoot(AC, v.root)
  if (host.error) return failCommand(v.json, host.error)
  return COMMANDS[sub].run({ root: host.root, v, positionals, cmd })
}

// dev.mjs — ac dev up|down|status|logs: run the local stack with process-compose.
// A client call uses a unix socket with a relative path (macOS limits a socket path to 104 bytes). The cwd is the project root.

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseArgs } from 'node:util'
import { outside } from './sync.mjs'
import { dirs, hostRoot, isDir, isObj, readJson, run } from './util.mjs'

const FILE = 'process-compose.yaml'
const DIR = '.agents/dev'
const CLIENT = ['-U', '-u', `${DIR}/pc.sock`]
const NAME = /^\w[\w.-]*$/
const SHELL_SAFE = /^[\w./-]+$/
const CONDITIONS = ['process_started', 'process_healthy', 'process_completed', 'process_completed_successfully', 'process_log_ready']
const TIMEOUT = { check: 30_000, up: 60_000, down: 60_000, status: 15_000, logs: 15_000 }
const MISSING = 'process-compose is not installed. Install it, or set AC_PROCESS_COMPOSE to its path.'
const HELP = `Usage: ac dev <up|down|status|logs> [options]

  up           Start the stack in the background from ${FILE}. With --dry: check the file,
               or print a draft when the file is missing.
  down         Stop the stack.
  status       Show the name, status, readiness and restarts of each process.
  logs <name>  Show the last lines of one process log.

Options:
  --root <dir>  Use this project root. The default is the current directory.
  --dry         Show the command. Run nothing.
  --json        Print the result as JSON.
  --tail <n>    With logs: the number of lines. The default is 100. The maximum is 2000.
  --help, -h    Show this help.`

const cap = (s) => (s.length > 4096 ? `${s.slice(0, 4096)}\n[output cut at 4 KB]` : s)
const binary = () => process.env.AC_PROCESS_COMPOSE || 'process-compose'
const pc = (root, args, timeout) => run(binary(), args, { cwd: root, timeout })
const readText = (path) => { try { return readFileSync(path, 'utf8') } catch { return '' } }

// --- draft of process-compose.yaml ---

const DEFAULT_PORTS = [['vite', 5173, 'vite'], ['next', 3000, 'next'], ['nest', 3000, '@nestjs/core'], ['expo', 8081, 'expo']]
const COMPOSE = /^(docker-)?compose[\w.-]*\.ya?ml$/

const packageManager = (root, pkg) => {
  const declared = /^(pnpm|yarn|bun|npm)@/.exec(pkg?.packageManager || '')?.[1]
  const lock = [['pnpm-lock.yaml', 'pnpm'], ['yarn.lock', 'yarn'], ['bun.lock', 'bun'], ['bun.lockb', 'bun']].find(([f]) => existsSync(join(root, f)))
  return declared || lock?.[1] || 'npm'
}

// The first compose file at the root or in apps/*/. A name with local or dev wins. A name with test or prod is skipped.
const composeFile = (root) => {
  const found = ['', ...dirs(join(root, 'apps')).map((d) => `apps/${d}/`)].flatMap((dir) => readdirSync(join(root, dir), { withFileTypes: true })
    .filter((e) => e.isFile() && COMPOSE.test(e.name) && !/test|prod/.test(e.name))
    .map((e) => e.name).sort().map((name) => ({ name, path: `${dir}${name}` })))
  return (found.find((f) => /local|dev/.test(f.name)) || found[0])?.path
}

// ponytail: the port comes from a --port flag, then PORT= in .env.example (only that line is read), then the framework
// default. A port that code or another env file sets is not found, so the draft warns and omits the probe.
const guessPort = (script, deps, dir) => {
  const flag = /(?:^|\s)(?:--port|-p)[ =](\d{2,5})\b/.exec(script)?.[1]
  const env = /^PORT=["']?(\d{2,5})["']?\s*$/m.exec(readText(join(dir, '.env.example')))?.[1]
  const framework = DEFAULT_PORTS.find(([word, , dep]) => new RegExp(`\\b${word}\\b`).test(script) || deps.has(dep))
  const port = Number(flag || env || framework?.[1])
  return port > 0 && port <= 65535 ? port : null
}

const probe = (port) => ({
  exec: { command: `nc -z 127.0.0.1 ${port}` }, initial_delay_seconds: 2, period_seconds: 5, timeout_seconds: 3, failure_threshold: 60,
})

export const validateDraft = (doc) => {
  const procs = doc?.processes
  if (!isObj(procs) || !Object.keys(procs).length) return ['processes must list at least one process']
  const errors = []
  const whole = (v, min) => Number.isInteger(v) && v >= min
  for (const [name, entry] of Object.entries(procs)) {
    const p = isObj(entry) ? entry : {}
    if (!NAME.test(name)) errors.push(`${name}: the process name is not valid`)
    if (typeof p.command !== 'string' || !p.command.trim()) errors.push(`${name}: command must be a non-empty string`)
    for (const [dep, d] of Object.entries(p.depends_on || {})) {
      if (!Object.hasOwn(procs, dep)) errors.push(`${name}: depends_on names the unknown process ${dep}`)
      if (!CONDITIONS.includes(d?.condition)) errors.push(`${name}: depends_on ${dep} has the unknown condition ${d?.condition}`)
    }
    const r = p.readiness_probe
    if (r && !(typeof r.exec?.command === 'string' && whole(r.initial_delay_seconds, 0) && whole(r.period_seconds, 1) && whole(r.timeout_seconds, 1) && whole(r.failure_threshold, 1))) {
      errors.push(`${name}: readiness_probe needs exec.command and whole-number timings`)
    }
  }
  const state = {}
  const visit = (name, path) => {
    if (state[name] === 'done') return
    if (state[name] === 'open') { errors.push(`depends_on has a cycle: ${[...path.slice(path.indexOf(name)), name].join(' -> ')}`); return }
    state[name] = 'open'
    for (const dep of Object.keys(procs[name].depends_on || {})) if (Object.hasOwn(procs, dep)) visit(dep, [...path, name])
    state[name] = 'done'
  }
  for (const name of Object.keys(procs)) visit(name, [])
  return errors
}

const plain = (v) => /^[A-Za-z_][\w./-]*$/.test(v) && !/^(true|false|null|yes|no|on|off|y|n)$/i.test(v)
const scalar = (v) => (typeof v === 'string' && !plain(v) ? JSON.stringify(v) : String(v))
// A JSON string is a valid YAML double-quoted scalar, so the emitter needs no other quoting rule.
const emit = (obj, pad = '') => Object.entries(obj).flatMap(([k, v]) => {
  if (Array.isArray(v)) return [`${pad}${scalar(k)}:`, ...v.map((x) => `${pad}  - ${scalar(x)}`)]
  return isObj(v) ? [`${pad}${scalar(k)}:`, ...emit(v, `${pad}  `)] : [`${pad}${scalar(k)}: ${scalar(v)}`]
})

export const draftStack = (root) => {
  const warnings = []
  const rootPkg = readJson(join(root, 'package.json'))
  const pm = packageManager(root, rootPkg)
  const compose = composeFile(root)
  const infra = compose && SHELL_SAFE.test(compose) ? compose : undefined
  if (compose && !infra) warnings.push(`${compose}: the path has a character that a shell reads, so the infra process is skipped`)
  const processes = infra ? { infra: { command: `docker compose -f ${infra} up --wait`, availability: { restart: 'no' } } } : {}
  const taken = new Set(['infra'])
  const ports = {}
  // ponytail: only apps/* (or the root without apps/) is scanned. A dir such as services/ is not.
  const apps = isDir(join(root, 'apps')) ? dirs(join(root, 'apps')).map((d) => [`apps/${d}`, d]) : [['', rootPkg?.name || 'app']]
  for (const [dir, label] of apps) {
    const pkg = dir ? readJson(join(root, dir, 'package.json')) : rootPkg
    const script = ['dev', 'start:dev'].find((s) => typeof pkg?.scripts?.[s] === 'string')
    if (!script) continue
    if (dir && !SHELL_SAFE.test(dir)) { warnings.push(`${dir}: the path has a character that a shell reads, so the app is skipped`); continue }
    let name = label.replace(/^@[^/]+\//, '').replace(/[^\w.-]/g, '-')
    while (taken.has(name)) name += '-app'
    taken.add(name)
    const deps = new Set(Object.keys({ ...pkg.dependencies, ...pkg.devDependencies }))
    const port = guessPort(pkg.scripts[script], deps, join(root, dir))
    if (port) (ports[port] ||= []).push(name)
    else warnings.push(`${name}: no port found, so the process has no readiness probe`)
    processes[name] = {
      command: `${pm} run ${script}`,
      ...(dir && { working_dir: dir }),
      log_location: `${DIR}/logs/${name}.log`,
      ...(infra && { depends_on: { infra: { condition: 'process_completed_successfully' } } }),
      ...(port && { readiness_probe: probe(port) }),
    }
  }
  for (const [port, names] of Object.entries(ports)) if (names.length > 1) warnings.push(`${names.join(', ')} use port ${port}`)
  const doc = { version: '0.5', log_location: `${DIR}/process-compose.log`, processes }
  const errors = Object.keys(processes).length ? validateDraft(doc) : ['nothing to start: no compose file and no app with a dev script']
  return { doc, yaml: errors.length ? '' : `${emit(doc).join('\n')}\n`, warnings, errors }
}

// --- commands ---

const fail = (...errors) => ({ ok: false, errors })

const draft = (root) => {
  const { doc, yaml, warnings, errors } = draftStack(root)
  if (errors.length) return fail(...errors)
  const notes = [`${FILE} is missing. The draft is on stdout. Nothing is written.`, `Draft: ${Object.keys(doc.processes).join(', ')}.`]
  return { ok: true, draft: true, yaml, text: yaml.trimEnd(), warnings, notes }
}

const up = (root, dry) => {
  if (!existsSync(join(root, FILE))) return dry ? draft(root) : fail(`${FILE} not found. Run "ac dev up --dry" for a draft, or use the local-run skill.`)
  const check = pc(root, ['up', '--dry-run', '-f', FILE], TIMEOUT.check)
  if (/ENOENT/.test(check.err)) return dry ? { ok: true, valid: null, warnings: ['process-compose is not installed, so the file is not validated'] } : fail(MISSING)
  if (!check.ok) return fail(`${FILE} is not valid: ${cap(check.err || check.out)}`)
  if (dry) return { ok: true, valid: true, text: `${FILE} is valid.` }
  if (outside(root, `${DIR}/.gitignore`)) return fail(`${DIR} is a symlink or leaves the project root; compass does not write it`)
  mkdirSync(join(root, DIR), { recursive: true })
  if (!existsSync(join(root, DIR, '.gitignore'))) writeFileSync(join(root, DIR, '.gitignore'), '*\n')
  const start = pc(root, ['up', '-D', '-f', FILE, ...CLIENT, '-L', `${DIR}/process-compose.log`], TIMEOUT.up)
  return start.ok ? { ok: true, text: 'The stack runs in the background. Run "ac dev status" to see it.' } : fail(`process-compose up failed: ${cap(start.err || start.out)}`)
}

const table = (out) => {
  let rows
  try { rows = JSON.parse(out) } catch { rows = null }
  if (!Array.isArray(rows)) return { ok: true, text: cap(out), raw: true }
  const cells = [['NAME', 'STATUS', 'READY', 'RESTARTS'], ...rows.map((p) => [p.name, p.status, p.is_ready, p.restarts].map((x) => String(x ?? '-')))]
  const width = [0, 1, 2].map((i) => Math.max(...cells.map((c) => c[i].length)))
  const processes = rows.map((p) => ({ name: p.name, status: p.status, ready: p.is_ready, restarts: p.restarts }))
  return { ok: true, processes, text: cells.map((c) => c.map((x, i) => x.padEnd(width[i])).join('  ').trimEnd()).join('\n') }
}

const client = (root, args, timeout, dry, show) => {
  if (dry) return { ok: true, dry: true, command: [binary(), ...args], text: [binary(), ...args].join(' ') }
  const r = pc(root, args, timeout)
  if (/ENOENT/.test(r.err)) return fail(MISSING)
  if (!r.ok) return fail(`process-compose ${args[0]} failed: ${cap(r.err || r.out) || 'no output'}. Is the stack running? Run "ac dev up".`)
  return show(r.out)
}

const finish = (o, sub, result) => {
  const { text, ...data } = { errors: [], warnings: [], notes: [], ...result }
  if (o.json) console.log(JSON.stringify({ command: `dev ${sub}`, ...data }, null, 2))
  else {
    for (const n of data.notes) console.error(n)
    for (const w of data.warnings) console.error(`warning: ${w}`)
    if (text) console.log(text)
    for (const e of data.errors) console.error(`error: ${e}`)
  }
  return data.ok ? 0 : 1
}

export const cli = async (argv, { AC }) => {
  const usage = (message) => { console.error(`${message}\n\n${HELP}`); return 2 }
  let parsed
  try {
    parsed = parseArgs({
      args: argv,
      allowPositionals: true,
      options: { root: { type: 'string' }, dry: { type: 'boolean' }, json: { type: 'boolean' }, tail: { type: 'string' }, help: { type: 'boolean', short: 'h' } },
    })
  } catch (err) { return usage(err.message) }
  const { values: o, positionals: [sub, name, ...extra] } = parsed
  if (o.help) { console.log(HELP); return 0 }
  if (!['up', 'down', 'status', 'logs'].includes(sub)) return usage(sub ? `Unknown dev command: ${sub}` : 'A dev command is necessary.')
  if (extra.length || (name !== undefined && sub !== 'logs')) return usage(`Unexpected argument: ${extra[0] ?? name}`)
  if (sub === 'logs' && !NAME.test(name || '')) return usage('logs needs a process name. A name has letters, digits, "_", "." and "-".')
  const tail = o.tail === undefined ? 100 : Number(o.tail)
  if (o.tail !== undefined && sub !== 'logs') return usage('--tail applies to logs only.')
  if (!Number.isInteger(tail) || tail < 1 || tail > 2000) return usage('--tail needs a whole number from 1 to 2000.')
  const host = hostRoot(AC, o.root)
  if (host.error) return finish(o, sub, fail(host.error))
  const { root } = host
  const result = {
    up: () => up(root, o.dry),
    down: () => client(root, ['down', ...CLIENT], TIMEOUT.down, o.dry, () => ({ ok: true, text: 'The stack is down.' })),
    status: () => client(root, ['process', 'list', '-o', 'json', ...CLIENT], TIMEOUT.status, o.dry, table),
    logs: () => client(root, ['process', 'logs', name, '-n', String(tail), ...CLIENT], TIMEOUT.logs, o.dry, (out) => ({ ok: true, process: name, tail, text: out })),
  }[sub]()
  return finish(o, sub, result)
}

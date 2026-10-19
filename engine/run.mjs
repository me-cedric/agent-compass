// run.mjs — ac run <name>: run a command from agent-compass.commands.json without a shell.
// The log, the result and the report paths go to .agents/runs/<timestamp>-<name>/.

import { spawn, spawnSync } from 'node:child_process'
import { closeSync, existsSync, mkdirSync, openSync, readdirSync, readFileSync, statSync, writeFileSync, writeSync } from 'node:fs'
import { join } from 'node:path'
import { createInterface } from 'node:readline'
import { SECRET_RE } from '../scripts/lib/redact.mjs'
import { MAX_SECONDS, names, prepare, REGISTRY, runnable } from './run-plan.mjs'
import { outside } from './sync.mjs'
import { failCommand, hostRoot, isObj, parseCommand, readJson, usageError } from './util.mjs'

const USAGE = `Usage: ac run <name> [--confirm] [--timeout <s>] [--root <dir>] [--json]
       ac run --list

Run a command from ${REGISTRY} by name, without a shell. The output goes to
.agents/runs/<timestamp>-<name>/output.log with secret-like lines redacted.
--confirm allows a destructive command. The default timeout is 1800 seconds.`

const LOG_CAP = 5 * 1024 * 1024
// ponytail: a heuristic, like scripts/lib/redact.mjs. Bounded \w{0,64}, so a long line cannot block the event loop.
export const SECRET_NAME = /(secret|password|passwd|passphrase|token|api[_-]?key|private[_-]?key|credential|authorization)\w{0,64}["']?\s*[:=]|:\/\/[^\s/:@]+:[^\s/@]+@/i

// Junit XML and HTML report files that changed after the start. ponytail: depth 5; a deeper report is not seen.
const reports = (root, since) => {
  const found = { junit: [], html: [] }
  const visit = (dir, depth) => {
    let entries = []
    try { entries = readdirSync(join(root, dir), { withFileTypes: true }) } catch { return }
    for (const e of entries) {
      const rel = `${dir}${e.name}`
      if (e.isDirectory()) {
        if (depth > 0 && !['node_modules', '.git', '.agents'].includes(e.name)) visit(`${rel}/`, depth - 1)
      } else if (e.isFile() && statSync(join(root, rel), { throwIfNoEntry: false })?.mtimeMs >= since) {
        if (e.name.endsWith('.xml') && readFileSync(join(root, rel), 'utf8').slice(0, 2048).includes('<testsuite')) found.junit.push(rel)
        else if (e.name === 'index.html' && dir.includes('report')) found.html.push(rel)
      }
    }
  }
  visit('', 5)
  return found
}

// Start the child in its own process group. Stop the group on a timeout (SIGTERM, then SIGKILL after 5 s) and on SIGINT or SIGTERM.
// Windows has no process group signal: taskkill /T stops the child and its tree.
const execute = ({ root, argv, env, limit }, emit) => new Promise((done) => {
  const child = spawn(argv[0], argv.slice(1), { cwd: root, detached: true, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, ...env } })
  const kill = (sig) => {
    if (process.platform === 'win32') { spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore', timeout: 10_000 }); return }
    try { process.kill(-child.pid, sig) } catch { /* the group is gone */ }
  }
  const relay = ['SIGINT', 'SIGTERM'].map((sig) => [sig, () => kill(sig)])
  for (const [sig, fn] of relay) process.on(sig, fn)
  let timedOut = false
  let hard
  const timer = setTimeout(() => { timedOut = true; kill('SIGTERM'); hard = setTimeout(() => kill('SIGKILL'), 5000) }, limit)
  // ponytail: readline holds a line in memory until its newline. A single line of hundreds of MB is not cut.
  for (const stream of [child.stdout, child.stderr]) createInterface({ input: stream }).on('line', emit)
  const finish = (exitCode, signal) => {
    clearTimeout(timer)
    clearTimeout(hard)
    for (const [sig, fn] of relay) process.off(sig, fn)
    done({ exitCode, signal, timedOut })
  }
  child.on('error', (err) => { emit(`error: cannot start ${argv[0]}: ${err.message}`); finish(null, null) })
  child.on('close', finish)
})

export const cli = async (argv, { AC }) => {
  const { values: v, positionals: [name, extra], exit } = parseCommand(argv, USAGE, { root: { type: 'string' }, json: { type: 'boolean' }, list: { type: 'boolean' }, confirm: { type: 'boolean' }, timeout: { type: 'string' } })
  if (exit !== undefined) return exit
  const seconds = v.timeout === undefined ? null : Number(v.timeout)
  if (seconds !== null && !(seconds > 0 && seconds <= MAX_SECONDS)) return usageError(USAGE, `--timeout needs a number of seconds above 0 and up to ${MAX_SECONDS}.`)
  if (extra) return usageError(USAGE, `Unexpected argument: ${extra}`)
  if (!name && !v.list) return usageError(USAGE, 'A command name is necessary. Use ac run --list.')
  const host = hostRoot(AC, v.root)
  if (host.error) return failCommand(v.json, host.error)
  const { root } = host
  const registry = readJson(join(root, REGISTRY))
  if (!isObj(registry)) return failCommand(v.json, `${REGISTRY} is missing or is not valid JSON`)
  if (v.list) {
    console.log(v.json ? JSON.stringify({ ok: true, commands: names(registry) }, null, 2) : names(registry).join('\n'))
    return 0
  }
  const entry = name.split('.').reduce((node, part) => (isObj(node) && Object.hasOwn(node, part) ? node[part] : undefined), registry)
  if (!runnable(entry)) return failCommand(v.json, `${name} is not in ${REGISTRY}. Do not invent a command. Use ac run --list.`)
  const plan = prepare(name, entry, { confirm: v.confirm, seconds })
  if (plan.error) return failCommand(v.json, plan.error)

  const startedMs = Date.now()
  const dir = `.agents/runs/${new Date(startedMs).toISOString().replace(/[:.]/g, '-')}-${name.replace(/[^\w.-]/g, '_')}`
  if (outside(root, `${dir}/output.log`) || outside(root, '.agents/runs/.gitignore')) {
    return failCommand(v.json, '.agents/runs is a symlink or leaves the project root; compass does not write there')
  }
  mkdirSync(join(root, dir), { recursive: true })
  if (!existsSync(join(root, '.agents/runs/.gitignore'))) writeFileSync(join(root, '.agents/runs/.gitignore'), '*\n')
  const log = `${dir}/output.log`
  const fd = openSync(join(root, log), 'w')
  if (!v.json) console.log(`Log: ${log}`)
  const tail = []
  let size = 0
  let pem = false
  const emit = (text) => {
    if (text.includes('-----BEGIN ')) pem = true
    const hide = pem || SECRET_RE.test(text) || SECRET_NAME.test(text)
    if (pem && text.includes('-----END ')) pem = false
    const out = hide ? '[redacted]' : text
    tail.push(out)
    if (tail.length > 100) tail.shift()
    if (size > LOG_CAP) return
    size += out.length + 1
    writeSync(fd, size > LOG_CAP ? `[output cut at ${LOG_CAP / 1024 / 1024} MB]\n` : `${out}\n`)
  }
  const { exitCode, signal, timedOut } = await execute({ root, ...plan }, emit)
  closeSync(fd)

  const ok = exitCode === 0 && !timedOut
  const result = { name, command: plan.cmd, exitCode, signal, timedOut, durationMs: Date.now() - startedMs, startedAt: new Date(startedMs).toISOString(), log, tail, ...reports(root, startedMs) }
  writeFileSync(join(root, dir, 'result.json'), `${JSON.stringify(result, null, 2)}\n`)
  if (v.json) console.log(JSON.stringify({ ok, ...result }, null, 2))
  else {
    if (tail.length) console.log(tail.slice(-40).join('\n'))
    const why = timedOut ? `timed out after ${plan.limit / 1000} s` : signal ? `stopped by ${signal}` : exitCode === null ? 'did not start' : `exited with ${exitCode}`
    console.log(`${ok ? 'ok' : 'FAILED'}: ${name} ${why} in ${(result.durationMs / 1000).toFixed(1)} s. Result: ${dir}/result.json`)
  }
  return ok ? 0 : exitCode || 1
}

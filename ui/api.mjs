// api.mjs — the JSON routes of `ac ui`. A route gets { AC, state, body, query } and returns data,
// or a function (res) that writes the response itself. No shell: a command is process.execPath
// with bin/ac.mjs and fixed arguments, or codexbar, gh, glab or jira with fixed arguments.

import { execFile } from 'node:child_process'
import { createReadStream, existsSync, readdirSync, readFileSync, realpathSync, statSync, writeFileSync } from 'node:fs'
import { basename, dirname, extname, isAbsolute, join, relative, sep } from 'node:path'
import { parseEnv } from 'node:util'
import { CONFIG, DEFAULT_CONFIG, LOCK, loadConfig, projectPaths } from '../engine/config.mjs'
import { onPath } from '../engine/doctor.mjs'
import { isTemplate, questionsDir } from '../engine/docs.mjs'
import { discover } from '../engine/env-check.mjs'
import { encodeValue } from '../engine/env.mjs'
import { outside, syncHost } from '../engine/sync.mjs'
import { frontmatter, hostRoot, isObj, readJson, run, safeRel, walk } from '../engine/util.mjs'

export class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status }
}
const bad = (message, status = 400) => { throw new HttpError(status, message) }

const MAX_OUT = 256 * 1024
const RUNS = '.agents/runs'
const PROCESS = /^[\w.-]+$/
const ENV_NAME = /^[A-Z_][A-Z0-9_]*$/
const RECIPIENT = /^[A-Za-z0-9][\w.@:/-]{0,200}$/
const AGE_FILE = /^\w[\w./-]*\.age$/

const exec = (file, args, { cwd, timeout = 60_000, max = MAX_OUT } = {}) => new Promise((done) => {
  const child = execFile(file, args, { cwd, timeout, maxBuffer: max, encoding: 'utf8', env: { ...process.env, GIT_TERMINAL_PROMPT: '0' } },
    (err, stdout, stderr) => done({ ok: !err, stdout: stdout ?? '', stderr: stderr ?? '', killed: Boolean(err?.killed) || err?.code === 'ERR_CHILD_PROCESS_STDIO_MAXBUFFER' }))
  child.stdin?.end()
})
const ac = (c, args, { root = true, ...opts } = {}) => exec(process.execPath, [join(c.AC, 'bin/ac.mjs'), ...args, ...(root ? ['--root', c.state.root] : [])], { cwd: c.state.root, ...opts })
const parse = (r) => {
  try { return JSON.parse(r.stdout) } catch {
    return { ok: false, errors: [r.killed ? 'The command ran too long or printed too much.' : r.stderr.trim().split('\n')[0] || 'The command printed no JSON.'] }
  }
}
const acJson = async (c, args, opts) => parse(await ac(c, args, opts))

// Load an engine module when a route needs it. A missing module gives 501, so the tab shows "not available".
const engine = async (name, fn) => {
  const mod = await import(`../engine/${name}.mjs`).catch(() => null)
  return typeof mod?.[fn] === 'function' ? mod[fn] : bad(`${name}.${fn} is not available in this compass version.`, 501)
}

const real = (p) => { try { return realpathSync(p) } catch { return null } }
const within = (base, p) => p === base || p.startsWith(base + sep)
const cap = (v, n = 200) => String(v ?? '').slice(0, n)
const scalar = (v) => ['string', 'number', 'boolean'].includes(typeof v)
const heading = (text) => /^#\s+(.+?)\s*$/m.exec(text)?.[1] ?? ''
const ymd = (d) => [d.getFullYear(), d.getMonth() + 1, d.getDate()].map((n, i) => (i ? String(n).padStart(2, '0') : n)).join('-')
// A text file in the project, or null. A symlink, a path that leaves the root and a file above 5 MB give null.
const readIn = (root, rel) => {
  try { return outside(root, rel) || statSync(join(root, rel)).size > 5e6 ? null : readFileSync(join(root, rel), 'utf8') } catch { return null }
}

// `ac usage` reads every transcript. It takes 10 s or more, so it runs in a child process and the answer is cached for 5 minutes, for each range and provider.
const PROVIDERS = ['claude', 'codex', 'all']
const usageData = (c, days, provider, fresh) => {
  const key = `${days}:${provider}`
  const hit = c.state.usage[key]
  if (hit && !fresh && Date.now() - hit.at < 300_000) return hit.promise
  const promise = (async () => {
    await engine('usage', 'readUsage')
    const data = parse(await ac(c, ['usage', '--json', '--provider', provider, '--since', ymd(new Date(Date.now() - (days - 1) * 864e5))], { root: false }))
    return data.ok ? data : bad((data.errors ?? ['The usage command failed.']).join(' '), 502)
  })()
  c.state.usage = { ...c.state.usage, [key]: { at: Date.now(), promise } }
  promise.catch(() => { c.state.usage = { ...c.state.usage, [key]: undefined } })
  return promise
}

// The projects of the last 90 days that hold .agents/compass.json, without the current one.
const roots = async (c, fresh) => {
  const rows = (await usageData(c, 90, 'all', fresh).catch(() => ({ byProject: [] }))).byProject
  return rows.map((r) => r.project).filter((p) => typeof p === 'string' && isAbsolute(p) && p !== c.state.root && existsSync(join(p, CONFIG)))
}

const project = (c) => {
  const lock = readJson(join(c.state.root, LOCK))
  return { root: c.state.root, configured: existsSync(join(c.state.root, CONFIG)), lock: isObj(lock) ? { version: lock.version, tag: lock.tag ?? null } : null }
}

const switchProject = async (c) => {
  const { root } = c.body
  if (typeof root !== 'string' || !((await roots(c)).includes(root))) bad('Choose a project from the list.', 404)
  if (hostRoot(c.AC, root).error) bad('This folder is not a host project.')
  c.state.root = root
  return project(c)
}

// Apply runs in a child process: it can fetch upstream sources, and the server must keep answering.
const sync = (apply) => (c) => (apply ? acJson(c, ['sync', '--json'], { timeout: 10 * 60_000 }) : syncHost({ AC: c.AC, root: c.state.root }))

// The checks and the token items of `ac doctor --tokens`. The paths and the sync changes stay on the server.
const doctorView = async (c) => {
  const d = await acJson(c, ['doctor', '--tokens', '--json'])
  return { ok: d.ok === true, errors: d.errors ?? [], checks: d.checks ?? [], tokens: d.tokens ?? null }
}

const assetView = async (c) => ({ ...(await engine('assets', 'listAssets'))({ AC: c.AC, root: c.state.root }), sync: syncHost({ AC: c.AC, root: c.state.root }) })

const current = (c) => {
  const { errors } = loadConfig(c.state.root, c.AC)
  return errors.length ? bad(errors.join(' '), 409) : { ...DEFAULT_CONFIG, ...readJson(join(c.state.root, CONFIG)) }
}

const toggle = async (c) => {
  const { kind, id, on } = c.body
  if (typeof on !== 'boolean') bad('"on" must be true or false.')
  const [list, setAsset, writeConfig] = await Promise.all([engine('assets', 'listAssets'), engine('assets', 'setAsset'), engine('assets', 'writeConfig')])
  const asset = list({ AC: c.AC, root: c.state.root }).assets?.find((a) => a.kind === kind && a.id === id)
  if (!asset) bad('This asset does not exist.', 404)
  if (on && !asset.available) bad(`This asset is not available: ${asset.reason}`, 409)
  writeConfig(c.state.root, setAsset(current(c), asset, on))
  return assetView(c)
}

const recommend = async (c) => {
  const [recommendedConfig, writeConfig] = await Promise.all([engine('assets', 'recommendedConfig'), engine('assets', 'writeConfig')])
  writeConfig(c.state.root, recommendedConfig({ AC: c.AC, root: c.state.root, config: current(c) }))
  return assetView(c)
}

// An env value never leaves the server. The page gets names and "set" or "empty".
const localFiles = (root) => discover(root).local.filter((f) => safeRel(f) && !outside(root, f) && run('git', ['check-ignore', '-q', '--', f], { cwd: root, timeout: 10_000 }).ok)

const masked = (root) => localFiles(root).map((file) => {
  let vars = []
  try { vars = Object.entries(parseEnv(readFileSync(join(root, file), 'utf8'))).map(([name, v]) => ({ name, state: v === '' ? 'empty' : 'set' })) } catch { /* an unreadable file lists no names */ }
  return { file, vars }
})

const envInfo = async (c) => ({ check: await acJson(c, ['env', 'check', '--json']), files: masked(c.state.root) })

const envValue = (c) => {
  const { root } = c.state
  const { file, name, value } = c.body
  if (!localFiles(root).includes(file)) bad('Choose a git-ignored local env file from the list.')
  if (typeof name !== 'string' || !ENV_NAME.test(name)) bad('A name has capital letters, digits and "_".')
  if (typeof value !== 'string' || /[\r\n\0]/.test(value)) bad('A value must be one line.')
  const enc = /^[\w./:@%+,-]*$/.test(value) ? value : encodeValue(value)
  if (enc === null) bad('This value has no safe quote style.')
  const text = readFileSync(join(root, file), 'utf8')
  const lines = text.split('\n')
  const at = lines.findLastIndex((l) => new RegExp(`^\\s*(?:export\\s+)?${name}\\s*=`).test(l))
  // An entry that spans more lines is not edited in place: the inner lines would become live names.
  if (at >= 0 && parseEnv(lines[at])[name] !== parseEnv(text)[name]) bad('This entry has more than one line. Edit the file by hand.', 409)
  const next = at < 0 ? `${text}${text === '' || text.endsWith('\n') ? '' : '\n'}${name}=${enc}\n` : lines.with(at, `${name}=${enc}`).join('\n')
  if (parseEnv(next)[name] !== value) bad('This entry cannot be edited safely. Edit the file by hand.', 409)
  writeFileSync(join(root, file), next)
  return { ok: true, files: masked(root) }
}

const envExport = (c) => {
  const raw = c.body.to
  const to = (Array.isArray(raw) ? raw : typeof raw === 'string' ? raw.split(',') : []).map((s) => (typeof s === 'string' ? s.trim() : s)).filter(Boolean)
  if (!to.length || to.length > 20 || !to.every((r) => typeof r === 'string' && RECIPIENT.test(r))) bad('Give 1 to 20 recipients: a key file, a user or host/user.')
  return acJson(c, ['env', 'export', '--to', to.join(','), '--json'])
}

const envImport = (c) => {
  const { file } = c.body
  const { root } = c.state
  if (typeof file !== 'string' || !safeRel(file) || !AGE_FILE.test(file)) bad('Give a .age file inside the project.')
  if (outside(root, file) || !statSync(join(root, file), { throwIfNoEntry: false })?.isFile()) bad('This bundle file does not exist.', 404)
  return acJson(c, ['env', 'import', file, '--json'])
}

// The new lines of a log window. The window slides, so find where the old tail meets the new head.
export const newLines = (prev, cur) => {
  for (let k = Math.min(prev.length, cur.length); k > 0; k--) if (prev.slice(-k).join('\n') === cur.slice(0, k).join('\n')) return cur.slice(k)
  return cur
}

// ponytail: `ac dev logs --json` drops the log text, so this polls the text output. Ceiling: a 200-line window every 2 s.
const logs = (c) => {
  const name = c.query.get('name') ?? ''
  if (!PROCESS.test(name)) bad('A process name has letters, digits, "_", "." and "-".')
  return (res) => {
    res.writeHead(200, { 'content-type': 'text/event-stream; charset=utf-8' })
    res.write(': open\n\n')
    let prev = []
    let closed = false
    let timer
    const send = (event, data) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
    const tick = async () => {
      const r = await ac(c, ['dev', 'logs', name, '--tail', '200'], { timeout: 15_000 })
      if (closed) return
      if (r.ok) {
        const cur = r.stdout.split('\n')
        if (cur.at(-1) === '') cur.pop()
        const fresh = newLines(prev, cur)
        prev = cur
        if (fresh.length) send('lines', fresh)
      } else send('fail', r.stderr.trim().split('\n')[0] || 'The log command failed.')
      timer = setTimeout(tick, 2000)
    }
    res.on('close', () => { closed = true; clearTimeout(timer) })
    tick()
  }
}

const strs = (v) => (Array.isArray(v) ? v.filter((s) => typeof s === 'string' && safeRel(s)) : [])

// The result.json files of .agents/runs, newest first.
const results = (root, limit) => {
  if (outside(root, `${RUNS}/x`)) return []
  let dirs
  try { dirs = readdirSync(join(root, RUNS)).sort().reverse().slice(0, limit) } catch { return [] }
  return dirs.flatMap((d) => {
    const r = readJson(join(root, RUNS, d, 'result.json'))
    return isObj(r) ? [{ dir: `${RUNS}/${d}`, name: cap(r.name ?? d), exitCode: Number.isInteger(r.exitCode) ? r.exitCode : null, timedOut: r.timedOut === true, durationMs: Number(r.durationMs) || 0, startedAt: cap(r.startedAt), junit: strs(r.junit), html: strs(r.html) }] : []
  })
}

const tests = async (c) => {
  const list = await acJson(c, ['run', '--list', '--json'])
  return { commands: list.ok ? list.commands : [], errors: list.ok ? [] : list.errors, history: results(c.state.root, 50) }
}

const testRun = async (c) => {
  const { name } = c.body
  const list = await acJson(c, ['run', '--list', '--json'])
  if (typeof name !== 'string' || !PROCESS.test(name) || !(list.commands ?? []).includes(name)) bad('This name is not in agent-compass.commands.json.', 404)
  // ac run stops the command at its own timeout. This limit only stops a stuck child.
  return acJson(c, ['run', name, '--json'], { timeout: 6 * 3600_000 })
}

// A report dir is a sub folder that no segment hides. The project root and .git are never a report dir.
const reportDir = (rel) => { const d = dirname(rel); return d === '.' || d.split('/').some((p) => p.startsWith('.')) ? null : d }

const report = (c) => {
  const { root } = c.state
  const rel = c.query.get('path') ?? ''
  if (!safeRel(rel)) bad('The path must stay inside the project.')
  const top = real(root)
  const file = real(join(root, rel))
  if (!top || !file) bad('This file does not exist.', 404)
  if (!within(top, file)) bad('This file is outside the project.', 403)
  const rs = results(root, Infinity)
  const dirs = [RUNS, ...rs.flatMap((r) => r.html.map(reportDir))].map((d) => d && real(join(root, d)))
  const junit = rs.flatMap((r) => r.junit).map((j) => real(join(root, j)))
  if (!dirs.some((d) => d && within(top, d) && within(d, file)) && !junit.includes(file)) bad('This file is not a run report.', 403)
  const runs = real(join(root, RUNS))
  if (!(runs && within(runs, file)) && relative(top, file).split(sep).some((p) => p.startsWith('.'))) bad('A dot-file is never a run report.', 403)
  if (!statSync(file).isFile()) bad('This path is not a file.', 404)
  const text = ['.log', '.txt', '.xml', '.json'].includes(extname(file).toLowerCase())
  return (res) => {
    res.writeHead(200, text ? { 'content-type': 'text/plain; charset=utf-8' } : { 'content-type': 'application/octet-stream', 'content-disposition': `attachment; filename="${basename(file).replace(/[^\w.-]/g, '_')}"` })
    createReadStream(file).on('error', () => res.destroy()).pipe(res)
  }
}

const SESSIONS_SHOWN = 20

const usage = async (c) => {
  const days = [7, 30, 90].includes(Number(c.query.get('days'))) ? Number(c.query.get('days')) : 30
  const provider = PROVIDERS.includes(c.query.get('provider')) ? c.query.get('provider') : 'all'
  const data = await usageData(c, days, provider, c.query.get('fresh') === '1')
  const sessions = data.bySession ?? []
  return { ...data, bySession: sessions.slice(0, SESSIONS_SHOWN), sessionCount: sessions.length, days, provider, quota: onPath('codexbar') }
}

const quota = async () => {
  if (!onPath('codexbar')) bad('codexbar is not on PATH.', 404)
  const r = await exec('codexbar', ['usage', '--json', '--provider', 'both'], { timeout: 20_000 })
  return { ok: r.ok, text: (r.stdout || r.stderr).slice(0, MAX_OUT) }
}

const files = (root, dir, keep) => {
  try { return outside(root, `${dir}/x`) ? [] : walk(join(root, dir)).filter(keep).slice(0, 300) } catch { return [] }
}
const front = (root, rel) => { const { data, body } = frontmatter(readIn(root, rel) ?? ''); return { data, title: cap(heading(body)) } }

const tickets = (root, paths) => {
  let data = null
  try { data = JSON.parse(readIn(root, `${paths.delivery}/tickets.json`)) } catch { /* no tickets file */ }
  const list = Array.isArray(data) ? data : Object.values(isObj(data) ? data : {}).find(Array.isArray) ?? []
  const rows = list.slice(0, 50).map((t) => (isObj(t) ? Object.fromEntries(Object.entries(t).filter(([, v]) => scalar(v)).map(([k, v]) => [k, cap(v, 120)])) : {}))
  return { count: list.length, rows }
}

const audit = (root, paths) => {
  const counts = Object.create(null)
  let total = 0
  for (const line of (readIn(root, `${paths.planning}/audit/rows.jsonl`) ?? '').split('\n')) {
    let row
    try { row = JSON.parse(line) } catch { continue }
    if (!isObj(row)) continue
    const status = cap(row.status ?? 'unknown', 40)
    counts[status] = (counts[status] ?? 0) + 1
    total++
  }
  return { total, counts }
}

const delivery = (c) => {
  const { root } = c.state
  const p = projectPaths(root, c.AC)
  if (p.errors.length) return { ok: false, errors: p.errors }
  const dir = questionsDir(p.paths)
  const raid = files(root, dir, (f) => /^Q-\d{3,}\.md$/.test(f)).map((file) => {
    const { data, title } = front(root, `${dir}/${file}`)
    return { file, id: cap(data.id), kind: cap(data.kind), status: cap(data.status), owner: cap(data.owner), ticket: cap(data.ticket), title }
  })
  const adrs = files(root, p.paths.adr, (f) => /\.md$/i.test(f) && !/^(readme|index)\.md$/i.test(basename(f)) && !isTemplate(basename(f))).map((file) => {
    const { data, title } = front(root, `${p.paths.adr}/${file}`)
    return { file, title, status: cap(data.status) }
  })
  return { ok: true, raid, tickets: tickets(root, p.paths), audit: audit(root, p.paths), adrs }
}

// A read-only issue list. The command, its arguments and its limits are fixed. The page gets plain text and http(s) links only.
const names = (list, ...keys) => (Array.isArray(list) ? list : []).map((x) => (isObj(x) ? keys.map((k) => x[k]).find(scalar) : x)).filter(scalar).map((x) => cap(x, 60)).join(', ')
const issue = (i) => {
  const t = isObj(i) ? i : {}
  const url = t.url ?? t.web_url
  return { number: cap(t.number ?? t.iid, 20), title: cap(t.title), state: cap(t.state, 20), labels: names(t.labels, 'name'), assignee: names(t.assignees, 'login', 'username'), url: /^https?:\/\//.test(url) ? cap(url, 300) : '' }
}

// `jira issue list --raw` prints REST issues: a list, or an object with the list in `issues`. The link is the part of `self` before "/rest/" and "/browse/<key>".
const jiraList = (data) => (Array.isArray(data) ? data : data?.issues)
const jiraIssue = (i) => {
  const t = isObj(i) ? i : {}
  const f = isObj(t.fields) ? t.fields : {}
  const base = /^(https?:\/\/[^\s?#]+?)\/rest\//.exec(t.self)?.[1]
  return { number: cap(t.key, 40), title: cap(f.summary), state: cap(f.status?.name, 40), labels: names(f.labels), assignee: cap(f.assignee?.displayName, 60), url: base && /^[\w-]+$/.test(t.key) ? cap(`${base}/browse/${t.key}`, 300) : '' }
}

const TRACKERS = {
  github: { cli: 'gh', login: 'gh auth login', args: ['issue', 'list', '--json', 'number,title,state,labels,assignees,url', '--limit', '100'], row: issue },
  gitlab: { cli: 'glab', login: 'glab auth login', args: ['issue', 'list', '--output', 'json', '--per-page', '100'], row: issue },
  jira: { cli: 'jira', login: 'jira init', args: ['issue', 'list', '--raw', '--paginate', '0:100'], row: jiraIssue, list: jiraList, max: 4 * 1024 * 1024 },
}
const message = (text) => cap(text.replace(/\x1b\[[\d;]*m/g, '').replace(/\s+/g, ' ').trim())

const pull = async (c) => {
  const { tracker } = c.body
  if (typeof tracker !== 'string' || !Object.hasOwn(TRACKERS, tracker)) bad('"tracker" must be github, gitlab or jira.')
  const { cli, login, args, row, list: pick = (data) => data, max } = TRACKERS[tracker]
  const fail = (text) => ({ ok: false, errors: [text] })
  if (!onPath(cli)) return fail(`${cli} is not on PATH. Install it and run "${login}".`)
  const r = await exec(cli, args, { cwd: c.state.root, timeout: 20_000, max })
  if (!r.ok) return fail(r.killed ? 'The command ran too long or printed too much.' : message(r.stderr) || `${cli} failed.`)
  let data
  try { data = JSON.parse(r.stdout) } catch { /* the check below reports it */ }
  const list = pick(data)
  return Array.isArray(list) ? { ok: true, tracker, count: list.length, rows: list.slice(0, 100).map((x) => row(x)) } : fail(`${cli} printed no JSON list.`)
}

const candidates = async (c) => (await engine('promote', 'candidates'))({ AC: c.AC, root: c.state.root })

const promote = async (c) => {
  const { skill } = c.body
  const promoteSkill = await engine('promote', 'promote')
  if (!(await candidates(c)).some((x) => x.name === skill)) bad('Choose a skill from the candidate list.', 404)
  return promoteSkill({ AC: c.AC, root: c.state.root, skill, dry: c.body.dry !== false })
}

export const routes = {
  'GET /api/project': project,
  'GET /api/project/others': async (c) => ({ others: await roots(c, c.query.get('fresh') === '1') }),
  'POST /api/project': switchProject,
  'GET /api/doctor': doctorView,
  'GET /api/sync': sync(false),
  'POST /api/sync': sync(true),
  'GET /api/assets': assetView,
  'POST /api/assets': toggle,
  'POST /api/assets/recommended': recommend,
  'GET /api/env': envInfo,
  'POST /api/env/value': envValue,
  'POST /api/env/export': envExport,
  'POST /api/env/import': envImport,
  'GET /api/run': (c) => acJson(c, ['dev', 'status', '--json']),
  'POST /api/run/up': (c) => acJson(c, ['dev', 'up', '--json'], { timeout: 180_000 }),
  'POST /api/run/down': (c) => acJson(c, ['dev', 'down', '--json']),
  'GET /api/run/logs': logs,
  'GET /api/tests': tests,
  'POST /api/tests/run': testRun,
  'GET /api/report': report,
  'GET /api/usage': usage,
  'POST /api/usage/quota': quota,
  'GET /api/delivery': delivery,
  'POST /api/delivery/pull': pull,
  'GET /api/promote': async (c) => ({ candidates: await candidates(c) }),
  'POST /api/promote': promote,
}

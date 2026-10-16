import assert from 'node:assert/strict'
import { spawn, spawnSync } from 'node:child_process'
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import http from 'node:http'
import { tmpdir } from 'node:os'
import { delimiter, dirname, join } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { KINDS } from '../engine/assets.mjs'
import { newLines } from '../ui/api.mjs'
import { createServer } from '../ui/server.mjs'
import { runNode } from './helpers.mjs'

const REPO = dirname(dirname(fileURLToPath(import.meta.url)))
const TOKEN = 'test-token-0123456789abcdefghijkl'
const CSP = "default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'"
const temps = []
const servers = []
test.after(() => {
  for (const s of servers) { s.closeAllConnections(); s.close() }
  for (const dir of temps) rmSync(dir, { recursive: true, force: true })
})

const temp = (prefix = 'ac-ui-') => {
  const dir = mkdtempSync(join(tmpdir(), prefix))
  temps.push(dir)
  return dir
}
const put = (root, files) => {
  for (const [rel, text] of Object.entries(files)) {
    mkdirSync(dirname(join(root, rel)), { recursive: true })
    writeFileSync(join(root, rel), typeof text === 'string' ? text : `${JSON.stringify(text, null, 2)}\n`)
  }
}
const git = (root, ...args) => spawnSync('git', args, { cwd: root, encoding: 'utf8' })

// A temp host project that `ac init` made. `git` adds a git repo with an ignored .env.local.
const host = async ({ withGit = false, files = {} } = {}) => {
  const root = temp()
  if (withGit) { git(root, 'init', '-q'); put(root, { '.gitignore': '.env.local\n.agents/\n' }) }
  const init = await runNode([join(REPO, 'bin/ac.mjs'), 'init', '--root', root])
  assert.equal(init.code, 0, init.stderr)
  put(root, files)
  return root
}

const start = async (root) => {
  const server = createServer({ AC: REPO, root, token: TOKEN })
  servers.push(server)
  await new Promise((ok) => server.listen(0, '127.0.0.1', ok))
  return { server, port: server.address().port }
}

// A raw request, so a test can set the Host and Origin headers.
const call = (port, { method = 'GET', path = '/', headers = {}, body, token = TOKEN } = {}) => new Promise((resolve, reject) => {
  const h = { host: `127.0.0.1:${port}`, ...(token ? { 'x-ac-token': token } : {}), ...headers }
  const req = http.request({ host: '127.0.0.1', port, method, path, headers: h }, (res) => {
    const chunks = []
    res.on('data', (c) => chunks.push(c))
    res.on('end', () => {
      const text = Buffer.concat(chunks).toString('utf8')
      resolve({ status: res.statusCode, headers: res.headers, text, json: () => JSON.parse(text) })
    })
  })
  req.on('error', reject)
  req.end(body)
})
const post = (port, path, data, headers = {}) => call(port, { method: 'POST', path, headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(data) })

// ---- security ----

test('the server listens on 127.0.0.1 only', async () => {
  const { server } = await start(await host())
  assert.equal(server.address().address, '127.0.0.1')
  assert.ok(server.address().port > 0)
})

test('ac ui cli prints a URL with a 24-byte token, serves it, and checks its options', async () => {
  const root = await host()
  const script = `import { cli } from ${JSON.stringify(join(REPO, 'ui/server.mjs'))}\nprocess.exitCode = await cli(${JSON.stringify(['--root', root])}, { AC: ${JSON.stringify(REPO)} })`
  const child = spawn(process.execPath, ['--input-type=module', '-e', script], { stdio: ['ignore', 'pipe', 'pipe'] })
  try {
    const line = await new Promise((ok, no) => {
      let out = ''
      child.stdout.on('data', (d) => { out += d; if (out.includes('\n')) ok(out.trim()) })
      child.on('error', no)
      setTimeout(() => no(new Error('no URL printed')), 15_000)
    })
    const m = /^http:\/\/127\.0\.0\.1:(\d+)\/\?token=([A-Za-z0-9_-]{32})$/.exec(line)
    assert.ok(m, line)
    assert.equal(Buffer.from(m[2], 'base64url').length, 24)
    const res = await call(Number(m[1]), { path: '/api/sync', token: m[2] })
    assert.equal(res.status, 200)
  } finally { child.kill() }
  const bad = await runNode(['--input-type=module', '-e', `import { cli } from ${JSON.stringify(join(REPO, 'ui/server.mjs'))}\nprocess.exitCode = await cli(['--port', 'abc'], { AC: ${JSON.stringify(REPO)} })`])
  assert.equal(bad.code, 2)
  assert.match(bad.stderr, /--port needs a whole number/)
})

test('a Host header that is not 127.0.0.1 or localhost with the port gets 403', async () => {
  const { port } = await start(await host())
  for (const h of ['evil.example', `evil.example:${port}`, `127.0.0.1:${port + 1}`, '127.0.0.1', `localhost.evil.example:${port}`]) {
    assert.equal((await call(port, { headers: { host: h } })).status, 403, h)
    assert.equal((await call(port, { path: '/api/sync', headers: { host: h } })).status, 403, h)
  }
  assert.equal((await call(port, { path: '/api/sync', headers: { host: `localhost:${port}` } })).status, 200)
  assert.equal((await call(port, { headers: { host: `127.0.0.1:${port}` } })).status, 200)
})

test('an API call needs the token, in the header or (GET only) in the query', async () => {
  const { port } = await start(await host())
  assert.equal((await call(port, { path: '/api/sync', token: null })).status, 401)
  assert.equal((await call(port, { path: '/api/sync', token: 'wrong' })).status, 401)
  assert.equal((await call(port, { path: '/api/sync', token: `${TOKEN}x` })).status, 401)
  assert.equal((await call(port, { path: '/api/sync' })).status, 200)
  assert.equal((await call(port, { path: `/api/sync?token=${TOKEN}`, token: null })).status, 200)
  assert.equal((await call(port, { path: '/api/sync?token=wrong', token: null })).status, 401)
  const noHeader = await call(port, { method: 'POST', path: `/api/sync?token=${TOKEN}`, token: null, headers: { 'content-type': 'application/json' }, body: '{}' })
  assert.equal(noHeader.status, 401)
  assert.equal((await call(port, { path: '/api/unknown', token: null })).status, 401)
  assert.equal((await call(port, { path: '/api/unknown' })).status, 404)
})

test('a POST needs the JSON content type', async () => {
  const { port } = await start(await host())
  for (const type of ['text/plain', 'application/x-www-form-urlencoded', 'multipart/form-data', 'application/jsonx']) {
    assert.equal((await call(port, { method: 'POST', path: '/api/sync', headers: { 'content-type': type }, body: '{}' })).status, 415, type)
  }
  assert.equal((await call(port, { method: 'POST', path: '/api/sync', body: '{}' })).status, 415)
  assert.equal((await post(port, '/api/sync', {}, { 'content-type': 'application/json; charset=utf-8' })).status, 200)
  assert.equal((await call(port, { method: 'POST', path: '/api/sync', headers: { 'content-type': 'application/json' }, body: '{oops' })).status, 400)
  assert.equal((await call(port, { method: 'POST', path: '/api/sync', headers: { 'content-type': 'application/json' }, body: '[1]' })).status, 400)
})

test('a POST with a foreign Origin gets 403', async () => {
  const { port } = await start(await host())
  for (const origin of ['http://evil.example', 'null', `http://127.0.0.1:${port + 1}`, `https://127.0.0.1:${port}`]) {
    assert.equal((await post(port, '/api/sync', {}, { origin })).status, 403, origin)
  }
  assert.equal((await post(port, '/api/sync', {}, { origin: `http://127.0.0.1:${port}` })).status, 200)
  assert.equal((await post(port, '/api/sync', {})).status, 200)
})

test('a POST body above 1 MB gets 413', async () => {
  const { port } = await start(await host())
  const big = await post(port, '/api/sync', { pad: 'x'.repeat(1024 * 1024 + 1) })
  assert.equal(big.status, 413)
  const ok = await post(port, '/api/sync', { pad: 'x'.repeat(1024 * 1024 - 100) })
  assert.equal(ok.status, 200)
})

test('every response carries the security headers', async () => {
  const { port } = await start(await host())
  const responses = [
    await call(port), await call(port, { path: '/app.js' }), await call(port, { path: '/api/sync' }), await call(port, { path: '/api/sync', token: null }),
    await call(port, { path: '/nope' }), await call(port, { headers: { host: 'evil.example' } }), await call(port, { method: 'POST', path: '/' }),
  ]
  assert.deepEqual(responses.map((r) => r.status), [200, 200, 200, 401, 404, 403, 405])
  for (const r of responses) {
    assert.equal(r.headers['content-security-policy'], CSP)
    assert.equal(r.headers['x-content-type-options'], 'nosniff')
    assert.equal(r.headers['referrer-policy'], 'no-referrer')
    assert.equal(r.headers['cache-control'], 'no-store')
  }
})

test('only the three public files are served', async () => {
  const { port } = await start(await host())
  const types = { '/': 'text/html', '/index.html': 'text/html', '/app.js': 'text/javascript', '/style.css': 'text/css' }
  for (const [path, type] of Object.entries(types)) {
    const r = await call(port, { path, token: null })
    assert.equal(r.status, 200, path)
    assert.match(r.headers['content-type'], new RegExp(`^${type}`))
  }
  for (const path of ['/public/', '/public/app.js', '/server.mjs', '/api.mjs', '/package.json', '/../package.json', '/%2e%2e/package.json', '/app.js/', '/.env', '/favicon.ico', '/style.css.map']) {
    assert.equal((await call(port, { path, token: null })).status, 404, path)
  }
  assert.equal((await call(port, { path: '//evil.example/app.js', token: null })).status, 400)
})

test('the page puts no server data into HTML', () => {
  const app = readFileSync(join(REPO, 'ui/public/app.js'), 'utf8')
  assert.doesNotMatch(app, /innerHTML|outerHTML|insertAdjacentHTML|document\.write|eval\(|new Function/)
  const html = readFileSync(join(REPO, 'ui/public/index.html'), 'utf8')
  assert.doesNotMatch(html, /<script(?![^>]*\bsrc=)|\son\w+=|style=|https?:\/\//)
  const css = readFileSync(join(REPO, 'ui/public/style.css'), 'utf8')
  assert.doesNotMatch(css, /@import|url\(/)
  assert.doesNotMatch(readFileSync(join(REPO, 'ui/api.mjs'), 'utf8'), /shell\s*:\s*true|\bexec\(`|execSync|spawnSync\(/)
})

test('the page has a label for every asset kind and the buttons of the tracker pull', () => {
  const app = readFileSync(join(REPO, 'ui/public/app.js'), 'utf8')
  const labels = /const KINDS = \{([^}]+)\}/.exec(app)[1]
  assert.deepEqual([...labels.matchAll(/(\w+): '/g)].map((m) => m[1]), KINDS)
  assert.match(labels, /plugin: 'Claude plugins'/)
  assert.match(app, /pull\('github', 'GitHub'\), pull\('gitlab', 'GitLab'\)/)
  assert.match(app, /mcp-atlassian/)
})

// ---- report files ----

test('the report route serves only run reports inside the project', async () => {
  const outsideDir = temp('ac-ui-outside-')
  put(outsideDir, { 'secret.txt': 'top secret' })
  const root = await host({
    files: {
      '.agents/runs/2026-01-01T00-00-00-000Z-test/output.log': 'the log\n',
      '.agents/runs/2026-01-01T00-00-00-000Z-test/result.json': { name: 'test', exitCode: 0, durationMs: 5, startedAt: '2026-01-01T00:00:00.000Z', junit: ['out/junit.xml'], html: ['playwright-report/index.html', 'index.html', '.git/index.html'] },
      'out/junit.xml': '<testsuite/>',
      'out/other.xml': '<x/>',
      'playwright-report/index.html': '<html></html>',
      'playwright-report/data/trace.zip': 'zip',
      'index.html': '<html>root</html>',
      '.env': 'SECRET=1\n',
      'secret.txt': 'project file',
    },
  })
  symlinkSync(join(outsideDir, 'secret.txt'), join(root, '.agents/runs/link.txt'))
  symlinkSync(outsideDir, join(root, 'playwright-report/escape'))
  const { port } = await start(root)
  const get = (path) => call(port, { path: `/api/report?path=${encodeURIComponent(path)}`, token: null, headers: { 'x-ac-token': TOKEN } })
  const status = async (path) => (await get(path)).status

  for (const path of ['../secret.txt', '../../etc/passwd', '.agents/runs/../../secret.txt', '.agents/runs/./x', '/etc/passwd', '', '.agents//runs', '.agents\\runs\\x']) assert.equal(await status(path), 400, path)
  assert.equal((await call(port, { path: `/api/report?path=%2e%2e%2fsecret.txt` })).status, 400)
  assert.equal((await call(port, { path: '/api/report' })).status, 400)
  assert.equal(await status('.agents/runs/link.txt'), 403)
  assert.equal(await status('playwright-report/escape/secret.txt'), 403)
  for (const path of ['secret.txt', '.env', 'out/other.xml', 'index.html', '.agents/compass.json']) assert.equal(await status(path), 403, path)
  assert.equal(await status('.agents/runs/nope.log'), 404)

  const log = await get('.agents/runs/2026-01-01T00-00-00-000Z-test/output.log')
  assert.equal(log.status, 200)
  assert.equal(log.text, 'the log\n')
  assert.match(log.headers['content-type'], /^text\/plain/)
  assert.equal((await get('out/junit.xml')).status, 200)
  const html = await get('playwright-report/index.html')
  assert.equal(html.status, 200)
  assert.match(html.headers['content-disposition'], /^attachment/)
  assert.equal((await get('playwright-report/data/trace.zip')).status, 200)
  const viaQuery = await call(port, { path: `/api/report?path=out%2Fjunit.xml&token=${TOKEN}`, token: null })
  assert.equal(viaQuery.status, 200)

  put(root, {
    '.agents/runs/2026-01-02T00-00-00-000Z-x/result.json': { name: 'x', exitCode: 0, junit: ['.env.local'], html: ['apps/report-ui/index.html'] },
    '.env.local': 'SECRET=1\n',
    'apps/report-ui/index.html': '<html></html>',
    'apps/report-ui/.env': 'SECRET=2\n',
  })
  for (const path of ['.env.local', 'apps/report-ui/.env']) assert.equal(await status(path), 403, `${path}: a dot-file is never a report`)
  assert.equal(await status('apps/report-ui/index.html'), 200)
})

// ---- happy paths ----

test('GET /api/sync and /api/project describe a host made by ac init', async () => {
  const root = await host()
  const { port } = await start(root)
  const sync = (await call(port, { path: '/api/sync' })).json()
  assert.equal(sync.ok, true)
  assert.equal(sync.drift, false)
  assert.deepEqual(sync.changes, [])
  assert.match(sync.version, /^\d+\.\d+\.\d+/)
  const project = (await call(port, { path: '/api/project' })).json()
  assert.equal(project.root, root)
  assert.equal(project.configured, true)
  assert.equal(project.lock.version, sync.version)
  assert.equal(project.others, undefined)
})

test('POST /api/sync applies a sync', async () => {
  const root = await host()
  rmSync(join(root, '.agents/compass.lock.json'))
  const { port } = await start(root)
  const diff = (await call(port, { path: '/api/sync' })).json()
  assert.equal(diff.drift, true)
  assert.equal(existsSync(join(root, '.agents/compass.lock.json')), false)
  const applied = (await post(port, '/api/sync', {})).json()
  assert.equal(applied.ok, true)
  assert.equal(existsSync(join(root, '.agents/compass.lock.json')), true)
  assert.equal((await call(port, { path: '/api/sync' })).json().drift, false)
})

test('the delivery tab reads the RAID, tickets, audit and ADR files', async () => {
  const root = await host({
    files: {
      'docs/delivery/questions/Q-001.md': '---\nid: Q-001\nkind: question\nstatus: open\nraisedAt: 2026-01-01\nraisedBy: me\nowner: ana\nspecRef: x\ntaskRef: y\nticket: ABC-1\n---\n\n# Which auth flow?\n',
      'docs/delivery/questions/notes.md': '# Not a RAID file\n',
      'docs/delivery/tickets.json': { tickets: [{ id: 'ABC-1', title: 'First', points: 3, nested: { a: 1 } }, { id: 'ABC-2', title: 'Second' }] },
      'docs/planning/audit/rows.jsonl': '{"status":"done"}\n{"status":"done"}\n{"status":"todo"}\nnot json\n',
      'docs/decisions/0001-use-x.md': '---\nstatus: accepted\ndate: 2026-01-01\n---\n\n# Use X\n',
      'docs/decisions/0000-template.md': '# Template\n',
    },
  })
  const { port } = await start(root)
  const d = (await call(port, { path: '/api/delivery' })).json()
  assert.equal(d.ok, true)
  assert.deepEqual(d.raid.map((r) => [r.file, r.id, r.kind, r.status, r.owner, r.ticket, r.title]), [['Q-001.md', 'Q-001', 'question', 'open', 'ana', 'ABC-1', 'Which auth flow?']])
  assert.equal(d.tickets.count, 2)
  assert.deepEqual(d.tickets.rows[0], { id: 'ABC-1', title: 'First', points: '3' })
  assert.deepEqual({ ...d.audit.counts }, { done: 2, todo: 1 })
  assert.equal(d.audit.total, 3)
  assert.deepEqual(d.adrs, [{ file: '0001-use-x.md', title: 'Use X', status: 'accepted' }])
})

test('the delivery tab shows nothing for a host without delivery files', async () => {
  const { port } = await start(await host())
  const d = (await call(port, { path: '/api/delivery' })).json()
  assert.deepEqual([d.raid, d.tickets, d.audit.total, d.adrs], [[], { count: 0, rows: [] }, 0, []])
})

// ---- tracker pull ----

// A fake tracker CLI: it records its arguments, its directory and its prompt setting, prints a fixed text and exits.
const fakeCli = (dir, name, { stdout = '', stderr = '', code = 0 } = {}) => {
  const log = JSON.stringify(join(dir, `${name}.log`))
  writeFileSync(join(dir, name), `#!${process.execPath}\nrequire('node:fs').appendFileSync(${log}, JSON.stringify({ args: process.argv.slice(2), cwd: process.cwd(), prompt: process.env.GIT_TERMINAL_PROMPT }) + '\\n')\nprocess.stdout.write(${JSON.stringify(stdout)})\nprocess.stderr.write(${JSON.stringify(stderr)})\nprocess.exitCode = ${code}\n`)
  chmodSync(join(dir, name), 0o755)
}
const calls = (dir, name) => (existsSync(join(dir, `${name}.log`)) ? readFileSync(join(dir, `${name}.log`), 'utf8').trim().split('\n').map((l) => JSON.parse(l)) : [])
const withPath = async (path, fn) => {
  const old = process.env.PATH
  process.env.PATH = path
  try { return await fn() } finally { process.env.PATH = old }
}
const GH = [{ number: 12, title: 'Fix the login', state: 'OPEN', labels: [{ name: 'bug' }, { name: 'ui' }], assignees: [{ login: 'ana' }, { login: 'bob' }], url: 'https://github.com/o/r/issues/12' }, { number: 13, title: 'No links', state: 'OPEN', labels: [], assignees: [], url: 'javascript:alert(1)' }]
const GL = [{ iid: 7, title: 'Slow page', state: 'opened', labels: ['perf'], assignees: [{ username: 'cy' }], web_url: 'https://gitlab.example/g/p/-/issues/7' }]

test('the tracker pull runs a fixed read-only list command in the project root and shows plain rows', async () => {
  const root = await host()
  const bin = temp('ac-ui-bin-')
  fakeCli(bin, 'gh', { stdout: JSON.stringify(GH) })
  fakeCli(bin, 'glab', { stdout: JSON.stringify(GL) })
  const { port } = await start(root)
  await withPath(`${bin}${delimiter}${process.env.PATH}`, async () => {
    const gh = (await post(port, '/api/delivery/pull', { tracker: 'github' })).json()
    assert.equal(gh.ok, true)
    assert.equal(gh.count, 2)
    assert.deepEqual(gh.rows, [
      { number: '12', title: 'Fix the login', state: 'OPEN', labels: 'bug, ui', assignee: 'ana, bob', url: 'https://github.com/o/r/issues/12' },
      { number: '13', title: 'No links', state: 'OPEN', labels: '', assignee: '', url: '' },
    ])
    const gl = (await post(port, '/api/delivery/pull', { tracker: 'gitlab' })).json()
    assert.deepEqual(gl.rows, [{ number: '7', title: 'Slow page', state: 'opened', labels: 'perf', assignee: 'cy', url: 'https://gitlab.example/g/p/-/issues/7' }])
  })
  assert.deepEqual(calls(bin, 'gh'), [{ args: ['issue', 'list', '--json', 'number,title,state,labels,assignees,url', '--limit', '100'], cwd: realpathSync(root), prompt: '0' }])
  assert.deepEqual(calls(bin, 'glab').map((c) => c.args), [['issue', 'list', '--output', 'json', '--per-page', '100']])
})

test('the tracker pull accepts only github and gitlab, and caps what it shows', async () => {
  const bin = temp('ac-ui-bin-')
  const many = Array.from({ length: 130 }, (_, i) => ({ number: i, title: 'T'.repeat(500), state: 'OPEN', labels: [], assignees: [], url: '' }))
  fakeCli(bin, 'gh', { stdout: JSON.stringify(many) })
  const { port } = await start(await host())
  await withPath(`${bin}${delimiter}${process.env.PATH}`, async () => {
    for (const tracker of ['jira', '', '-h', 'github;id', ['github'], 5, undefined]) assert.equal((await post(port, '/api/delivery/pull', { tracker })).status, 400, JSON.stringify(tracker))
    assert.equal((await post(port, '/api/delivery/pull', {})).status, 400)
    assert.deepEqual(calls(bin, 'gh'), [], 'a bad tracker starts no command')
    const r = (await post(port, '/api/delivery/pull', { tracker: 'github' })).json()
    assert.equal(r.rows.length, 100)
    assert.equal(r.count, 130)
    assert.equal(r.rows[0].title.length, 200)
  })
  assert.equal((await call(port, { method: 'POST', path: '/api/delivery/pull', token: null, headers: { 'content-type': 'application/json' }, body: '{"tracker":"github"}' })).status, 401)
})

test('the tracker pull gives a short message for a missing CLI, a failed login and a bad answer', async () => {
  const bin = temp('ac-ui-bin-')
  const { port } = await start(await host())
  await withPath(temp('ac-ui-nopath-'), async () => {
    const r = (await post(port, '/api/delivery/pull', { tracker: 'gitlab' })).json()
    assert.equal(r.ok, false)
    assert.match(r.errors[0], /^glab is not on PATH/)
  })
  fakeCli(bin, 'gh', { stderr: 'To get started with GitHub CLI, please run:  gh auth login\nOr set GH_TOKEN.\n', code: 4 })
  fakeCli(bin, 'glab', { stdout: 'not json' })
  await withPath(`${bin}${delimiter}${process.env.PATH}`, async () => {
    const login = (await post(port, '/api/delivery/pull', { tracker: 'github' })).json()
    assert.deepEqual([login.ok, login.errors], [false, ['To get started with GitHub CLI, please run: gh auth login Or set GH_TOKEN.']])
    const bad = (await post(port, '/api/delivery/pull', { tracker: 'gitlab' })).json()
    assert.deepEqual([bad.ok, bad.errors], [false, ['glab printed no JSON list.']])
  })
})

// ---- commands ----

test('a test run needs a name from the registry, and its result lands in the history', async () => {
  const root = await host({ files: { 'agent-compass.commands.json': { schema: 1, test: 'node --version', fail: 'node -e "process.exit(3)"' } } })
  const { port } = await start(root)
  const list = (await call(port, { path: '/api/tests' })).json()
  assert.deepEqual(list.commands, ['test', 'fail'])
  assert.deepEqual(list.history, [])
  for (const name of ['nope', '--help', '../x', 'test; id', 5, undefined]) assert.equal((await post(port, '/api/tests/run', { name })).status, 404, String(name))
  const ran = (await post(port, '/api/tests/run', { name: 'test' })).json()
  assert.equal(ran.ok, true)
  assert.equal(ran.exitCode, 0)
  const failed = (await post(port, '/api/tests/run', { name: 'fail' })).json()
  assert.equal(failed.ok, false)
  assert.equal(failed.exitCode, 3)
  const after = (await call(port, { path: '/api/tests' })).json()
  assert.deepEqual(after.history.map((r) => [r.name, r.exitCode]).sort(), [['fail', 3], ['test', 0]])
  assert.ok(after.history[0].dir.startsWith('.agents/runs/'))
  assert.ok(after.history[0].startedAt >= after.history[1].startedAt)
  const log = await call(port, { path: `/api/report?path=${encodeURIComponent(`${after.history[0].dir}/output.log`)}` })
  assert.equal(log.status, 200)
})

test('a test run without a registry lists no command', async () => {
  const { port } = await start(await host())
  const list = (await call(port, { path: '/api/tests' })).json()
  assert.deepEqual(list.commands, [])
  assert.equal(list.errors.length, 1)
})

test('the run tab reports a stack that is not there, and checks the log process name', async () => {
  const { port } = await start(await host())
  const status = (await call(port, { path: '/api/run' })).json()
  assert.equal(status.ok, false)
  assert.ok(status.errors.length)
  for (const name of ['a b', '../x', 'x;id', '', '-h&x']) assert.equal((await call(port, { path: `/api/run/logs?name=${encodeURIComponent(name)}` })).status, 400, name)
  assert.equal((await call(port, { path: '/api/run/logs?name=web', token: null })).status, 401)
  assert.equal((await call(port, { path: '/api/run/logs?name=web&token=wrong', token: null })).status, 401)
})

test('the log stream is an event stream that stops when the client leaves', async () => {
  const { port } = await start(await host())
  const first = await new Promise((resolve, reject) => {
    const req = http.get({ host: '127.0.0.1', port, path: `/api/run/logs?name=web&token=${TOKEN}`, headers: { host: `127.0.0.1:${port}` } }, (res) => {
      res.once('data', (chunk) => { req.destroy(); resolve({ status: res.statusCode, type: res.headers['content-type'], csp: res.headers['content-security-policy'], text: String(chunk) }) })
    })
    req.on('error', reject)
  })
  assert.equal(first.status, 200)
  assert.match(first.type, /^text\/event-stream/)
  assert.equal(first.csp, CSP)
  assert.ok(first.text.startsWith(': open'))

  // A fake ac counts its runs. After the client leaves, no new poll starts.
  const fake = temp('ac-ui-fake-')
  const count = join(fake, 'count')
  put(fake, { 'bin/ac.mjs': "import { appendFileSync } from 'node:fs'\nappendFileSync(process.env.AC_UI_TEST_COUNT, 'x')\nconsole.log('{\"ok\":true,\"lines\":[]}')\n" })
  process.env.AC_UI_TEST_COUNT = count
  const server = createServer({ AC: fake, root: await host(), token: TOKEN })
  servers.push(server)
  await new Promise((ok) => server.listen(0, '127.0.0.1', ok))
  const p = server.address().port
  await new Promise((resolve, reject) => {
    const req = http.get({ host: '127.0.0.1', port: p, path: `/api/run/logs?name=web&token=${TOKEN}`, headers: { host: `127.0.0.1:${p}` } }, (res) => {
      res.once('data', () => setTimeout(() => { req.destroy(); resolve() }, 2500))
    })
    req.on('error', reject)
  })
  await new Promise((ok) => setTimeout(ok, 500))
  const after = existsSync(count) ? readFileSync(count, 'utf8').length : 0
  assert.ok(after >= 1, 'the stream polled while the client was there')
  await new Promise((ok) => setTimeout(ok, 4500))
  assert.equal(readFileSync(count, 'utf8').length, after, 'no poll after the client left')
})

test('newLines finds the lines that are new in a sliding log window', () => {
  assert.deepEqual(newLines([], ['a', 'b']), ['a', 'b'])
  assert.deepEqual(newLines(['a', 'b'], ['a', 'b']), [])
  assert.deepEqual(newLines(['a', 'b', 'c'], ['b', 'c', 'd', 'e']), ['d', 'e'])
  assert.deepEqual(newLines(['a', 'b'], ['x', 'y']), ['x', 'y'])
  assert.deepEqual(newLines(['a', 'b'], []), [])
})

// ---- env ----

const envHost = () => host({ withGit: true, files: { '.env.local': 'API_KEY=s3cr3t-value-123\nEMPTY=\nPORT=3000\n', '.env.other': 'LEAK=other-secret\n', '.env.example': 'API_KEY=\n', 'a.age': 'x' } })

test('the env tab lists names and states, never values, for git-ignored local files only', async () => {
  const { port } = await start(await envHost())
  const res = await call(port, { path: '/api/env' })
  assert.equal(res.status, 200)
  assert.doesNotMatch(res.text, /s3cr3t|3000|other-secret/)
  const d = res.json()
  assert.deepEqual(d.files, [{ file: '.env.local', vars: [{ name: 'API_KEY', state: 'set' }, { name: 'EMPTY', state: 'empty' }, { name: 'PORT', state: 'set' }] }])
  assert.ok(Array.isArray(d.check.findings))
})

test('an env edit changes one value in place, or appends it, and checks its inputs', async () => {
  const root = await envHost()
  const { port } = await start(root)
  const edit = (body) => post(port, '/api/env/value', body)
  assert.equal((await edit({ file: '.env.local', name: 'PORT', value: '4000' })).status, 200)
  assert.equal(readFileSync(join(root, '.env.local'), 'utf8'), 'API_KEY=s3cr3t-value-123\nEMPTY=\nPORT=4000\n')
  const added = await edit({ file: '.env.local', name: 'NEW_NAME', value: 'has space & "quote"' })
  assert.equal(added.status, 200)
  assert.doesNotMatch(added.text, /has space/)
  const text = readFileSync(join(root, '.env.local'), 'utf8')
  assert.match(text, /^NEW_NAME=.+\n$/m)
  assert.equal(text.split('\n').filter((l) => l.startsWith('PORT=')).length, 1)
  const bad = [
    { file: '.env.other', name: 'LEAK', value: 'x' }, { file: '.env.example', name: 'API_KEY', value: 'x' }, { file: 'package.json', name: 'A', value: 'x' },
    { file: '../.env.local', name: 'A', value: 'x' }, { file: '.env.local', name: 'lower', value: 'x' }, { file: '.env.local', name: 'A B', value: 'x' },
    { file: '.env.local', name: 'A=B', value: 'x' }, { file: '.env.local', name: 'A', value: 'line\nbreak' }, { file: '.env.local', name: 'A', value: 5 }, { file: '.env.local', name: 'A' },
  ]
  for (const body of bad) assert.equal((await edit(body)).status, 400, JSON.stringify(body))
  assert.equal(readFileSync(join(root, '.env.other'), 'utf8'), 'LEAK=other-secret\n')
  const multi = `${readFileSync(join(root, '.env.local'), 'utf8')}CERT="-----BEGIN\nDB_URL=postgres://x\n-----END"\n`
  writeFileSync(join(root, '.env.local'), multi)
  assert.equal((await edit({ file: '.env.local', name: 'CERT', value: 'new' })).status, 409, 'a multi-line entry is not edited in place')
  assert.equal(readFileSync(join(root, '.env.local'), 'utf8'), multi)
})

test('env export and import check their inputs before they start a command', async () => {
  const { port } = await start(await envHost())
  for (const to of ['', '-h', '--out=x', 'a b', 'a,-x', '/etc/passwd', ['ok', '-x'], Array(21).fill('a'), 5, undefined]) {
    assert.equal((await post(port, '/api/env/export', { to })).status, 400, JSON.stringify(to))
  }
  for (const file of ['x.txt', '../x.age', '/tmp/x.age', '-x.age', 'a b.age', '', 5, undefined]) {
    assert.equal((await post(port, '/api/env/import', { file })).status, 400, JSON.stringify(file))
  }
  assert.equal((await post(port, '/api/env/import', { file: 'missing.age' })).status, 404)
  const noKey = (await post(port, '/api/env/export', { to: 'nobody.pub' })).json()
  assert.equal(noKey.ok, false)
})

// ---- tabs that need an engine file from the other worker ----

const present = (name) => existsSync(join(REPO, 'engine', `${name}.mjs`))

const withHome = async (home, fn) => {
  const old = process.env.HOME
  process.env.HOME = home
  try { return await fn() } finally { process.env.HOME = old }
}
const row = (cwd, id) => JSON.stringify({ timestamp: new Date().toISOString(), cwd, requestId: `r-${id}`, isSidechain: false, message: { id, model: 'claude-sonnet-5-5', usage: { input_tokens: 100, output_tokens: 50, cache_read_input_tokens: 1000, cache_creation_input_tokens: 0 } } })

test('the usage and project tabs read the transcripts in a child process and switch only to a listed project', { skip: !present('usage') }, async () => {
  const [a, b] = [await host(), await host()]
  const plain = temp()
  const home = temp('ac-ui-home-')
  put(home, { '.claude/projects/p1/s1.jsonl': [row(b, 'm1'), row(plain, 'm2'), row(a, 'm3'), row(a, 'm3')].join('\n') })
  await withHome(home, async () => {
    const { port } = await start(a)
    const u = (await call(port, { path: '/api/usage?days=30' })).json()
    assert.equal(u.days, 30)
    assert.equal(u.totals.tokens, 3450)
    assert.equal(u.byProject.length, 3)
    assert.equal(typeof u.quota, 'boolean')
    assert.equal((await call(port, { path: '/api/usage?days=5' })).json().days, 30)
    assert.deepEqual((await call(port, { path: '/api/project/others' })).json().others, [b])
    for (const root of [plain, a, tmpdir(), 5, undefined, '../x']) assert.equal((await post(port, '/api/project', { root })).status, 404, String(root))
    const switched = await post(port, '/api/project', { root: b })
    assert.equal(switched.status, 200)
    assert.equal((await call(port, { path: '/api/project' })).json().root, b)
    assert.equal((await call(port, { path: '/api/sync' })).json().ok, true)
  })
})

test('an empty transcript folder gives zero totals and no other project', { skip: !present('usage') }, async () => {
  const home = temp('ac-ui-home-')
  await withHome(home, async () => {
    const { port } = await start(await host())
    const u = (await call(port, { path: '/api/usage' })).json()
    assert.equal(u.totals.tokens, 0)
    assert.deepEqual((await call(port, { path: '/api/project/others' })).json().others, [])
  })
})

test('a missing engine module gives 501 and the other routes keep working', async () => {
  const { port } = await start(await host())
  const routes = { assets: '/api/assets', usage: '/api/usage', promote: '/api/promote' }
  for (const [name, path] of Object.entries(routes)) {
    if (present(name)) continue
    const res = await call(port, { path })
    assert.equal(res.status, 501, path)
    assert.match(res.json().error, /not available/)
  }
  assert.equal((await call(port, { path: '/api/sync' })).status, 200)
})

test('the promote route accepts only a listed skill', { skip: !present('promote') }, async () => {
  const { port } = await start(await host())
  assert.equal((await post(port, '/api/promote', { skill: 'nope', dry: true })).status, 404)
  assert.equal((await post(port, '/api/promote', { skill: '../x' })).status, 404)
})

test('the assets route lists the assets and changes one through the config', { skip: !present('assets') }, async () => {
  const root = await host()
  const { port } = await start(root)
  const view = (await call(port, { path: '/api/assets' })).json()
  assert.ok(Array.isArray(view.assets) && view.assets.length > 0)
  assert.ok(view.sync)
  assert.equal((await post(port, '/api/assets', { kind: 'skill', id: 'no-such-skill', on: false })).status, 404)
  assert.equal((await post(port, '/api/assets', { kind: 'skill', id: view.assets.find((a) => a.kind === 'skill').id })).status, 400)
  const skill = view.assets.find((a) => a.kind === 'skill' && a.on && a.available)
  const off = (await post(port, '/api/assets', { kind: 'skill', id: skill.id, on: false })).json()
  assert.equal(off.assets.find((a) => a.kind === 'skill' && a.id === skill.id).on, false)
  assert.ok(JSON.parse(readFileSync(join(root, '.agents/compass.json'), 'utf8')).exclude.includes(skill.id))
  const rec = await post(port, '/api/assets/recommended', {})
  assert.equal(rec.status, 200)
})

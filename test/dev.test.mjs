import assert from 'node:assert/strict'
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { draftStack, validateDraft } from '../engine/dev.mjs'
import { runNode } from './helpers.mjs'

const REPO = dirname(dirname(fileURLToPath(import.meta.url)))
const temps = []
test.after(() => { for (const dir of temps) rmSync(dir, { recursive: true, force: true }) })

const temp = (prefix) => {
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

// The subset that the draft emitter writes: block maps, lists of scalars, JSON-quoted or plain scalars.
const parseYaml = (text) => {
  const root = {}
  const stack = [[-1, root]]
  for (const line of text.split('\n').filter(Boolean)) {
    const [, pad, rawKey, rest] = /^( *)("(?:[^"\\]|\\.)*"|[^:]+):(?: (.*))?$/.exec(line) || assert.fail(`not YAML: ${line}`)
    while (stack.at(-1)[0] >= pad.length) stack.pop()
    const key = rawKey.startsWith('"') ? JSON.parse(rawKey) : rawKey
    const value = rest === undefined ? {} : rest.startsWith('"') ? JSON.parse(rest) : /^\d+$/.test(rest) ? Number(rest) : rest
    stack.at(-1)[1][key] = value
    if (rest === undefined) stack.push([pad.length, value])
  }
  return root
}

const monorepo = (extra = {}) => {
  const root = temp('ac-dev-repo-')
  put(root, {
    'package.json': { name: 'shop', packageManager: 'pnpm@9.1.0' },
    'docker-compose.yml': 'services: {}\n',
    'apps/api/compose.local.yaml': 'services: {}\n',
    'apps/api/docker-compose.test.yml': 'services: {}\n',
    'apps/api/package.json': { scripts: { dev: 'nest start --watch' }, dependencies: { '@nestjs/core': '11' } },
    'apps/api/.env.example': 'DB_PASSWORD=never-read\nPORT=4000\n',
    'apps/web/package.json': { scripts: { dev: 'vite --port 5174' }, devDependencies: { vite: '7' } },
    'apps/worker/package.json': { scripts: { 'start:dev': 'node watch.js' } },
    'apps/lib/package.json': { scripts: { build: 'tsc' } },
    ...extra,
  })
  return root
}

test('draft: a pnpm monorepo gives infra, two ports and one warning for an unknown port', () => {
  const { doc, yaml, warnings, errors } = draftStack(monorepo())
  assert.deepEqual(errors, [])
  assert.deepEqual(Object.keys(doc.processes), ['infra', 'api', 'web', 'worker'])
  assert.deepEqual(doc.processes.infra, { command: 'docker compose -f apps/api/compose.local.yaml up --wait', availability: { restart: 'no' } })
  const { api, web, worker } = doc.processes
  assert.equal(api.command, 'pnpm run dev')
  assert.equal(api.working_dir, 'apps/api')
  assert.equal(api.log_location, '.agents/dev/logs/api.log')
  assert.deepEqual(api.depends_on, { infra: { condition: 'process_completed_successfully' } })
  assert.equal(api.readiness_probe.exec.command, 'nc -z 127.0.0.1 4000', 'PORT in .env.example')
  assert.deepEqual(api.readiness_probe, { exec: { command: 'nc -z 127.0.0.1 4000' }, initial_delay_seconds: 2, period_seconds: 5, timeout_seconds: 3, failure_threshold: 60 })
  assert.equal(web.readiness_probe.exec.command, 'nc -z 127.0.0.1 5174', '--port in the script')
  assert.equal(worker.command, 'pnpm run start:dev')
  assert.equal(worker.readiness_probe, undefined)
  assert.deepEqual(warnings, ['worker: no port found, so the process has no readiness probe'])
  assert.deepEqual(parseYaml(yaml), JSON.parse(JSON.stringify(doc)), 'the YAML text parses back to the draft')
  assert.ok(yaml.startsWith('version: "0.5"\nlog_location: ".agents/dev/process-compose.log"\nprocesses:\n'))
  assert.ok(!yaml.includes('never-read') && !yaml.includes('DB_PASSWORD'), 'only PORT is read from .env.example')
})

test('draft: framework ports, a clash, the lock file, the root app and a root compose file', () => {
  const root = temp('ac-dev-root-')
  put(root, {
    'package.json': { name: '@scope/solo', scripts: { dev: 'next dev' } },
    'yarn.lock': '',
    'docker-compose.prod.yml': 'services: {}\n',
    'docker-compose.yml': 'services: {}\n',
  })
  const one = draftStack(root)
  assert.deepEqual(one.errors, [])
  assert.deepEqual(one.doc.processes.solo, {
    command: 'yarn run dev',
    log_location: '.agents/dev/logs/solo.log',
    depends_on: { infra: { condition: 'process_completed_successfully' } },
    readiness_probe: one.doc.processes.solo.readiness_probe,
  })
  assert.equal(one.doc.processes.solo.readiness_probe.exec.command, 'nc -z 127.0.0.1 3000')
  assert.equal(one.doc.processes.infra.command, 'docker compose -f docker-compose.yml up --wait', 'a prod file is skipped')

  const clash = draftStack(monorepo({ 'apps/admin/package.json': { scripts: { dev: 'vite' } }, 'apps/web/package.json': { scripts: { dev: 'vite' } } }))
  assert.ok(clash.warnings.includes('admin, web use port 5173'), clash.warnings.join('\n'))
  const expo = draftStack(temp('ac-dev-expo-'))
  assert.match(expo.errors[0], /^nothing to start/)
  const mobile = temp('ac-dev-mobile-')
  put(mobile, { 'package.json': { scripts: { dev: 'node run.cjs' }, dependencies: { expo: '55' } } })
  assert.equal(draftStack(mobile).doc.processes.app.readiness_probe.exec.command, 'nc -z 127.0.0.1 8081')
})

test('draft: a process name that YAML reads as a boolean is quoted, and a name clash gets a suffix', () => {
  const { doc, yaml } = draftStack(monorepo({ 'apps/no/package.json': { scripts: { dev: 'node a.js' } }, 'apps/infra/package.json': { scripts: { dev: 'node b.js' } } }))
  assert.ok(doc.processes.no && doc.processes['infra-app'])
  assert.match(yaml, /^ {2}"no":$/m)
  assert.deepEqual(parseYaml(yaml), JSON.parse(JSON.stringify(doc)))
})

test('draft: a compose path or an app folder that a shell reads in a special way is skipped with a warning', () => {
  const root = temp('ac-dev-unsafe-')
  put(root, {
    'package.json': { name: 'shop' },
    'apps/a;b/package.json': { scripts: { dev: 'vite' } },
    'apps/a;b/compose.yaml': 'services: {}\n',
    'apps/web/package.json': { scripts: { dev: 'vite' } },
  })
  const { doc, warnings } = draftStack(root)
  assert.deepEqual(Object.keys(doc.processes), ['web'])
  assert.ok(warnings.some((w) => w.startsWith('apps/a;b/compose.yaml: ')), warnings.join('\n'))
  assert.ok(warnings.some((w) => w.startsWith('apps/a;b: ')), warnings.join('\n'))
})

test('validation: a process name cannot start with a dash', () => {
  assert.deepEqual(validateDraft({ processes: { '-x': { command: 'x' } } }), ['-x: the process name is not valid'])
  assert.deepEqual(validateDraft({ processes: { 'x-1.a_b': { command: 'x' } } }), [])
})

test('validation: an unknown depends_on target, a cycle, a condition, a command and a probe', () => {
  const ok = { command: 'x' }
  assert.deepEqual(validateDraft({ processes: { a: ok, b: { ...ok, depends_on: { a: { condition: 'process_healthy' } } } } }), [])
  assert.deepEqual(validateDraft({}), ['processes must list at least one process'])
  assert.deepEqual(validateDraft({ processes: { a: { ...ok, depends_on: { ghost: { condition: 'process_started' } } } } }),
    ['a: depends_on names the unknown process ghost'])
  assert.deepEqual(validateDraft({ processes: { a: { ...ok, depends_on: { b: { condition: 'process_started' } } }, b: { ...ok, depends_on: { c: { condition: 'process_started' } } }, c: { ...ok, depends_on: { a: { condition: 'process_started' } } } } }),
    ['depends_on has a cycle: a -> b -> c -> a'])
  assert.deepEqual(validateDraft({ processes: { a: { ...ok, depends_on: { a: { condition: 'process_started' } } } } }), ['depends_on has a cycle: a -> a'])
  assert.deepEqual(validateDraft({ processes: { a: { ...ok, depends_on: { b: { condition: 'soon' } } }, b: ok } }),
    ['a: depends_on b has the unknown condition soon'])
  assert.deepEqual(validateDraft({ processes: { a: { command: '' } } }), ['a: command must be a non-empty string'])
  assert.deepEqual(validateDraft({ processes: { 'a b': ok } }), ['a b: the process name is not valid'])
  assert.equal(validateDraft({ processes: { a: { ...ok, readiness_probe: { exec: { command: 'nc -z x 1' }, initial_delay_seconds: 2, period_seconds: 0, timeout_seconds: 3, failure_threshold: 60 } } } }).length, 1)
  assert.equal(validateDraft({ processes: { a: { ...ok, readiness_probe: { period_seconds: 5 } } } }).length, 1)
})

// A fake process-compose: a Node script that records its argv and cwd, and answers from the environment.
const FAKE = (log) => `#!${process.execPath}
import { appendFileSync } from 'node:fs'
const args = process.argv.slice(2)
appendFileSync(${JSON.stringify(log)}, JSON.stringify({ args, cwd: process.cwd() }) + '\\n')
if (args.includes('--dry-run') && process.env.FAKE_INVALID) { console.error(process.env.FAKE_INVALID); process.exit(1) }
if (args[0] === 'process' && args[1] === 'list') console.log(process.env.FAKE_STATUS || '[]')
if (args[0] === 'process' && args[1] === 'logs') console.log('line one\\nline two')
if (args[0] === 'down' && process.env.FAKE_DOWN_FAIL) { console.error('connection refused'); process.exit(1) }
`

const setup = (files = { 'process-compose.yaml': 'version: "0.5"\n' }) => {
  const root = temp('ac-dev-host-')
  put(root, files)
  const bin = temp('ac-dev-bin-')
  const log = join(bin, 'calls.jsonl')
  const fake = join(bin, 'process-compose.mjs')
  writeFileSync(fake, FAKE(log))
  chmodSync(fake, 0o755)
  const calls = () => (existsSync(log) ? readFileSync(log, 'utf8').trim().split('\n').map((l) => JSON.parse(l)) : [])
  const dev = (args, env = {}) => runNode([join(REPO, 'bin/ac.mjs'), 'dev', ...args, '--root', root], { env: { ...process.env, AC_PROCESS_COMPOSE: fake, ...env } })
  return { root, calls, dev, fake }
}

const SOCKET = ['-U', '-u', '.agents/dev/pc.sock']

test('up: validates, writes the ignore file, then starts in the background with the root as cwd', async () => {
  const { root, calls, dev } = setup()
  const r = await dev(['up'])
  assert.equal(r.code, 0, r.stderr)
  assert.deepEqual(calls().map((c) => c.args), [
    ['up', '--dry-run', '-f', 'process-compose.yaml'],
    ['up', '-D', '-f', 'process-compose.yaml', ...SOCKET, '-L', '.agents/dev/process-compose.log'],
  ])
  assert.ok(calls().every((c) => realpathSync(c.cwd) === realpathSync(root)))
  assert.equal(readFileSync(join(root, '.agents/dev/.gitignore'), 'utf8'), '*\n')
})

test('up: a missing file is an error that points to the draft and the skill', async () => {
  const { calls, dev } = setup({ 'README.md': 'x\n' })
  const r = await dev(['up'])
  assert.equal(r.code, 1)
  assert.match(r.stderr, /process-compose\.yaml not found\. Run "ac dev up --dry" for a draft, or use the local-run skill\./)
  assert.deepEqual(calls(), [])
})

test('up: an invalid file stops before the start and writes nothing', async () => {
  const { root, calls, dev } = setup()
  const r = await dev(['up'], { FAKE_INVALID: 'yaml: line 3: bad key' })
  assert.equal(r.code, 1)
  assert.match(r.stderr, /process-compose\.yaml is not valid: yaml: line 3: bad key/)
  assert.equal(calls().length, 1)
  assert.ok(!existsSync(join(root, '.agents/dev')))
})

test('up: refuses to write through a symlinked .agents/dev', async () => {
  const { root, calls, dev } = setup()
  const away = temp('ac-dev-away-')
  mkdirSync(join(root, '.agents'), { recursive: true })
  symlinkSync(away, join(root, '.agents/dev'))
  const r = await dev(['up'])
  assert.equal(r.code, 1)
  assert.match(r.stderr, /symlink or leaves the project root/)
  assert.ok(!existsSync(join(away, '.gitignore')))
  assert.equal(calls().length, 1)
})

test('up --dry: validates an existing file and warns when the binary is missing', async () => {
  const { root, calls, dev } = setup()
  const ok = await dev(['up', '--dry'])
  assert.equal(ok.code, 0, ok.stderr)
  assert.match(ok.stdout, /process-compose\.yaml is valid\./)
  assert.deepEqual(calls().map((c) => c.args), [['up', '--dry-run', '-f', 'process-compose.yaml']])
  assert.ok(!existsSync(join(root, '.agents/dev')))
  const none = await dev(['up', '--dry', '--json'], { AC_PROCESS_COMPOSE: join(root, 'missing-binary') })
  assert.equal(none.code, 0)
  const json = JSON.parse(none.stdout)
  assert.equal(json.ok, true)
  assert.equal(json.valid, null)
  assert.deepEqual(json.warnings, ['process-compose is not installed, so the file is not validated'])
})

test('up --dry without a file: the draft is on stdout, the summary on stderr, and nothing is written', async () => {
  const root = monorepo()
  const run = (...args) => runNode([join(REPO, 'bin/ac.mjs'), 'dev', 'up', '--dry', '--root', root, ...args])
  const text = await run()
  assert.equal(text.code, 0, text.stderr)
  assert.ok(text.stdout.startsWith('version: "0.5"'))
  assert.deepEqual(Object.keys(parseYaml(text.stdout).processes), ['infra', 'api', 'web', 'worker'])
  assert.match(text.stderr, /process-compose\.yaml is missing\. The draft is on stdout\. Nothing is written\./)
  assert.match(text.stderr, /warning: worker: no port found/)
  const json = JSON.parse((await run('--json')).stdout)
  assert.equal(json.draft, true)
  assert.deepEqual(parseYaml(json.yaml), parseYaml(text.stdout))
  assert.ok(!existsSync(join(root, 'process-compose.yaml')) && !existsSync(join(root, '.agents')))
})

test('down, status and logs: the arguments, the output and the limits', async () => {
  const { calls, dev } = setup()
  assert.equal((await dev(['down'])).code, 0)
  const status = await dev(['status'], { FAKE_STATUS: JSON.stringify([{ name: 'api', status: 'Running', is_ready: 'Ready', restarts: 0 }, { name: 'infra', status: 'Completed', is_ready: '-', restarts: 2 }]) })
  assert.equal(status.code, 0, status.stderr)
  assert.deepEqual(status.stdout.trim().split('\n'), ['NAME   STATUS     READY  RESTARTS', 'api    Running    Ready  0', 'infra  Completed  -      2'])
  const logs = await dev(['logs', 'api', '--tail', '50'])
  assert.equal(logs.stdout, 'line one\nline two\n')
  assert.equal((await dev(['logs', 'api'])).code, 0)
  assert.deepEqual(calls().map((c) => c.args), [
    ['down', ...SOCKET],
    ['process', 'list', '-o', 'json', ...SOCKET],
    ['process', 'logs', 'api', '-n', '50', ...SOCKET],
    ['process', 'logs', 'api', '-n', '100', ...SOCKET],
  ])
  const json = JSON.parse((await dev(['status', '--json'], { FAKE_STATUS: '[{"name":"a","status":"Running","is_ready":"Ready","restarts":1}]' })).stdout)
  assert.deepEqual(json.processes, [{ name: 'a', status: 'Running', ready: 'Ready', restarts: 1 }])
})

test('status: bad JSON prints the raw output, cut at 4 KB', async () => {
  const { dev } = setup()
  const r = await dev(['status'], { FAKE_STATUS: `not json ${'x'.repeat(6000)}` })
  assert.equal(r.code, 0)
  assert.ok(r.stdout.startsWith('not json xxx'))
  assert.ok(r.stdout.length < 4200 && r.stdout.includes('[output cut at 4 KB]'))
})

test('--dry on down, status and logs prints the command and runs nothing', async () => {
  const { calls, dev, fake } = setup()
  assert.equal((await dev(['down', '--dry'])).stdout.trim(), `${fake} down -U -u .agents/dev/pc.sock`)
  assert.equal((await dev(['status', '--dry'])).stdout.trim(), `${fake} process list -o json -U -u .agents/dev/pc.sock`)
  const logs = JSON.parse((await dev(['logs', 'api', '--tail', '7', '--dry', '--json'])).stdout)
  assert.deepEqual(logs.command, [fake, 'process', 'logs', 'api', '-n', '7', ...SOCKET])
  assert.equal(logs.dry, true)
  assert.deepEqual(calls(), [])
})

test('usage errors exit 2 and a failing or missing binary exits 1', async () => {
  const { root, dev } = setup()
  for (const args of [[], ['launch'], ['logs'], ['logs', '../etc'], ['logs', 'api', '--tail', '2001'], ['logs', 'api', '--tail', 'ten'], ['status', '--tail', '5'], ['down', 'now']]) {
    const r = await dev(args)
    assert.equal(r.code, 2, `${args.join(' ')}: ${r.stderr}`)
  }
  const help = await dev(['--help'])
  assert.equal(help.code, 0)
  assert.match(help.stdout, /Usage: ac dev/)
  const fail = await dev(['down'], { FAKE_DOWN_FAIL: '1' })
  assert.equal(fail.code, 1)
  assert.match(fail.stderr, /process-compose down failed: connection refused/)
  const none = await dev(['status'], { AC_PROCESS_COMPOSE: join(root, 'missing-binary') })
  assert.equal(none.code, 1)
  assert.match(none.stderr, /process-compose is not installed/)
})

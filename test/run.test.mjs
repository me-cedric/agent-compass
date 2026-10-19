import assert from 'node:assert/strict'
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, symlinkSync, utimesSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { windowsStart } from '../engine/run-plan.mjs'
import { runNode } from './helpers.mjs'

const REPO = dirname(dirname(fileURLToPath(import.meta.url)))
const BIN = join(REPO, 'bin/ac.mjs')
const temps = []
test.after(() => { for (const dir of temps) rmSync(dir, { recursive: true, force: true }) })

const CHILD = `import { spawn } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
const [mode, ...rest] = process.argv.slice(2)
if (mode === 'ok') { console.log('hello out'); console.error('hello err'); console.log('token=abcdef123456'); console.log('password: hunter2hunter2') }
if (mode === 'leaks') {
  for (const l of ['{"password": "hunter2"}', 'STRIPE_SECRET_KEY=sk_live_abc', '-----BEGIN PRIVATE KEY-----', 'MIIEvQIBADANBgkqhkiG9w0BAQEF', '-----END PRIVATE KEY-----', 'after pem']) console.log(l)
}
if (mode === 'urls') { console.log('DATABASE_URL=postgres://u:pw@h/db'); console.log('Authorization: Basic dXNlcjpwYXNz'); console.log('see https://example.com/path') }
if (mode === 'long') console.log('token'.repeat(200_000))
if (mode === 'marker') writeFileSync('marker.txt', 'ran')
if (mode === 'fail') { console.log('before failure'); process.exit(7) }
if (mode === 'args') console.log(JSON.stringify(rest))
if (mode === 'env') console.log(process.env.FOO + '|' + process.env.BAR)
if (mode === 'big') { const line = 'x'.repeat(1023); for (let i = 0; i < 6000; i++) console.log(line) }
if (mode === 'reports') {
  mkdirSync('out/report', { recursive: true })
  writeFileSync('out/report/index.html', '<html></html>')
  writeFileSync('out/junit.xml', '<?xml version="1.0"?>\\n<testsuites><testsuite name="a"/></testsuites>')
  writeFileSync('out/other.xml', '<config/>')
}
if (mode === 'hang') {
  const grandchild = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { stdio: 'ignore' })
  writeFileSync('grandchild.pid', String(grandchild.pid))
  setInterval(() => {}, 1000)
}
`

// A project folder with a registry. Every command runs the child script with the node binary.
const host = (extra = {}) => {
  const root = mkdtempSync(join(tmpdir(), 'ac-run-'))
  temps.push(root)
  const node = `"${process.execPath}" child.mjs`
  const registry = {
    schema: 1,
    notes: ['not a command'],
    ok: `${node} ok`,
    fail: `${node} fail`,
    leaks: `${node} leaks`,
    urls: `${node} urls`,
    long: `${node} long`,
    marker: `${node} marker`,
    big: `${node} big`,
    reports: `${node} reports`,
    args: `${node} args "a b" 'c d' e`,
    env: `FOO=bar BAR="two words" ${node} env`,
    gone: 'no-such-binary-for-ac-run',
    pipe: 'echo a | cat',
    redirect: 'echo a > out.txt',
    quoted: 'echo "$HOME"',
    glob: 'ls *.js',
    open: 'echo "abc',
    placeholder: 'npm run test -- <file>',
    push: 'git push origin main',
    ship: { cmd: `${node} marker`, destructive: true },
    slow: { cmd: `${node} hang`, timeout: 1 },
    slowflag: `${node} hang`,
    huge: { cmd: `${node} ok`, timeout: 3_000_000 },
    nested: { deep: { one: `${node} ok` } },
    ...extra,
  }
  writeFileSync(join(root, 'agent-compass.commands.json'), JSON.stringify(registry))
  writeFileSync(join(root, 'child.mjs'), CHILD)
  return root
}

const ac = (root, args) => runNode([BIN, 'run', ...args, '--root', root])
const result = (root, json) => JSON.parse(readFileSync(join(root, json.log, '..', 'result.json'), 'utf8'))

test('ac run refuses a name that is not in the registry', async () => {
  const root = host()
  const r = await ac(root, ['made.up'])
  assert.equal(r.code, 1)
  assert.match(r.stderr, /made\.up is not in agent-compass\.commands\.json\. Do not invent a command\. Use ac run --list\./)
  const json = JSON.parse((await ac(root, ['made.up', '--json'])).stdout)
  assert.equal(json.ok, false)
  assert.ok(!existsSync(join(root, '.agents')))
})

test('ac run --list prints the runnable names, dotted for nested ones', async () => {
  const root = host()
  const r = await ac(root, ['--list'])
  assert.equal(r.code, 0)
  const names = r.stdout.trim().split('\n')
  assert.ok(names.includes('ok') && names.includes('nested.deep.one') && names.includes('ship'))
  assert.ok(!names.includes('schema') && !names.includes('notes') && !names.includes('nested'))
  assert.deepEqual(JSON.parse((await ac(root, ['--list', '--json'])).stdout).commands, names)
})

test('ac run gives a usage error for a bad option, a missing name or a bad timeout', async () => {
  const root = host()
  for (const args of [[], ['ok', 'extra'], ['ok', '--timeout', 'abc'], ['ok', '--timeout', '0'], ['ok', '--nope']]) {
    assert.equal((await ac(root, args)).code, 2, args.join(' '))
  }
  assert.equal((await ac(root, ['--help'])).code, 0)
})

test('ac run refuses a timeout that setTimeout cannot hold', async () => {
  const root = host()
  const flag = await ac(root, ['ok', '--timeout', '2147484'])
  assert.equal(flag.code, 2)
  assert.match(flag.stderr, /--timeout needs a number of seconds above 0 and up to 2147483/)
  const entry = await ac(root, ['huge'])
  assert.equal(entry.code, 1)
  assert.match(entry.stderr, /huge has a timeout above 2147483 seconds/)
  assert.ok(!existsSync(join(root, '.agents')))
  assert.equal((await ac(root, ['ok', '--timeout', '2147483'])).code, 0)
})

test('ac run needs a registry file', async () => {
  const root = mkdtempSync(join(tmpdir(), 'ac-run-none-'))
  temps.push(root)
  const r = await ac(root, ['ok'])
  assert.equal(r.code, 1)
  assert.match(r.stderr, /agent-compass\.commands\.json is missing/)
})

test('ac run refuses a command that needs a shell, and names the character', async () => {
  const root = host()
  for (const [name, char] of [['pipe', '|'], ['redirect', '>'], ['quoted', '$'], ['glob', '*']]) {
    const r = await ac(root, [name])
    assert.equal(r.code, 1, name)
    assert.match(r.stderr, new RegExp(`${name} needs a shell; compass runs registry commands without one \\(found \\${char}\\)`), name)
  }
  const open = await ac(root, ['open'])
  assert.match(open.stderr, /open has a quote that is not closed/)
  assert.ok(!existsSync(join(root, '.agents')))
})

test('ac run refuses a placeholder and names it', async () => {
  const r = await ac(host(), ['placeholder'])
  assert.equal(r.code, 1)
  assert.match(r.stderr, /placeholder has the placeholder <file>/)
})

test('ac run refuses a destructive command without --confirm and runs it with --confirm', async () => {
  const root = host()
  for (const name of ['ship', 'push']) {
    const r = await ac(root, [name])
    assert.equal(r.code, 1, name)
    assert.match(r.stderr, new RegExp(`${name} looks destructive .* with --confirm`), name)
  }
  assert.ok(!existsSync(join(root, 'marker.txt')))
  assert.ok(!existsSync(join(root, '.agents')))
  const ok = await ac(root, ['ship', '--confirm'])
  assert.equal(ok.code, 0, ok.stderr)
  assert.equal(readFileSync(join(root, 'marker.txt'), 'utf8'), 'ran')
})

test('ac run stores the log and the result, and redacts secret-like lines', async () => {
  const root = host()
  const r = await ac(root, ['ok'])
  assert.equal(r.code, 0, r.stderr)
  const [first, ...rest] = r.stdout.trim().split('\n')
  assert.match(first, /^Log: \.agents\/runs\/\d{4}-\d\d-\d\dT\d\d-\d\d-\d\d-\d{3}Z-ok\/output\.log$/)
  assert.deepEqual(rest.slice(0, -1).sort(), ['[redacted]', '[redacted]', 'hello err', 'hello out'])
  assert.match(rest.at(-1), /^ok: ok exited with 0 in \d+\.\d s\. Result: \.agents\/runs\/.+\/result\.json$/)
  const log = readFileSync(join(root, first.slice(5)), 'utf8')
  assert.ok(log.includes('hello out') && log.includes('hello err') && log.includes('[redacted]'))
  assert.ok(!log.includes('abcdef123456') && !log.includes('hunter2'))
  assert.ok(!r.stdout.includes('abcdef123456') && !r.stdout.includes('hunter2'))
  assert.equal(readFileSync(join(root, '.agents/runs/.gitignore'), 'utf8'), '*\n')
  const saved = JSON.parse(readFileSync(join(root, dirname(first.slice(5)), 'result.json'), 'utf8'))
  assert.equal(saved.name, 'ok')
  assert.match(saved.command, /child\.mjs ok$/)
  assert.deepEqual([saved.exitCode, saved.signal, saved.timedOut], [0, null, false])
  assert.equal(typeof saved.durationMs, 'number')
  assert.ok(!Number.isNaN(Date.parse(saved.startedAt)))
  assert.equal(saved.log, first.slice(5))
  assert.ok(saved.tail.includes('hello out') && !saved.tail.join('\n').includes('hunter2'))
  assert.deepEqual([saved.junit, saved.html], [[], []])
})

test('ac run redacts a JSON secret, a name that ends in KEY and every line of a PEM block', async () => {
  const json = JSON.parse((await ac(host(), ['leaks', '--json'])).stdout)
  assert.deepEqual(json.tail, [...Array(5).fill('[redacted]'), 'after pem'])
})

test('ac run redacts a URL password and an Authorization header, and a long line does not block it', async () => {
  const root = host()
  assert.deepEqual(JSON.parse((await ac(root, ['urls', '--json'])).stdout).tail, ['[redacted]', '[redacted]', 'see https://example.com/path'])
  const start = Date.now()
  const long = await ac(root, ['long', '--json'])
  assert.equal(long.code, 0)
  assert.ok(Date.now() - start < 10_000, `${Date.now() - start} ms`)
})

test('ac run does not write through a symlinked .agents dir', async () => {
  const root = host()
  const away = mkdtempSync(join(tmpdir(), 'ac-run-away-'))
  temps.push(away)
  symlinkSync(away, join(root, '.agents'))
  const r = await ac(root, ['ok', '--json'])
  assert.equal(r.code, 1)
  assert.match(JSON.parse(r.stdout).errors.join(' '), /symlink/)
  assert.deepEqual(readdirSync(away), [])
})

test('ac run keeps a .gitignore that exists and prints one JSON object with --json', async () => {
  const root = host()
  mkdirSync(join(root, '.agents/runs'), { recursive: true })
  writeFileSync(join(root, '.agents/runs/.gitignore'), 'custom\n')
  const r = await ac(root, ['nested.deep.one', '--json'])
  const json = JSON.parse(r.stdout)
  assert.equal(r.code, 0)
  assert.deepEqual([json.ok, json.name, json.exitCode], [true, 'nested.deep.one', 0])
  assert.equal(readFileSync(join(root, '.agents/runs/.gitignore'), 'utf8'), 'custom\n')
  assert.deepEqual(result(root, json).tail, json.tail)
})

test('ac run passes the child exit code and the arguments without a shell', async () => {
  const root = host()
  const fail = await ac(root, ['fail', '--json'])
  assert.equal(fail.code, 7)
  assert.deepEqual([JSON.parse(fail.stdout).ok, JSON.parse(fail.stdout).exitCode], [false, 7])
  const args = JSON.parse((await ac(root, ['args', '--json'])).stdout)
  assert.deepEqual(args.tail, ['["a b","c d","e"]'])
  const env = JSON.parse((await ac(root, ['env', '--json'])).stdout)
  assert.deepEqual(env.tail, ['bar|two words'])
})

test('windowsStart runs a .cmd or .bat found with PATHEXT through cmd.exe, and leaves an .exe to spawn', () => {
  const files = new Set([join('C:\\tools', 'npm.cmd'), join('C:\\bin', 'git.exe'), 'scripts\\build.bat'])
  const opts = { env: { PATH: 'C:\\bin;C:\\tools', PATHEXT: '.exe;.cmd;.bat', ComSpec: 'C:\\Windows\\cmd.exe' }, exists: (p) => files.has(p) }
  const npm = join('C:\\tools', 'npm.cmd')
  assert.deepEqual(windowsStart(['npm', 'run', 'test', 'a b', 'C:\\out\\'], opts),
    { cmd: 'C:\\Windows\\cmd.exe', args: ['/d', '/s', '/c', `""${npm}" "run" "test" "a b" "C:\\out\\\\""`] })
  assert.equal(windowsStart(['git', 'status'], opts), null)
  assert.equal(windowsStart(['missing'], opts), null)
  assert.equal(windowsStart(['scripts\\build'], opts).args[3], '""scripts\\build.bat""')
  for (const arg of ['50%', 'a^b', 'say "hi"', 'a\nb']) assert.match(windowsStart(['npm', arg], opts).error, /cannot hold/, arg)
})

test('ac run starts a .cmd file on PATH on Windows', { skip: process.platform !== 'win32' && 'Windows only' }, async () => {
  const root = host({ wintool: 'wintool hello "a b"' })
  writeFileSync(join(root, 'wintool.cmd'), `@"${process.execPath}" "%~dp0child.mjs" args %*\r\n`)
  const r = await runNode([BIN, 'run', 'wintool', '--json', '--root', root], { env: { ...process.env, PATH: `${root};${process.env.PATH}` } })
  assert.equal(r.code, 0, r.stdout + r.stderr)
  assert.deepEqual(JSON.parse(r.stdout).tail, ['["hello","a b"]'])
})

test('ac run reports a command that cannot start', async () => {
  const root = host()
  const r = await ac(root, ['gone', '--json'])
  const json = JSON.parse(r.stdout)
  assert.equal(r.code, 1)
  assert.deepEqual([json.ok, json.exitCode], [false, null])
  assert.match(readFileSync(join(root, json.log), 'utf8'), /cannot start no-such-binary-for-ac-run/)
})

test('ac run stops the whole process group on a timeout', async () => {
  const root = host()
  for (const args of [['slow'], ['slowflag', '--timeout', '1']]) {
    rmSync(join(root, 'grandchild.pid'), { force: true })
    const r = await ac(root, [...args, '--json'])
    const json = JSON.parse(r.stdout)
    assert.equal(r.code, 1, args.join(' '))
    assert.deepEqual([json.ok, json.timedOut], [false, true], args.join(' '))
    // taskkill ends the child without a signal name.
    if (process.platform !== 'win32') assert.equal(json.signal, 'SIGTERM', args.join(' '))
    assert.ok(json.durationMs >= 900 && json.durationMs < 10_000, `${json.durationMs} ms`)
    const pid = Number(readFileSync(join(root, 'grandchild.pid'), 'utf8'))
    let alive = true
    for (let i = 0; i < 30 && alive; i++) {
      try { process.kill(pid, 0); await new Promise((resolve) => setTimeout(resolve, 100)) } catch { alive = false }
    }
    assert.equal(alive, false, 'the grandchild is stopped')
  }
})

test('ac run lists junit and HTML reports that changed during the run', async () => {
  const root = host()
  mkdirSync(join(root, 'old/report'), { recursive: true })
  writeFileSync(join(root, 'old/report/index.html'), '<html></html>')
  writeFileSync(join(root, 'old/junit.xml'), '<testsuite/>')
  const past = new Date(Date.now() - 3_600_000)
  for (const f of ['old/report/index.html', 'old/junit.xml']) utimesSync(join(root, f), past, past)
  const json = JSON.parse((await ac(root, ['reports', '--json'])).stdout)
  assert.deepEqual(json.junit, ['out/junit.xml'])
  assert.deepEqual(json.html, ['out/report/index.html'])
  assert.equal(statSync(join(root, 'out/other.xml')).isFile(), true)
})

test('ac run caps the log at 5 MB and keeps the last 100 lines in the result', async () => {
  const root = host()
  const json = JSON.parse((await ac(root, ['big', '--json'])).stdout)
  const size = statSync(join(root, json.log)).size
  assert.ok(size > 5 * 1024 * 1024 - 2048 && size < 5 * 1024 * 1024 + 2048, `${size} bytes`)
  assert.match(readFileSync(join(root, json.log), 'utf8').trimEnd().split('\n').at(-1), /^\[output cut at 5 MB\]$/)
  assert.equal(json.tail.length, 100)
})

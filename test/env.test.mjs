import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, dirname, join } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { parseEnv } from 'node:util'
import { encodeValue, recipientKeys } from '../engine/env.mjs'
import { walk } from '../engine/util.mjs'
import { runNode } from './helpers.mjs'

const REPO = dirname(dirname(fileURLToPath(import.meta.url)))
const BIN = join(REPO, 'bin/ac.mjs')
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
    writeFileSync(join(root, rel), text)
  }
}

// A project folder. With git, the files are in the index, so ignored files stay untracked.
const host = (files, { git = true } = {}) => {
  const root = temp('ac-env-host-')
  if (git) spawnSync('git', ['init', '-q'], { cwd: root })
  put(root, files)
  if (git) spawnSync('git', ['add', '-A'], { cwd: root })
  return root
}

const env = (args, extra = {}) => runNode([BIN, 'env', ...args], { env: { ...process.env, ...extra } })
const check = async (root) => {
  const r = await env(['check', '--root', root, '--json'])
  return { ...r, json: JSON.parse(r.stdout) }
}
const summary = (json) => json.findings.map((f) => `${f.level} ${f.kind}${f.name ? ` ${f.name}` : ''}`)

const SECRET = 'zq-secret-value-8812'

// ---- check ----

test('env check without a catalog reports each finding kind and exits 1 on an error', async () => {
  const root = host({
    '.gitignore': '.env\n',
    '.env.example': 'A=\nB=\nVITE_API_SECRET=\n',
    'apps/api/.env.example': 'A=\nB=\nVITE_API_SECRET=\n',
    'apps/web/.env.example': 'A=\nC=\nVITE_MAP_API_KEY=\n',
    '.env': `A=${SECRET}\nZ=${SECRET}\n`,
    'src/main.ts': [
      'const a = process.env.A',
      "const b = process.env['UNDECLARED_ONE']",
      'const c = import.meta.env.VITE_X',
      "const d = config.get<string>('CFG_NAME')",
      "const e = this.configService.getOrThrow('OTHER')",
      'const f = process.env.NODE_ENV',
      'const g = process.env.lower',
      "const h = process.env?.OPT_CHAIN",
    ].join('\n'),
  })
  const r = await check(root)
  assert.equal(r.code, 1)
  assert.equal(r.json.ok, false)
  assert.equal(r.json.catalog, null)
  assert.deepEqual(r.json.templates, ['.env.example', 'apps/api/.env.example', 'apps/web/.env.example'])
  assert.deepEqual(r.json.local, ['.env'])
  assert.equal(r.json.reads, 6)
  const got = summary(r.json)
  assert.deepEqual(got.filter((s) => s.startsWith('error')), ['error public-secret VITE_API_SECRET'])
  for (const want of [
    'warn duplicate', 'warn overlap', 'warn public-secret VITE_MAP_API_KEY',
    'warn undeclared UNDECLARED_ONE', 'warn undeclared VITE_X', 'warn undeclared CFG_NAME', 'warn undeclared OTHER', 'warn undeclared OPT_CHAIN',
    'warn missing B', 'warn missing VITE_API_SECRET', 'warn extra Z',
  ]) assert.ok(got.includes(want), `${want} in ${got.join(' | ')}`)
  assert.ok(!got.some((s) => /NODE_ENV|lower/.test(s)))
  const dup = r.json.findings.find((f) => f.kind === 'duplicate')
  assert.deepEqual(dup.files, ['.env.example', 'apps/api/.env.example'])
  const overlap = r.json.findings.find((f) => f.kind === 'overlap')
  assert.deepEqual(overlap.files, ['.env.example', 'apps/web/.env.example'])
  assert.match(overlap.detail, /^1 shared/)
  assert.deepEqual(r.json.findings.find((f) => f.name === 'OTHER').files, ['src/main.ts:5'])
  assert.ok(!r.stdout.includes(SECRET))
})

test('env check exits 0 when only warnings exist, and the text output never holds a value', async () => {
  const root = host({ '.gitignore': '.env\n', '.env.example': 'A=\nB=\n', '.env': `A=${SECRET}\n`, 'src/x.ts': 'process.env.A' })
  const r = await env(['check', '--root', root])
  assert.equal(r.code, 0, r.stderr)
  assert.match(r.stdout, /warn {2}missing {7}B {2}no local file in the root sets it \(\.env\.example\)/)
  assert.match(r.stdout, /0 error\(s\), 1 warning\(s\)\. Catalog: no\. 1 template\(s\), 0 committed, 1 local, 1 code read\(s\)\./)
  assert.ok(!(r.stdout + r.stderr).includes(SECRET))
})

test('env check treats a tracked non-template env file as committed and an untracked one as local', async () => {
  const root = host({ '.gitignore': '.env.local\n', '.env.example': 'A=\n', 'apps/web/.env.development': 'VITE_A=1\n', '.env.local': 'A=1\n' })
  const { json } = await check(root)
  assert.deepEqual(json.committed, ['apps/web/.env.development'])
  assert.deepEqual(json.local, ['.env.local'])
  assert.ok(!summary(json).includes('warn extra A'))
})

test('env check without git treats every non-template file as local', async () => {
  const root = host({ '.env.example': 'A=\n', '.env.development': 'A=1\n' }, { git: false })
  const { json } = await check(root)
  assert.deepEqual(json.local, ['.env.development'])
  assert.deepEqual(json.committed, [])
})

test('env check skips a code line longer than 2000 characters', async () => {
  const root = host({ '.env.example': 'A=\n', 'app.min.js': `${'config'.repeat(65_000)}\nprocess.env.A\n` })
  const start = Date.now()
  const r = await runNode([BIN, 'env', 'check', '--root', root, '--json'], { timeout: 15_000 })
  assert.equal(r.code, 0, r.stderr)
  assert.ok(Date.now() - start < 10_000)
  assert.equal(JSON.parse(r.stdout).reads, 1)
  const many = host({ '.env.example': 'A=\n', 'app.js': `${`${'config'.repeat(333)}\n`.repeat(500)}process.env.A\n` })
  const t0 = Date.now()
  assert.equal((await runNode([BIN, 'env', 'check', '--root', many, '--json'], { timeout: 15_000 })).code, 0)
  assert.ok(Date.now() - t0 < 10_000, `${Date.now() - t0} ms for 500 lines just under the cap`)
})

test('env check finds a public name that holds a secret, with any known prefix and any letter case', async () => {
  const root = host({ '.env.example': 'REACT_APP_SECRET=\nPUBLIC_API_TOKEN=\nNEXT_PUBLIC_DB_PASSPHRASE=\nVITE_stripe_secret=\nNUXT_PUBLIC_ACCESS_KEY=\nPUBLIC_PAGE_SIZE=\n' })
  const got = summary((await check(root)).json).filter((s) => s.includes('public-secret'))
  assert.deepEqual(got, [
    'error public-secret NEXT_PUBLIC_DB_PASSPHRASE', 'error public-secret REACT_APP_SECRET', 'error public-secret VITE_stripe_secret',
    'warn public-secret NUXT_PUBLIC_ACCESS_KEY', 'warn public-secret PUBLIC_API_TOKEN',
  ])
})

test('env check gives a warning for a tracked env file that is missing on disk', async () => {
  const root = host({ '.env.example': 'A=\n', '.env.development': 'B=1\n' })
  rmSync(join(root, '.env.development'))
  const r = await check(root)
  assert.equal(r.code, 0, r.stderr)
  assert.deepEqual(r.json.findings.filter((f) => f.kind === 'unreadable').map((f) => [f.level, f.files]), [['warn', ['.env.development']]])
})

test('env check reads untracked code files and destructured names, and skips ignored files', async () => {
  const root = host({
    '.gitignore': 'ignored.js\n',
    'src/a.ts': "const { DB_URL, API_KEY: key, PORT = '3000', lower, ...rest } = process.env\n",
    'ignored.js': 'process.env.IGNORED_READ',
  })
  put(root, { 'src/new.ts': 'process.env.UNTRACKED_READ', '.agents/hooks/compass.mjs': 'process.env.CLAUDE_PROJECT_DIR', '.claude/hooks/x.mjs': 'process.env.TOOL_READ', '.codex/y.mjs': 'process.env.TOOL_READ' })
  const got = summary((await check(root)).json).filter((s) => s.includes('undeclared')).sort()
  assert.deepEqual(got, ['warn undeclared API_KEY', 'warn undeclared DB_URL', 'warn undeclared PORT', 'warn undeclared UNTRACKED_READ'])
})

const CATALOG = {
  version: 1,
  vars: [
    { name: 'A', required: { local: true }, allowed: ['1', '2'] },
    { name: 'MODE_X', pattern: '^[a-z]+$' },
    { name: 'NEEDED', required: { local: true } },
    { name: 'HAS_DEFAULT', required: { local: true }, default: 'x' },
    { name: 'VITE_PUB', secret: true },
    { name: 'NOT_IN_TEMPLATE' },
  ],
}

test('env check with a catalog finds missing, invalid, undeclared, extra and public secrets', async () => {
  const files = {
    '.gitignore': '.env\n',
    'env.catalog.json': JSON.stringify(CATALOG),
    '.env.example': 'A=\nMODE_X=\nNEEDED=\nHAS_DEFAULT=\nVITE_PUB=\nSTRAY_TEMPLATE=\n',
    '.env': `A=3\nMODE_X=ABC${SECRET}\nSTRAY=1\nHAS_DEFAULT=\n`,
    'src/a.ts': 'process.env.NEEDED; process.env.NOT_IN_CATALOG',
  }
  const root = host(files)
  const r = await check(root)
  assert.equal(r.code, 1)
  assert.equal(r.json.catalog, 'env.catalog.json')
  assert.deepEqual(summary(r.json).filter((s) => s.startsWith('error')), [
    'error invalid A', 'error invalid MODE_X', 'error missing NEEDED', 'error public-secret VITE_PUB', 'error undeclared NOT_IN_CATALOG',
  ])
  const warns = summary(r.json).filter((s) => s.startsWith('warn'))
  assert.deepEqual(warns, ['warn extra STRAY', 'warn extra STRAY_TEMPLATE', 'warn missing NOT_IN_TEMPLATE'])
  assert.ok(!r.stdout.includes(SECRET))
  assert.ok(!r.json.findings.some((f) => f.kind === 'missing' && f.name === 'HAS_DEFAULT'))

  const { '.env': local, ...withoutLocal } = files
  assert.ok(local)
  const noLocal = host(withoutLocal)
  assert.ok(!summary((await check(noLocal)).json).includes('error missing NEEDED'), 'a missing local file is not an error')
})

test('env check with a catalog and no local env file gives one warning, not one error per name', async () => {
  const catalog = { version: 1, vars: [{ name: 'NEEDED', required: { local: true } }, { name: 'ALSO', required: { local: true } }, { name: 'HAS_DEFAULT', required: { local: true }, default: 'x' }] }
  const root = host({ 'env.catalog.json': JSON.stringify(catalog), '.env.example': 'NEEDED=\nALSO=\nHAS_DEFAULT=\n' })
  const r = await check(root)
  assert.equal(r.code, 0, r.stderr)
  assert.deepEqual(r.json.findings.map((f) => [f.level, f.kind, f.name, f.detail]), [['warn', 'missing', undefined, 'no local env file; 2 name(s) are required for local']])
})

test('env check rejects a catalog that has the wrong shape', async () => {
  const bad = {
    'not an object': '[]',
    'invalid JSON': '{',
    'wrong version': JSON.stringify({ version: 2, vars: [] }),
    'lower-case name': JSON.stringify({ version: 1, vars: [{ name: 'lower' }] }),
    'repeated name': JSON.stringify({ version: 1, vars: [{ name: 'A' }, { name: 'A' }] }),
    'unknown key': JSON.stringify({ version: 1, vars: [{ name: 'A', foo: 1 }] }),
    'allowed and pattern': JSON.stringify({ version: 1, vars: [{ name: 'A', allowed: ['x'], pattern: 'x' }] }),
    'bad pattern': JSON.stringify({ version: 1, vars: [{ name: 'A', pattern: '(' }] }),
    'bad required': JSON.stringify({ version: 1, vars: [{ name: 'A', required: { prod: 'yes' } }] }),
    'bad secret': JSON.stringify({ version: 1, vars: [{ name: 'A', secret: 'yes' }] }),
    'bad apps': JSON.stringify({ version: 1, vars: [{ name: 'A', apps: 'web' }] }),
    'empty allowed': JSON.stringify({ version: 1, vars: [{ name: 'A', allowed: [] }] }),
  }
  for (const [label, text] of Object.entries(bad)) {
    const r = await check(host({ 'env.catalog.json': text, '.env.example': 'A=\n' }))
    assert.equal(r.code, 1, label)
    assert.ok(r.json.findings.length > 0 && r.json.findings.every((f) => f.kind === 'catalog' && f.level === 'error'), label)
  }
})

// ---- values ----

test('encodeValue gives a string that parseEnv reads back unchanged', () => {
  const values = ['plain', 'with space', 'with"quote', "it's", 'back`tick', 'line\nbreak', 'lit\\neral', '#hash', '=eq', '', 'trail ', '$DOLLAR']
  for (const x of values) {
    const e = encodeValue(x)
    assert.notEqual(e, null, JSON.stringify(x))
    assert.equal(parseEnv(`K=${e}`).K, x, JSON.stringify(x))
  }
  assert.equal(encodeValue('all"\'`'), null)
  assert.equal(encodeValue('a\r\nb'), null)
})

test('encodeValue uses single quotes first, so a shell and Docker Compose keep a dollar sign', () => {
  assert.equal(encodeValue('pa$$w0rd'), "'pa$$w0rd'")
  // A value with ' and a shell character has no safe form, so import refuses it.
  for (const x of ["it's $(touch P)", "x '\"' ; touch P ; echo", 'both"and\'', 'x\ny"z', "it's `id`", "it's \\n"]) assert.equal(encodeValue(x), null, x)
})

// ---- recipients ----

const fakeKeys = (text, status = 200) => async (url) => {
  fakeKeys.urls.push(url)
  return new Response(text, { status })
}
fakeKeys.urls = []

test('recipientKeys builds https key URLs and keeps only ssh-ed25519 and ssh-rsa lines', async () => {
  const body = '# comment\nssh-ed25519 AAAAC3Nza one\necdsa-sha2-nistp256 AAAA two\nssh-rsa AAAAB3 three\n'
  const fetchFn = fakeKeys(body)
  assert.deepEqual(await recipientKeys('alice', { fetchFn }), ['ssh-ed25519 AAAAC3Nza one', 'ssh-rsa AAAAB3 three'])
  await recipientKeys('alice', { forge: 'git.example.org', fetchFn })
  await recipientKeys('forge.example.org:8443/bob', { fetchFn })
  assert.deepEqual(fakeKeys.urls, ['https://github.com/alice.keys', 'https://git.example.org/alice.keys', 'https://forge.example.org:8443/bob.keys'])
})

test('recipientKeys refuses bad names, a failed answer, a large answer and an empty answer', async () => {
  for (const spec of ['bad user!', '-lead', 'a/b/c', 'HOST/ok', 'x'.repeat(40), 'host.example/bad name']) {
    await assert.rejects(recipientKeys(spec, { fetchFn: () => assert.fail('no request') }), /is not a key file/, spec)
  }
  await assert.rejects(recipientKeys('alice', { fetchFn: fakeKeys('x', 404) }), /answered 404/)
  await assert.rejects(recipientKeys('alice', { fetchFn: fakeKeys(`ssh-ed25519 ${'A'.repeat(70_000)}`) }), /more than 64 KB/)
  await assert.rejects(recipientKeys('alice', { fetchFn: fakeKeys('no keys here\n') }), /no SSH key found/)
  await assert.rejects(recipientKeys('missing.pub', { root: temp('ac-env-none-') }), /does not exist/)
})

// ---- export, import and run with a fake age ----

const keyDir = temp('ac-env-keys-')
const keygen = (name) => {
  const file = join(keyDir, name)
  const r = spawnSync('ssh-keygen', ['-t', 'ed25519', '-N', '', '-f', file, '-q'], { encoding: 'utf8' })
  assert.equal(r.status, 0, r.stderr)
  return file
}
const KEY1 = keygen('one')
const KEY2 = keygen('two')
const pub = (file) => readFileSync(`${file}.pub`, 'utf8').trim()

// The fake age records its arguments, the recipients file and that file's mode. It copies stdin to -o, and prints the file for -d.
const fakeAge = () => {
  const dir = temp('ac-env-age-')
  const bin = join(dir, 'fake-age.mjs')
  const log = join(dir, 'calls.jsonl')
  writeFileSync(bin, `#!${process.execPath}
import { appendFileSync, readFileSync, statSync, writeFileSync } from 'node:fs'
const args = process.argv.slice(2)
const at = (flag) => args[args.indexOf(flag) + 1]
const entry = { args }
if (args.includes('-R')) Object.assign(entry, { recipients: readFileSync(at('-R'), 'utf8'), mode: statSync(at('-R')).mode & 0o777, rfile: at('-R') })
appendFileSync(process.env.FAKE_AGE_LOG, JSON.stringify(entry) + '\\n')
if (args.includes('-d')) process.stdout.write(readFileSync(args.at(-1)))
else writeFileSync(at('-o'), readFileSync(0))
`)
  chmodSync(bin, 0o755)
  return { env: { AC_AGE: bin, FAKE_AGE_LOG: log }, calls: () => (existsSync(log) ? readFileSync(log, 'utf8').trim().split('\n').map((l) => JSON.parse(l)) : []) }
}

const LOCAL = {
  '.gitignore': '.env\n.env.local\napps/*/.env\n',
  '.env': "A=1\nB=two words\nC='has \"quote'\nSECRET_KEY=zq-1\n",
  'apps/api/.env': 'D=4\nE="line one\\nline two"\n',
  '.env.example': 'A=\n',
}

test('env export encrypts the local values for every recipient and writes no plain file', async () => {
  const age = fakeAge()
  const root = host(LOCAL)
  const before = walk(root)
  const r = await env(['export', '--root', root, '--to', `${KEY1}.pub,${KEY2}.pub`, '--json'], age.env)
  assert.equal(r.code, 0, r.stdout + r.stderr)
  const json = JSON.parse(r.stdout)
  assert.deepEqual([json.files, json.values, json.out], [2, 6, 'env-bundle.age'])
  assert.deepEqual(json.recipients.map((x) => x.keys), [1, 1])
  assert.deepEqual(walk(root).sort(), [...before, 'env-bundle.age'].sort())
  const [call] = age.calls()
  assert.deepEqual(call.recipients.trim().split('\n'), [pub(KEY1), pub(KEY2)])
  if (process.platform !== 'win32') assert.equal(call.mode, 0o600)
  assert.equal(call.args[0], '-R')
  assert.equal(call.args[2], '-o')
  assert.ok(!existsSync(call.rfile), 'the temp recipients file is removed')
  const plain = JSON.parse(readFileSync(join(root, 'env-bundle.age'), 'utf8'))
  assert.equal(plain.version, 1)
  assert.deepEqual(plain.files['.env'], { A: '1', B: 'two words', C: 'has "quote', SECRET_KEY: 'zq-1' })
  assert.deepEqual(plain.files['apps/api/.env'], { D: '4', E: 'line one\nline two' })
  assert.ok(!r.stdout.includes('zq-1') && !r.stderr.includes('zq-1'))
})

test('env export honors --only, --file and --out, and refuses bad input', async () => {
  const age = fakeAge()
  const root = host(LOCAL)
  const r = await env(['export', '--root', root, '--to', `${KEY1}.pub`, '--only', 'A, D', '--file', '.env', '--file', 'apps/api/.env', '--out', 'out/team.age'], age.env)
  assert.equal(r.code, 0, r.stderr)
  assert.match(r.stdout, /Exported 2 value\(s\) from 2 file\(s\) to out\/team\.age\./)
  assert.deepEqual(Object.keys(JSON.parse(readFileSync(join(root, 'out/team.age'), 'utf8')).files), ['.env', 'apps/api/.env'])

  const refuse = async (args, pattern, code = 1) => {
    const x = await env(['export', '--root', root, ...args], age.env)
    assert.equal(x.code, code, `${args.join(' ')}: ${x.stdout}${x.stderr}`)
    assert.match(x.stderr, pattern)
  }
  await refuse(['--to', `${KEY1}.pub`, '--file', '.env.example'], /is not a local env file/)
  await refuse(['--to', `${KEY1}.pub`, '--file', '../outside'], /is not a local env file/)
  await refuse(['--to', `${KEY1}.pub`, '--out', 'bundle.txt'], /must end with \.age/)
  await refuse(['--to', `${KEY1}.pub`, '--only', 'NOPE'], /no values to export/)
  await refuse(['--to', 'bad user!'], /is not a key file/)
  await refuse(['--to', 'nobody.pub'], /does not exist/)
  await refuse([], /export needs --to/, 2)
})

test('env export refuses an --out path that goes through a symlink or leaves the project', async () => {
  const age = fakeAge()
  const root = host(LOCAL)
  const away = temp('ac-env-away-')
  symlinkSync(away, join(root, 'link'))
  for (const out of ['link/b.age', join('..', basename(away), 'rel.age'), join(away, 'abs.age')]) {
    const r = await env(['export', '--root', root, '--to', `${KEY1}.pub`, '--out', out], age.env)
    assert.equal(r.code, 1, out)
    assert.match(r.stderr, /--out must be a path inside the project/, out)
  }
  assert.deepEqual(walk(away), [])
})

test('env export says that age is missing', async () => {
  const root = host(LOCAL)
  const r = await env(['export', '--root', root, '--to', `${KEY1}.pub`], { AC_AGE: join(root, 'no-such-age') })
  assert.equal(r.code, 1)
  assert.match(r.stderr, /age is not installed; install age 1\.3 or later/)
  assert.ok(!existsSync(join(root, 'env-bundle.age')))
})

const bundle = (files) => JSON.stringify({ version: 1, files })
const ID = `${KEY1}`

test('env import creates git-ignored files with mode 0600 and values that parseEnv reads back', async () => {
  const age = fakeAge()
  const values = { A: '1', B: 'two words', C: 'has "quote', D: "it's", E: 'line one\nline two', F: 'lit\\neral', G: '' }
  const root = host({ '.gitignore': '.env\napps/*/.env\n' })
  put(root, { 'in.age': bundle({ '.env': values, 'apps/api/.env': { H: '8' } }) })
  const r = await env(['import', 'in.age', '--root', root, '--identity', ID], age.env)
  assert.equal(r.code, 0, r.stdout + r.stderr)
  assert.match(r.stdout, /^\.env: 7 added, 0 replaced, 0 same, 0 kept$/m)
  assert.deepEqual({ ...parseEnv(readFileSync(join(root, '.env'), 'utf8')) }, values)
  assert.deepEqual({ ...parseEnv(readFileSync(join(root, 'apps/api/.env'), 'utf8')) }, { H: '8' })
  if (process.platform !== 'win32') assert.equal(statSync(join(root, '.env')).mode & 0o777, 0o600)
  assert.deepEqual(age.calls()[0].args.slice(0, 3), ['-d', '-i', ID])
  assert.ok(!r.stdout.includes('two words'))
})

test('env import keeps a name that has another value unless --overwrite replaces a one-line entry', async () => {
  const age = fakeAge()
  const existing = 'A=old\nexport B=same-value\nML="first\nsecond"\nC=old\nC=again\n# note\n'
  const files = { 'in.age': bundle({ '.env': { A: 'new', B: 'same-value', ML: 'other', C: 'newc', D: 'added' } }) }
  const root = host({ '.gitignore': '.env\n', '.env': existing, ...files })
  const first = await env(['import', 'in.age', '--root', root, '--identity', ID, '--json'], age.env)
  assert.equal(first.code, 0, first.stderr)
  assert.deepEqual(JSON.parse(first.stdout).files[0], { path: '.env', added: ['D'], replaced: [], kept: ['A', 'ML', 'C'], same: 1 })
  assert.equal(readFileSync(join(root, '.env'), 'utf8'), `${existing}D='added'\n`)

  const root2 = host({ '.gitignore': '.env\n', '.env': existing, ...files })
  const second = await env(['import', 'in.age', '--root', root2, '--identity', ID, '--overwrite', '--json'], age.env)
  assert.deepEqual(JSON.parse(second.stdout).files[0], { path: '.env', added: ['D'], replaced: ['A'], kept: ['ML', 'C'], same: 1 })
  const merged = readFileSync(join(root2, '.env'), 'utf8')
  assert.equal(merged, `${existing.replace('A=old', "A='new'")}D='added'\n`)
  assert.equal(parseEnv(merged).A, 'new')
})

test('env import refuses unsafe targets and writes nothing', async () => {
  const age = fakeAge()
  const outsideDir = temp('ac-env-outside-')
  const root = host({ '.gitignore': '.env\n', 'ok/.gitignore': '' })
  mkdirSync(join(outsideDir, 'target'))
  symlinkSync(join(outsideDir, 'target'), join(root, 'apps-link'))
  const bad = {
    'not ignored': { '.env.local': { A: '1' } },
    template: { '.env.example': { A: '1' } },
    traversal: { '../x/.env': { A: '1' } },
    absolute: { [join(outsideDir, '.env')]: { A: '1' } },
    'not an env name': { 'config.json': { A: '1' } },
    'dir symlink': { 'apps-link/.env': { A: '1' } },
  }
  for (const [label, files] of Object.entries(bad)) {
    put(root, { 'in.age': bundle({ '.env': { A: '0' }, ...files }) })
    const before = walk(root)
    const r = await env(['import', 'in.age', '--root', root, '--identity', ID, '--json'], age.env)
    assert.equal(r.code, 1, label)
    assert.match(JSON.parse(r.stdout).errors[0], /Nothing was written/, label)
    assert.deepEqual(walk(root), before, label)
    assert.equal(walk(outsideDir).length, 0, label)
  }
  const plain = host({ 'in.age': bundle({ '.env': { A: '1' } }) }, { git: false })
  const r = await env(['import', 'in.age', '--root', plain, '--identity', ID], age.env)
  assert.equal(r.code, 1)
  assert.match(r.stderr, /\.env is not ignored by git/)
  assert.ok(!existsSync(join(plain, '.env')))
})

test('env import refuses a file symlink and a value that has no safe quote style', async () => {
  const age = fakeAge()
  const target = join(temp('ac-env-target-'), 'real')
  writeFileSync(target, 'X=1\n')
  const root = host({ '.gitignore': '.env\n.env.local\n', 'in.age': bundle({ '.env.local': { A: '1' } }) })
  symlinkSync(target, join(root, '.env.local'))
  const link = await env(['import', 'in.age', '--root', root, '--identity', ID], age.env)
  assert.equal(link.code, 1)
  assert.match(link.stderr, /\.env\.local goes through a symlink/)
  assert.equal(readFileSync(target, 'utf8'), 'X=1\n')

  const quotes = host({ '.gitignore': '.env\n', 'in.age': bundle({ '.env': { OK: '1', HARD: 'a"b\'c`d' } }) })
  const r = await env(['import', 'in.age', '--root', quotes, '--identity', ID], age.env)
  assert.equal(r.code, 1)
  assert.match(r.stderr, /the value of HARD has no safe quote style/)
  assert.ok(!existsSync(join(quotes, '.env')))
})

test('env import refuses a bundle with a wrong shape or a missing identity', async () => {
  const age = fakeAge()
  const home = temp('ac-env-home-')
  const root = host({ '.gitignore': '.env\n' })
  const shapes = ['not json', JSON.stringify({ version: 2, files: {} }), bundle({ '.env': { 'BAD NAME': '1' } }), bundle({ '.env': { A: 1 } })]
  for (const text of shapes) {
    put(root, { 'in.age': text })
    const r = await env(['import', 'in.age', '--root', root, '--identity', ID], age.env)
    assert.equal(r.code, 1, text)
    assert.match(r.stderr, /the bundle (is not valid JSON|has an incorrect shape)/)
  }
  put(root, { 'in.age': bundle({ '.env': { A: '1' } }) })
  const none = await env(['import', 'in.age', '--root', root], { ...age.env, HOME: home, USERPROFILE: home })
  assert.equal(none.code, 1)
  assert.match(none.stderr, /no SSH identity found/)
  mkdirSync(join(home, '.ssh'))
  writeFileSync(join(home, '.ssh/id_ed25519'), 'key')
  const found = await env(['import', 'in.age', '--root', root], { ...age.env, HOME: home, USERPROFILE: home })
  assert.equal(found.code, 0, found.stderr)
  assert.equal(age.calls().at(-1).args[2], join(home, '.ssh/id_ed25519'))
  assert.equal((await env(['import', '--root', root], age.env)).code, 2)
})

test('env run passes the values to the child, keeps process values and writes no file', async () => {
  const age = fakeAge()
  const root = host({
    '.env': 'RUN_A=file\nRUN_C=file\n',
    '.env.local': 'RUN_A=local\nRUN_B=b\n',
    'other.env': 'RUN_O=o\n',
    'show.mjs': 'console.log(JSON.stringify([process.env.RUN_A, process.env.RUN_B, process.env.RUN_C, process.env.RUN_O, process.env.RUN_X, process.argv.slice(2)]))\nprocess.exit(Number(process.env.EXIT ?? 0))\n',
    'in.age': bundle({ '.env': { RUN_X: 'bundle', RUN_B: 'from-bundle' } }),
  })
  const before = walk(root)
  const run = (args, extra = {}) => env(['run', '--root', root, ...args, '--', process.execPath, 'show.mjs', 'a b', '--flag'], { ...extra, RUN_C: 'process' })
  const plain = await run([])
  assert.equal(plain.code, 0, plain.stderr)
  assert.deepEqual(JSON.parse(plain.stdout), ['local', 'b', 'process', null, null, ['a b', '--flag']])
  assert.deepEqual(JSON.parse((await run(['--file', 'other.env'])).stdout), [null, null, 'process', 'o', null, ['a b', '--flag']])
  const bundled = await run(['--bundle', 'in.age', '--identity', ID], age.env)
  assert.deepEqual(JSON.parse(bundled.stdout), ['local', 'from-bundle', 'process', null, 'bundle', ['a b', '--flag']])
  assert.equal((await run([], { EXIT: '7' })).code, 7)
  assert.deepEqual(walk(root), before)
  assert.equal((await env(['run', '--root', root])).code, 2)
  const missing = await env(['run', '--root', root, '--file', 'nope.env', '--', 'x'])
  assert.equal(missing.code, 1)
  assert.match(missing.stderr, /nope\.env does not exist/)
  const gone = await env(['run', '--root', root, '--', join(root, 'no-such-binary')])
  assert.equal(gone.code, 1)
  assert.match(gone.stderr, /cannot start/)
})

test('a command that is not env gives a usage error', async () => {
  assert.equal((await env([])).code, 2)
  assert.equal((await env(['bogus'])).code, 2)
  assert.equal((await env(['check', '--nope'])).code, 2)
  assert.equal((await env(['check', 'extra'])).code, 2)
  const help = await env(['--help'])
  assert.equal(help.code, 0)
  assert.match(help.stdout, /Usage: ac env/)
})

// ---- a real age round trip ----

const realAge = spawnSync('age', ['--version'], { encoding: 'utf8' })

test('env export and env import round trip with real age and two SSH keys', { skip: realAge.status === 0 ? false : 'age is not installed' }, async () => {
  const source = host(LOCAL)
  const r = await env(['export', '--root', source, '--to', `${KEY1}.pub,${KEY2}.pub`, '--json'])
  assert.equal(r.code, 0, r.stdout + r.stderr)
  const encrypted = readFileSync(join(source, 'env-bundle.age'))
  assert.ok(!encrypted.includes('two words'), 'the bundle is encrypted')
  for (const key of [KEY1, KEY2]) {
    const target = host({ '.gitignore': '.env\napps/*/.env\n' })
    writeFileSync(join(target, 'env-bundle.age'), encrypted)
    const imported = await env(['import', 'env-bundle.age', '--root', target, '--identity', key])
    assert.equal(imported.code, 0, imported.stdout + imported.stderr)
    assert.equal(parseEnv(readFileSync(join(target, '.env'), 'utf8')).B, 'two words')
    assert.equal(parseEnv(readFileSync(join(target, 'apps/api/.env'), 'utf8')).E, 'line one\nline two')
  }
})

import assert from 'node:assert/strict'
import { chmodSync, cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { checkDocs, SCREENS_SEED } from '../engine/docs.mjs'
import { LOCK, syncHost } from '../engine/sync.mjs'

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
    if (text === null) { rmSync(join(root, rel), { recursive: true, force: true }); continue }
    mkdirSync(dirname(join(root, rel)), { recursive: true })
    writeFileSync(join(root, rel), text)
  }
  return root
}

const host = (files) => put(temp('ac-docs-'), files)
const check = (root) => checkDocs({ AC: REPO, root })
const has = (list, pattern) => list.some((m) => pattern.test(m))

const raid = (id, over = {}) => {
  const keys = { id, kind: 'question', status: 'open', raisedAt: '2026-10-16', raisedBy: 'me', owner: '', specRef: '', taskRef: '', ticket: '', ...over }
  return `---\n${Object.entries(keys).filter(([, v]) => v !== null).map(([k, v]) => (v ? `${k}: ${v}` : `${k}:`)).join('\n')}\n---\n\n## Question\n\nWhy?\n`
}
const adr = (status = 'accepted', date = '2026-10-16') => `---\nstatus: ${status}\ndate: ${date}\n---\n\n# Title\n`

test('RAID files: nine ordered keys, closed kind and status, id equal to the file name', () => {
  const ok = check(host({ 'docs/delivery/questions/Q-001.md': raid('Q-001'), 'docs/delivery/questions/Q-002.md': raid('Q-002', { kind: 'Risk', status: 'folded' }) }))
  assert.deepEqual(ok.errors, [])
  assert.equal(ok.ok, true)

  const keys = (order) => `---\n${order.map((k) => `${k}:${k === 'id' ? ' Q-003' : k === 'kind' ? ' risk' : k === 'status' ? ' open' : ''}`).join('\n')}\n---\n`
  const bad = check(host({
    'docs/delivery/questions/Q-001.md': raid('Q-001', { ticket: null }),
    'docs/delivery/questions/Q-002.md': raid('Q-002', { kind: 'idea', status: 'closed' }),
    'docs/delivery/questions/Q-003.md': keys(['id', 'status', 'kind', 'raisedAt', 'raisedBy', 'owner', 'specRef', 'taskRef', 'ticket']),
    'docs/delivery/questions/Q-004.md': raid('Q-040'),
    'docs/delivery/questions/notes.md': 'draft\n',
  }))
  assert.equal(bad.ok, false)
  assert.ok(has(bad.errors, /Q-001\.md: the frontmatter needs the keys ticket/))
  assert.ok(has(bad.errors, /Q-002\.md: kind "idea"/))
  assert.ok(has(bad.errors, /Q-002\.md: status "closed"/))
  assert.ok(has(bad.errors, /Q-003\.md: write the frontmatter keys in this order/))
  assert.ok(has(bad.errors, /Q-004\.md: the id must be Q-004/))
  assert.ok(has(bad.warnings, /notes\.md: the name of a RAID file is Q-NNN\.md/))
})

test('ADRs: NNNN-slug.md with MADR status and date; templates, README and index are skipped', () => {
  const ok = check(host({
    'docs/decisions/0001-first.md': adr(),
    'docs/decisions/0002-second.md': adr('accepted — risk accepted'),
    'docs/decisions/sub/0003-third.md': adr('superseded by 0004'),
    'docs/decisions/000-template.md': '# no frontmatter\n',
    'docs/decisions/adr-template.md': '# no frontmatter\n',
    'docs/decisions/template-short.md': '# no frontmatter\n',
    'docs/decisions/README.md': '# Index\n',
  }))
  assert.deepEqual(ok.errors, [])

  const bad = check(host({
    'docs/decisions/001-short.md': adr(),
    'docs/decisions/0002-Upper.md': adr(),
    'docs/decisions/0003-no-front.md': '# Title\n',
    'docs/decisions/0004-bad-date.md': adr('maybe', '16/10/2026'),
    'docs/decisions/0005-a.md': adr(),
    'docs/decisions/0005-b.md': adr(),
  }))
  assert.ok(has(bad.errors, /001-short\.md: the name of an ADR is NNNN-slug\.md/))
  assert.ok(has(bad.errors, /0002-Upper\.md: the name of an ADR/))
  assert.ok(has(bad.errors, /0003-no-front\.md: the MADR frontmatter needs "status"/))
  assert.ok(has(bad.errors, /0003-no-front\.md: the MADR frontmatter needs "date"/))
  assert.ok(has(bad.errors, /0004-bad-date\.md: the MADR frontmatter needs "status"/))
  assert.ok(has(bad.errors, /ADR number 0005 is in more than one file/))
})

test('a root specs/ folder is a warning; Konvoy paths decide the dirs', () => {
  const plain = check(host({ 'specs/README.md': 'x\n' }))
  assert.equal(plain.ok, true)
  assert.ok(has(plain.warnings, /specs\/ is at the project root/))

  const konvoy = check(host({
    '.agents/konvoy.json': JSON.stringify({ paths: { adr: 'adr', openspec: 'specs' } }),
    'specs/README.md': 'x\n',
    'adr/01-bad.md': adr(),
    'docs/decisions/01-ignored.md': adr(),
  }))
  assert.equal(konvoy.pathsFrom, '.agents/konvoy.json')
  assert.ok(!has(konvoy.warnings, /specs\/ is at the project root/))
  assert.deepEqual(konvoy.errors.filter((e) => /ADR/.test(e)), ['adr/01-bad.md: the name of an ADR is NNNN-slug.md (four digits, then a lower-case slug)'])
})

test('screens registry: unique ids and aliases; every Screen tag resolves to one id', () => {
  const screens = (list) => JSON.stringify({ version: 1, screens: list })
  const spec = 'docs/openspec/changes/a/specs/auth/spec.md'
  const ok = check(host({
    'docs/designs/screens.json': screens([
      { id: 'SCR-001', aliases: ['login', 'Sign in'], route: '/login', figma: { fileKey: 'k', nodeId: '1:2' }, stories: ['Auth/Login'], specRefs: ['auth/spec.md'] },
      { id: 'SCR-002' },
    ]),
    [spec]: '### Requirement: login\nScreen: SCR-001\n- **Screen:** sign in, SCR-002\n```\nScreen: SCR-999\n```\n',
    'docs/openspec/schemas/konvoy-delivery/templates/spec.md': 'Screen: SCR-404\n',
  }))
  assert.deepEqual(ok.errors, [])

  const bad = check(host({
    'docs/designs/screens.json': screens([
      { id: 'SCR-001', aliases: ['login'] },
      { id: 'SCR-001', aliases: ['Login'], figma: { fileKey: 'k', 'node-id': '1:2' } },
      { id: 'S-3' },
    ]),
    [spec]: 'Screen: SCR-009\nScreen: checkout\n',
  }))
  assert.ok(has(bad.errors, /screens\[1\]: the id SCR-001 is in the registry more than once/))
  assert.ok(has(bad.errors, /screens\[1\]: "figma" must be/))
  assert.ok(has(bad.errors, /screens\[2\]: "id" must be SCR-/))
  assert.ok(has(bad.errors, /spec\.md:1: the screen SCR-009 is not in docs\/designs\/screens\.json/))
  assert.ok(has(bad.errors, /spec\.md:2: "checkout" is not a screen id or alias/))

  const dup = check(host({ 'docs/designs/screens.json': screens([{ id: 'SCR-001', aliases: ['home'] }, { id: 'SCR-002', aliases: ['HOME'] }]) }))
  assert.ok(has(dup.errors, /the alias "HOME" is on SCR-001 and on SCR-002/))

  const missing = check(host({ [spec]: 'Screen: SCR-001\n' }))
  assert.ok(has(missing.errors, /1 "Screen:" tag\(s\), but docs\/designs\/screens\.json does not exist/))
  assert.ok(has(check(host({ 'docs/designs/screens.json': '{ bad' })).errors, /screens\.json: /))
  assert.ok(has(check(host({ 'docs/designs/screens.json': '[]' })).errors, /an object with a "screens" list/))
})

test('the openspec CLI runs with a timeout in the parent of the OpenSpec dir, only when it exists', { skip: process.platform === 'win32' }, () => {
  const bin = temp('ac-bin-')
  const log = join(bin, 'calls.log')
  put(bin, { openspec: '#!/bin/sh\necho "$PWD|$*" >> "$OPENSPEC_LOG"\ncase "$1" in\n  validate) if [ -f openspec/BAD ]; then echo \'{"items":[{"id":"chg","valid":false}]}\'; exit 1; fi; echo \'{"items":[]}\' ;;\n  status) if [ -f openspec/BAD ]; then printf \'{\\n "status": [{ "message": "No change named x" }]\\n}\\n\'; exit 1; fi; echo \'{}\' ;;\n  *) echo ok ;;\nesac\n' })
  chmodSync(join(bin, 'openspec'), 0o755)
  const saved = { PATH: process.env.PATH, OPENSPEC_LOG: process.env.OPENSPEC_LOG }
  try {
    process.env.OPENSPEC_LOG = log
    process.env.PATH = bin
    const root = host({ 'docs/openspec/project.md': 'x\n' })
    assert.deepEqual(check(root).errors, [])
    const calls = readFileSync(log, 'utf8').trim().split('\n')
    assert.deepEqual(calls.map((c) => c.split('|')[1]), ['--version', 'validate --all --strict --json', 'status --all --json'])
    assert.match(calls[1], /\/docs\|validate/, 'the CLI runs in docs/, the parent of docs/openspec')

    put(root, { 'docs/openspec/BAD': '' })
    const red = check(root)
    assert.ok(has(red.errors, /openspec validate --all --strict: 1 item\(s\) are not valid: chg/))
    assert.ok(has(red.warnings, /^openspec status: No change named x$/))

    const odd = host({ '.agents/compass.json': JSON.stringify({ paths: { openspec: 'docs/specs' } }), 'docs/specs/project.md': 'x\n' })
    assert.ok(has(check(odd).warnings, /reads a folder named openspec, so it cannot check docs\/specs/))

    process.env.PATH = temp('ac-empty-')
    assert.ok(has(check(root).warnings, /the openspec CLI is not installed/))
    assert.equal(check(host({})).warnings.length, 0)
  } finally {
    Object.assign(process.env, saved)
  }
})

// Ownership rules that need both ledgers (docs/contract/ownership.md).
const compass = () => {
  const ac = temp('ac-own-')
  cpSync(join(REPO, 'core/openspec'), join(ac, 'core/openspec'), { recursive: true })
  return put(ac, {
    'package.json': '{ "version": "1.0.0-test" }\n',
    'core/blocks/AGENTS.md': 'Contract.\n',
    'core/keys.json': JSON.stringify({ '.codex/config.toml': { model_verbosity: 'low' } }),
  })
}
const SCHEMA_FILE = 'docs/openspec/schemas/konvoy-delivery/schema.yaml'

test('the konvoy-delivery schema installs only without the Konvoy ledger; then Konvoy owns it', () => {
  const ac = compass()
  const root = host({ '.agents/compass.json': '{}', 'docs/openspec/project.md': 'x\n', 'docs/designs/a.png': 'png' })
  const first = syncHost({ AC: ac, root, apply: true })
  assert.equal(first.ok, true, first.errors.join('\n'))
  assert.equal(readFileSync(join(root, SCHEMA_FILE), 'utf8'), readFileSync(join(REPO, 'core/openspec/konvoy-delivery/schema.yaml'), 'utf8'))
  assert.equal(readFileSync(join(root, 'docs/designs/screens.json'), 'utf8'), SCREENS_SEED)

  put(root, { '.agents/konvoy.json': '{}' })
  const second = syncHost({ AC: ac, root, apply: true })
  assert.equal(second.ok, true, second.errors.join('\n'))
  assert.ok(second.changes.some((c) => c.action === 'release' && c.path === SCHEMA_FILE))
  assert.ok(existsSync(join(root, SCHEMA_FILE)), 'a released file stays on disk')
  assert.ok(!(SCHEMA_FILE in JSON.parse(readFileSync(join(root, LOCK), 'utf8')).files))

  const fresh = host({ '.agents/compass.json': '{}', '.agents/konvoy.json': '{}', 'docs/openspec/project.md': 'x\n' })
  assert.equal(syncHost({ AC: ac, root: fresh, apply: true }).ok, true)
  assert.ok(!existsSync(join(fresh, SCHEMA_FILE)))
})

test('Konvoy cannot claim compass files, and compass cannot own keys in a file that Konvoy owns whole', () => {
  const ac = compass()
  const root = host({
    '.agents/compass.json': '{}',
    '.agents/konvoy.json': JSON.stringify({ host_files: { '.codex/config.toml': '0.9.1' }, owns: { files: ['.agents/compass.lock.json'] } }),
  })
  const r = syncHost({ AC: ac, root })
  assert.equal(r.ok, false)
  assert.ok(has(r.errors, /\.agents\/konvoy\.json lists \.agents\/compass\.lock\.json, but compass owns that file/))
  assert.ok(has(r.warnings, /\.codex\/config\.toml belongs to Konvoy as a whole file; compass leaves its keys and blocks to Konvoy/))
  assert.ok(!has(r.errors, /config\.toml/))
  put(root, { '.agents/konvoy.json': JSON.stringify({ owns: { files: ['AGENTS.md'] } }) })
  const agents = syncHost({ AC: ac, root })
  assert.equal(agents.ok, true, agents.errors.join('\n'))
  assert.ok(has(agents.warnings, /AGENTS\.md belongs to Konvoy as a whole file/))
})

test('when Konvoy takes a whole file, compass releases its keys and block there and writes nothing to it', () => {
  const ac = compass()
  const root = host({ '.agents/compass.json': '{}', '.codex/config.toml': 'model = "x"\n', 'AGENTS.md': '# Project\n' })
  assert.equal(syncHost({ AC: ac, root, apply: true }).ok, true)
  const lockBefore = JSON.parse(readFileSync(join(root, LOCK), 'utf8'))
  assert.ok(lockBefore.keys['.codex/config.toml'] && lockBefore.blocks['AGENTS.md'], 'compass owned a key and a block')
  const toml = readFileSync(join(root, '.codex/config.toml'), 'utf8')
  const agents = readFileSync(join(root, 'AGENTS.md'), 'utf8')
  put(root, { '.agents/konvoy.json': JSON.stringify({ owns: { files: ['.codex/config.toml', 'AGENTS.md'] } }) })
  const r = syncHost({ AC: ac, root, apply: true })
  assert.equal(r.ok, true, r.errors.join('\n'))
  assert.ok(r.changes.some((c) => c.action === 'release' && c.path === '.codex/config.toml'))
  assert.ok(r.changes.some((c) => c.action === 'release' && c.path === 'AGENTS.md'))
  assert.equal(readFileSync(join(root, '.codex/config.toml'), 'utf8'), toml, 'no write to a Konvoy file')
  assert.equal(readFileSync(join(root, 'AGENTS.md'), 'utf8'), agents)
  const lock = JSON.parse(readFileSync(join(root, LOCK), 'utf8'))
  assert.equal(lock.keys['.codex/config.toml'], undefined)
  assert.equal(lock.blocks['AGENTS.md'], undefined)
})

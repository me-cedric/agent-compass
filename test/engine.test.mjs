import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { walk } from '../engine/util.mjs'
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
    if (text === null) { rmSync(join(root, rel), { force: true }); continue }
    mkdirSync(dirname(join(root, rel)), { recursive: true })
    writeFileSync(join(root, rel), text)
  }
}

const KEYS = {
  '.claude/settings.json': { outputStyle: 'compass' },
  '.mcp.json': { 'mcpServers.docs': { command: 'docs-mcp' } },
  '.codex/config.toml': { model_verbosity: 'low', 'mcp_servers.docs': { command: 'docs-mcp', args: ['--read-only'] } },
}

// A small compass tree: the real bin/ and engine/ with placeholder assets.
const makeCompass = (extra = {}) => {
  const ac = temp('ac-compass-')
  cpSync(join(REPO, 'bin'), join(ac, 'bin'), { recursive: true })
  cpSync(join(REPO, 'engine'), join(ac, 'engine'), { recursive: true })
  put(ac, {
    'package.json': '{ "version": "1.0.0-test" }\n',
    'skills/alpha/SKILL.md': '---\nname: alpha\ndescription: Alpha.\n---\nAlpha v1.\n',
    'skills/alpha/ref/notes.md': 'Notes.\n',
    'skills/nest-only/SKILL.md': '---\nname: nest-only\nmetadata:\n  stacks: [nestjs-api]\n---\nNest.\n',
    'agents/worker.md': '---\nname: worker\ndescription: Does the work.\nmodel: sonnet\ncodex-model: gpt-5\n---\nDo the task.\n',
    'rules/stack-nest.md': '---\ndescription: Nest rules.\npaths:\n  - "src/**/*.ts"\nstacks: [nestjs-api]\n---\nNest rule.\n',
    'core/blocks/AGENTS.md': 'Contract v1.\n',
    'core/blocks/CLAUDE.md': '@AGENTS.md\n',
    'core/files/.claude/output-styles/compass.md': 'Style v1.\n',
    'core/seed/process-compose.yaml': 'version: "0.5"\n',
    'core/keys.json': JSON.stringify(KEYS),
    ...extra,
  })
  return ac
}

const makeHost = (files = {}) => {
  const root = temp('ac-host-')
  put(root, files)
  return root
}

const ac = async (compass, host, ...args) => {
  const r = await runNode([join(compass, 'bin/ac.mjs'), ...args, '--root', host, '--json'])
  return { ...r, json: r.stdout ? JSON.parse(r.stdout) : null }
}

const snapshot = (root) => Object.fromEntries(walk(root).map((rel) => [rel, readFileSync(join(root, rel), 'utf8')]))
const read = (root, rel) => readFileSync(join(root, rel), 'utf8')
const actions = (r) => r.json.changes.map((c) => `${c.action} ${c.path}${c.key ? `#${c.key}` : ''}`)

test('init installs files, skills in both dirs, agents for Claude and Codex, keys and blocks', async () => {
  const compass = makeCompass()
  const host = makeHost({ 'AGENTS.md': '# Project\n\nOwn rules.\n' })
  const r = await ac(compass, host, 'init')
  assert.equal(r.code, 0, r.stderr)
  assert.equal(read(host, '.claude/skills/alpha/SKILL.md'), read(host, '.agents/skills/alpha/SKILL.md'))
  assert.ok(existsSync(join(host, '.agents/skills/alpha/ref/notes.md')))
  assert.ok(!existsSync(join(host, '.claude/skills/nest-only')), 'a stack-bound skill installs only for its stack')
  assert.ok(!existsSync(join(host, '.claude/rules/stack-nest.md')))
  assert.equal(existsSync(join(host, '.github/agents/worker.agent.md')), false)
  assert.match(read(host, '.codex/agents/worker.toml'), /^name = "worker"\ndescription = "Does the work."\nmodel = "gpt-5"\ndeveloper_instructions = '''\nDo the task.'''\n$/)
  assert.ok(read(host, 'AGENTS.md').startsWith('# Project\n\nOwn rules.\n\n<!-- compass:begin -->\nContract v1.\n<!-- compass:end -->'))
  assert.match(read(host, '.codex/config.toml'), /^model_verbosity = "low"\n\n\[mcp_servers\.docs\]\ncommand = "docs-mcp"\nargs = \["--read-only"\]\n$/)
  assert.deepEqual(JSON.parse(read(host, '.agents/compass.json')), { version: 1, packs: [], exclude: [] })
  const lock = JSON.parse(read(host, '.agents/compass.lock.json'))
  assert.equal(lock.lockVersion, 2)
  assert.equal(lock.version, '1.0.0-test')
  assert.deepEqual(lock.skills, ['alpha'])
  assert.equal(lock.files['process-compose.yaml'].owner, 'project')
  assert.equal(lock.files['.claude/skills/alpha/SKILL.md'].owner, 'compass')
  assert.deepEqual(Object.keys(lock.keys['.codex/config.toml']), ['mcp_servers.docs', 'model_verbosity'])
  assert.ok(lock.blocks['AGENTS.md'])
})

test('a stack-bound asset installs when its stack is detected', async () => {
  const compass = makeCompass()
  const host = makeHost({ 'package.json': JSON.stringify({ dependencies: { '@nestjs/core': '1' } }) })
  assert.equal((await ac(compass, host, 'init')).code, 0)
  assert.ok(existsSync(join(host, '.agents/skills/nest-only/SKILL.md')))
  assert.match(read(host, '.claude/rules/stack-nest.md'), /^paths:\n {2}- "src\/\*\*\/\*\.ts"$/m)
  assert.equal(read(host, '.agents/skills/stack-nest/SKILL.md'), '---\nname: stack-nest\ndescription: "Nest rules."\n---\nNest rule.\n')
  assert.ok(!existsSync(join(host, '.claude/skills/stack-nest')), 'Claude reads the rule, so the Codex skill goes to .agents/skills only')
  assert.deepEqual(JSON.parse(read(host, '.agents/compass.lock.json')).skills, ['alpha', 'nest-only', 'stack-nest'])
})

test('path placeholders take the Konvoy paths; an unknown placeholder is an error', async () => {
  const compass = makeCompass({
    'skills/paths/SKILL.md': '---\nname: paths\n---\nWrite to {{DELIVERY_DIR}}/raid and read {{PERSONAS_FILE}}.\n',
    'rules/stack-nest.md': '---\ndescription: Nest rules.\nstacks: [nestjs-api]\n---\nSee {{OPENAPI_DIR}}.\n',
  })
  const host = makeHost({
    '.agents/konvoy.json': JSON.stringify({ paths: { delivery: 'product/delivery' } }),
    'package.json': JSON.stringify({ dependencies: { '@nestjs/core': '1' } }),
  })
  assert.equal((await ac(compass, host, 'init')).code, 0)
  assert.match(read(host, '.claude/skills/paths/SKILL.md'), /Write to product\/delivery\/raid and read docs\/personas\/personas\.json\./)
  assert.match(read(host, '.agents/skills/stack-nest/SKILL.md'), /See docs\/api\./)
  assert.match(read(host, '.claude/rules/stack-nest.md'), /See docs\/api\./)
  put(host, { '.agents/konvoy.json': JSON.stringify({ paths: { delivery: 'delivery' } }) })
  assert.deepEqual(actions(await ac(compass, host, 'sync')).sort(), ['update .agents/skills/paths/SKILL.md', 'update .claude/skills/paths/SKILL.md'])
  put(compass, { 'skills/paths/SKILL.md': '---\nname: paths\n---\nWrite to {{DELIVRY_DIR}}.\n' })
  const typo = await ac(compass, host, 'sync')
  assert.equal(typo.code, 1)
  assert.match(typo.json.errors.join('\n'), /skills\/paths\/SKILL\.md: unknown placeholder \{\{DELIVRY_DIR\}\}/)
})

test('excluding a stack rule by name or by path drops the rule and its Codex skill', async () => {
  const compass = makeCompass()
  for (const exclude of ['stack-nest', '.claude/rules/stack-nest.md']) {
    const host = makeHost({ 'package.json': JSON.stringify({ dependencies: { '@nestjs/core': '1' } }), '.agents/compass.json': JSON.stringify({ exclude: [exclude] }) })
    assert.equal((await ac(compass, host, 'sync')).code, 0)
    assert.ok(!existsSync(join(host, '.claude/rules/stack-nest.md')) && !existsSync(join(host, '.agents/skills/stack-nest')), exclude)
  }
})

test('a stack rule without a description is an error', async () => {
  const compass = makeCompass({ 'rules/stack-nest.md': '---\nstacks: [nestjs-api]\n---\nNest rule.\n' })
  const host = makeHost({ 'package.json': JSON.stringify({ dependencies: { '@nestjs/core': '1' } }) })
  const r = await ac(compass, host, 'init')
  assert.equal(r.code, 1)
  assert.match(r.json.errors.join('\n'), /rules\/stack-nest\.md needs a description for its Codex skill/)
})

test('sync twice gives no diff', async () => {
  const compass = makeCompass()
  const host = makeHost()
  await ac(compass, host, 'init')
  const before = snapshot(host)
  const r = await ac(compass, host, 'sync')
  assert.equal(r.code, 0)
  assert.deepEqual(r.json.changes, [])
  assert.equal(r.json.drift, false)
  assert.deepEqual(snapshot(host), before)
})

test('an edited managed file, key and block are kept and reported; unedited ones update', async () => {
  const compass = makeCompass()
  const host = makeHost()
  await ac(compass, host, 'init')
  put(host, {
    '.claude/output-styles/compass.md': 'My style.\n',
    'AGENTS.md': read(host, 'AGENTS.md').replace('Contract v1.', 'My contract.'),
    '.claude/settings.json': '{\n  "outputStyle": "mine"\n}\n',
  })
  put(compass, {
    'core/files/.claude/output-styles/compass.md': 'Style v2.\n',
    'core/blocks/AGENTS.md': 'Contract v2.\n',
    'core/keys.json': JSON.stringify({ ...KEYS, '.claude/settings.json': { outputStyle: 'compass-2' } }),
    'skills/alpha/SKILL.md': '---\nname: alpha\n---\nAlpha v2.\n',
  })
  const r = await ac(compass, host, 'sync')
  assert.equal(r.code, 0, r.stderr)
  assert.deepEqual(actions(r).sort(), [
    '.claude/settings.json#outputStyle', '.claude/output-styles/compass.md', 'AGENTS.md#block',
  ].map((p) => `kept ${p}`).concat(['update .agents/skills/alpha/SKILL.md', 'update .claude/skills/alpha/SKILL.md']).sort())
  assert.equal(read(host, '.claude/output-styles/compass.md'), 'My style.\n')
  assert.match(read(host, 'AGENTS.md'), /My contract\./)
  assert.equal(JSON.parse(read(host, '.claude/settings.json')).outputStyle, 'mine')
  assert.match(read(host, '.claude/skills/alpha/SKILL.md'), /Alpha v2/)
  assert.ok(!walk(host).some((f) => f.endsWith('.acnew')))
  const again = await ac(compass, host, 'sync')
  assert.deepEqual(actions(again).every((a) => a.startsWith('kept ')), true)
})

test('Konvoy-owned files, skill dirs, keys and blocks stay byte-identical', async () => {
  const compass = makeCompass()
  const konvoyFiles = {
    '.agents/konvoy.json': `${JSON.stringify({ schema: 1, paths: { delivery: 'product/delivery' }, owns: { skills: ['konvoy-plan'], keys: { '.claude/settings.json': ['env.KONVOY'] } } }, null, 2)}\n`,
    '.agents/skills/konvoy-plan/SKILL.md': '---\nname: konvoy-plan\n---\nKonvoy skill.\n',
    'product/delivery/tickets.json': '{"tickets":[]}',
  }
  const agents = '# P\n\n<!-- konvoy:begin -->\nKonvoy   block\n\n\n<!-- konvoy:end -->\n'
  const mcp = '{\n  "mcpServers": {\n    "konvoy": {\n      "url": "http://127.0.0.1:7777/mcp"\n    }\n  }\n}\n'
  const konvoyToml = '[mcp_servers.konvoy]\nurl = "http://127.0.0.1:7777/mcp"   # Konvoy\n'
  const settings = '{\n  "env": {\n    "KONVOY": "1"\n  }\n}\n'
  const host = makeHost({ ...konvoyFiles, 'AGENTS.md': agents, '.mcp.json': mcp, '.codex/config.toml': `# user\n\n${konvoyToml}`, '.claude/settings.json': settings })
  const r = await ac(compass, host, 'init')
  assert.equal(r.code, 0, r.stderr)
  assert.equal(r.json.pathsFrom, '.agents/konvoy.json')
  assert.equal(r.json.paths.delivery, 'product/delivery')
  for (const [rel, text] of Object.entries(konvoyFiles)) assert.equal(read(host, rel), text, rel)
  assert.ok(read(host, 'AGENTS.md').includes('<!-- konvoy:begin -->\nKonvoy   block\n\n\n<!-- konvoy:end -->\n'))
  assert.ok(read(host, '.mcp.json').includes('    "konvoy": {\n      "url": "http://127.0.0.1:7777/mcp"\n    }'))
  assert.ok(read(host, '.codex/config.toml').includes(konvoyToml))
  assert.ok(read(host, '.claude/settings.json').includes('  "env": {\n    "KONVOY": "1"\n  }'))
  const before = snapshot(host)
  assert.deepEqual((await ac(compass, host, 'sync')).json.changes, [])
  assert.deepEqual(snapshot(host), before)
})

test('check --frozen exits 1 on drift and 0 when clean', async () => {
  const compass = makeCompass()
  const host = makeHost()
  assert.equal((await ac(compass, host, 'check', '--frozen')).code, 1, 'no config yet')
  await ac(compass, host, 'init')
  assert.equal((await ac(compass, host, 'check', '--frozen')).code, 0)
  const style = read(host, '.claude/output-styles/compass.md')
  put(host, { '.claude/output-styles/compass.md': 'Edited.\n' })
  const edited = await ac(compass, host, 'check', '--frozen')
  assert.equal(edited.code, 1)
  assert.deepEqual(actions(edited), ['kept .claude/output-styles/compass.md'])
  assert.equal(read(host, '.claude/output-styles/compass.md'), 'Edited.\n', 'check writes nothing')
  put(host, { '.claude/output-styles/compass.md': style })
  assert.equal((await ac(compass, host, 'check', '--frozen')).code, 0)
  put(compass, { 'skills/beta/SKILL.md': '---\nname: beta\n---\nBeta.\n' })
  assert.equal((await ac(compass, host, 'check', '--frozen')).code, 1)
  assert.equal((await ac(compass, host, 'check')).code, 0, 'without --frozen, drift is a report')
  await ac(compass, host, 'sync')
  assert.equal((await ac(compass, host, 'check', '--frozen')).code, 0)
})

test('a skill name in both ledgers is an error and nothing is written', async () => {
  const compass = makeCompass()
  const host = makeHost({ '.agents/konvoy.json': JSON.stringify({ compass_skills: { alpha: '0.9.1' } }) })
  const r = await ac(compass, host, 'init')
  assert.equal(r.code, 1)
  assert.match(r.json.errors.join('\n'), /skill "alpha" is in both ledgers/)
  assert.deepEqual(walk(host), ['.agents/konvoy.json'])
})

test('a compass file in a Konvoy path or on a Konvoy key is an error', async () => {
  const compass = makeCompass({ 'core/files/docs/delivery/x.md': 'X\n', 'core/keys.json': JSON.stringify({ '.mcp.json': { 'mcpServers.konvoy': {} } }) })
  const host = makeHost({ '.agents/konvoy.json': '{}' })
  const r = await ac(compass, host, 'init')
  assert.equal(r.code, 1)
  assert.match(r.json.errors.join('\n'), /docs\/delivery\/x\.md belongs to Konvoy/)
  assert.match(r.json.errors.join('\n'), /mcpServers\.konvoy overlaps/)
})

test('stale items: unedited ones go, edited ones are released and kept', async () => {
  const compass = makeCompass()
  const host = makeHost()
  await ac(compass, host, 'init')
  put(host, { '.agents/skills/alpha/ref/notes.md': 'Mine.\n' })
  put(compass, { 'skills/alpha/SKILL.md': null, 'skills/alpha/ref/notes.md': null, 'core/keys.json': '{}', 'core/blocks/CLAUDE.md': null })
  const r = await ac(compass, host, 'sync')
  assert.equal(r.code, 0, r.stderr)
  assert.ok(!existsSync(join(host, '.claude/skills/alpha')), 'empty dirs are pruned')
  assert.equal(read(host, '.agents/skills/alpha/ref/notes.md'), 'Mine.\n')
  assert.ok(actions(r).includes('release .agents/skills/alpha/ref/notes.md'))
  assert.equal(read(host, '.codex/config.toml'), '')
  assert.deepEqual(JSON.parse(read(host, '.claude/settings.json')), {})
  assert.equal(read(host, 'CLAUDE.md'), '')
  const lock = JSON.parse(read(host, '.agents/compass.lock.json'))
  assert.deepEqual(lock.skills, [])
  assert.ok(!Object.keys(lock.files).some((f) => f.includes('alpha')))
  assert.equal((await ac(compass, host, 'check', '--frozen')).code, 0)
})

test('seed files are written once, then the project owns them', async () => {
  const compass = makeCompass()
  const host = makeHost()
  await ac(compass, host, 'init')
  put(host, { 'process-compose.yaml': 'mine\n' })
  put(compass, { 'core/seed/process-compose.yaml': 'version: "0.6"\n' })
  assert.deepEqual((await ac(compass, host, 'sync')).json.changes, [])
  assert.equal(read(host, 'process-compose.yaml'), 'mine\n')
  rmSync(join(host, 'process-compose.yaml'))
  assert.deepEqual((await ac(compass, host, 'sync')).json.changes, [])
  assert.ok(!existsSync(join(host, 'process-compose.yaml')), 'a deleted seed file is not written again')
})

test('--dry and check write nothing; usage errors exit 2', async () => {
  const compass = makeCompass()
  const host = makeHost()
  const dry = await ac(compass, host, 'init', '--dry')
  assert.equal(dry.code, 0)
  assert.ok(dry.json.changes.length > 5)
  assert.deepEqual(walk(host), [])
  assert.equal((await ac(compass, host, 'sync', '--frozen')).code, 2)
  assert.equal((await ac(compass, host, 'check', '--to', 'v1')).code, 2)
  assert.equal((await runNode([join(compass, 'bin/ac.mjs'), 'nope'])).code, 2)
  assert.equal((await ac(compass, compass, 'sync')).code, 1, 'compass does not sync into itself')
})

test('sync --to <tag> checks out the tag and syncs with its engine', async () => {
  const compass = makeCompass()
  const git = (...args) => {
    const r = spawnSync('git', ['-C', compass, '-c', 'user.name=t', '-c', 'user.email=t@t', ...args], { encoding: 'utf8', timeout: 10_000, env: { ...process.env, GIT_TERMINAL_PROMPT: '0' } })
    assert.equal(r.status, 0, r.stderr)
    return r.stdout.trim()
  }
  git('init', '-q')
  git('add', '-A')
  git('commit', '-qm', 'v1')
  git('tag', 'v1')
  put(compass, { 'core/files/.claude/output-styles/compass.md': 'Style v2.\n' })
  git('commit', '-qam', 'v2')
  git('tag', 'v2')
  const host = makeHost()
  assert.equal((await ac(compass, host, 'init')).code, 0)
  assert.equal(read(host, '.claude/output-styles/compass.md'), 'Style v2.\n')
  assert.equal(JSON.parse(read(host, '.agents/compass.lock.json')).tag, 'v2')
  const dry = await ac(compass, host, 'sync', '--to', 'v1', '--dry')
  assert.equal(dry.code, 0)
  assert.match(dry.json.pin, /would fetch tags and check out v1/)
  const r = await ac(compass, host, 'sync', '--to', 'v1')
  assert.equal(r.code, 0, r.stderr)
  assert.equal(read(host, '.claude/output-styles/compass.md'), 'Style v1.\n')
  assert.equal(JSON.parse(read(host, '.agents/compass.lock.json')).tag, 'v1')
  assert.equal((await ac(compass, host, 'sync', '--to=-x')).code, 1)
  assert.equal((await ac(compass, host, 'sync', '--to', 'v9')).code, 1)
  git('tag', 'old', git('commit-tree', git('hash-object', '-t', 'tree', '/dev/null'), '-m', 'old'))
  assert.match((await ac(compass, host, 'sync', '--to', 'old', '--dry')).json.errors[0], /has no bin\/ac\.mjs/)
  const old = await ac(compass, host, 'sync', '--to', 'old')
  assert.equal(old.code, 1)
  assert.match(old.json.errors[0], /has no bin\/ac\.mjs/)
  assert.equal(git('describe', '--tags', '--exact-match', 'HEAD'), 'v1', 'a refused tag leaves the checkout as it was')
})

test('a path that moves from a whole file to owned keys stays on disk', async () => {
  const servers = { 'servers.docs': { command: 'd' } }
  const compass = makeCompass({ 'core/files/.vscode/mcp.json': `${JSON.stringify({ servers: { docs: { command: 'd' } } }, null, 2)}\n` })
  const host = makeHost()
  await ac(compass, host, 'init')
  put(compass, { 'core/files/.vscode/mcp.json': null, 'core/keys.json': JSON.stringify({ ...KEYS, '.vscode/mcp.json': servers }) })
  const r = await ac(compass, host, 'sync')
  assert.equal(r.code, 0, r.stderr)
  assert.deepEqual(actions(r), ['release .vscode/mcp.json'])
  assert.deepEqual(JSON.parse(read(host, '.vscode/mcp.json')), { servers: { docs: { command: 'd' } } })
  assert.equal((await ac(compass, host, 'check', '--frozen')).code, 0)
  assert.deepEqual((await ac(compass, host, 'sync')).json.changes, [])
})

test('compass does not write through a symlink or over a directory', async () => {
  const compass = makeCompass()
  const elsewhere = temp('ac-elsewhere-')
  const host = makeHost()
  symlinkSync(elsewhere, join(host, '.claude'))
  const linked = await ac(compass, host, 'init')
  assert.equal(linked.code, 1)
  assert.match(linked.json.errors.join('\n'), /symlink or leaves the project root/)
  assert.deepEqual(walk(elsewhere), [])
  assert.ok(!existsSync(join(host, '.agents')), 'nothing is written')
  const other = makeHost()
  mkdirSync(join(other, '.claude/output-styles/compass.md'), { recursive: true })
  const dir = await ac(compass, other, 'init')
  assert.equal(dir.code, 1)
  assert.match(dir.json.errors[0], /compass\.md is not a regular file/)
})

test('the real compass assets sync into an empty project and pass doctor', async () => {
  const host = makeHost()
  const init = await ac(REPO, host, 'init')
  assert.equal(init.code, 0, init.stderr)
  assert.equal((await ac(REPO, host, 'check', '--frozen')).code, 0)
  const doc = await ac(REPO, host, 'doctor')
  assert.equal(doc.code, 0, JSON.stringify(doc.json?.checks))
})

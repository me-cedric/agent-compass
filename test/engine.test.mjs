import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { entrySha } from '../engine/merge.mjs'
import { sha, walk } from '../engine/util.mjs'
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
    '.gitattributes': '* text=auto eol=lf\n',
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
  const lock = JSON.parse(read(host, '.agents/compass.lock.json'))
  put(host, { '.agents/compass.lock.json': `${JSON.stringify({ ...lock, tag: 'v1.0.0' }, null, 2)}\n` })
  assert.equal((await ac(compass, host, 'check', '--frozen')).code, 0, 'a checkout without tag data keeps the lock tag (CI clone)')
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

test('a Konvoy whole file is fine when compass.json excludes each of its keys', async () => {
  const compass = makeCompass()
  const konvoy = JSON.stringify({ host_files: ['.codex/config.toml'] })
  const exclude = ['.codex/config.toml#model_verbosity', '.codex/config.toml#mcp_servers.docs']
  const host = makeHost({ '.agents/konvoy.json': konvoy, '.agents/compass.json': JSON.stringify({ version: 1, packs: [], exclude }), '.codex/config.toml': 'model = "x"\n' })
  const r = await ac(compass, host, 'sync')
  assert.equal(r.code, 0, JSON.stringify(r.json?.errors))
  assert.equal(read(host, '.codex/config.toml'), 'model = "x"\n')
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
  const copilot = JSON.parse(read(host, '.github/hooks/compass.json')).hooks
  assert.deepEqual(Object.keys(copilot), ['PreToolUse', 'Stop', 'SessionStart'])
  assert.equal(copilot.PreToolUse[0].matcher, settingsOf(host).hooks.PreToolUse[0].matcher)
  assert.equal((await ac(REPO, host, 'check', '--frozen')).code, 0)
  const doc = await ac(REPO, host, 'doctor')
  assert.equal(doc.code, 0, JSON.stringify(doc.json?.checks))
})

// Sync safety: a stale compass checkout, conflict markers, the kept detail, Windows paths and the managed CI check.
const gitIn = (dir) => (...args) => {
  const r = spawnSync('git', ['-C', dir, '-c', 'user.name=t', '-c', 'user.email=t@t', '-c', 'protocol.file.allow=always', ...args], { encoding: 'utf8', timeout: 20_000, env: { ...process.env, GIT_TERMINAL_PROMPT: '0' } })
  assert.equal(r.status, 0, r.stderr)
  return r.stdout.trim()
}
const setLock = (host, change) => put(host, { '.agents/compass.lock.json': `${JSON.stringify({ ...JSON.parse(read(host, '.agents/compass.lock.json')), ...change }, null, 2)}\n` })

test('a lock from a newer compass refuses the sync; --to goes back on purpose; a subdirectory finds the root', async () => {
  const compass = makeCompass()
  const git = gitIn(compass)
  git('init', '-q')
  git('add', '-A')
  git('commit', '-qm', 'v1')
  git('tag', 'v1')
  const host = makeHost()
  assert.equal((await ac(compass, host, 'init')).code, 0)
  setLock(host, { version: '9.0.0' })
  const refused = await ac(compass, host, 'sync')
  assert.equal(refused.code, 1)
  assert.deepEqual(refused.json.errors, ['the lock is from compass 9.0.0; this checkout is 1.0.0-test; run "git submodule update --init" (or "ac sync --to <tag>" to go back on purpose)'])
  assert.equal(JSON.parse(read(host, '.agents/compass.lock.json')).version, '9.0.0', 'a refused sync writes nothing')
  const back = await ac(compass, host, 'sync', '--to', 'v1')
  assert.equal(back.code, 0, back.stderr)
  assert.equal(JSON.parse(read(host, '.agents/compass.lock.json')).version, '1.0.0-test')

  mkdirSync(join(host, 'src/deep'), { recursive: true })
  const sub = await runNode([join(compass, 'bin/ac.mjs'), 'check', '--json'], { cwd: join(host, 'src/deep') })
  assert.equal(sub.code, 0, sub.stdout + sub.stderr)
  assert.deepEqual(JSON.parse(sub.stdout).changes, [])
})

test('the lock keeps its tag only when the compass version is the same', async () => {
  const compass = makeCompass()
  const host = makeHost()
  assert.equal((await ac(compass, host, 'init')).code, 0)
  setLock(host, { tag: 'v1' })
  assert.equal((await ac(compass, host, 'sync')).code, 0)
  assert.equal(JSON.parse(read(host, '.agents/compass.lock.json')).tag, 'v1', 'no tag data and the same version: the tag stays')
  setLock(host, { tag: 'v0', version: '0.9.0' })
  assert.equal((await ac(compass, host, 'sync')).code, 0)
  assert.equal(JSON.parse(read(host, '.agents/compass.lock.json')).tag, null)
})

const CONFLICT = '<<<<<<< HEAD\nours\n=======\ntheirs\n>>>>>>> branch\n'

test('conflict markers in the host part of a block file are not an error', async () => {
  const compass = makeCompass()
  const host = makeHost({ 'AGENTS.md': '# Project\n\n```\n<<<<<<< HEAD\nours\n=======\ntheirs\n>>>>>>> main\n```\n' })
  assert.equal((await ac(compass, host, 'init')).code, 0)
  assert.equal((await ac(compass, host, 'check', '--frozen')).code, 0, 'a fenced example in the host text is not a conflict')
})

test('conflict markers in the lock or in a managed file give one clear error and no write', async () => {
  const compass = makeCompass()
  const host = makeHost()
  assert.equal((await ac(compass, host, 'init')).code, 0)
  const lock = read(host, '.agents/compass.lock.json')
  put(host, { '.agents/compass.lock.json': `${CONFLICT}${lock}` })
  const r = await ac(compass, host, 'sync')
  assert.equal(r.code, 1)
  assert.deepEqual(r.json.errors, ['.agents/compass.lock.json has git conflict markers; take one side or delete the lock, then run "ac sync"'])
  put(host, { '.agents/compass.lock.json': lock, '.claude/output-styles/compass.md': CONFLICT, 'AGENTS.md': read(host, 'AGENTS.md').replace('<!-- compass:end -->', `${CONFLICT}<!-- compass:end -->`) })
  const f = await ac(compass, host, 'sync')
  assert.equal(f.code, 1)
  assert.deepEqual(f.json.errors, ['.claude/output-styles/compass.md, AGENTS.md have git conflict markers; take one side or delete the lock, then run "ac sync"'])
  assert.equal(read(host, '.claude/output-styles/compass.md'), CONFLICT)
})

test('kept says if compass has a newer version; check --diff shows the planned change', async () => {
  const compass = makeCompass()
  const host = makeHost()
  assert.equal((await ac(compass, host, 'init')).code, 0)
  put(host, { '.claude/output-styles/compass.md': 'My style.\n', 'AGENTS.md': read(host, 'AGENTS.md').replace('Contract v1.', 'My contract.') })
  const notes = (r) => r.json.changes.map((c) => `${c.action} ${c.path} ${c.note}`)
  assert.deepEqual(notes(await ac(compass, host, 'check')), ['kept .claude/output-styles/compass.md no compass change', 'kept AGENTS.md no compass change'])
  put(compass, { 'core/files/.claude/output-styles/compass.md': 'Style v2.\n' })
  assert.deepEqual(notes(await ac(compass, host, 'check')), ['kept .claude/output-styles/compass.md compass has a newer version', 'kept AGENTS.md no compass change'])

  const text = await runNode([join(compass, 'bin/ac.mjs'), 'check', '--diff', '--root', host])
  assert.equal(text.code, 0, text.stderr)
  assert.match(text.stdout, /kept {4}\.claude\/output-styles\/compass\.md {2}\(compass has a newer version\)/)
  assert.match(text.stdout, /^--- a\/\.claude\/output-styles\/compass\.md\n\+\+\+ b\/\.claude\/output-styles\/compass\.md\n@@ -1 \+1 @@\n-My style\.\n\+Style v2\.$/m)
  assert.match(text.stdout, /^-My contract\.\n\+Contract v1\.$/m)
  assert.equal(read(host, '.claude/output-styles/compass.md'), 'My style.\n', '--diff writes nothing')
  assert.equal((await ac(compass, host, 'sync', '--diff')).code, 2)
})

test('command() runs a .mjs tool path with node and keeps a binary path as it is', async () => {
  const { command } = await import('../engine/util.mjs')
  assert.deepEqual(command('age'), ['age'])
  assert.deepEqual(command('/opt/bin/process-compose'), ['/opt/bin/process-compose'])
  assert.deepEqual(command('/tmp/fake-age.mjs'), [process.execPath, '/tmp/fake-age.mjs'])
  assert.deepEqual(command('C:\\t\\fake.JS'), [process.execPath, 'C:\\t\\fake.JS'])
})

test('a path below the root is inside on POSIX and on Windows', async () => {
  const { posix, win32 } = await import('node:path')
  const { below } = await import('../engine/util.mjs')
  assert.deepEqual([
    below('/p', '/p/a', posix), below('/p', '/p', posix), below('/p', '/p2', posix), below('/p', '/', posix), below('/p', '/p/..x', posix),
  ], [true, false, false, false, true])
  assert.deepEqual([
    below('C:\\p', 'C:\\p\\a', win32), below('C:\\p', 'c:\\P\\a', win32), below('C:\\p', 'C:\\p2', win32), below('C:\\p', 'D:\\p\\a', win32), below('C:\\p', 'C:\\', win32),
  ], [true, true, false, false, false])
})

test('the compass-check CI files are managed and get the compass dir; an edited old seed stays kept', async () => {
  const { relative, sep } = await import('node:path')
  const { realpathSync } = await import('node:fs')
  const host = makeHost({ '.agents/compass.json': JSON.stringify({ version: 1, packs: ['ci-github', 'ci-gitlab'], exclude: [] }) })
  const r = await ac(REPO, host, 'sync')
  assert.equal(r.code, 0, r.stderr)
  const dir = relative(realpathSync(host), realpathSync(REPO)).split(sep).join('/')
  assert.match(read(host, '.github/workflows/compass-check.yml'), new RegExp(`^ {2}COMPASS_DIR: ${dir.replace(/\./g, '\\.')}$`, 'm'))
  assert.match(read(host, '.gitlab/compass/check.yml'), new RegExp(`^ {4}COMPASS_DIR: ${dir.replace(/\./g, '\\.')}$`, 'm'))
  const lock = JSON.parse(read(host, '.agents/compass.lock.json'))
  assert.equal(lock.files['.github/workflows/compass-check.yml'].owner, 'compass')
  assert.equal(lock.files['.github/workflows/compass-security.yml'].owner, 'project', 'the other CI files stay seeds')

  const old = makeHost({ '.agents/compass.json': JSON.stringify({ version: 1, packs: ['ci-github'], exclude: [] }), '.github/workflows/compass-check.yml': 'mine\n' })
  assert.equal((await ac(REPO, old, 'sync')).code, 0)
  setLock(old, { files: { ...JSON.parse(read(old, '.agents/compass.lock.json')).files, '.github/workflows/compass-check.yml': { sha: sha('mine\n'), owner: 'project' } } })
  const kept = await ac(REPO, old, 'sync')
  assert.deepEqual(kept.json.changes.map((c) => `${c.action} ${c.path}`), ['kept .github/workflows/compass-check.yml'])
  assert.equal(read(old, '.github/workflows/compass-check.yml'), 'mine\n')
})

test('doctor: a host without git, the Codex hook trust, the user-level todo count, and a stale submodule', async () => {
  const compass = makeCompass()
  const host = makeHost()
  assert.equal((await ac(compass, host, 'init')).code, 0)
  put(host, { '.codex/hooks.json': '{}\n' })
  const checks = async () => (await ac(compass, host, 'doctor')).json.checks
  const plain = await checks()
  assert.ok(plain.some((c) => c.name === 'git' && c.status === 'warn' && /not a git repository/.test(c.detail)), JSON.stringify(plain))
  assert.ok(plain.some((c) => c.name === 'codex' && c.status === 'ok' && /\/hooks/.test(c.detail)))
  assert.ok(plain.some((c) => c.name === 'global' && /\d+ user-level item\(s\) to fix; run "ac doctor --global"|user-level setup has no open item/.test(c.detail)))

  const git = gitIn(compass)
  git('init', '-q')
  git('add', '-A')
  git('commit', '-qm', 'one')
  git('tag', 'v1.0.0')
  const hostGit = gitIn(host)
  hostGit('init', '-q')
  hostGit('submodule', 'add', '-q', compass, 'docs/agent-compass')
  hostGit('commit', '-qm', 'add compass')
  put(compass, { 'NEW.md': 'x\n' })
  git('add', '-A')
  git('commit', '-qm', 'two')
  git('tag', 'v9.0.0')
  const sub = join(host, 'docs/agent-compass')
  const subGit = gitIn(sub)
  subGit('fetch', '-q', '--tags')
  const doc = async () => JSON.parse((await runNode([join(sub, 'bin/ac.mjs'), 'doctor', '--json', '--root', host])).stdout).checks.filter((c) => c.name === 'submodule')
  const tagged = await doc()
  assert.deepEqual(tagged.map((c) => [c.status, c.detail]), [['warn', 'the compass tag v9.0.0 is newer than this checkout (1.0.0-test); run "ac sync --to v9.0.0" to update']])
  subGit('checkout', '-q', 'v9.0.0')
  assert.ok((await doc()).some((c) => c.status === 'warn' && /is not at the commit that the project records/.test(c.detail)))
})

// Array keys: compass owns its entries in the array, not the array.
const hook =(matcher, command, extra = {}) => ({ matcher, hooks: [{ type: 'command', command: `node ".agents/hooks/compass.mjs" ${command}`, timeout: 10, ...extra }] })
const GUARD = hook('Read|Bash', 'guard')
const OURS = { matcher: 'Bash', hooks: [{ type: 'command', command: 'echo ours' }] }
const PRE = '.claude/settings.json#hooks.PreToolUse'
const arrayCompass = (settings) => makeCompass({ 'core/keys.json': JSON.stringify({ ...KEYS, '.claude/settings.json': { outputStyle: 'compass', ...settings } }) })
const settingsOf = (root) => JSON.parse(read(root, '.claude/settings.json'))
const lockedEntries = (root, key) => JSON.parse(read(root, '.agents/compass.lock.json')).keys['.claude/settings.json'][key]
const writeSettings = (root, data) => put(root, { '.claude/settings.json': `${JSON.stringify(data, null, 2)}\n` })

test('a host hook group stays as it is; the compass group goes after it; two syncs give no diff', async () => {
  const compass = arrayCompass({ 'hooks.PreToolUse': [GUARD] })
  const host = makeHost()
  writeSettings(host, { model: 'x', hooks: { PreToolUse: [OURS], PostToolUse: [OURS] } })
  const r = await ac(compass, host, 'init')
  assert.equal(r.code, 0, r.stderr)
  assert.deepEqual(actions(r).filter((a) => a.includes('.claude/settings.json')).sort(), ['create .claude/settings.json#outputStyle', `update ${PRE}`])
  assert.ok(!actions(r).some((a) => a.startsWith('kept')))
  const data = settingsOf(host)
  assert.deepEqual(data.hooks.PreToolUse, [OURS, GUARD])
  assert.deepEqual(data.hooks.PostToolUse, [OURS])
  assert.equal(data.model, 'x')
  assert.deepEqual(lockedEntries(host, 'hooks.PreToolUse'), { entries: [entrySha(GUARD)] })
  const before = snapshot(host)
  const again = await ac(compass, host, 'sync')
  assert.deepEqual(again.json.changes, [])
  assert.equal(again.json.drift, false)
  assert.deepEqual(snapshot(host), before)
  assert.equal((await ac(compass, host, 'check', '--frozen')).code, 0)
})

test('compass creates the array when the host has none, and the host group that is added later stays', async () => {
  const compass = arrayCompass({ 'hooks.PreToolUse': [GUARD] })
  const host = makeHost()
  assert.equal((await ac(compass, host, 'init')).code, 0)
  assert.deepEqual(settingsOf(host).hooks.PreToolUse, [GUARD])
  assert.ok(actions(await ac(compass, host, 'check')).length === 0)
  writeSettings(host, { ...settingsOf(host), hooks: { PreToolUse: [OURS, GUARD] } })
  const r = await ac(compass, host, 'sync')
  assert.deepEqual(r.json.changes, [])
  assert.deepEqual(settingsOf(host).hooks.PreToolUse, [OURS, GUARD])
})

test('the host removes the compass group: check --frozen fails and ac sync puts it back', async () => {
  const compass = arrayCompass({ 'hooks.PreToolUse': [GUARD] })
  const host = makeHost()
  writeSettings(host, { hooks: { PreToolUse: [OURS] } })
  await ac(compass, host, 'init')
  writeSettings(host, { outputStyle: 'compass', hooks: { PreToolUse: [OURS] } })
  const bad = await ac(compass, host, 'check', '--frozen')
  assert.equal(bad.code, 1)
  assert.deepEqual(actions(bad), [`update ${PRE}`])
  assert.deepEqual(settingsOf(host).hooks.PreToolUse, [OURS], 'check writes nothing')
  const fix = await ac(compass, host, 'sync')
  assert.equal(fix.code, 0)
  assert.deepEqual(actions(fix), [`update ${PRE}`])
  assert.deepEqual(settingsOf(host).hooks.PreToolUse, [OURS, GUARD])
  assert.equal((await ac(compass, host, 'check', '--frozen')).code, 0)
})

test('a compass group that the host edited is kept once and is not added a second time', async () => {
  const compass = arrayCompass({ 'hooks.PreToolUse': [GUARD] })
  const host = makeHost()
  writeSettings(host, { hooks: { PreToolUse: [OURS] } })
  await ac(compass, host, 'init')
  const edited = hook('Read|Bash', 'guard --strict')
  writeSettings(host, { outputStyle: 'compass', hooks: { PreToolUse: [OURS, edited] } })
  for (const run of [1, 2]) {
    const r = await ac(compass, host, 'sync')
    assert.equal(r.code, 0, `sync ${run}`)
    assert.deepEqual(actions(r), [`kept ${PRE}`], `sync ${run}`)
    assert.deepEqual(settingsOf(host).hooks.PreToolUse, [OURS, edited], `sync ${run}`)
  }
  assert.deepEqual(lockedEntries(host, 'hooks.PreToolUse'), undefined, 'the lock holds no entry that is not in the file')
  assert.equal((await ac(compass, host, 'check', '--frozen')).code, 1, 'a kept entry is drift, as for every kept key')
})

test('a planned entry that compass drops is removed when unchanged and kept when the host edited it', async () => {
  const [a, b, c] = [hook('Bash', 'a'), hook('Read', 'b'), hook('Grep', 'c')]
  const compass = arrayCompass({ 'hooks.PreToolUse': [a, b, c] })
  const host = makeHost()
  writeSettings(host, { hooks: { PreToolUse: [OURS] } })
  await ac(compass, host, 'init')
  assert.deepEqual(settingsOf(host).hooks.PreToolUse, [OURS, a, b, c])
  const editedB = hook('Read', 'b', { timeout: 99 })
  writeSettings(host, { ...settingsOf(host), hooks: { PreToolUse: [OURS, a, editedB, c] } })
  put(compass, { 'core/keys.json': JSON.stringify({ ...KEYS, '.claude/settings.json': { outputStyle: 'compass', 'hooks.PreToolUse': [c] } }) })
  assert.equal((await ac(compass, host, 'check', '--frozen')).code, 1, 'a stale compass entry in the file is drift')
  const shrink = await ac(compass, host, 'sync')
  assert.equal(shrink.code, 0)
  assert.deepEqual(actions(shrink).sort(), [`update ${PRE}`, `update ${COPILOT}`])
  assert.deepEqual(settingsOf(host).hooks.PreToolUse, [OURS, editedB, c])
  assert.deepEqual(lockedEntries(host, 'hooks.PreToolUse'), { entries: [entrySha(c)] })
  assert.deepEqual((await ac(compass, host, 'sync')).json.changes, [])
  put(compass, { 'core/keys.json': JSON.stringify({ ...KEYS, '.claude/settings.json': { outputStyle: 'compass' } }) })
  const drop = await ac(compass, host, 'sync')
  assert.deepEqual(actions(drop).sort(), [`remove ${PRE}`, `remove ${COPILOT}`])
  assert.deepEqual(settingsOf(host).hooks.PreToolUse, [OURS, editedB])
  assert.equal(lockedEntries(host, 'hooks.PreToolUse'), undefined)
  assert.deepEqual((await ac(compass, host, 'sync')).json.changes, [])
  assert.equal((await ac(compass, host, 'check', '--frozen')).code, 0)
})

test('permissions.deny: host strings stay, compass strings go after them, no string appears twice', async () => {
  const compass = arrayCompass({ 'permissions.deny': ['Bash(rm *)', 'Bash(curl *)'] })
  const host = makeHost()
  writeSettings(host, { permissions: { allow: ['Bash(ls)'], deny: ['Read(.env)', 'Bash(rm *)'] } })
  const r = await ac(compass, host, 'init')
  assert.equal(r.code, 0, r.stderr)
  assert.ok(!actions(r).some((a) => a.startsWith('kept')))
  assert.deepEqual(settingsOf(host).permissions, { allow: ['Bash(ls)'], deny: ['Read(.env)', 'Bash(rm *)', 'Bash(curl *)'] })
  assert.deepEqual((await ac(compass, host, 'sync')).json.changes, [])
  assert.equal((await ac(compass, host, 'check', '--frozen')).code, 0)
})

test('an exclude on an array key removes all compass entries and leaves the host entries', async () => {
  const compass = arrayCompass({ 'hooks.PreToolUse': [GUARD] })
  const host = makeHost()
  writeSettings(host, { hooks: { PreToolUse: [OURS] } })
  await ac(compass, host, 'init')
  put(host, { '.agents/compass.json': JSON.stringify({ version: 1, packs: [], exclude: [PRE] }) })
  const r = await ac(compass, host, 'sync')
  assert.equal(r.code, 0)
  assert.deepEqual(actions(r).sort(), [`remove ${PRE}`, `remove ${COPILOT}`])
  assert.deepEqual(settingsOf(host).hooks.PreToolUse, [OURS])
  assert.equal(lockedEntries(host, 'hooks.PreToolUse'), undefined)
  assert.deepEqual((await ac(compass, host, 'sync')).json.changes, [])
  const fresh = makeHost({ '.agents/compass.json': JSON.stringify({ version: 1, packs: [], exclude: [] }) })
  await ac(compass, fresh, 'sync')
  assert.deepEqual(settingsOf(fresh).hooks.PreToolUse, [GUARD])
  put(fresh, { '.agents/compass.json': JSON.stringify({ version: 1, packs: [], exclude: [PRE] }) })
  await ac(compass, fresh, 'sync')
  assert.equal(settingsOf(fresh).hooks.PreToolUse, undefined, 'the key that compass made goes with its last entry')
})

test('an old lock whose sha does not fit the array: the entries that the host had stay the host\'s; the second run has no drift', async () => {
  const compass = arrayCompass({ 'hooks.PreToolUse': [GUARD] })
  const host = makeHost()
  writeSettings(host, { hooks: { PreToolUse: [OURS] } })
  await ac(compass, host, 'init')
  const lock = JSON.parse(read(host, '.agents/compass.lock.json'))
  lock.keys['.claude/settings.json']['hooks.PreToolUse'] = '0123456789abcdef'
  put(host, { '.agents/compass.lock.json': `${JSON.stringify(lock, null, 2)}\n` })
  const settings = read(host, '.claude/settings.json')
  const first = await ac(compass, host, 'sync')
  assert.equal(first.code, 0, first.stderr)
  assert.deepEqual(first.json.changes, [], 'the file is right, so only the lock changes')
  assert.equal(read(host, '.claude/settings.json'), settings)
  assert.equal(lockedEntries(host, 'hooks.PreToolUse'), undefined)
  assert.equal((await ac(compass, host, 'check', '--frozen')).code, 0)
  assert.equal((await ac(compass, host, 'sync')).json.drift, false)
})

test('an old lock with one sha for an array key: the older compass entries are updated and removed once', async () => {
  const compass = arrayCompass({ 'hooks.PreToolUse': [GUARD], 'permissions.deny': ['Bash(rm *)', 'Bash(curl *)'] })
  const host = makeHost()
  await ac(compass, host, 'init')
  const older = hook('Read|Bash', 'guard', { timeout: 5 })
  const deny = ['Bash(rm *)', 'Bash(curl *)', 'Bash(old-compass-entry *)']
  writeSettings(host, { ...settingsOf(host), hooks: { PreToolUse: [older] }, permissions: { deny } })
  const lock = JSON.parse(read(host, '.agents/compass.lock.json'))
  lock.keys['.claude/settings.json']['hooks.PreToolUse'] = sha(JSON.stringify([older]))
  lock.keys['.claude/settings.json']['permissions.deny'] = sha(JSON.stringify(deny))
  put(host, { '.agents/compass.lock.json': `${JSON.stringify(lock, null, 2)}\n` })
  const first = await ac(compass, host, 'sync')
  assert.equal(first.code, 0, first.stderr)
  assert.deepEqual(actions(first).sort(), [`update ${PRE}`, 'update .claude/settings.json#permissions.deny'])
  assert.deepEqual(settingsOf(host).hooks.PreToolUse, [GUARD])
  assert.deepEqual(settingsOf(host).permissions.deny, ['Bash(rm *)', 'Bash(curl *)'])
  assert.deepEqual(lockedEntries(host, 'hooks.PreToolUse'), { entries: [entrySha(GUARD)] })
  assert.deepEqual((await ac(compass, host, 'sync')).json.changes, [])
  assert.equal((await ac(compass, host, 'check', '--frozen')).code, 0)
})

test('a host string that equals a planned string stays the host string when the key goes off', async () => {
  const compass = arrayCompass({ 'permissions.deny': ['Bash(rm *)', 'Bash(curl *)'] })
  const host = makeHost()
  writeSettings(host, { permissions: { deny: ['Read(.env)', 'Bash(rm *)'] } })
  await ac(compass, host, 'init')
  assert.deepEqual(settingsOf(host).permissions.deny, ['Read(.env)', 'Bash(rm *)', 'Bash(curl *)'])
  assert.deepEqual(lockedEntries(host, 'permissions.deny'), { entries: [entrySha('Bash(curl *)')] })
  put(host, { '.agents/compass.json': JSON.stringify({ version: 1, packs: [], exclude: ['.claude/settings.json#permissions.deny'] }) })
  const r = await ac(compass, host, 'sync')
  assert.deepEqual(actions(r), ['remove .claude/settings.json#permissions.deny'])
  assert.deepEqual(settingsOf(host).permissions.deny, ['Read(.env)', 'Bash(rm *)'])
})

test('a compass group with a narrowed matcher is an edited group: kept once, no second guard group', async () => {
  const compass = arrayCompass({ 'hooks.PreToolUse': [GUARD] })
  const host = makeHost()
  writeSettings(host, { hooks: { PreToolUse: [OURS] } })
  await ac(compass, host, 'init')
  const narrowed = hook('Bash', 'guard')
  writeSettings(host, { outputStyle: 'compass', hooks: { PreToolUse: [OURS, narrowed] } })
  for (const run of [1, 2]) {
    const r = await ac(compass, host, 'sync')
    assert.deepEqual(actions(r), [`kept ${PRE}`], `sync ${run}`)
    assert.deepEqual(settingsOf(host).hooks.PreToolUse, [OURS, narrowed], `sync ${run}`)
  }
})

const WARN = (id) => `${id}: compass merges this array per entry now; remove the exclude to get the compass entries`

test('doctor warns about an exclude only when the planned value and the host value are arrays and Konvoy does not own the key', async () => {
  const STOP = '.claude/settings.json#hooks.Stop'
  const DENY = '.claude/settings.json#permissions.deny'
  const compass = arrayCompass({ 'hooks.PreToolUse': [GUARD], 'hooks.Stop': [hook('*', 'gate')], 'permissions.deny': ['Bash(rm *)'] })
  const exclude = [PRE, STOP, DENY, '.claude/settings.json#outputStyle', '.claude/settings.json#hooks.Unknown']
  const doctor = async (settings, konvoy) => {
    const host = makeHost({ '.agents/compass.json': JSON.stringify({ version: 1, packs: [], exclude }), ...(konvoy && { '.agents/konvoy.json': JSON.stringify(konvoy) }) })
    writeSettings(host, settings)
    const r = await ac(compass, host, 'doctor')
    assert.equal(r.code, 0, JSON.stringify(r.json.checks))
    return r.json.checks.filter((c) => c.name === 'exclude').map((c) => c.detail)
  }
  const arrays = { outputStyle: 'x', hooks: { PreToolUse: [OURS], Stop: [OURS], Unknown: [OURS] }, permissions: { deny: ['Read(.env)'] } }
  assert.deepEqual(await doctor(arrays), [WARN(PRE), WARN(STOP), WARN(DENY)])
  assert.deepEqual(await doctor(arrays, { owns: { keys: { '.claude/settings.json': ['hooks.Stop'] } } }), [WARN(PRE), WARN(DENY)], 'Konvoy owns hooks.Stop')
  assert.deepEqual(await doctor({ ...arrays, hooks: { PreToolUse: 'x' }, permissions: { deny: 'x' } }), [], 'a host value that is not an array needs the exclude')
  assert.deepEqual(await doctor({}), [], 'no host array')
})

test('the real compass assets add their hook groups and deny strings beside a host with its own', async () => {
  const host = makeHost()
  const ours = { matcher: 'Bash', hooks: [{ type: 'command', command: 'echo ours' }] }
  writeSettings(host, { permissions: { deny: ['Read(.env)'] }, hooks: { PreToolUse: [ours], Stop: [{ hooks: [{ type: 'command', command: 'echo done' }] }] } })
  put(host, { '.codex/hooks.json': `${JSON.stringify({ hooks: { PreToolUse: [ours] } }, null, 2)}\n` })
  const init = await ac(REPO, host, 'init')
  assert.equal(init.code, 0, init.stderr)
  assert.ok(!actions(init).some((a) => a.startsWith('kept')), actions(init).join('\n'))
  const claude = settingsOf(host)
  assert.deepEqual(claude.hooks.PreToolUse[0], ours)
  assert.match(claude.hooks.PreToolUse[1].hooks[0].command, /compass\.mjs" guard/)
  assert.equal(claude.hooks.Stop.length, 2)
  assert.deepEqual(claude.permissions.deny[0], 'Read(.env)')
  assert.ok(claude.permissions.deny.length > 1)
  assert.deepEqual(JSON.parse(read(host, '.codex/hooks.json')).hooks.PreToolUse[0], ours)
  assert.equal(JSON.parse(read(host, '.codex/hooks.json')).hooks.PreToolUse.length, 2)
  const before = snapshot(host)
  assert.deepEqual((await ac(REPO, host, 'sync')).json.changes, [])
  assert.deepEqual(snapshot(host), before)
  assert.equal((await ac(REPO, host, 'check', '--frozen')).code, 0)
})

// Copilot reads the hooks of .github/hooks/*.json. PascalCase events keep the Claude payload and the Claude matcher.
const STOP = { hooks: [{ type: 'command', command: 'node ".agents/hooks/compass.mjs" gate', timeout: 10 }] }
const HOOKS = { 'hooks.PreToolUse': [GUARD], 'hooks.Stop': [STOP], 'hooks.SessionStart': [hook('startup|clear', 'start')] }
const COPILOT = '.github/hooks/compass.json'
const copilotEntry = (cmd, extra = {}) => ({ type: 'command', ...extra, bash: `node ".agents/hooks/compass.mjs" ${cmd} --copilot`, cwd: '.', timeoutSec: 10 })

test('the Claude hook keys give the Copilot hook file; an excluded key leaves its event out; no hook key gives no file', async () => {
  const compass = arrayCompass(HOOKS)
  const host = makeHost()
  const r = await ac(compass, host, 'init')
  assert.equal(r.code, 0, r.stderr)
  assert.deepEqual(JSON.parse(read(host, COPILOT)), {
    version: 1,
    hooks: { PreToolUse: [copilotEntry('guard', { matcher: 'Read|Bash' })], Stop: [copilotEntry('gate')], SessionStart: [copilotEntry('start')] },
  })
  assert.equal(JSON.parse(read(host, '.agents/compass.lock.json')).files[COPILOT].owner, 'compass')
  const exclude = (...keys) => put(host, { '.agents/compass.json': JSON.stringify({ version: 1, packs: [], exclude: keys.map((k) => `.claude/settings.json#${k}`) }) })
  exclude('hooks.Stop')
  assert.equal((await ac(compass, host, 'sync')).code, 0)
  assert.deepEqual(Object.keys(JSON.parse(read(host, COPILOT)).hooks), ['PreToolUse', 'SessionStart'])
  exclude(...Object.keys(HOOKS))
  assert.equal((await ac(compass, host, 'sync')).code, 0)
  assert.equal(existsSync(join(host, COPILOT)), false)
})

test('a sync that writes a .codex/hooks.json key warns to approve the hooks in /hooks; a sync without a change does not', async () => {
  const trust = 'Codex: approve the changed hooks in /hooks before they run'
  const compass = makeCompass({ 'core/keys.json': JSON.stringify({ ...KEYS, '.codex/hooks.json': { 'hooks.Stop': [STOP] } }) })
  const host = makeHost()
  const init = await ac(compass, host, 'init')
  assert.equal(init.code, 0, init.stderr)
  assert.ok(init.json.warnings.includes(trust), JSON.stringify(init.json.warnings))
  assert.ok(!(await ac(compass, host, 'sync')).json.warnings.includes(trust))
  put(compass, { 'core/keys.json': JSON.stringify({ ...KEYS, '.codex/hooks.json': { 'hooks.Stop': [{ hooks: [{ ...STOP.hooks[0], timeout: 20 }] }] } }) })
  assert.ok((await ac(compass, host, 'sync')).json.warnings.includes(trust))
})

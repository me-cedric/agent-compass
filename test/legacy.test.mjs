import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readlinkSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { legacyPlan, migrateLegacy } from '../engine/legacy.mjs'
import { blockSet } from '../engine/merge.mjs'
import { syncHost } from '../engine/sync.mjs'
import { run, sha, walk } from '../engine/util.mjs'
import { runNode } from './helpers.mjs'

const AC = dirname(dirname(fileURLToPath(import.meta.url)))
const needTag = run('git', ['-C', AC, 'rev-parse', '--verify', '--quiet', 'refs/tags/v0.9.6^{commit}']).ok ? false : 'the tag v0.9.6 is not in this clone'
const VENDOR = 'docs/agent-compass'
const temps = []
test.after(() => { for (const dir of temps) rmSync(dir, { recursive: true, force: true }) })

const temp = (prefix = 'ac-legacy-') => {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), prefix)))
  temps.push(dir)
  return dir
}
// The bytes of a file in the compass 0.9.6 tree.
const old = (path) => execFileSync('git', ['-C', AC, 'show', `v0.9.6:${path}`], { maxBuffer: 1 << 24 })
const plus = (buf, text) => Buffer.concat([buf, Buffer.from(text)])
const snap = (root) => Object.fromEntries(walk(root).map((rel) => [rel, readFileSync(join(root, rel)).toString('base64')]))

// The exact pointer text of install.mjs in compass 0.9.
const pointer = (file, name, rel) => {
  if (file === 'AGENTS.md') {
    return `# ${name} — Agent Guide\n\nThis project follows the shared **agent-compass** contract.\n\n- Read \`${rel}/AGENTS.md\` first — it is the canonical agent contract.\n- Guidelines: \`${rel}/docs/guidelines/\` · Architecture: \`${rel}/docs/architecture/\` · Tooling: \`${rel}/docs/tooling/\`\n- Skills: \`${rel}/skills/\` · Templates: \`${rel}/templates/\`\n- Knowledge: \`${rel}/knowledge/\` — instincts and worked examples.\n\nAdd project-specific conventions below this line; they take precedence over the\nagent-compass baseline on conflict.\n`
  }
  const tool = { 'CLAUDE.md': 'Claude', 'GEMINI.md': 'Gemini' }[file]
  return `# ${name} — ${tool} Agent Guide\n\nRead \`${rel}/AGENTS.md\` first. It is the canonical agent-compass contract.\n\nHost project \`AGENTS.md\` takes precedence when it adds project-specific rules.\n`
}

const ANSWERS = { name: 'demo', scope: '@demo', ci: 'github-actions', sonar: true, security: false, codeIntelligence: 'codebase-memory', providers: ['claude'] }

// A host with a 0.9 install, edited in places. `edited` holds every byte that the migration must not lose.
const build = () => {
  const root = temp()
  const outside = temp('ac-legacy-out-')
  const edited = new Map()
  const put = (rel, data, keep = false) => {
    mkdirSync(dirname(join(root, rel)), { recursive: true })
    writeFileSync(join(root, rel), data)
    if (keep) edited.set(rel, Buffer.from(data))
  }
  const managed = { '.mcp/figma.example.json': 'a'.repeat(16), '../escape.txt': 'b'.repeat(16) }
  const lock = (rel, src, extra = '') => {
    const original = old(src)
    managed[rel] = sha(original)
    put(rel, plus(original, extra), extra !== '')
  }
  lock('.claude/agents/security.md', 'templates/claude/.claude/agents/security.md')
  lock('.claude/agents/reviewer.md', 'templates/claude/.claude/agents/reviewer.md', '\n## Mine\n')
  lock('.mcp/tool-contract.md', 'templates/mcp/tool-contract.md', '\nmine\n')
  lock('.gemini/settings.example.json', 'templates/gemini/.gemini/settings.example.json')
  lock('.mcp/gemini.example.json', 'templates/mcp/gemini.example.json')
  put('.agent/agent-compass.lock', `${JSON.stringify({ version: '0.9.6', managed, syncedAt: '2026-01-01T00:00:00.000Z' }, null, 2)}\n`)
  put('.gemini/local.json', '{}\n', true)

  put('AGENTS.md', pointer('AGENTS.md', 'demo', VENDOR))
  put('GEMINI.md', pointer('GEMINI.md', 'demo', VENDOR))
  put('CLAUDE.md', `${pointer('CLAUDE.md', 'demo', VENDOR)}\n## Our rules\n`, true)

  for (const base of ['.claude/skills', '.agents/skills']) {
    put(`${base}/impact-analysis/SKILL.md`, old('skills/impact-analysis/SKILL.md'))
    put(`${base}/project-memory/SKILL.md`, plus(old('skills/project-memory/SKILL.md'), '\nedited\n'), true)
    put(`${base}/gen-docs/SKILL.md`, plus(old('skills/gen-docs/SKILL.md'), '\nedited\n'), true)
    put(`${base}/gen-docs/scripts/doc_generator.cjs`, old('skills/gen-docs/scripts/doc_generator.cjs'), true)
  }
  put('.claude/skills/my-own-skill/SKILL.md', '# mine\n', true)
  writeFileSync(join(outside, 'SKILL.md'), old('skills/verify-change/SKILL.md'))
  symlinkSync(outside, join(root, '.agents/skills/verify-change'))
  put('.editorconfig', 'root = true\n', true)

  put('agent-compass.answers.json', `${JSON.stringify(ANSWERS, null, 2)}\n`, true)
  put(`${VENDOR}/.vendor.json`, `${JSON.stringify({ schema: 1, name: 'agent-compass', version: '0.9.6', ref: 'v0.9.6', commit: 'cee9bb28b65edc17131f2b874a668eab1beac31d', vendoredAt: '2026-01-01T00:00:00.000Z' }, null, 2)}\n`)
  put(`${VENDOR}/package.json`, old('package.json'))
  put(`${VENDOR}/LICENSE`, old('LICENSE'))
  put(`${VENDOR}/README.md`, plus(old('README.md'), '\nlocal\n'), true)
  put(`${VENDOR}/notes.txt`, 'ours\n', true)
  return { root, outside, edited }
}

// A byte that must survive is in place or under migrated/. The sync can add its block to a kept Markdown file.
const survives = (root, edited) => {
  for (const [rel, bytes] of edited) {
    const same = [rel, `migrated/${rel}`].some((p) => existsSync(join(root, p)) && readFileSync(join(root, p)).includes(bytes))
    assert.ok(same, `${rel} is lost or changed`)
  }
}

const EXPECTED = {
  '.claude/agents/security.md': ['unedited', 'delete'],
  '.claude/agents/reviewer.md': ['edited-claimed', 'move'],
  '.mcp/tool-contract.md': ['edited', 'keep'],
  '.gemini/settings.example.json': ['unedited', 'delete'],
  '.mcp/gemini.example.json': ['unedited', 'delete'],
  'GEMINI.md': ['unedited', 'delete'],
  'AGENTS.md': ['unedited', 'delete'],
  'CLAUDE.md': ['edited', 'keep'],
  '.claude/skills/impact-analysis/SKILL.md': ['unedited', 'delete'],
  '.agents/skills/impact-analysis/SKILL.md': ['unedited', 'delete'],
  '.claude/skills/project-memory/SKILL.md': ['edited-claimed', 'move'],
  '.agents/skills/project-memory/SKILL.md': ['edited-claimed', 'move'],
  '.claude/skills/gen-docs/SKILL.md': ['edited', 'keep'],
  '.agents/skills/gen-docs/scripts/doc_generator.cjs': ['unedited', 'keep'],
  '.agents/skills/verify-change': ['symlink', 'keep'],
  'agent-compass.answers.json': ['edited-claimed', 'move'],
  [`${VENDOR}/.vendor.json`]: ['unedited', 'delete'],
  [`${VENDOR}/package.json`]: ['unedited', 'delete'],
  [`${VENDOR}/LICENSE`]: ['unedited', 'delete'],
  [`${VENDOR}/README.md`]: ['edited', 'keep'],
  [`${VENDOR}/notes.txt`]: ['edited', 'keep'],
}

test('the dry run lists every legacy file and writes nothing', { skip: needTag }, () => {
  const { root } = build()
  const before = snap(root)
  const r = migrateLegacy({ AC, root })
  assert.deepEqual(r.errors, [])
  assert.equal(r.ok, true)
  assert.deepEqual(snap(root), before)
  assert.deepEqual(r.plan, legacyPlan({ AC, root }).plan)
  for (const [path, [cls, action]] of Object.entries(EXPECTED)) {
    assert.deepEqual(r.plan.find((i) => i.path === path), { path, class: cls, action }, path)
  }
  for (const path of ['.editorconfig', '.claude/skills/my-own-skill/SKILL.md', '.mcp/figma.example.json', '.gemini/local.json']) assert.ok(!r.plan.some((i) => i.path === path), path)
  assert.deepEqual(r.detected.lock, { path: '.agent/agent-compass.lock', version: '0.9.6' })
  assert.deepEqual(r.detected.vendored, { path: VENDOR, version: '0.9.6', commit: 'cee9bb28b65edc17131f2b874a668eab1beac31d' })
  assert.equal(r.detected.answers, 'agent-compass.answers.json')
  assert.ok(r.detected.doubleSkills.includes('impact-analysis'))
  assert.deepEqual(r.detected.gemini, ['.gemini/local.json', '.gemini/settings.example.json', '.mcp/gemini.example.json', 'GEMINI.md'])
  assert.equal(r.detected.konvoy, null)
  assert.ok(r.warnings.some((w) => w.includes('../escape.txt')))
  assert.ok(r.warnings.some((w) => w.includes('.claude/skills/gen-docs') && w.includes('review')))
  assert.deepEqual(r.deleted.filter((p) => p === 'GEMINI.md'), ['GEMINI.md'])
  assert.ok(r.kept.some((k) => k.path === 'CLAUDE.md' && /review/.test(k.note)))
  assert.equal(r.sync, null)
})

test('apply deletes the matching files, keeps every edited byte, and leaves no drift', { skip: needTag }, async () => {
  const { root, outside, edited } = build()
  const r = migrateLegacy({ AC, root, apply: true })
  assert.deepEqual(r.errors, [])
  assert.equal(r.ok, true)
  assert.equal(r.sync.ok, true)

  for (const gone of ['.claude/agents/security.md', 'GEMINI.md', '.gemini/settings.example.json', '.mcp/gemini.example.json', `${VENDOR}/package.json`, `${VENDOR}/LICENSE`, `${VENDOR}/.vendor.json`, '.agent/agent-compass.lock', 'agent-compass.answers.json']) {
    assert.ok(!existsSync(join(root, gone)), `${gone} stays`)
  }
  survives(root, edited)
  assert.ok(readFileSync(join(root, 'migrated/.claude/agents/reviewer.md')).equals(edited.get('.claude/agents/reviewer.md')))
  assert.ok(readFileSync(join(root, '.mcp/tool-contract.md')).equals(edited.get('.mcp/tool-contract.md')))
  assert.match(readFileSync(join(root, 'CLAUDE.md'), 'utf8'), /^# demo — Claude Agent Guide[\s\S]*## Our rules/)
  for (const base of ['.claude/skills', '.agents/skills']) {
    assert.ok(existsSync(join(root, `${base}/gen-docs/scripts/doc_generator.cjs`)), 'a file of an edited skill dir stays')
    assert.ok(existsSync(join(root, `migrated/${base}/project-memory/SKILL.md`)))
  }
  assert.ok(existsSync(join(root, 'migrated/.claude/agents/reviewer.md')))
  assert.ok(!readFileSync(join(root, '.claude/agents/reviewer.md')).equals(edited.get('.claude/agents/reviewer.md')), 'the sync writes the 1.0 agent file')
  assert.notEqual(readFileSync(join(root, 'AGENTS.md'), 'utf8'), pointer('AGENTS.md', 'demo', VENDOR), 'the sync rewrites AGENTS.md')
  assert.ok(lstatSync(join(root, '.agents/skills/verify-change')).isSymbolicLink())
  assert.equal(readlinkSync(join(root, '.agents/skills/verify-change')), outside)
  assert.ok(existsSync(join(outside, 'SKILL.md')), 'the target of a symlink stays')

  const config = JSON.parse(readFileSync(join(root, '.agents/compass.json'), 'utf8'))
  assert.deepEqual(config, { version: 1, packs: ['ci-github', 'security'], exclude: [], mcp: ['codebase-memory'] })
  assert.ok(existsSync(join(root, '.agents/compass.lock.json')))

  const check = syncHost({ AC, root })
  assert.deepEqual(check.errors, [])
  assert.equal(check.drift, false, JSON.stringify(check.changes))
  const cli = await runNode([join(AC, 'bin/ac.mjs'), 'check', '--frozen', '--root', root])
  assert.equal(cli.code, 0, cli.stderr)

  const again = snap(root)
  const second = migrateLegacy({ AC, root, apply: true })
  assert.equal(second.ok, true)
  assert.deepEqual([second.deleted, second.moved], [[], []])
  assert.deepEqual(snap(root), again, 'a second run changes nothing')
})

test('a real 0.9.6 install migrates with no drift', { skip: needTag }, () => {
  const root = temp()
  const vendor = join(root, VENDOR)
  mkdirSync(vendor, { recursive: true })
  execFileSync('sh', ['-c', 'git -C "$1" archive v0.9.6 | tar -x -C "$2"', 'sh', AC, vendor])
  writeFileSync(join(vendor, '.vendor.json'), JSON.stringify({ schema: 1, name: 'agent-compass', version: '0.9.6', ref: 'v0.9.6', commit: 'cee9bb28b65edc17131f2b874a668eab1beac31d' }))
  writeFileSync(join(root, 'agent-compass.answers.json'), JSON.stringify({ name: 'demo', ci: 'gitlab-ci' }))
  execFileSync(process.execPath, [join(vendor, 'scripts/install.mjs'), root], { stdio: 'ignore' })
  assert.ok(existsSync(join(root, '.agent/agent-compass.lock')), 'the 0.9.6 install writes its lock')

  const r = migrateLegacy({ AC, root, apply: true })
  assert.deepEqual(r.errors, [])
  for (const pointerFile of ['AGENTS.md', 'CLAUDE.md', 'CODEX.md', 'GEMINI.md', '.github/copilot-instructions.md']) assert.ok(r.deleted.includes(pointerFile), pointerFile)
  assert.deepEqual(r.kept, [])
  assert.ok(!existsSync(vendor), 'the vendored copy is gone')
  assert.deepEqual(JSON.parse(readFileSync(join(root, '.agents/compass.json'), 'utf8')).packs, ['ci-gitlab'])
  const check = syncHost({ AC, root })
  assert.equal(check.drift, false, JSON.stringify(check.changes))
})

test('a file under migrated/ stops the migration before any change', { skip: needTag }, () => {
  const { root } = build()
  mkdirSync(join(root, 'migrated/.claude/agents'), { recursive: true })
  writeFileSync(join(root, 'migrated/.claude/agents/reviewer.md'), 'older\n')
  const before = snap(root)
  const r = migrateLegacy({ AC, root, apply: true })
  assert.equal(r.ok, false)
  assert.match(r.errors.join('\n'), /migrated\/\.claude\/agents\/reviewer\.md exists or leaves the project root; move \.claude\/agents\/reviewer\.md by hand/)
  assert.deepEqual(snap(root), before)
})

test('a migrated/ symlink out of the project stops the migration', { skip: needTag }, () => {
  const { root } = build()
  const outside = temp('ac-legacy-out-')
  symlinkSync(outside, join(root, 'migrated'))
  const r = migrateLegacy({ AC, root, apply: true })
  assert.equal(r.ok, false)
  assert.match(r.errors.join('\n'), /leaves the project root/)
  assert.deepEqual(walk(outside), [])
  assert.ok(existsSync(join(root, '.claude/agents/security.md')))
})

test('a crafted 0.x lock cannot reach the 1.0 config or lock', () => {
  const root = temp()
  const files = { '.agents/compass.json': '{"version":1,"packs":[],"exclude":[]}\n', '.agents/compass.lock.json': '{}\n' }
  const managed = {}
  mkdirSync(join(root, '.agents'), { recursive: true })
  mkdirSync(join(root, '.agent'), { recursive: true })
  for (const [rel, text] of Object.entries(files)) {
    writeFileSync(join(root, rel), text)
    managed[rel] = sha(Buffer.from(text))
  }
  writeFileSync(join(root, '.agent/agent-compass.lock'), JSON.stringify({ version: '0.9.6', managed }))
  assert.deepEqual(legacyPlan({ AC, root }).plan, [])
})

test('Konvoy paths and skills stay, and the ledger is reported', { skip: needTag }, () => {
  const { root, edited } = build()
  writeFileSync(join(root, '.agents/konvoy.json'), JSON.stringify({ version: 3, compass_skills: ['gen-docs'], host_files: ['.mcp/gemini.example.json'] }))
  const r = migrateLegacy({ AC, root, apply: true })
  assert.deepEqual(r.errors, [])
  assert.deepEqual(r.detected.konvoy, { version: 3, compassSkills: 1 })
  assert.deepEqual(r.plan.find((i) => i.path === '.claude/skills/gen-docs'), { path: '.claude/skills/gen-docs', class: 'konvoy', action: 'keep' })
  assert.equal(r.plan.find((i) => i.path === '.mcp/gemini.example.json').class, 'konvoy')
  assert.ok(existsSync(join(root, '.agents/skills/gen-docs/scripts/doc_generator.cjs')))
  assert.ok(existsSync(join(root, '.mcp/gemini.example.json')))
  assert.ok(existsSync(join(root, '.agents/konvoy.json')))
  survives(root, edited)
})

test('a Konvoy conflict and a host value go into exclude, and the check is green', () => {
  const root = temp()
  const own = {
    '.claude/agents/reviewer.md': '# Our reviewer\n',
    '.claude/skills/impact-analysis/SKILL.md': '# Konvoy skill\n',
    '.claude/settings.json': `${JSON.stringify({ hooks: { PreToolUse: [{ matcher: 'Bash', hooks: [{ type: 'command', command: 'echo ours' }] }] } }, null, 2)}\n`,
    '.mcp.json': `${JSON.stringify({ mcpServers: { 'codebase-memory': { command: 'konvoy-cbm' } } }, null, 2)}\n`,
    '.codex/config.toml': '[mcp_servers.codebase-memory]\ncommand = "ours"\n',
    'CLAUDE.md': blockSet('# Ours\n', 'Our text in the compass block.\n'),
  }
  const files = {
    ...own,
    'agent-compass.answers.json': JSON.stringify({ name: 'demo' }),
    '.agents/compass.json': JSON.stringify({ version: 1, packs: [], exclude: ['zzz'], mcp: ['codebase-memory'] }),
    '.agents/konvoy.json': JSON.stringify({
      version: 3,
      compass_skills: ['impact-analysis'],
      host_files: ['.claude/agents/reviewer.md'],
      owns: { keys: { '.mcp.json': ['mcpServers.codebase-memory'] } },
    }),
  }
  for (const [rel, text] of Object.entries(files)) {
    mkdirSync(dirname(join(root, rel)), { recursive: true })
    writeFileSync(join(root, rel), text)
  }
  assert.ok(syncHost({ AC, root }).errors.length, 'the sync stops before the migration')

  const dry = migrateLegacy({ AC, root })
  assert.deepEqual(dry.excluded.map((e) => e.reason), ['konvoy', 'konvoy', 'konvoy'], 'the dry run shows the Konvoy conflicts')

  const r = migrateLegacy({ AC, root, apply: true })
  assert.deepEqual(r.errors, [])
  assert.equal(r.ok, true)
  assert.deepEqual(r.excluded, [
    { id: '.claude/agents/reviewer.md', reason: 'konvoy' },
    { id: '.mcp.json#mcpServers.codebase-memory', reason: 'konvoy' },
    { id: 'impact-analysis', reason: 'konvoy' },
    { id: '.claude/settings.json#hooks.PreToolUse', reason: 'host value' },
    { id: '.codex/config.toml#mcp_servers.codebase-memory', reason: 'host value' },
    { id: 'CLAUDE.md', reason: 'host value' },
  ])
  const config = JSON.parse(readFileSync(join(root, '.agents/compass.json'), 'utf8'))
  assert.deepEqual(config.exclude, ['zzz', ...r.excluded.map((e) => e.id)], 'the old entry stays and the new ids follow')
  assert.deepEqual(config.mcp, ['codebase-memory'])
  assert.ok(!r.sync.changes.some((c) => c.action === 'kept'))

  for (const rel of ['.claude/agents/reviewer.md', '.claude/skills/impact-analysis/SKILL.md', 'CLAUDE.md']) assert.equal(readFileSync(join(root, rel), 'utf8'), own[rel], rel)
  assert.ok(readFileSync(join(root, '.codex/config.toml'), 'utf8').includes(own['.codex/config.toml']), 'the sync adds other keys and keeps the host key')
  assert.deepEqual(JSON.parse(readFileSync(join(root, '.claude/settings.json'), 'utf8')).hooks.PreToolUse, JSON.parse(own['.claude/settings.json']).hooks.PreToolUse)
  assert.deepEqual(JSON.parse(readFileSync(join(root, '.mcp.json'), 'utf8')).mcpServers['codebase-memory'], { command: 'konvoy-cbm' })
  assert.ok(existsSync(join(root, '.claude/agents/scout.md')), 'the sync still writes the other compass files')

  const check = syncHost({ AC, root })
  assert.deepEqual(check.errors, [])
  assert.equal(check.ok, true)
  assert.equal(check.drift, false, JSON.stringify(check.changes))
  const before = readFileSync(join(root, '.agents/compass.json'), 'utf8')
  assert.deepEqual(migrateLegacy({ AC, root, apply: true }).excluded, [])
  assert.equal(readFileSync(join(root, '.agents/compass.json'), 'utf8'), before, 'a second run adds no entry')
})

test('a submodule is reported, its credentials are not, and its path matches the pointers', { skip: needTag }, () => {
  const root = temp()
  writeFileSync(join(root, '.gitmodules'), '[submodule "ac"]\n\tpath = tools/agent-compass\n\turl = https://user:token@example.com/org/agent-compass.git\n[submodule "other"]\n\tpath = x\n\turl = https://example.com/x.git\n')
  writeFileSync(join(root, 'GEMINI.md'), pointer('GEMINI.md', root.split('/').pop(), 'tools/agent-compass'))
  const r = legacyPlan({ AC, root })
  assert.deepEqual(r.detected.submodule, { path: 'tools/agent-compass', url: 'https://example.com/org/agent-compass.git' })
  assert.deepEqual(r.plan, [{ path: 'GEMINI.md', class: 'unedited', action: 'delete' }])
})

test('a symlinked managed file is listed and never followed', { skip: needTag }, () => {
  const root = temp()
  const outside = temp('ac-legacy-out-')
  const original = old('templates/claude/.claude/agents/security.md')
  writeFileSync(join(outside, 'security.md'), original)
  mkdirSync(join(root, '.claude/agents'), { recursive: true })
  symlinkSync(join(outside, 'security.md'), join(root, '.claude/agents/security.md'))
  mkdirSync(join(root, '.agent'), { recursive: true })
  writeFileSync(join(root, '.agent/agent-compass.lock'), JSON.stringify({ version: '0.9.6', managed: { '.claude/agents/security.md': sha(original) } }))
  const r = migrateLegacy({ AC, root, apply: true })
  assert.deepEqual(r.plan, [{ path: '.claude/agents/security.md', class: 'symlink', action: 'keep' }])
  assert.ok(lstatSync(join(root, '.claude/agents/security.md')).isSymbolicLink())
  assert.ok(readFileSync(join(outside, 'security.md')).equals(original))
})

test('without v0 tags only the lock proves a file', () => {
  const fake = temp('ac-fake-')
  const root = temp()
  const original = Buffer.from('managed text\n')
  mkdirSync(join(root, '.agent'), { recursive: true })
  mkdirSync(join(root, '.claude/skills/impact-analysis'), { recursive: true })
  writeFileSync(join(root, 'a.md'), original)
  writeFileSync(join(root, '.claude/skills/impact-analysis/SKILL.md'), 'text of a skill\n')
  writeFileSync(join(root, '.agent/agent-compass.lock'), JSON.stringify({ version: '0.9.6', managed: { 'a.md': sha(original) } }))
  const r = legacyPlan({ AC: fake, root })
  assert.ok(r.warnings.some((w) => w.includes('no v0.* tags')))
  assert.deepEqual(r.plan, [{ path: 'a.md', class: 'unedited', action: 'delete' }])
})

test('the answers file sets the packs and the MCP servers of compass.json', () => {
  const pick = (answers) => {
    const root = temp()
    writeFileSync(join(root, 'agent-compass.answers.json'), JSON.stringify(answers))
    const r = migrateLegacy({ AC, root, apply: true })
    assert.deepEqual(r.errors, [])
    assert.ok(existsSync(join(root, 'migrated/agent-compass.answers.json')))
    return JSON.parse(readFileSync(join(root, '.agents/compass.json'), 'utf8'))
  }
  assert.deepEqual(pick({ ci: 'gitlab-ci', security: true }), { version: 1, packs: ['ci-gitlab', 'security'], exclude: [] })
  assert.deepEqual(pick({ ci: 'none', sonar: false, codeIntelligence: 'none' }), { version: 1, packs: [], exclude: [] })
})

test('a host without a 0.x install has nothing to migrate', () => {
  const root = temp()
  const r = migrateLegacy({ AC, root, apply: true })
  assert.equal(r.ok, true)
  assert.equal(r.detected.found, false)
  assert.match(r.warnings.join('\n'), /nothing to migrate/)
  assert.deepEqual(walk(root), [])
})

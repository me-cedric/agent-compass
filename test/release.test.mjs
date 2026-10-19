import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { VERSION_FILES, getAt } from '../scripts/lib/versions.mjs'
import { runNode } from './helpers.mjs'

const script = fileURLToPath(new URL('../scripts/release.mjs', import.meta.url))
const checker = fileURLToPath(new URL('../scripts/check-release.mjs', import.meta.url))
const temps = []
test.after(() => { for (const d of temps) rmSync(d, { recursive: true, force: true }) })

const CHANGELOG = '# Changelog\n\n## 1.2.3 — 2026-01-01\n\n- change\n'

// A repository with every version file at 1.2.3, a plugin entry in the marketplace and a changelog.
const makeRepo = () => {
  const dir = mkdtempSync(join(tmpdir(), 'ac-release-'))
  temps.push(dir)
  const put = (file, data) => {
    mkdirSync(dirname(join(dir, file)), { recursive: true })
    writeFileSync(join(dir, file), typeof data === 'string' ? data : `${JSON.stringify(data, null, 2)}\n`)
  }
  put('package.json', { name: 'fixture', version: '1.2.3' })
  put('plugins/compass-user/.claude-plugin/plugin.json', { name: 'compass-user', version: '1.2.3' })
  put('plugins/compass-user/.codex-plugin/plugin.json', { name: 'compass-user', version: '1.2.3', skills: './skills/' })
  put('.claude-plugin/marketplace.json', { name: 'm', plugins: [{ name: 'compass-user', version: '1.2.3' }] })
  put('CHANGELOG.md', CHANGELOG)
  return dir
}
const read = (dir, file) => readFileSync(join(dir, file), 'utf8')

test('release sets the version in every file and adds one changelog heading', async () => {
  const dir = makeRepo()
  const r = await runNode([script, '2.0.0'], { cwd: dir })
  assert.equal(r.code, 0, r.stderr)
  for (const { file, path } of VERSION_FILES) assert.equal(getAt(JSON.parse(read(dir, file)), path), '2.0.0', file)
  assert.match(read(dir, 'plugins/compass-user/.codex-plugin/plugin.json'), /"skills": "\.\/skills\/"/)
  assert.match(read(dir, 'CHANGELOG.md'), /^# Changelog\n\n## 2\.0\.0 — \d{4}-\d{2}-\d{2}\n\n## 1\.2\.3 — 2026-01-01\n/)
  assert.equal((await runNode([checker, dir])).code, 0)
  const again = await runNode([script, '2.0.0'], { cwd: dir })
  assert.equal(again.code, 0, again.stderr)
  assert.equal(read(dir, 'CHANGELOG.md').match(/^## 2\.0\.0 /gm).length, 1)
})

test('release fails when CHANGELOG.md has no title line, and writes nothing', async () => {
  const dir = makeRepo()
  writeFileSync(join(dir, 'CHANGELOG.md'), '## 1.2.3 — 2026-01-01\n')
  const r = await runNode([script, '2.0.0'], { cwd: dir })
  assert.equal(r.code, 1)
  assert.match(r.stderr, /title line/)
  assert.equal(JSON.parse(read(dir, 'package.json')).version, '1.2.3')
})

test('release turns the "## Unreleased" heading into the version heading', async () => {
  const dir = makeRepo()
  writeFileSync(join(dir, 'CHANGELOG.md'), '# Changelog\n\n## Unreleased\n\n- new thing\n\n## 1.2.3 — 2026-01-01\n\n- change\n')
  const r = await runNode([script, '2.0.0'], { cwd: dir })
  assert.equal(r.code, 0, r.stderr)
  assert.match(read(dir, 'CHANGELOG.md'), /^# Changelog\n\n## 2\.0\.0 — \d{4}-\d{2}-\d{2}\n\n- new thing\n\n## 1\.2\.3 — 2026-01-01\n/)
  assert.ok(!read(dir, 'CHANGELOG.md').includes('Unreleased'))
})

test('release --dry writes nothing', async () => {
  const dir = makeRepo()
  const r = await runNode([script, '2.0.0', '--dry'], { cwd: dir })
  assert.equal(r.code, 0, r.stderr)
  assert.match(r.stdout, /would write package\.json/)
  assert.equal(JSON.parse(read(dir, 'package.json')).version, '1.2.3')
  assert.equal(read(dir, 'CHANGELOG.md'), CHANGELOG)
})

test('release rejects a bad version and the git flags of the old script', async () => {
  const dir = makeRepo()
  for (const args of [['nope'], [], ['2.0.0', '--tag'], ['2.0.0', '--push']]) {
    const r = await runNode([script, ...args], { cwd: dir })
    assert.equal(r.code, 1, args.join(' '))
  }
  assert.equal(read(dir, 'CHANGELOG.md'), CHANGELOG)
})

test('the repository passes its own release check', async () => {
  const r = await runNode([checker], { cwd: dirname(dirname(script)) })
  assert.equal(r.code, 0, r.stderr)
  assert.match(r.stdout, /release check passed/)
})

test('release lists the asset files that changed since the last tag, grouped, under the new heading', async () => {
  const dir = makeRepo()
  const git = (...args) => {
    const r = spawnSync('git', ['-C', dir, '-c', 'user.name=t', '-c', 'user.email=t@t', ...args], { encoding: 'utf8', timeout: 10_000, env: { ...process.env, GIT_TERMINAL_PROMPT: '0' } })
    assert.equal(r.status, 0, r.stderr)
  }
  const put = (file, text) => { mkdirSync(dirname(join(dir, file)), { recursive: true }); writeFileSync(join(dir, file), text) }
  put('core/old.md', 'old\n')
  put('skills/a/SKILL.md', 'a\n')
  put('engine/x.mjs', 'x\n')
  git('init', '-q')
  git('add', '-A')
  git('commit', '-qm', 'one')
  git('tag', 'v1.2.3')
  rmSync(join(dir, 'core/old.md'))
  put('skills/a/SKILL.md', 'a2\n')
  put('mcp/catalog.json', '{}\n')
  put('upstream.json', '{}\n')
  put('engine/x.mjs', 'x2\n')
  git('add', '-A')
  git('commit', '-qm', 'two')
  const r = await runNode([script, '2.0.0'], { cwd: dir })
  assert.equal(r.code, 0, r.stderr)
  assert.match(read(dir, 'CHANGELOG.md'), /^# Changelog\n\n## 2\.0\.0 — \d{4}-\d{2}-\d{2}\n\nAsset changes since v1\.2\.3:\n\n- Added: mcp\/catalog\.json, upstream\.json\n- Changed: skills\/a\/SKILL\.md\n- Removed: core\/old\.md\n\n## 1\.2\.3 — 2026-01-01\n/)
  assert.equal((await runNode([checker, dir])).code, 0)
})

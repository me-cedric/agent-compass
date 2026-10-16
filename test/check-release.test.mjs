import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import test from 'node:test'
import { VERSION_FILES, setAt } from '../scripts/lib/versions.mjs'
import { runNode } from './helpers.mjs'

const root = new URL('..', import.meta.url)
const script = new URL('../scripts/check-release.mjs', import.meta.url)
const temps = []
test.after(() => { for (const d of temps) rmSync(d, { recursive: true, force: true }) })

const FILES = {
  'package.json': {},
  'plugins/compass-user/.claude-plugin/plugin.json': {},
  'plugins/compass-user/.codex-plugin/plugin.json': {},
  '.claude-plugin/marketplace.json': { plugins: [{}] },
}

// A fixture in which every version file carries `version`. `changes` maps a file to another version.
const makeRepo = ({ version = '1.2.3', changes = {}, changelog } = {}) => {
  const dir = mkdtempSync(join(tmpdir(), 'ac-release-'))
  temps.push(dir)
  for (const { file, path } of VERSION_FILES) {
    const json = structuredClone(FILES[file])
    setAt(json, path, changes[file] ?? version)
    mkdirSync(dirname(join(dir, file)), { recursive: true })
    writeFileSync(join(dir, file), JSON.stringify(json))
  }
  writeFileSync(join(dir, 'CHANGELOG.md'), changelog ?? `# Changelog\n\n## ${version} — 2026-01-01\n\n- change\n`)
  return dir
}
const check = (dir, ...args) => runNode([script.pathname, ...args, dir], { cwd: root.pathname })

test('check-release passes on a consistent fixture (positional root and --root)', async () => {
  const dir = makeRepo()
  const r = await check(dir)
  assert.equal(r.code, 0, r.stderr)
  assert.match(r.stdout, /release check passed/)
  assert.equal((await runNode([script.pathname, '--root', dir], { cwd: root.pathname })).code, 0)
})

test('check-release names each file whose version differs', async () => {
  const dir = makeRepo({ changes: { 'plugins/compass-user/.codex-plugin/plugin.json': '1.2.2', '.claude-plugin/marketplace.json': '0.9.6' } })
  const r = await check(dir)
  assert.equal(r.code, 1)
  assert.match(r.stderr, /\.codex-plugin\/plugin\.json: version "1\.2\.2" is not 1\.2\.3/)
  assert.match(r.stderr, /marketplace\.json: version "0\.9\.6" is not 1\.2\.3/)
  assert.doesNotMatch(r.stderr, /claude-plugin\/plugin\.json/)
})

test('check-release rejects a missing changelog heading or a heading for another version', async () => {
  for (const changelog of ['# Changelog\n', '# Changelog\n\n## 1.2.2 — 2026-01-01\n', '# Changelog\n\n## [1.2.3] - 2026-01-01\n', '# Changelog\n\n## 1.2.3 — soon\n']) {
    const r = await check(makeRepo({ changelog }))
    assert.equal(r.code, 1, changelog)
    assert.match(r.stderr, /CHANGELOG\.md: no heading "## 1\.2\.3 — <date>"/)
  }
})

test('check-release rejects an invalid version and a missing file', async () => {
  const bad = await check(makeRepo({ version: 'one' }))
  assert.equal(bad.code, 1)
  assert.match(bad.stderr, /package\.json: invalid version "one"/)
  const empty = await check(mkdtempSync(join(tmpdir(), 'ac-release-empty-')))
  assert.equal(empty.code, 1)
  assert.match(empty.stderr, /package\.json: ENOENT/)
})

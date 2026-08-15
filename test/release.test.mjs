import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

import { changelogSection } from '../scripts/lib/changelog.mjs'
import { runNode } from './helpers.mjs'

const script = new URL('../scripts/release.mjs', import.meta.url)

const README = '# Fixture\n\n![Version](https://img.shields.io/badge/version-v1.2.3-blue)\n\nCurrent version: `1.2.3`.\n'

const writeFixture = async (dir) => {
  await writeFile(join(dir, 'package.json'), `${JSON.stringify({ version: '1.2.3' }, null, 2)}\n`)
  await writeFile(join(dir, 'CHANGELOG.md'), '# Changelog\n\n## [Unreleased]\n\n- change\n')
  await writeFile(join(dir, 'README.md'), README)
}

test('changelogSection returns the whole section, blank lines included', () => {
  const changelog = '# Changelog\n\n## [Unreleased]\n\n## [1.2.3] - 2026-01-01\n\n### Added\n\n- one\n\n### Fixed\n\n- two\n\n## [1.2.2] - 2025-12-01\n\n- old\n'

  assert.equal(changelogSection(changelog, '1.2.3'), '### Added\n\n- one\n\n### Fixed\n\n- two')
  assert.equal(changelogSection(changelog, '1.2.2'), '- old')
})

test('changelogSection falls back when the version has no section', () => {
  assert.equal(changelogSection('# Changelog\n\n## [Unreleased]\n', '9.9.9'), 'Release v9.9.9')
})

test('release rejects --push without --tag', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'ac-release-run-'))
  try {
    await writeFixture(dir)

    const result = await runNode([script.pathname, '9.9.9', '--push'], { cwd: dir })
    assert.equal(result.code, 1)
    assert.match(result.stderr, /--push requires --tag/)
    assert.equal(await readFile(join(dir, 'README.md'), 'utf8'), README)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('release rejects --release without --tag', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'ac-release-run-'))
  try {
    await writeFixture(dir)

    const result = await runNode([script.pathname, '9.9.9', '--release'], { cwd: dir })
    assert.equal(result.code, 1)
    assert.match(result.stderr, /--release requires --tag/)
    assert.equal(await readFile(join(dir, 'README.md'), 'utf8'), README)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('release --dry reports the README bump and writes nothing', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'ac-release-run-'))
  try {
    await writeFixture(dir)

    const result = await runNode([script.pathname, '9.9.9', '--dry'], { cwd: dir })
    assert.equal(result.code, 0, result.stderr)
    assert.match(result.stdout, /package\.json version -> 9\.9\.9/)
    assert.match(result.stdout, /CHANGELOG\.md adds ## \[9\.9\.9\]/)
    assert.match(result.stdout, /README\.md version markers 1\.2\.3 -> 9\.9\.9/)
    assert.equal(await readFile(join(dir, 'README.md'), 'utf8'), README)
    assert.match(await readFile(join(dir, 'package.json'), 'utf8'), /"version": "1\.2\.3"/)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('release bumps both README version markers', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'ac-release-run-'))
  try {
    await writeFixture(dir)

    const result = await runNode([script.pathname, '9.9.9'], { cwd: dir })
    assert.equal(result.code, 0, result.stderr)

    const readme = await readFile(join(dir, 'README.md'), 'utf8')
    assert.match(readme, /version-v9\.9\.9-blue/)
    assert.match(readme, /Current version: `9\.9\.9`\./)
    assert.doesNotMatch(readme, /1\.2\.3/)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

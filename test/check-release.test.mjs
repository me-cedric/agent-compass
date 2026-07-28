import assert from 'node:assert/strict'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

import { runNode } from './helpers.mjs'

const root = new URL('..', import.meta.url)
const script = new URL('../scripts/check-release.mjs', import.meta.url)

const writeConsistentFixture = async (dir, version = '1.2.3') => {
  await writeFile(join(dir, 'package.json'), JSON.stringify({ version }))
  await writeFile(join(dir, 'CHANGELOG.md'), `# Changelog\n\n## [${version}] - 2026-01-01\n\n- change\n`)
  await writeFile(join(dir, 'README.md'), `# Fixture\n\n![Version](https://img.shields.io/badge/version-v${version}-blue)\n\nCurrent version: \`${version}\`.\n`)
}

test('check-release validates live release metadata', async () => {
  const result = await runNode([script.pathname], { cwd: root.pathname })
  if (result.code !== 0) {
    // Between a version bump and the release tagging, "missing tag vX.Y.Z" is
    // the expected state — any OTHER issue (changelog/README drift) still fails.
    const issues = result.stderr.split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('✗'))
    assert.ok(issues.every((l) => /^git: missing tag v/.test(l)), `unexpected release issues:\n${result.stderr}`)
  } else {
    assert.match(result.stdout, /release check passed/)
  }
})

test('check-release passes on a consistent fixture (positional root)', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'ac-release-'))
  try {
    await writeConsistentFixture(dir)

    const result = await runNode([script.pathname, dir], { cwd: root.pathname })
    assert.equal(result.code, 0, result.stderr)
    assert.match(result.stdout, /release check passed/)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('check-release rejects missing changelog section', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'ac-release-'))
  try {
    await writeFile(join(dir, 'package.json'), JSON.stringify({ version: '9.9.9' }))
    await writeFile(join(dir, 'CHANGELOG.md'), '# Changelog\n')

    const result = await runNode([script.pathname, '--root', dir], { cwd: root.pathname })
    assert.equal(result.code, 1)
    assert.match(result.stderr, /CHANGELOG\.md/)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('check-release rejects README version drift', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'ac-release-'))
  try {
    await writeConsistentFixture(dir, '1.2.3')
    await writeFile(join(dir, 'README.md'), '# Fixture\n\n![Version](https://img.shields.io/badge/version-v9.9.9-blue)\n\nCurrent version: `9.9.9`.\n')

    const result = await runNode([script.pathname, '--root', dir], { cwd: root.pathname })
    assert.equal(result.code, 1)
    assert.match(result.stderr, /README\.md: missing badge token version-v1\.2\.3/)
    assert.match(result.stderr, /README\.md: missing string Current version: `1\.2\.3`/)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

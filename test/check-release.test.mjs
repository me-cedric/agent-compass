import assert from 'node:assert/strict'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

import { runNode } from './helpers.mjs'

const root = new URL('..', import.meta.url)
const script = new URL('../scripts/check-release.mjs', import.meta.url)

test('check-release validates live release metadata', async () => {
  const result = await runNode([script.pathname], { cwd: root.pathname })
  assert.equal(result.code, 0, result.stderr)
  assert.match(result.stdout, /release check passed/)
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

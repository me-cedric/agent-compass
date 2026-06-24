import assert from 'node:assert/strict'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

import { runNode } from './helpers.mjs'

const root = new URL('..', import.meta.url)
const script = new URL('../scripts/check-docs.mjs', import.meta.url)

test('check-docs validates live links and template placeholders', async () => {
  const result = await runNode([script.pathname], { cwd: root.pathname })
  assert.equal(result.code, 0, result.stderr)
  assert.match(result.stdout, /docs check passed/)
})

test('check-docs rejects broken local links and unknown template placeholders', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'ac-docs-'))
  try {
    await mkdir(join(dir, 'templates'), { recursive: true })
    await writeFile(join(dir, 'README.md'), '[missing](docs/missing.md)\n')
    await writeFile(join(dir, 'templates', 'bad.tpl'), 'name=<client>\nroot=/Users/example/repo\n')

    const result = await runNode([script.pathname, '--root', dir], { cwd: root.pathname })
    assert.equal(result.code, 1)
    assert.match(result.stderr, /broken link/)
    assert.match(result.stderr, /unknown placeholder <client>/)
    assert.match(result.stderr, /local path in template/)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

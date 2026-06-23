import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

import { runNode } from './helpers.mjs'

const root = new URL('..', import.meta.url)
const script = new URL('../scripts/check-actions.mjs', import.meta.url)

test('check-actions validates live workflow action versions', async () => {
  const result = await runNode([script.pathname], { cwd: root.pathname })
  assert.equal(result.code, 0, result.stderr)
  assert.match(result.stdout, /GitHub Action versions/)
})

test('ci checkout fetches tags for release guard', async () => {
  const workflow = await readFile(new URL('../.github/workflows/ci.yml', import.meta.url), 'utf8')
  assert.match(workflow, /uses: actions\/checkout@v7[\s\S]*fetch-depth: 0/)
})

test('check-actions rejects stale action majors', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'ac-actions-'))
  try {
    await mkdir(join(dir, '.github', 'workflows'), { recursive: true })
    await mkdir(join(dir, 'templates', 'ci'), { recursive: true })
    await writeFile(join(dir, '.github', 'workflows', 'ci.yml'), 'steps:\n  - uses: actions/checkout@v4\n')
    const result = await runNode([script.pathname, '--root', dir], { cwd: root.pathname })
    assert.equal(result.code, 1)
    assert.match(result.stderr, /actions\/checkout@v4/)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

import assert from 'node:assert/strict'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

import { runNode } from './helpers.mjs'

const root = new URL('..', import.meta.url)
const script = new URL('../scripts/check-indexes.mjs', import.meta.url)

test('check-indexes validates live catalogs', async () => {
  const result = await runNode([script.pathname], { cwd: root.pathname })
  assert.equal(result.code, 0, result.stderr)
  assert.match(result.stdout, /index check passed/)
})

test('check-indexes rejects stale workflow, template, and skill catalogs', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'ac-indexes-'))
  try {
    await mkdir(join(dir, 'stacks'), { recursive: true })
    await mkdir(join(dir, 'docs', 'workflows'), { recursive: true })
    await mkdir(join(dir, 'docs', 'tooling'), { recursive: true })
    await mkdir(join(dir, 'skills', 'sample'), { recursive: true })
    await mkdir(join(dir, 'templates', 'sample'), { recursive: true })
    await mkdir(join(dir, 'scripts'), { recursive: true })
    await writeFile(join(dir, 'stacks', 'README.md'), '# Stacks\n')
    await writeFile(join(dir, 'stacks', 'web.md'), '# Web\n')
    await writeFile(join(dir, 'docs', 'workflows', 'README.md'), '# Workflows\n')
    await writeFile(join(dir, 'docs', 'workflows', 'flow.md'), '# Flow\n')
    await writeFile(join(dir, 'docs', 'tooling', 'README.md'), '# Tooling\n')
    await writeFile(join(dir, 'docs', 'tooling', 'tool.md'), '# Tool\n')
    await writeFile(join(dir, 'skills', 'README.md'), '# Skills\n')
    await writeFile(join(dir, 'skills', 'sample', 'SKILL.md'), '---\nname: sample\ndescription: sample\n---\n')
    await writeFile(join(dir, 'templates', 'README.md'), '# Templates\n')
    await writeFile(join(dir, 'templates', 'sample', 'file.txt'), 'x\n')
    await writeFile(join(dir, 'scripts', 'bootstrap.mjs'), "export const STACK_DOC_BY_APP = {\n  'web': 'stacks/web.md',\n}\n")

    const result = await runNode([script.pathname, '--root', dir], { cwd: root.pathname })
    assert.equal(result.code, 1)
    assert.match(result.stderr, /docs\/workflows\/README\.md/)
    assert.match(result.stderr, /docs\/tooling\/README\.md/)
    assert.match(result.stderr, /templates\/README\.md/)
    assert.match(result.stderr, /skills\/README\.md/)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

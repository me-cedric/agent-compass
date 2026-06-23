import assert from 'node:assert/strict'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

import { runNode } from './helpers.mjs'

const root = new URL('..', import.meta.url)
const script = new URL('../scripts/check-naming.mjs', import.meta.url)

test('check-naming accepts generic files and valid skill frontmatter', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'ac-naming-'))
  try {
    await mkdir(join(dir, 'skills', 'sample'), { recursive: true })
    await writeFile(join(dir, 'skills', 'sample', 'SKILL.md'), [
      '---',
      'name: sample',
      'description: Generic sample skill.',
      '---',
      '',
      '# Sample',
      '',
    ].join('\n'))

    const result = await runNode([script.pathname, '--root', dir], { cwd: root.pathname })
    assert.equal(result.code, 0, result.stderr)
    assert.match(result.stdout, /skill frontmatter valid/)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('check-naming rejects project names and malformed skills', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'ac-naming-'))
  try {
    await mkdir(join(dir, 'skills', 'bad'), { recursive: true })
    await writeFile(join(dir, 'notes.md'), `real project: ${['par', 'cus'].join('')}\n`)
    await writeFile(join(dir, 'skills', 'bad', 'SKILL.md'), '# Missing metadata\n')

    const result = await runNode([script.pathname, '--root', dir], { cwd: root.pathname })
    assert.equal(result.code, 1)
    assert.match(result.stderr, /project\/domain-specific/)
    assert.match(result.stderr, /skill frontmatter/)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

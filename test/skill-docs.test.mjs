import assert from 'node:assert/strict'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

import { runNode } from './helpers.mjs'

const AC = new URL('..', import.meta.url).pathname
const script = join(AC, 'scripts', 'skill-docs.mjs')
const cli = join(AC, 'scripts', 'cli.mjs')

test('generated skill documentation is current', async () => {
  const result = await runNode([cli, 'skill-docs', '--check'], { cwd: AC })
  assert.equal(result.code, 0, result.stderr)
  assert.match(result.stdout, /skill documentation is current/)
})

test('skill documentation writer replaces stale generated blocks', async () => {
  const root = await mkdtemp(join(tmpdir(), 'ac-skill-docs-'))
  try {
    await mkdir(join(root, 'skills', 'demo'), { recursive: true })
    await writeFile(join(root, 'skills', 'demo', 'SKILL.md'), '# Demo\n')
    await writeFile(join(root, 'README.md'), [
      '<!-- BEGIN GENERATED:SKILL_BADGE -->',
      'stale',
      '<!-- END GENERATED:SKILL_BADGE -->',
      '<!-- BEGIN GENERATED:CAPABILITY_PACKS -->',
      'stale',
      '<!-- END GENERATED:CAPABILITY_PACKS -->',
      '',
    ].join('\n'))
    await writeFile(join(root, 'skills', 'README.md'), [
      '# Skills',
      '<!-- BEGIN GENERATED:OPERATIONAL_SKILLS -->',
      'stale',
      '<!-- END GENERATED:OPERATIONAL_SKILLS -->',
      '',
    ].join('\n'))

    const stale = await runNode([script, '--root', root, '--check'], { cwd: AC })
    assert.equal(stale.code, 1)
    assert.match(stale.stderr, /generated skill documentation drift/)

    const write = await runNode([script, '--root', root, '--write'], { cwd: AC })
    assert.equal(write.code, 0, write.stderr)
    const readme = await readFile(join(root, 'README.md'), 'utf8')
    assert.match(readme, /skills-1-orange/)

    const current = await runNode([script, '--root', root, '--check'], { cwd: AC })
    assert.equal(current.code, 0, current.stderr)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

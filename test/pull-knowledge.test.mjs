import assert from 'node:assert/strict'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'
import test from 'node:test'

import { runNode } from './helpers.mjs'

const root = new URL('..', import.meta.url)
const script = new URL('../scripts/pull-knowledge.mjs', import.meta.url)

test('pull-knowledge stages agent files, configs, and module docs', async () => {
  const target = join(tmpdir(), `ac-source-${Date.now()}`)
  const staged = join(root.pathname, 'knowledge', 'incoming', basename(target))
  try {
    await mkdir(join(target, 'apps', 'api', 'src', 'modules', 'accounts'), { recursive: true })
    await writeFile(join(target, 'AGENTS.md'), '# Agent guide\n')
    await writeFile(join(target, 'turbo.json'), '{}\n')
    await writeFile(join(target, 'apps', 'api', 'src', 'modules', 'accounts', 'README.md'), '# Accounts\n')

    const result = await runNode([script.pathname, target], { cwd: root.pathname })
    assert.equal(result.code, 0, result.stderr)

    const index = await readFile(join(staged, 'INDEX.md'), 'utf8')
    assert.match(index, /agent-config/)
    assert.match(index, /config/)
    assert.match(index, /module-readme/)
  } finally {
    await rm(target, { recursive: true, force: true })
    await rm(staged, { recursive: true, force: true })
  }
})

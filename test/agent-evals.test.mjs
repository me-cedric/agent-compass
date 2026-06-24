import assert from 'node:assert/strict'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

import { runNode } from './helpers.mjs'

const root = new URL('..', import.meta.url)
const script = new URL('../scripts/agent-evals.mjs', import.meta.url)

test('agent-evals validates live teaching fixture', async () => {
  const result = await runNode([script.pathname, '--root', root.pathname], { cwd: root.pathname })
  assert.equal(result.code, 0, result.stderr)
  assert.match(result.stdout, /agent eval fixture valid/)
})

test('agent-evals rejects malformed fixture', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'ac-evals-'))
  try {
    await mkdir(join(dir, 'templates', 'evals'), { recursive: true })
    await writeFile(join(dir, 'templates', 'evals', 'bad.json'), JSON.stringify({
      references: ['missing.md'],
      scenarios: [{ id: 'bad', prompt: 'x', expect: [], reject: [] }],
    }))

    const result = await runNode([script.pathname, '--root', dir, '--fixture', 'templates/evals/bad.json'], { cwd: root.pathname })
    assert.equal(result.code, 1)
    assert.match(result.stderr, /missing referenced artifacts/)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

import assert from 'node:assert/strict'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

import { runNode } from './helpers.mjs'

const root = new URL('..', import.meta.url)
const script = new URL('../scripts/agent-trace.mjs', import.meta.url)

test('agent-trace validates the live example log', async () => {
  const result = await runNode([script.pathname, '--root', root.pathname], { cwd: root.pathname })
  assert.equal(result.code, 0, result.stderr)
  assert.match(result.stdout, /agent trace valid/)
})

test('agent-trace rejects secrets and missing fields', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'ac-trace-'))
  try {
    await writeFile(join(dir, 'secret.jsonl'),
      '{"task":"x","type":"bugfix","validation":"passed","outcome":"fixed","lesson":"api_key=AKIAIOSFODNN7EXAMPLE"}\n')
    const withSecret = await runNode([script.pathname, '--root', dir, '--file', 'secret.jsonl'], { cwd: root.pathname })
    assert.equal(withSecret.code, 1)
    assert.match(withSecret.stderr, /secret\/credential/)

    await writeFile(join(dir, 'bad.jsonl'), '{"task":"x","type":"bugfix"}\n')
    const missing = await runNode([script.pathname, '--root', dir, '--file', 'bad.jsonl'], { cwd: root.pathname })
    assert.equal(missing.code, 1)
    assert.match(missing.stderr, /missing "validation"/)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

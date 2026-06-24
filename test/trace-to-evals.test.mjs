import assert from 'node:assert/strict'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

import { runNode } from './helpers.mjs'

const root = new URL('..', import.meta.url)
const script = new URL('../scripts/trace-to-evals.mjs', import.meta.url).pathname
const evalsScript = new URL('../scripts/agent-evals.mjs', import.meta.url).pathname

test('trace-to-evals emits agent-evals-valid regression scenarios', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'ac-t2e-'))
  try {
    await writeFile(join(dir, 'trace.jsonl'), [
      '{"task":"fix login","type":"bugfix","validation":"failed","outcome":"broke build","lesson":"run tests first"}',
      '{"task":"add page","type":"feature","validation":"passed","outcome":"shipped"}',
    ].join('\n'))

    const gen = await runNode([script, dir, '--file', 'trace.jsonl', '--out', 'gen.json'], { cwd: root.pathname })
    assert.equal(gen.code, 0, gen.stderr)
    assert.match(gen.stdout, /1 regression/)

    const validate = await runNode([evalsScript, '--root', dir, '--fixture', 'gen.json'], { cwd: root.pathname })
    assert.equal(validate.code, 0, validate.stderr)
    assert.match(validate.stdout, /fixture valid/)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('trace-to-evals reports nothing when no regressions', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'ac-t2e-'))
  try {
    await writeFile(join(dir, 'trace.jsonl'), '{"task":"ok","type":"chore","validation":"passed","outcome":"done"}\n')
    const gen = await runNode([script, dir, '--file', 'trace.jsonl'], { cwd: root.pathname })
    assert.equal(gen.code, 0, gen.stderr)
    assert.match(gen.stdout, /No regressions/)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

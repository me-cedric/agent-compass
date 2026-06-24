import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

import { runNode } from './helpers.mjs'

const root = new URL('..', import.meta.url)
const script = new URL('../scripts/context-pack.mjs', import.meta.url).pathname

test('context-pack indexes the live repo', async () => {
  const result = await runNode([script, root.pathname], { cwd: root.pathname })
  assert.equal(result.code, 0, result.stderr)
  const pack = JSON.parse(result.stdout)
  assert.equal(pack.schema, 1)
  assert.ok(pack.packages.some((p) => p.name === 'agent-compass'))
  assert.ok(pack.commands, 'commands registry should be parsed')
})

test('context-pack --write then --check round-trips, detects drift', async () => {
  const host = await mkdtemp(join(tmpdir(), 'ac-ctx-'))
  try {
    await writeFile(join(host, 'package.json'), JSON.stringify({ name: 'demo', scripts: { test: 'x' } }))
    const write = await runNode([script, host, '--write'], { cwd: root.pathname })
    assert.equal(write.code, 0, write.stderr)
    JSON.parse(await readFile(join(host, '.agent', 'context.json'), 'utf8'))

    const clean = await runNode([script, host, '--check'], { cwd: root.pathname })
    assert.equal(clean.code, 0, clean.stderr)

    await writeFile(join(host, '.agent', 'context.json'), '{"schema":1}\n')
    const stale = await runNode([script, host, '--check'], { cwd: root.pathname })
    assert.equal(stale.code, 1)
  } finally {
    await rm(host, { recursive: true, force: true })
  }
})

import assert from 'node:assert/strict'
import test from 'node:test'

import { runNode } from './helpers.mjs'

const root = new URL('..', import.meta.url)
const script = new URL('../scripts/check-change-companions.mjs', import.meta.url).pathname

test('flags source changed without a test', async () => {
  const result = await runNode([script, '--files', 'src/foo.ts', '--strict'], { cwd: root.pathname })
  assert.equal(result.code, 1)
  assert.match(result.stderr, /without a test/)
})

test('passes when a test companion is present', async () => {
  const result = await runNode([script, '--files', 'src/foo.ts,src/foo.test.ts', '--strict'], { cwd: root.pathname })
  assert.equal(result.code, 0, result.stderr)
})

test('passes for docs-only changes', async () => {
  const result = await runNode([script, '--files', 'docs/x.md,README.md', '--strict'], { cwd: root.pathname })
  assert.equal(result.code, 0, result.stderr)
})

test('--allow overrides with a recorded reason', async () => {
  const result = await runNode([script, '--files', 'src/foo.ts', '--allow', 'external-integration', '--strict'], { cwd: root.pathname })
  assert.equal(result.code, 0, result.stderr)
  assert.match(result.stdout, /overridden/)
})

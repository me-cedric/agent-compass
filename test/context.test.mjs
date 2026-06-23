import assert from 'node:assert/strict'
import test from 'node:test'

import { runNode } from './helpers.mjs'

const root = new URL('..', import.meta.url)
const script = new URL('../scripts/context.mjs', import.meta.url)

test('context prints compact repo snapshot', async () => {
  const result = await runNode([script.pathname, root.pathname], { cwd: root.pathname })
  assert.equal(result.code, 0, result.stderr)
  assert.match(result.stdout, /Agent Context Snapshot/)
  assert.match(result.stdout, /agent-compass\.commands\.json/)
  assert.match(result.stdout, /docs\/workflows/)
})

import assert from 'node:assert/strict'
import test from 'node:test'

import { runNode } from './helpers.mjs'

const root = new URL('..', import.meta.url)
const script = new URL('../scripts/check-indexes.mjs', import.meta.url)

test('check-indexes validates live catalogs', async () => {
  const result = await runNode([script.pathname], { cwd: root.pathname })
  assert.equal(result.code, 0, result.stderr)
  assert.match(result.stdout, /index check passed/)
})

import assert from 'node:assert/strict'
import test from 'node:test'

import { runNode } from './helpers.mjs'

const root = new URL('..', import.meta.url)
const script = new URL('../scripts/gen-depgraph.mjs', import.meta.url).pathname

test('gen-depgraph emits a mermaid graph of internal imports', async () => {
  const result = await runNode([script, root.pathname, '--dir', 'scripts'], { cwd: root.pathname })
  assert.equal(result.code, 0, result.stderr)
  assert.match(result.stdout, /graph LR/)
  assert.match(result.stdout, /manifest\.mjs/)
  // install.mjs and sync.mjs both import manifest.mjs → it shows as depended-on.
  assert.match(result.stdout, /Depended on by/)
})

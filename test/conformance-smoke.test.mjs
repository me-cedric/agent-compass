import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

test('conformance smoke template covers core agent behaviors', async () => {
  const text = await readFile(new URL('../templates/conformance/agent-smoke-test.md', import.meta.url), 'utf8')
  assert.match(text, /AGENTS\.md/)
  assert.match(text, /agent-compass\.commands\.json/)
  assert.match(text, /Completion Gate/)
})

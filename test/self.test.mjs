// self.test.mjs — this repository runs the contract that compass installs: the same block, output style, hooks and permissions.

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { blockFind, blockInner } from '../engine/merge.mjs'

const REPO = dirname(dirname(fileURLToPath(import.meta.url)))
const read = (p) => readFileSync(join(REPO, p), 'utf8')
const HOOK = 'core/files/.agents/hooks/compass.mjs'

test('AGENTS.md carries the core block between the compass markers', () => {
  const at = blockFind(read('AGENTS.md'))
  assert.ok(at, 'AGENTS.md has one compass:begin … compass:end pair')
  assert.equal(at.inner, blockInner(read('core/blocks/AGENTS.md')))
})

test('.claude holds the core output style and the core settings keys, with the hook at its core path', () => {
  assert.equal(read('.claude/output-styles/compass.md'), read('core/files/.claude/output-styles/compass.md'))
  const expected = {}
  for (const [key, value] of Object.entries(JSON.parse(read('core/keys.json'))['.claude/settings.json'])) {
    const path = key.split('.')
    const at = path.slice(0, -1).reduce((o, k) => (o[k] ??= {}), expected)
    at[path.at(-1)] = JSON.parse(JSON.stringify(value).replaceAll('/.agents/hooks/compass.mjs', `/${HOOK}`))
  }
  assert.ok(expected.hooks.PreToolUse[0].hooks[0].command.includes(HOOK))
  assert.deepEqual(JSON.parse(read('.claude/settings.json')), expected)
})

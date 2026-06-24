import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

import { runNode } from './helpers.mjs'

const root = new URL('..', import.meta.url)
const script = new URL('../scripts/agent-conformance.mjs', import.meta.url)

test('agent-conformance validates live provider artifacts', async () => {
  const result = await runNode([script.pathname, '--root', root.pathname, '--strict'], { cwd: root.pathname })
  assert.equal(result.code, 0, result.stderr)
  assert.match(result.stdout, /Agent Conformance/)
  assert.match(result.stdout, /Codex config template \| passed/)
  assert.match(result.stdout, /Claude hook template \| passed/)
  assert.match(result.stdout, /Copilot MCP allowlist template \| passed/)
})

test('agent-conformance writes provider smoke prompt packet', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'ac-conformance-'))
  try {
    const result = await runNode([script.pathname, '--root', dir, '--write'], { cwd: root.pathname })
    assert.equal(result.code, 0, result.stderr)
    const packet = await readFile(join(dir, '.agent', 'agent-conformance.md'), 'utf8')
    assert.match(packet, /Claude/)
    assert.match(packet, /Codex/)
    assert.match(packet, /Copilot/)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

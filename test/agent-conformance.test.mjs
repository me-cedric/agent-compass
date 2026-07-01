import assert from 'node:assert/strict'
import { mkdir, mkdtemp, readFile, rm, symlink } from 'node:fs/promises'
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
  assert.match(result.stdout, /global setup \| passed/)
  assert.match(result.stdout, /MCP readiness probe \| passed/)
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

test('agent-conformance accepts agent-compass vendored under docs', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'ac-conformance-host-'))
  try {
    await mkdir(join(dir, 'docs'), { recursive: true })
    await symlink(root.pathname, join(dir, 'docs', 'agent-compass'), 'dir')
    const result = await runNode([script.pathname, '--root', dir, '--strict'], { cwd: root.pathname })
    assert.equal(result.code, 0, result.stderr)
    assert.match(result.stdout, /provider capabilities guide \| passed/)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

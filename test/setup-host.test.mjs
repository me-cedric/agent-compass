import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

import { runNode } from './helpers.mjs'

const root = new URL('..', import.meta.url)
const script = new URL('../scripts/setup-host.mjs', import.meta.url).pathname

test('setup-host installs host wiring and writes agent startup artifacts', async () => {
  const host = await mkdtemp(join(tmpdir(), 'ac-setup-host-'))
  try {
    const result = await runNode([script, host, '--strict'], { cwd: root.pathname })
    assert.equal(result.code, 0, result.stderr)
    assert.match(result.stdout, /ready: host setup generated and checked/)

    assert.ok(existsSync(join(host, 'AGENTS.md')))
    assert.ok(existsSync(join(host, '.agent', 'context.json')))
    assert.ok(existsSync(join(host, '.agent', 'doctor-report.md')))
    assert.ok(existsSync(join(host, '.agent', 'RUNBOOK.md')))
    assert.match(await readFile(join(host, '.agent', 'RUNBOOK.md'), 'utf8'), /Agent Runbook/)
  } finally {
    await rm(host, { recursive: true, force: true })
  }
})

test('setup-host refuses to target agent-compass itself', async () => {
  const result = await runNode([script, root.pathname], { cwd: root.pathname })
  assert.equal(result.code, 1)
  assert.match(result.stderr, /Refusing/)
})

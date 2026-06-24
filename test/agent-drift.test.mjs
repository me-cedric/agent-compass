import assert from 'node:assert/strict'
import test from 'node:test'

import { runNode } from './helpers.mjs'

const root = new URL('..', import.meta.url)
const script = new URL('../scripts/agent-drift.mjs', import.meta.url)

test('agent-drift reports no drift on a clean repo', async () => {
  const result = await runNode([script.pathname, '--strict'], { cwd: root.pathname })
  assert.equal(result.code, 0, result.stderr)
  assert.match(result.stdout, /Agent Drift Report/)
  assert.match(result.stdout, /no drift detected/)
})

test('agent-drift emits machine-readable json', async () => {
  const result = await runNode([script.pathname, '--json'], { cwd: root.pathname })
  assert.equal(result.code, 0, result.stderr)
  const report = JSON.parse(result.stdout)
  assert.equal(report.ok, true)
  assert.ok(report.results.length >= 5)
  assert.ok(report.results.every((entry) => entry.ok))
})

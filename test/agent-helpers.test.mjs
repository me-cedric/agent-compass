import assert from 'node:assert/strict'
import test from 'node:test'

import { runNode } from './helpers.mjs'

const root = new URL('..', import.meta.url)

test('doctor-report prints readiness markdown', async () => {
  const result = await runNode([new URL('../scripts/doctor-report.mjs', import.meta.url).pathname, root.pathname], { cwd: root.pathname })
  assert.equal(result.code, 0, result.stderr)
  assert.match(result.stdout, /Agent Readiness Report/)
  assert.match(result.stdout, /Command registry/)
})

test('runbook prints agent startup steps', async () => {
  const result = await runNode([new URL('../scripts/runbook.mjs', import.meta.url).pathname, root.pathname], { cwd: root.pathname })
  assert.equal(result.code, 0, result.stderr)
  assert.match(result.stdout, /Agent Runbook/)
  assert.match(result.stdout, /agent-compass\.commands\.json/)
})

test('release dry run reports version changes only', async () => {
  const result = await runNode([new URL('../scripts/release.mjs', import.meta.url).pathname, '9.9.9', '--dry'], { cwd: root.pathname })
  assert.equal(result.code, 0, result.stderr)
  assert.match(result.stdout, /package\.json version -> 9\.9\.9/)
})

import assert from 'node:assert/strict'
import test from 'node:test'

import { runNode } from './helpers.mjs'

const root = new URL('..', import.meta.url)
const scripts = [
  'agent-conformance.mjs',
  'agent-evals.mjs',
  'agent-drift.mjs',
  'agent-trace.mjs',
  'agent-onboard.mjs',
  'bootstrap.mjs',
  'check-actions.mjs',
  'check-change-companions.mjs',
  'check-update.mjs',
  'cli.mjs',
  'context.mjs',
  'context-pack.mjs',
  'doctor-report.mjs',
  'gen-depgraph.mjs',
  'install.mjs',
  'new.mjs',
  'redact.mjs',
  'run-command.mjs',
  'trace-to-evals.mjs',
  'pr.mjs',
  'pr-review.mjs',
  'pull-knowledge.mjs',
  'release.mjs',
  'runbook.mjs',
  'sync.mjs',
  'upgrade-host.mjs',
  'check-docs.mjs',
  'check-indexes.mjs',
  'check-naming.mjs',
  'check-release.mjs',
]

test('scripts expose --help', async () => {
  for (const script of scripts) {
    const result = await runNode([new URL(`../scripts/${script}`, import.meta.url).pathname, '--help'], { cwd: root.pathname })
    assert.equal(result.code, 0, `${script}: ${result.stderr}`)
    assert.match(result.stdout, /Usage:/, script)
  }
})

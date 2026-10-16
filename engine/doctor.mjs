// doctor.mjs — check the tools, the compass checkout, the configuration and the ownership rules.
// A "fail" check makes `ac doctor` exit 1. A "warn" check does not.

import { syncHost } from './sync.mjs'
import { run } from './util.mjs'

export const doctor = ({ AC, root }) => {
  const sync = syncHost({ AC, root })
  const node = Number(process.versions.node.split('.')[0])
  const git = run('git', ['--version'], { timeout: 10_000 })
  const checks = [
    { name: 'node', status: node >= 20 ? 'ok' : 'fail', detail: node >= 20 ? process.version : `${process.version}; Node 20 or later is necessary` },
    { name: 'git', status: git.ok ? 'ok' : 'fail', detail: git.ok ? git.out : `git does not run: ${git.err}` },
    { name: 'compass', status: sync.tag ? 'ok' : 'warn', detail: `${sync.version} ${sync.tag ? `at tag ${sync.tag}` : '(not on a release tag)'}` },
    { name: 'paths', status: 'ok', detail: sync.pathsFrom ? `from ${sync.pathsFrom}` : 'not read' },
    { name: 'stacks', status: 'ok', detail: sync.stacks.join(', ') || 'none detected' },
    ...sync.warnings.map((detail) => ({ name: 'config', status: 'warn', detail })),
    ...sync.errors.map((detail) => ({ name: 'error', status: 'fail', detail })),
  ]
  if (sync.ok) {
    checks.push({ name: 'sync', status: sync.drift ? 'warn' : 'ok', detail: sync.drift ? `${sync.changes.length} pending change(s); run "ac sync"` : 'up to date' })
  }
  return { ok: checks.every((c) => c.status !== 'fail'), checks, paths: sync.paths, changes: sync.changes }
}

// doctor.mjs — check the tools, the compass checkout, the configuration and the ownership rules.
// A "fail" check makes `ac doctor` exit 1. A "warn" check does not. `tokens` adds the context budget checks.

import { syncHost } from './sync.mjs'
import { BUDGET, measureTokens } from './tokens.mjs'
import { run } from './util.mjs'

const tokenChecks = (t) => [
  ...t.items.map((i) => ({ name: 'tokens', status: 'ok', detail: `${i.name}: ${i.chars} chars, about ${i.tokens} tokens` })),
  ...t.errors.map((detail) => ({ name: 'budget', status: 'fail', detail })),
  ...(t.errors.length ? [] : [{ name: 'budget', status: 'ok', detail: `about ${t.total} of ${BUDGET.tokens} tokens; SessionStart ${t.startChars} of ${BUDGET.sessionStartChars} chars` }]),
]

export const doctor = ({ AC, root, tokens = false }) => {
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
    ...sync.changes.filter((c) => c.action === 'kept').map((c) => ({
      name: 'kept', status: 'warn', detail: `${c.path}${c.key ? `#${c.key}` : ''} is edited in the project, so the compass version is not installed`,
    })),
    ...sync.errors.map((detail) => ({ name: 'error', status: 'fail', detail })),
  ]
  if (sync.ok) {
    checks.push({ name: 'sync', status: sync.drift ? 'warn' : 'ok', detail: sync.drift ? `${sync.changes.length} pending change(s); run "ac sync"` : 'up to date' })
  }
  const measured = tokens ? measureTokens({ AC, root }) : null
  if (measured) checks.push(...tokenChecks(measured))
  return { ok: checks.every((c) => c.status !== 'fail'), checks, paths: sync.paths, changes: sync.changes, ...(measured && { tokens: measured }) }
}

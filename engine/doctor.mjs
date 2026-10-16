// doctor.mjs — check the tools, the compass checkout, the configuration and the ownership rules.
// A "fail" check makes `ac doctor` exit 1. A "warn" check does not. `tokens` adds the context budget checks.

import { accessSync, constants, statSync } from 'node:fs'
import { delimiter, join } from 'node:path'
import { konvoyOwns, loadConfig, loadKonvoy, resolvePaths } from './config.mjs'
import { mcpPlan } from './mcp.mjs'
import { jsonGet } from './merge.mjs'
import { buildPlan } from './plan.mjs'
import { syncHost } from './sync.mjs'
import { BUDGET, measureTokens } from './tokens.mjs'
import { readJson, run } from './util.mjs'

// True when an executable file with this name is in a directory of PATH.
export const onPath = (name) => (process.env.PATH ?? '').split(delimiter).some((dir) => {
  try { accessSync(join(dir, name), constants.X_OK); return statSync(join(dir, name)).isFile() } catch { return false }
})

// One warning for each command of a selected MCP server that is not on PATH. No network.
const commandChecks = ({ AC, root, sync }) => {
  if (!sync.ok) return []
  const { commands } = mcpPlan({ AC, config: loadConfig(root, AC, { init: true }).config, stacks: sync.stacks })
  return Object.entries(commands).filter(([cmd]) => !onPath(cmd))
    .map(([cmd, names]) => ({ name: 'mcp', status: 'warn', detail: `"${cmd}" is not on PATH, so the MCP server ${names.join(', ')} cannot start` }))
}

// An exclude that a host array needed before the per-entry merge. It is advice only when the key is a planned array that the host holds as an array
// and Konvoy does not own. Else the exclude is right, and the sync fails without it. A plan error shows in the sync check.
const konvoyTakes = (kv, file, key) => konvoyOwns(kv, file) || (kv.keys[file] ?? []).some((k) => k === key || key.startsWith(`${k}.`) || k.startsWith(`${key}.`))

const excludeChecks = ({ AC, root }) => {
  const { config } = loadConfig(root, AC, { init: true })
  const ids = (config?.exclude ?? []).filter((id) => id.includes('#'))
  if (!ids.length) return []
  try {
    const { konvoy } = loadKonvoy(root)
    const open = { ...config, exclude: config.exclude.filter((id) => !ids.includes(id)) }
    const { keys } = buildPlan({ AC, root, config: open, paths: resolvePaths(open, konvoy).paths, konvoy: Boolean(konvoy) })
    return ids.filter((id) => {
      const [file, key] = [id.slice(0, id.indexOf('#')), id.slice(id.indexOf('#') + 1)]
      return Array.isArray(keys.get(file)?.get(key)) && !(konvoy && konvoyTakes(konvoy, file, key)) && Array.isArray(jsonGet(readJson(join(root, file)), key))
    }).map((id) => ({ name: 'exclude', status: 'warn', detail: `${id}: compass merges this array per entry now; remove the exclude to get the compass entries` }))
  } catch { return [] }
}

const tokenChecks = (t) => [
  ...t.items.map((i) => ({ name: 'tokens', status: 'ok', detail: `${i.name}: ${i.chars} chars, about ${i.tokens} tokens` })),
  ...t.warnings.map((detail) => ({ name: 'budget', status: 'warn', detail })),
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
  checks.push(...excludeChecks({ AC, root }), ...commandChecks({ AC, root, sync }))
  if (sync.ok) {
    checks.push({ name: 'sync', status: sync.drift ? 'warn' : 'ok', detail: sync.drift ? `${sync.changes.length} pending change(s); run "ac sync"` : 'up to date' })
  }
  const measured = tokens ? measureTokens({ AC, root }) : null
  if (measured) checks.push(...tokenChecks(measured))
  return { ok: checks.every((c) => c.status !== 'fail'), checks, paths: sync.paths, changes: sync.changes, ...(measured && { tokens: measured }) }
}

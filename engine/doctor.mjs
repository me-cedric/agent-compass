// doctor.mjs — check the tools, the compass checkout, the configuration and the ownership rules.
// A "fail" check makes `ac doctor` exit 1. A "warn" check does not. `tokens` adds the context budget checks.
// A child process (git, a language server, the code graph CLI) runs with a timeout. Its failure is a warning, never a fail.

import { accessSync, constants, existsSync, realpathSync, statSync } from 'node:fs'
import { delimiter, join } from 'node:path'
import { konvoyOwns, loadConfig, loadKonvoy, resolvePaths } from './config.mjs'
import { newerTag, submoduleMoved } from './git.mjs'
import { doctorGlobal } from './global.mjs'
import { mcpPlan } from './mcp.mjs'
import { jsonGet } from './merge.mjs'
import { buildPlan } from './plan.mjs'
import { syncHost } from './sync.mjs'
import { BUDGET, measureTokens } from './tokens.mjs'
import { readJson, run, versionCmp } from './util.mjs'

// True when an executable file with this name is in a directory of PATH.
// Windows finds a command with each PATHEXT extension too, such as npx.cmd.
export const onPath = (name, win = process.platform === 'win32') => {
  const exts = win ? ['', ...(process.env.PATHEXT || '.EXE;.CMD;.BAT').split(';').filter(Boolean)] : ['']
  return (process.env.PATH ?? '').split(delimiter).some((dir) => exts.some((ext) => {
    try { accessSync(join(dir, name + ext), constants.X_OK); return statSync(join(dir, name + ext)).isFile() } catch { return false }
  }))
}

// One warning for each command of a selected MCP server that is not on PATH. No network.
const commandChecks = ({ commands }) => Object.entries(commands).filter(([cmd]) => !onPath(cmd))
  .map(([cmd, names]) => ({ name: 'mcp', status: 'warn', detail: `"${cmd}" is not on PATH, so the MCP server ${names.join(', ')} cannot start` }))

// One warning for each enabled LSP plugin whose language server is not on PATH.
const lspChecks = ({ lsp }) => lsp.filter((p) => !onPath(p.command))
  .map((p) => ({ name: 'lsp', status: 'warn', detail: `"${p.command}" is not on PATH, so the plugin ${p.id} cannot start; install it: ${p.install}` }))

// The code graph index of the project. codebase-memory-mcp names a project after its path: "/a/b" is "a-b".
const GRAPH = 'codebase-memory-mcp'
const graphChecks = ({ selected }, root) => {
  if (!selected.includes('codebase-memory') || !onPath(GRAPH)) return []
  const project = realpathSync(root).replace(/^\//, '').split('/').join('-')
  const r = run(GRAPH, ['cli', '--json', 'index_status', '--project', project], { timeout: 10_000 })
  let data
  try { data = JSON.parse(r.out.split('\n').at(-1)).structuredContent } catch { data = null }
  if (data?.status) return [{ name: 'graph', status: 'ok', detail: `the project has a code graph index: ${data.status}, ${data.nodes ?? 0} nodes` }]
  if (/not (found|indexed)/.test(data?.error ?? '')) {
    return [{ name: 'graph', status: 'warn', detail: 'the project has no code graph index; run "codebase-memory-mcp cli index_repository" once in the project (the analysis tool profile removes that tool from the agent)' }]
  }
  return [{ name: 'graph', status: 'warn', detail: `${GRAPH} cli failed: ${(data?.error || r.err || 'no output').split('\n')[0]}` }]
}

// One warning for each selected server whose command is older than its catalog minVersion. An unknown version is skipped.
const versionChecks = ({ versions }) => versions.filter((v) => onPath(v.command)).flatMap((v) => {
  const r = run(v.command, ['--version'], { timeout: 10_000 })
  const found = /(\d+\.\d+\.\d+)/.exec(`${r.out}\n${r.err}`)?.[1]
  return found && versionCmp(found, v.min) < 0
    ? [{ name: 'version', status: 'warn', detail: `${v.command} ${found} is older than ${v.min}, the minimum for the MCP server ${v.name}` }]
    : []
})

// The project and its compass checkout: git, the submodule commit, a newer tag, the Codex hook trust and the user-level todo count.
const hostChecks = ({ AC, root, version, gitOk }) => {
  const checks = []
  if (gitOk && !run('git', ['-C', root, 'rev-parse', '--is-inside-work-tree'], { timeout: 10_000 }).ok) {
    checks.push({ name: 'git', status: 'warn', detail: 'the project is not a git repository; the Codex hooks use "git rev-parse" to find the project root' })
  }
  const moved = gitOk && submoduleMoved(root, AC)
  if (moved) checks.push({ name: 'submodule', status: 'warn', detail: `the compass checkout ${moved} is not at the commit that the project records; run "git submodule update --init" or commit the new commit` })
  const tag = gitOk && newerTag(AC, version)
  if (tag) checks.push({ name: 'submodule', status: 'warn', detail: `the compass tag ${tag} is newer than this checkout (${version}); run "ac sync --to ${tag}" to update` })
  if (existsSync(join(root, '.codex/hooks.json'))) {
    checks.push({ name: 'codex', status: 'ok', detail: 'Codex runs the project hooks only after you trust them: run /hooks in Codex once' })
  }
  try {
    const todo = doctorGlobal({ AC, root }).recommended.filter((c) => !c.ok).length
    checks.push({ name: 'global', status: 'ok', detail: todo ? `${todo} user-level item(s) to fix; run "ac doctor --global"` : 'the user-level setup has no open item' })
  } catch (err) { checks.push({ name: 'global', status: 'warn', detail: `ac doctor --global failed: ${err.message}` }) }
  return checks
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
  const mcp = sync.ok ? mcpPlan({ AC, config: loadConfig(root, AC, { init: true }).config, stacks: sync.stacks }) : null
  checks.push(...excludeChecks({ AC, root }))
  if (mcp) checks.push(...commandChecks(mcp), ...lspChecks(mcp), ...graphChecks(mcp, root), ...versionChecks(mcp))
  checks.push(...hostChecks({ AC, root, version: sync.version, gitOk: git.ok }))
  if (sync.ok) {
    checks.push({ name: 'sync', status: sync.drift ? 'warn' : 'ok', detail: sync.drift ? `${sync.changes.length} pending change(s); run "ac sync"` : 'up to date' })
  }
  const measured = tokens ? measureTokens({ AC, root }) : null
  if (measured) checks.push(...tokenChecks(measured))
  return { ok: checks.every((c) => c.status !== 'fail'), checks, paths: sync.paths, changes: sync.changes, ...(measured && { tokens: measured }) }
}

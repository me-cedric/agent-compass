// global.mjs — `ac doctor --global`: report the user-level Claude Code and Codex setup that adds to every session.
// It only reads files. With `measure` it also runs each SessionStart hook once, as Claude Code does.

import { spawnSync } from 'node:child_process'
import { existsSync, lstatSync, readdirSync, readFileSync, readlinkSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join, resolve, sep } from 'node:path'
import { isObj, SHELL } from './util.mjs'

export const LIMITS = { plugins: 15, mcp: 10, hookChars: 1000, totalChars: 2000 }
// The hook events whose output goes into the context.
const EVENTS = ['SessionStart', 'UserPromptSubmit', 'SubagentStart', 'PreCompact']
const SET = [
  { name: 'ponytail', source: 'DietrichGebert/ponytail', market: 'ponytail' },
  { name: 'caveman', source: 'JuliusBrussee/caveman', market: 'caveman' },
  { name: 'i-have-adhd', source: 'ayghri/i-have-adhd', market: 'i-have-adhd' },
]

// A missing file is empty. A file that exists and does not parse is an error.
const load = (path, errors) => {
  if (!existsSync(path)) return {}
  try {
    const v = JSON.parse(readFileSync(path, 'utf8'))
    if (!isObj(v)) throw new Error('it is not a JSON object')
    return v
  } catch (err) {
    errors.push(`${path} is not readable: ${err.message}`)
    return {}
  }
}

const hooksOf = (hooks, from, root) => EVENTS.flatMap((event) => (Array.isArray(hooks?.[event]) ? hooks[event] : [])
  .flatMap((m) => (Array.isArray(m?.hooks) ? m.hooks : []).map((h) => [m.matcher ?? '', h]))
  .filter(([, h]) => h?.type === 'command' && typeof h.command === 'string')
  .map(([matcher, h]) => ({ event, matcher, from, command: h.command, root })))

// `[mcp_servers.<name>]` and `[plugins."<name>"]` tables. A sub-table such as `[mcp_servers.<name>.env]` is the same server.
const codexOf = (text) => {
  const mcp = new Set()
  const plugins = []
  for (const table of text.split(/^\s*\[/m).slice(1)) {
    const m = /^(mcp_servers|plugins)\.("[^"]+"|[\w@.-]+?)(?:\.[\w-]+)?\]([\s\S]*)/.exec(table)
    if (!m) continue
    const name = m[2].replace(/"/g, '')
    if (m[1] === 'mcp_servers') mcp.add(name)
    else if (!/^\s*enabled\s*=\s*false/m.test(m[3])) plugins.push(name)
  }
  return { mcp: [...mcp], plugins }
}

// A hook that exits before it reads stdin gives spawnSync a write error (EPIPE) beside the exit code. The exit code wins.
export const hookError = (r) => {
  if (r.status === 0) return null
  const text = (r.stderr || '').trim() || (r.status === null ? r.error?.message || `signal ${r.signal}` : `exit code ${r.status}`)
  return text.trim().split('\n')[0]
}

// The hook commands are shell strings, so this is the one place that runs a shell (SHELL: sh, or Git Bash on Windows). Only --measure gets here.
// One SessionStart matcher fires per session, so the same command under several matchers runs once.
const measureHooks = (hooks, root) => hooks.filter((h, i, all) => h.event === 'SessionStart' && all.findIndex((x) => x.event === 'SessionStart' && x.command === h.command) === i).map((h) => {
  const r = spawnSync(h.command, {
    shell: SHELL,
    cwd: root,
    input: '{}',
    encoding: 'utf8',
    timeout: 10_000,
    env: { ...process.env, GIT_TERMINAL_PROMPT: '0', CLAUDE_PROJECT_DIR: root, ...(h.root && { CLAUDE_PLUGIN_ROOT: h.root }) },
  })
  const error = hookError(r)
  return { from: h.from, command: h.command, chars: (r.stdout || '').length, ...(error && { error }) }
})

// The 0.9 global-setup linked every skill into three user folders and wrote pointer files.
const leftovers = ({ AC, home, claudeDir, codexDir, errors }) => {
  const manifest = join(home, '.agent-compass/manifest.json')
  const roots = [AC, load(manifest, errors).source].filter((r) => typeof r === 'string').map((r) => resolve(r))
  const stale = (dir, name) => {
    const path = join(dir, name)
    try {
      if (!lstatSync(path).isSymbolicLink()) return false
      const target = resolve(dir, readlinkSync(path))
      return !existsSync(path) || roots.some((r) => target === r || target.startsWith(r + sep))
    } catch { return false }
  }
  const items = []
  for (const dir of [join(claudeDir, 'skills'), join(home, '.agents/skills'), join(codexDir, 'skills')]) {
    let names = []
    try { names = readdirSync(dir).sort() } catch { continue }
    const links = names.filter((n) => stale(dir, n))
    if (links.length) items.push({ name: '0.9 skill links', ok: false, links, fix: `move ${links.length} link(s) out of ${dir}; they point into a compass checkout or to nothing (--json lists them)` })
  }
  if (existsSync(manifest)) items.push({ name: '0.9 manifest', ok: false, fix: `move ${dirname(manifest)} out; compass 1.0 does not read it` })
  const pointers = [
    [join(claudeDir, 'CLAUDE.md'), `import "@${join(AC, 'core/blocks/AGENTS.md')}" instead`],
    [join(codexDir, 'AGENTS.md'), 'keep your own notes only; the compass-user plugin carries the style'],
  ]
  for (const [file, todo] of pointers) {
    let text = ''
    try { text = readFileSync(file, 'utf8') } catch { continue }
    if (/^# Global (Claude|Codex) Agent Compass Pointer/m.test(text) || roots.some((r) => text.includes(join(r, 'AGENTS.md')))) {
      items.push({ name: '0.9 pointer', ok: false, fix: `${file} points to the compass 0.9 contract; ${todo}` })
    }
  }
  return items
}

export const doctorGlobal = ({ AC, root, measure = false, home = homedir(), env = process.env }) => {
  const errors = []
  const warnings = []
  // CLAUDE_CONFIG_DIR moves ~/.claude and ~/.claude.json; CODEX_HOME moves ~/.codex.
  const claudeDir = env.CLAUDE_CONFIG_DIR || join(home, '.claude')
  const settings = load(join(claudeDir, 'settings.json'), errors)
  const state = load(env.CLAUDE_CONFIG_DIR ? join(claudeDir, '.claude.json') : join(home, '.claude.json'), errors)
  const registry = load(join(claudeDir, 'plugins/installed_plugins.json'), errors)
  const installed = isObj(registry.plugins) ? registry.plugins : {}
  const enabled = Object.entries(isObj(settings.enabledPlugins) ? settings.enabledPlugins : {}).filter(([, on]) => on === true).map(([id]) => id)
  const installPath = (id) => {
    const entries = (Array.isArray(installed[id]) ? installed[id] : []).filter(isObj)
    const path = (entries.find((e) => e.scope === 'user') ?? entries[0])?.installPath
    return typeof path === 'string' ? path : null
  }

  const mcp = Object.keys(isObj(state.mcpServers) ? state.mcpServers : {}).map((name) => ({ name, from: 'user' }))
  const hooks = hooksOf(settings.hooks, 'user settings')
  for (const id of enabled) {
    const dir = installPath(id)
    if (!dir) continue
    const file = load(join(dir, '.mcp.json'), errors)
    mcp.push(...Object.keys(isObj(file.mcpServers) ? file.mcpServers : file).map((name) => ({ name, from: id })))
    hooks.push(...hooksOf(load(join(dir, 'hooks/hooks.json'), errors).hooks, id, dir))
  }

  const codexDir = env.CODEX_HOME || join(home, '.codex')
  const toml = join(codexDir, 'config.toml')
  let codex = { mcp: [], plugins: [] }
  try { if (existsSync(toml)) codex = codexOf(readFileSync(toml, 'utf8')) } catch (err) { errors.push(`${toml}: ${err.message}`) }

  const names = enabled.map((id) => id.split('@')[0])
  const status = (name, source, market) => {
    if (names.includes(name)) return { name, ok: true }
    const id = Object.keys(installed).find((k) => k.split('@')[0] === name)
    return { name, ok: false, fix: id ? `claude plugin enable ${id}` : `claude plugin marketplace add ${source} && claude plugin install ${name}@${market}` }
  }
  // The compass checkout path stays the same across plugin updates; the plugin cache path has the version in it.
  const script = join(AC, 'plugins/compass-user/scripts/statusline.mjs')
  const recommended = [
    status('compass-user', AC, 'agent-compass'),
    ...SET.map((s) => status(s.name, s.source, s.market)),
    ['compass-user:compass', 'compass'].includes(settings.outputStyle)
      ? { name: 'outputStyle', ok: true }
      : { name: 'outputStyle', ok: false, fix: 'add to ~/.claude/settings.json: {"outputStyle":"compass-user:compass"}' },
    isObj(settings.attribution) && settings.attribution.commit === '' && settings.attribution.pr === ''
      ? { name: 'attribution', ok: true }
      : { name: 'attribution', ok: false, fix: 'add to ~/.claude/settings.json: {"attribution":{"commit":"","pr":"","sessionUrl":false}}' },
    settings.statusLine?.command
      ? { name: 'statusLine', ok: true }
      : { name: 'statusLine', ok: false, fix: `add to ~/.claude/settings.json: ${JSON.stringify({ statusLine: { type: 'command', command: `node "${script}"` } })}` },
    ...leftovers({ AC, home, claudeDir, codexDir, errors }),
  ]

  const seen = new Map()
  // The same command under another matcher is another hook (SessionStart: startup, resume, clear, compact).
  for (const h of hooks) seen.set(`${h.event}\0${h.matcher}\0${h.command}`, (seen.get(`${h.event}\0${h.matcher}\0${h.command}`) ?? 0) + 1)
  for (const [key, n] of seen) if (n > 1) { const [event, , command] = key.split('\0'); warnings.push(`the ${event} hook "${command}" is listed ${n} times; it runs ${n} times`) }
  if (enabled.length > LIMITS.plugins) warnings.push(`${enabled.length} enabled Claude plugins; the budget is ${LIMITS.plugins}`)
  if (mcp.length > LIMITS.mcp) warnings.push(`${mcp.length} Claude MCP servers at user level; the budget is ${LIMITS.mcp}`)
  if (codex.mcp.length > LIMITS.mcp) warnings.push(`${codex.mcp.length} Codex MCP servers; the budget is ${LIMITS.mcp}`)

  const items = measure ? measureHooks(hooks, root) : null
  const total = items?.reduce((sum, i) => sum + i.chars, 0) ?? 0
  for (const i of items ?? []) {
    if (i.error) warnings.push(`the SessionStart hook "${i.command}" failed: ${i.error}`)
    else if (i.chars > LIMITS.hookChars) warnings.push(`the SessionStart hook "${i.command}" prints ${i.chars} characters; the budget is ${LIMITS.hookChars}`)
  }
  if (total > LIMITS.totalChars) warnings.push(`the SessionStart hooks print ${total} characters; the budget is ${LIMITS.totalChars}`)

  return {
    ok: !errors.length,
    claude: { plugins: enabled, mcp, hooks: hooks.map(({ event, from, command }) => ({ event, from, command })) },
    codex,
    ...(items && { measure: { items, total } }),
    recommended,
    warnings,
    errors,
  }
}

export const formatGlobal = (r) => [
  'ac doctor --global',
  `  claude  ${r.claude.plugins.length} enabled plugin(s): ${r.claude.plugins.join(', ') || 'none'}`,
  `  claude  ${r.claude.mcp.length} MCP server(s): ${r.claude.mcp.map((s) => `${s.name} (${s.from})`).join(', ') || 'none'}`,
  `  claude  ${r.claude.hooks.length} SessionStart, UserPromptSubmit, SubagentStart or PreCompact hook(s)`,
  ...r.claude.hooks.map((h) => `            ${h.event} [${h.from}] ${h.command}`),
  `  codex   ${r.codex.mcp.length} MCP server(s): ${r.codex.mcp.join(', ') || 'none'}; ${r.codex.plugins.length} plugin(s)`,
  ...(r.measure ? [`  measure SessionStart output: ${r.measure.total} characters`, ...r.measure.items.map((i) => `            ${i.chars} chars  ${i.command}`)] : []),
  ...r.recommended.map((c) => `  ${c.ok ? 'ok  ' : 'todo'}    ${c.name}${c.fix ? `: ${c.fix}` : ''}`),
  ...r.warnings.map((w) => `  warn    ${w}`),
  ...r.errors.map((e) => `error: ${e}`),
].join('\n')

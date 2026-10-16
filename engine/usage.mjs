// usage.mjs — ac usage: tokens, cost and cache use from the Claude Code transcripts in <home>/.claude/projects and
// the Codex sessions in <codex home>/sessions (CODEX_HOME moves <home>/.codex).
// A Claude row counts once per "<message.id>:<requestId>": streaming writes one line per content block, and the line with
// the largest output count is the full one. A Codex file is one row: its last total_token_usage, on the local day of its start.
// A day is a local day. A cost is in USD at list price. A Codex model has no price yet, so its cost is 0.
// A session is the sessionId of the lines (a sub-agent has the sessionId of its parent) or a Codex file. It is a "graph" session when
// any of its lines calls a tool of a codebase-memory MCP server.

import { readFileSync, statSync } from 'node:fs'
import { homedir } from 'node:os'
import { basename, dirname, join, resolve } from 'node:path'
import { parseCommand, run, usageError, walk } from './util.mjs'

// Model id prefix → [input, output, cacheRead] in USD per million tokens. The longest matching prefix prices a row.
export const PRICES = {
  'claude-fable-5-1': [10, 50, 0.25], 'claude-mythos-5-1': [10, 50, 0.25], 'claude-fable-5': [10, 50, 1], 'claude-mythos-5': [10, 50, 1],
  'claude-opus-5-5': [4, 20, 0.2], 'claude-opus-5': [5, 25, 0.5],
  'claude-opus-4-8': [5, 25, 0.5], 'claude-opus-4-7': [5, 25, 0.5], 'claude-opus-4-6': [5, 25, 0.5], 'claude-opus-4-5': [5, 25, 0.5],
  'claude-opus-4-1': [15, 75, 1.5], 'claude-opus-4': [15, 75, 1.5],
  'claude-sonnet-5-5': [2, 10, 0.2], 'claude-sonnet-5': [2, 10, 0.2],
  'claude-sonnet-4-6': [3, 15, 0.3], 'claude-sonnet-4-5': [3, 15, 0.3], 'claude-sonnet-4': [3, 15, 0.3],
  'claude-haiku-5-5': [0.1, 0.5, 0.01], 'claude-haiku-4-5': [1, 5, 0.1], 'claude-3-5-haiku': [0.8, 4, 0.08],
}
const PREFIXES = Object.keys(PRICES).sort((a, b) => b.length - a.length)
const WORKTREES = '/.claude/worktrees/'
const GRAPH_TOOL = 'mcp__codebase-memory'
const GRAPH_SERVER = '"invocation":{"server":"codebase-memory'
const PROVIDERS = ['claude', 'codex', 'all']

const localDay = (d) => d.toLocaleDateString('sv-SE')
const validDay = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s) && localDay(new Date(`${s}T00:00:00`)) === s

const FIELDS = ['input', 'output', 'cacheWrite', 'cacheRead', 'tokens', 'cost', 'messages']
const blank = () => Object.fromEntries(FIELDS.map((k) => [k, 0]))
const plus = (a, b) => Object.fromEntries(FIELDS.map((k) => [k, a[k] + b[k]]))
const bump = (map, key, s) => map.set(key, map.has(key) ? plus(map.get(key), s) : s)
const ranked = (map, name) => [...map].map(([key, s]) => ({ [name]: key, ...s })).sort((a, b) => b.tokens - a.tokens)

const n = (v) => Number(v) || 0
const hit = (s) => { const reads = s.input + s.cacheWrite + s.cacheRead; return reads ? s.cacheRead / reads : 0 }
// Cache writes cost 1.25 × input for 5 minutes and 2 × for 1 hour. Without the breakdown, all writes cost 1.25 ×. Fast speed doubles the row.
const rowSums = (u, price) => {
  const [pin, pout, pread] = price ?? [0, 0, 0]
  const [e5, e1] = [n(u.cache_creation?.ephemeral_5m_input_tokens), n(u.cache_creation?.ephemeral_1h_input_tokens)]
  const cacheWrite = n(u.cache_creation_input_tokens) || e5 + e1
  const [input, output, cacheRead] = [n(u.input_tokens), n(u.output_tokens), n(u.cache_read_input_tokens)]
  const write = e5 + e1 ? e5 * 1.25 + e1 * 2 : cacheWrite * 1.25
  const cost = (input * pin + output * pout + cacheRead * pread + write * pin) / 1e6 * (u.speed === 'fast' ? 2 : 1)
  return { input, output, cacheWrite, cacheRead, tokens: input + output + cacheWrite + cacheRead, cost, messages: 1 }
}

// The repo root of a cwd: cut at a Claude worktree dir, else the parent of the git common dir, else the cwd itself.
const repoOf = (cwd, cache) => {
  if (!cache.has(cwd)) {
    const cut = cwd.indexOf(WORKTREES)
    const git = cut < 0 ? run('git', ['-C', cwd, 'rev-parse', '--path-format=absolute', '--git-common-dir'], { timeout: 5000 }) : null
    cache.set(cwd, cut >= 0 ? cwd.slice(0, cut) : git.ok && git.out.endsWith('/.git') ? dirname(git.out) : cwd)
  }
  return cache.get(cwd)
}

// Linear interpolation between the two nearest values of an ascending list, rounded to a whole token.
const quantile = (asc, p) => {
  const at = (asc.length - 1) * p
  const [lo, hi] = [Math.floor(at), Math.ceil(at)]
  return asc.length ? Math.round(asc[lo] + (asc[hi] - asc[lo]) * (at - lo)) : 0
}
const spread = (rows) => {
  const asc = rows.map((r) => r.tokens).sort((a, b) => a - b)
  return { count: asc.length, median: quantile(asc, 0.5), p90: quantile(asc, 0.9) }
}

const parseRow = (line) => {
  let d
  try { d = JSON.parse(line) } catch { return null }
  const m = d?.message
  const at = new Date(d?.timestamp)
  if (!m?.usage || typeof m.model !== 'string' || m.model === '<synthetic>' || Number.isNaN(at.getTime())) return null
  const graph = Array.isArray(m.content) && m.content.some((c) => c?.type === 'tool_use' && String(c.name).startsWith(GRAPH_TOOL))
  return { key: m.id && d.requestId ? `${m.id}:${d.requestId}` : null, day: localDay(at), cwd: d.cwd || '(unknown)', model: m.model, side: d.isSidechain === true, usage: m.usage, session: d.sessionId || '(unknown)', graph }
}

const json = (line) => { try { return JSON.parse(line) } catch { return null } }

const claudeRows = (base, first) => {
  const files = walk(base).filter((f) => f.endsWith('.jsonl') && statSync(join(base, f)).mtimeMs >= first)
  const [best, loose, graphSessions] = [new Map(), [], new Set()]
  let lines = 0
  for (const file of files) {
    for (const line of readFileSync(join(base, file), 'utf8').split('\n')) {
      if (!line.trim()) continue
      lines++
      const row = line.includes('"usage"') ? parseRow(line) : null
      if (!row) continue
      if (row.graph) graphSessions.add(row.session)
      if (!row.key) loose.push(row)
      else if ((best.get(row.key)?.usage.output_tokens ?? -1) < (row.usage.output_tokens ?? 0)) best.set(row.key, row)
    }
  }
  return { rows: [...best.values(), ...loose].map((row) => ({ ...row, provider: 'claude', graph: graphSessions.has(row.session) })), files: files.length, lines }
}

// The row of one Codex file, or null. input_tokens holds the cached part, so the fresh input is input_tokens − cached_input_tokens.
// output_tokens holds the reasoning tokens (total_tokens is input_tokens + output_tokens). An old file has only total_tokens: that count is input.
// cache_write_input_tokens is 0 in every file, so it is not read. A step is a change of total_tokens. A repeated event is not a step.
const codexRow = (lines, graph) => {
  let [meta, context, total, steps] = [null, null, null, 0]
  for (const line of lines) {
    if (line.includes('"type":"session_meta"')) meta ??= json(line)?.payload
    else if (line.includes('"type":"turn_context"')) context = line
    else if (line.includes('"token_count"')) {
      const p = json(line)?.payload
      const t = p?.type === 'token_count' ? p.info?.total_token_usage : null
      if (!t) continue
      if (n(t.total_tokens) !== n(total?.total_tokens)) steps++
      total = t
    }
  }
  const at = new Date(meta?.timestamp)
  if (!total || !n(total.total_tokens) || Number.isNaN(at.getTime())) return null
  const [input, cached, output] = [n(total.input_tokens), n(total.cached_input_tokens), n(total.output_tokens)]
  const model = json(context)?.payload?.model
  return {
    key: null, provider: 'codex', day: localDay(at), cwd: meta.cwd || '(unknown)', model: typeof model === 'string' && model ? model : '(unknown)', side: Boolean(meta.source?.subagent),
    usage: { input_tokens: input - cached + Math.max(0, n(total.total_tokens) - input - output), output_tokens: output, cache_read_input_tokens: cached },
    session: meta.id || '(unknown)', graph, messages: steps,
  }
}

const codexRows = (base, first) => {
  const files = walk(base).filter((f) => /(^|\/)rollout-[^/]*\.jsonl$/.test(f) && statSync(join(base, f)).mtimeMs >= first)
  let lines = 0
  const rows = files.flatMap((file) => {
    const text = readFileSync(join(base, file), 'utf8')
    const rowLines = text.split('\n').filter((l) => l.trim())
    lines += rowLines.length
    return codexRow(rowLines, text.includes(GRAPH_SERVER)) ?? []
  })
  return { rows, files: files.length, lines }
}

const codexBase = (home) => join(home === undefined ? process.env.CODEX_HOME || join(homedir(), '.codex') : join(home, '.codex'), 'sessions')

// since and until are inclusive local days (YYYY-MM-DD). until is today when it is not set. project is a repo root: other rows are skipped.
// provider is claude, codex or all. A file that was last written before the first day holds no row of the window, so it is not read.
// A home that is given moves both folders: <home>/.claude/projects and <home>/.codex/sessions. Without it, CODEX_HOME moves the Codex one.
export const readUsage = ({ home, since, until, project: only, provider = 'all', now = new Date() } = {}) => {
  const first = since ? new Date(`${since}T00:00:00`).getTime() : 0
  const last = until ?? localDay(now)
  const sources = [
    provider !== 'codex' && claudeRows(join(home ?? homedir(), '.claude/projects'), first),
    provider !== 'claude' && codexRows(codexBase(home), first),
  ].filter(Boolean)
  const unknown = new Set()
  const [repos, days, projects, models, sessions, providers] = [new Map(), new Map(), new Map(), new Map(), new Map(), new Map()]
  let totals = blank()
  let side = 0
  for (const row of sources.flatMap((x) => x.rows)) {
    const project = repoOf(row.cwd, repos)
    if ((since && row.day < since) || row.day > last || (only && project !== only)) continue
    const price = PREFIXES.find((p) => row.model.startsWith(p))
    if (!price) unknown.add(row.model)
    const s = { ...rowSums(row.usage, PRICES[price]), messages: row.messages ?? 1 }
    totals = plus(totals, s)
    if (row.side) side += s.tokens
    bump(days, row.day, s)
    bump(projects, project, s)
    bump(models, row.model, s)
    bump(providers, row.provider, s)
    const key = `${row.provider}:${row.session}`
    const prev = sessions.get(key)
    sessions.set(key, prev
      ? { ...prev, ...plus(prev, s), first: row.day < prev.first ? row.day : prev.first, last: row.day > prev.last ? row.day : prev.last }
      : { session: row.session, provider: row.provider, project, first: row.day, last: row.day, graph: row.graph, ...s })
  }
  const bySession = [...sessions.values()].map((r) => ({ ...r, cacheHit: hit(r) })).sort((a, b) => b.tokens - a.tokens)
  return {
    totals,
    byDay: ranked(days, 'day').sort((a, b) => (a.day < b.day ? -1 : 1)),
    byProject: ranked(projects, 'project'),
    byModel: ranked(models, 'model'),
    byProvider: ranked(providers, 'provider'),
    bySession,
    sessionSummary: { graph: spread(bySession.filter((r) => r.graph)), noGraph: spread(bySession.filter((r) => !r.graph)) },
    cacheHit: hit(totals),
    subagentShare: totals.tokens ? side / totals.tokens : 0,
    unknownModels: [...unknown].sort(),
    files: sources.reduce((sum, x) => sum + x.files, 0),
    lines: sources.reduce((sum, x) => sum + x.lines, 0),
  }
}

const HELP = `Usage: ac usage [--by session] [--provider claude|codex|all] [--project <root>] [--since YYYY-MM-DD] [--until YYYY-MM-DD] [--json]

Read the Claude Code transcripts in ~/.claude/projects and the Codex sessions in ~/.codex/sessions
(CODEX_HOME moves the Codex folder). Show tokens, cost and cache use by provider, day, project and
model. A cost is the list price. A day is a local day. A Codex model has no price yet, so its cost is 0.
  --by session  One row for each session. A graph session called a codebase-memory MCP tool.
                The summary has the count, the median and the p90 of tokens for graph and no-graph sessions.
  --provider    Count only claude or only codex. The default is all.
  --project     Count only the sessions of this repository root (a worktree counts for its root).
  --since       First day to count. The default is the first day in the transcripts.
  --until       Last day to count. The default is today.
  --json        Print the result as JSON. It always holds bySession and byProvider.`

const fmt = (v) => Math.round(v).toLocaleString('en-US')
const share = (v) => `${(v * 100).toFixed(1)}%`
const line = (r, key) => `  ${String(r[key]).padEnd(44)} ${fmt(r.tokens).padStart(14)} tokens  $${r.cost.toFixed(2)}`

const print = (u) => {
  const t = u.totals
  const days = [...u.byDay].reverse()
  console.log([
    `ac usage: ${days.length ? `${days.at(-1).day} to ${days[0].day}` : 'no data'} (${u.files} files, ${u.lines} lines)`,
    `  tokens     ${fmt(t.tokens)}  (input ${fmt(t.input)}, output ${fmt(t.output)}, cache write ${fmt(t.cacheWrite)}, cache read ${fmt(t.cacheRead)})`,
    `  cost       $${t.cost.toFixed(2)}  (${fmt(t.messages)} messages)`,
    `  cache hit  ${share(u.cacheHit)}   sub-agent share ${share(u.subagentShare)}`,
    ...[['By provider', u.byProvider, 'provider'], ['By model', u.byModel, 'model'], ['By project', u.byProject, 'project'], ['By day', days, 'day']]
      .flatMap(([title, rows, key]) => [`${title} (${Math.min(5, rows.length)} of ${rows.length})`, ...rows.slice(0, 5).map((r) => line(r, key))]),
    ...(u.unknownModels.length ? [`No price for: ${u.unknownModels.join(', ')}. Their cost counts as 0.`] : []),
  ].join('\n'))
}

const printSessions = (u) => {
  const rows = u.bySession.slice(0, 10)
  const group = (label, g) => `  ${label.padEnd(9)} ${String(g.count).padStart(4)} sessions  median ${fmt(g.median)} tokens  p90 ${fmt(g.p90)} tokens`
  console.log([
    `ac usage --by session: ${u.bySession.length} sessions`,
    group('graph', u.sessionSummary.graph),
    group('no graph', u.sessionSummary.noGraph),
    `Largest sessions (${rows.length} of ${u.bySession.length})`,
    ...rows.map((r) => `  ${basename(r.project).slice(0, 24).padEnd(24)} ${r.first} to ${r.last}  ${r.messages} msgs  ${fmt(r.tokens)} tokens  $${r.cost.toFixed(2)}  cache ${share(r.cacheHit)}${r.graph ? '  graph' : ''}  ${r.provider}`),
  ].join('\n'))
}

export const cli = (argv) => {
  const { values: v, positionals, exit } = parseCommand(argv, HELP, { by: { type: 'string' }, provider: { type: 'string' }, project: { type: 'string' }, since: { type: 'string' }, until: { type: 'string' }, json: { type: 'boolean' } })
  if (exit !== undefined) return exit
  if (positionals.length) return usageError(HELP, `Unexpected argument: ${positionals[0]}`)
  const bad = [['--since', v.since], ['--until', v.until]].find(([, day]) => day !== undefined && !validDay(day))
  if (bad) return usageError(HELP, `${bad[0]} needs a date as YYYY-MM-DD.`)
  if (v.by !== undefined && v.by !== 'session') return usageError(HELP, '--by needs the value session.')
  if (v.provider !== undefined && !PROVIDERS.includes(v.provider)) return usageError(HELP, '--provider needs claude, codex or all.')
  const result = readUsage({ since: v.since, until: v.until, provider: v.provider, project: v.project === undefined ? undefined : resolve(v.project) })
  if (v.json) console.log(JSON.stringify({ ok: true, ...result }, null, 2))
  else if (v.by) printSessions(result)
  else print(result)
  return 0
}

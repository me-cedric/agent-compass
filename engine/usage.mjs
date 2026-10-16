// usage.mjs — ac usage: tokens, cost and cache use from the Claude Code transcripts in <home>/.claude/projects and
// the Codex sessions in <codex home>/sessions (CODEX_HOME moves <home>/.codex).
// A Claude row counts once per "<message.id>:<requestId>": streaming writes one line per content block, and the line with
// the largest output count is the full one. A Codex file is one row: its last total_token_usage, on the local day of its start.
// A day is a local day. A cost is in USD at list price. A Codex model has no price yet, so its cost is 0.
// A session is the sessionId of the lines (a sub-agent has the sessionId of its parent) or a Codex file. It is a "graph" session when
// any of its lines calls a tool of a codebase-memory MCP server, or when Claude Code attributes a line to that server (attributionMcpServer).
// A Claude session also counts its tool calls (one count for each tool_use id), the searches before its first edit, the fresh tokens
// (input + cache write + output) per message, its hook errors (hook_non_blocking_error and hook_cancelled attachments), its guard fires
// (a tool result with is_error that holds a compass guard message) and its stop blocks (a "Stop hook feedback" meta line, or a
// stop_hook_summary with preventedContinuation). A Codex session has 0 for these counts.

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
const WORKTREES = /[\\/]\.claude[\\/]worktrees[\\/]/
const GRAPH_TOOL = 'mcp__codebase-memory'
const GRAPH_MCP = 'codebase-memory'
const SEARCH_TOOLS = new Set(['Grep', 'Glob', 'Read'])
const EDIT_TOOLS = new Set(['Edit', 'Write', 'MultiEdit', 'NotebookEdit', 'apply_patch'])
const SEARCH_COMMAND = /(^|[\s|;&(])(rg|grep|find)\s/
const GUARD = /compass: the (read of|edit of|command|tool) /
const HOOK_ERRORS = new Set(['hook_non_blocking_error', 'hook_cancelled'])
const STOP_FEEDBACK = 'Stop hook feedback'
const BYS = ['session', 'skill', 'branch']
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
    const cut = cwd.search(WORKTREES)
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
const ascending = (values) => [...values].sort((a, b) => a - b)
const spread = (rows) => {
  const asc = ascending(rows.map((r) => r.tokens))
  const searches = ascending(rows.filter((r) => r.searchesBeforeEdit !== null).map((r) => r.searchesBeforeEdit))
  return {
    count: asc.length, median: quantile(asc, 0.5), p90: quantile(asc, 0.9), edited: searches.length,
    searchesBeforeEdit: searches.length ? quantile(searches, 0.5) : null, freshPerMessage: quantile(ascending(rows.map((r) => r.freshPerMessage)), 0.5),
  }
}

const parseRow = (d) => {
  const m = d?.message
  const at = new Date(d?.timestamp)
  if (!m?.usage || typeof m.model !== 'string' || m.model === '<synthetic>' || Number.isNaN(at.getTime())) return null
  const graph = String(d.attributionMcpServer).startsWith(GRAPH_MCP) ||
    (Array.isArray(m.content) && m.content.some((c) => c?.type === 'tool_use' && String(c.name).startsWith(GRAPH_TOOL)))
  return {
    key: m.id && d.requestId ? `${m.id}:${d.requestId}` : null, t: at.getTime(), day: localDay(at), cwd: d.cwd || '(unknown)', model: m.model, side: d.isSidechain === true,
    usage: m.usage, session: d.sessionId || '(unknown)', graph, branch: d.gitBranch || '(none)', effort: typeof d.effort === 'string' ? d.effort : null,
  }
}

const json = (line) => { try { return JSON.parse(line) } catch { return null } }

const toolKind = (c) => (c.name.startsWith(GRAPH_TOOL) ? 'graph' : EDIT_TOOLS.has(c.name) ? 'edit' : c.name === 'Skill' ? 'skill'
  : SEARCH_TOOLS.has(c.name) || (c.name === 'Bash' && SEARCH_COMMAND.test(String(c.input?.command ?? ''))) ? 'search' : null)
const textOf = (content) => (typeof content === 'string' ? content
  : Array.isArray(content) ? content.map((c) => (typeof c?.text === 'string' ? c.text : '')).join('\n') : '')

// The counted events of one parsed line. An id makes each event count once, also when a line is written twice.
const lineEvents = (d) => {
  const c = d.message?.content
  const base = { session: d.sessionId || '(unknown)', t: new Date(d.timestamp).getTime() }
  const one = (kind, id) => (id ? [{ ...base, kind, id: `${kind}:${id}` }] : [])
  if (Number.isNaN(base.t)) return []
  if (d.type === 'assistant' && Array.isArray(c)) {
    return c.filter((x) => x?.type === 'tool_use' && typeof x.name === 'string' && x.id).flatMap((x) => {
      const kind = toolKind(x)
      return kind ? [{ ...base, kind, id: `tool:${x.id}`, skill: kind === 'skill' ? String(x.input?.skill || '(unknown)') : undefined }] : []
    })
  }
  if (d.type === 'attachment') return HOOK_ERRORS.has(d.attachment?.type) ? one('hook', d.uuid) : []
  if (d.type === 'system') return d.subtype === 'stop_hook_summary' && d.preventedContinuation === true ? one('stop', d.uuid) : []
  if (d.type !== 'user') return []
  if (Array.isArray(c) && c.some((x) => x?.type === 'tool_result')) {
    return c.filter((x) => x?.type === 'tool_result' && x.is_error === true && GUARD.test(textOf(x.content))).flatMap((x) => one('guard', x.tool_use_id))
  }
  if (d.isMeta) return typeof c === 'string' && c.startsWith(STOP_FEEDBACK) ? one('stop', d.uuid) : []
  const prompt = !d.isSidechain && (typeof c === 'string' || (Array.isArray(c) && c.some((x) => x?.type === 'text')))
  return prompt ? one('prompt', d.uuid) : []
}

// A line is parsed only when it can hold a row or an event. A tool result is parsed only when it can hold a guard fire.
const wanted = (line) => line.includes('"usage"') || line.includes('hook_non_blocking_error') || line.includes('hook_cancelled') ||
  line.includes('stop_hook_summary') ||
  (line.includes('"type":"user"') && (!line.includes('"tool_result"') || (line.includes('"is_error":true') && line.includes('compass: the '))))

const claudeRows = (base, first) => {
  const files = walk(base).filter((f) => f.endsWith('.jsonl') && statSync(join(base, f)).mtimeMs >= first)
  const [best, loose, graphSessions, events] = [new Map(), [], new Set(), new Map()]
  let lines = 0
  for (const file of files) {
    for (const line of readFileSync(join(base, file), 'utf8').split('\n')) {
      if (!line.trim()) continue
      lines++
      const d = wanted(line) ? json(line) : null
      if (!d) continue
      for (const e of lineEvents(d)) if (!events.has(`${e.session}\0${e.id}`)) events.set(`${e.session}\0${e.id}`, e)
      const row = parseRow(d)
      if (!row) continue
      if (row.graph) graphSessions.add(row.session)
      if (!row.key) loose.push(row)
      else if ((best.get(row.key)?.usage.output_tokens ?? -1) < (row.usage.output_tokens ?? 0)) best.set(row.key, row)
    }
  }
  return { rows: [...best.values(), ...loose].map((row) => ({ ...row, provider: 'claude', graph: graphSessions.has(row.session) })), events: [...events.values()], files: files.length, lines }
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
    key: null, provider: 'codex', t: at.getTime(), day: localDay(at), branch: '(none)', effort: null, cwd: meta.cwd || '(unknown)', model: typeof model === 'string' && model ? model : '(unknown)', side: Boolean(meta.source?.subagent),
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

// The counts of one session from its events in the window. A search before the first edit counts in the order of time.
const counts = (events) => {
  const tools = events.filter((e) => e.kind !== 'prompt')
  const edit = tools.findIndex((e) => e.kind === 'edit')
  const of = (kind, list = tools) => list.filter((e) => e.kind === kind).length
  return {
    graphCalls: of('graph'), searchCalls: of('search'), editCalls: of('edit'), skillCalls: of('skill'),
    searchesBeforeEdit: edit < 0 ? null : of('search', tools.slice(0, edit)), hookErrors: of('hook'), guardFires: of('guard'), stopBlocks: of('stop'),
  }
}
const NO_COUNTS = { graphCalls: 0, searchCalls: 0, editCalls: 0, skillCalls: 0, searchesBeforeEdit: null, hookErrors: 0, guardFires: 0, stopBlocks: 0 }

// The skill of each row: the last Skill call before the row, when no user prompt comes between them.
const skillTokens = (marks, rows, map) => {
  let [i, active] = [0, null]
  for (const r of rows) {
    for (; i < marks.length && marks[i].t < r.t; i++) active = marks[i].kind === 'skill' ? marks[i].skill : null
    if (active) bump(map, active, r.s)
  }
}

const byTime = (a, b) => a.t - b.t
// A local list grows in place: a copy for each item costs quadratic time on a long session.
const group = (list, key) => list.reduce((map, x) => { (map.get(key(x)) ?? map.set(key(x), []).get(key(x))).push(x); return map }, new Map())

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
  const [repos, days, projects, models, sessions, providers, branches, skills] = [new Map(), new Map(), new Map(), new Map(), new Map(), new Map(), new Map(), new Map()]
  const kept = []
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
    bump(branches, `${project}\0${row.branch}`, s)
    kept.push({ ...row, s })
    const key = `${row.provider}:${row.session}`
    const prev = sessions.get(key)
    sessions.set(key, prev
      ? { ...prev, ...plus(prev, s), first: row.day < prev.first ? row.day : prev.first, last: row.day > prev.last ? row.day : prev.last }
      : { session: row.session, provider: row.provider, project, first: row.day, last: row.day, graph: row.graph, ...s })
  }
  const inWindow = (e) => !(since && localDay(new Date(e.t)) < since) && localDay(new Date(e.t)) <= last
  const events = group(sources.flatMap((x) => x.events ?? []).sort(byTime), (e) => e.session)
  const rowsOf = group(kept.filter((r) => r.provider === 'claude').sort(byTime), (r) => r.session)
  for (const [session, rows] of rowsOf) skillTokens((events.get(session) ?? []).filter((e) => e.kind === 'skill' || e.kind === 'prompt'), rows, skills)
  const bySession = [...sessions.values()].map((r) => {
    const rows = r.provider === 'claude' ? rowsOf.get(r.session) ?? [] : []
    return {
      ...r, cacheHit: hit(r), effort: rows.findLast((x) => x.effort)?.effort ?? null,
      freshPerMessage: r.messages ? Math.round((r.input + r.cacheWrite + r.output) / r.messages) : 0,
      ...(r.provider === 'claude' ? counts((events.get(r.session) ?? []).filter(inWindow)) : NO_COUNTS),
    }
  }).sort((a, b) => b.tokens - a.tokens)
  const total = (k) => bySession.reduce((sum, r) => sum + r[k], 0)
  return {
    totals,
    byDay: ranked(days, 'day').sort((a, b) => (a.day < b.day ? -1 : 1)),
    byProject: ranked(projects, 'project'),
    byModel: ranked(models, 'model'),
    byProvider: ranked(providers, 'provider'),
    bySession,
    bySkill: ranked(skills, 'skill'),
    byBranch: [...branches].map(([key, s]) => ({ project: key.split('\0')[0], branch: key.split('\0')[1], ...s })).sort((a, b) => b.tokens - a.tokens),
    hooks: { errors: total('hookErrors'), guardFires: total('guardFires'), stopBlocks: total('stopBlocks') },
    sessionSummary: { graph: spread(bySession.filter((r) => r.graph)), noGraph: spread(bySession.filter((r) => !r.graph)) },
    cacheHit: hit(totals),
    subagentShare: totals.tokens ? side / totals.tokens : 0,
    unknownModels: [...unknown].sort(),
    files: sources.reduce((sum, x) => sum + x.files, 0),
    lines: sources.reduce((sum, x) => sum + x.lines, 0),
  }
}

const HELP = `Usage: ac usage [--by session|skill|branch] [--provider claude|codex|all] [--project <root>] [--since YYYY-MM-DD] [--until YYYY-MM-DD] [--json]

Read the Claude Code transcripts in ~/.claude/projects and the Codex sessions in ~/.codex/sessions
(CODEX_HOME moves the Codex folder). Show tokens, cost and cache use by provider, day, project and
model. A cost is the list price. A day is a local day. A Codex model has no price yet, so its cost is 0.
  --by session  One row for each session. A graph session called a codebase-memory MCP tool.
                The summary has the count, the median and the p90 of tokens for graph and no-graph sessions,
                the median of the searches before the first edit and the median of the fresh tokens per message.
                A fresh token is an input, cache write or output token. A search is a Grep, Glob or Read call,
                or a Bash call with rg, grep or find. The hooks line counts hook errors, guard fires and stop blocks.
  --by skill    Tokens for each skill: from a Skill call to the next user prompt.
  --by branch   Tokens for each project and git branch.
  --provider    Count only claude or only codex. The default is all.
  --project     Count only the sessions of this repository root (a worktree counts for its root).
  --since       First day to count. The default is the first day in the transcripts.
  --until       Last day to count. The default is today.
  --json        Print the result as JSON. It always holds bySession, bySkill, byBranch, hooks and byProvider.`

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
  const group = (label, g) => `  ${label.padEnd(9)} ${String(g.count).padStart(4)} sessions  median ${fmt(g.median)} tokens  p90 ${fmt(g.p90)} tokens` +
    `  searches before edit ${g.searchesBeforeEdit ?? '-'}  fresh/msg ${fmt(g.freshPerMessage)}`
  console.log([
    `ac usage --by session: ${u.bySession.length} sessions`,
    group('graph', u.sessionSummary.graph),
    group('no graph', u.sessionSummary.noGraph),
    `  hooks: ${u.hooks.errors} errors, ${u.hooks.guardFires} guard fires, ${u.hooks.stopBlocks} stop blocks`,
    `Largest sessions (${rows.length} of ${u.bySession.length})`,
    ...rows.map((r) => `  ${basename(r.project).slice(0, 24).padEnd(24)} ${r.first} to ${r.last}  ${r.messages} msgs  ${fmt(r.tokens)} tokens  $${r.cost.toFixed(2)}  cache ${share(r.cacheHit)}` +
      `${r.graph ? '  graph' : ''}  ${r.provider}  fresh/msg ${fmt(r.freshPerMessage)}  searches ${r.searchCalls}  edits ${r.editCalls}`),
  ].join('\n'))
}

const printRows = (title, rows, label) => console.log([`ac usage --by ${title}: ${rows.length} rows`, ...rows.slice(0, 20).map((r) => line({ ...r, label: label(r) }, 'label'))].join('\n'))

export const cli = (argv) => {
  const { values: v, positionals, exit } = parseCommand(argv, HELP, { by: { type: 'string' }, provider: { type: 'string' }, project: { type: 'string' }, since: { type: 'string' }, until: { type: 'string' }, json: { type: 'boolean' } })
  if (exit !== undefined) return exit
  if (positionals.length) return usageError(HELP, `Unexpected argument: ${positionals[0]}`)
  const bad = [['--since', v.since], ['--until', v.until]].find(([, day]) => day !== undefined && !validDay(day))
  if (bad) return usageError(HELP, `${bad[0]} needs a date as YYYY-MM-DD.`)
  if (v.by !== undefined && !BYS.includes(v.by)) return usageError(HELP, '--by needs session, skill or branch.')
  if (v.provider !== undefined && !PROVIDERS.includes(v.provider)) return usageError(HELP, '--provider needs claude, codex or all.')
  const result = readUsage({ since: v.since, until: v.until, provider: v.provider, project: v.project === undefined ? undefined : resolve(v.project) })
  if (v.json) console.log(JSON.stringify({ ok: true, ...result }, null, 2))
  else if (v.by === 'session') printSessions(result)
  else if (v.by === 'skill') printRows('skill', result.bySkill, (r) => r.skill)
  else if (v.by === 'branch') printRows('branch', result.byBranch, (r) => `${basename(r.project).slice(0, 20)}  ${r.branch}`)
  else print(result)
  return 0
}

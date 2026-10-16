import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { PRICES, readUsage } from '../engine/usage.mjs'
import { runNode } from './helpers.mjs'

const REPO = dirname(dirname(fileURLToPath(import.meta.url)))
const temps = []
test.after(() => { for (const dir of temps) rmSync(dir, { recursive: true, force: true }) })
const temp = (prefix) => {
  const dir = mkdtempSync(join(tmpdir(), prefix))
  temps.push(dir)
  return dir
}

// Local noon, so the local day is the same in every time zone.
const at = (month, day) => new Date(2026, month - 1, day, 12).toISOString()
const row = (over, message, usage) => JSON.stringify({
  type: 'assistant', timestamp: at(3, 10), cwd: '/x/repo', requestId: 'r1', ...over, message: { id: 'm1', model: 'claude-sonnet-4-6', usage, ...message },
})
const put = (home, rel, lines) => {
  mkdirSync(dirname(join(home, '.claude/projects', rel)), { recursive: true })
  writeFileSync(join(home, '.claude/projects', rel), `${lines.join('\n')}\n`)
}

const A = row({}, {}, {
  input_tokens: 1000, output_tokens: 500, cache_read_input_tokens: 2000, cache_creation_input_tokens: 400,
  cache_creation: { ephemeral_5m_input_tokens: 100, ephemeral_1h_input_tokens: 300 },
})
const B = row({ timestamp: at(3, 11), requestId: 'r2', cwd: '/x/repo/.claude/worktrees/w1' }, { id: 'm2', model: 'claude-haiku-4-5-20251001' }, {
  input_tokens: 100, output_tokens: 100, cache_read_input_tokens: 1000, cache_creation_input_tokens: 80,
})
const C = row({ timestamp: at(2, 1), requestId: 'r3' }, { id: 'm3', model: 'claude-opus-5' }, { input_tokens: 1000, output_tokens: 0 })
const D = row({ isSidechain: true, requestId: 'r4' }, { id: 'm4' }, { input_tokens: 1000, output_tokens: 1000, speed: 'fast' })
const E = row({ requestId: 'r5' }, { id: 'm5', model: 'claude-unknown-9' }, { input_tokens: 10, output_tokens: 10 })
const F = row({ timestamp: at(3, 11), requestId: undefined, cwd: '/y/other' }, { id: 'm6', model: 'claude-opus-4-8' }, { input_tokens: 100, output_tokens: 0 })
const G = row({ timestamp: at(4, 5), requestId: 'r7' }, { id: 'm7' }, { input_tokens: 1, output_tokens: 1 })

const makeHome = () => {
  const home = temp('ac-usage-home-')
  put(home, '-x-repo/s1.jsonl', [
    'not json',
    JSON.stringify({ type: 'user', timestamp: at(3, 10), message: { role: 'user', content: 'hi' } }),
    // Streaming writes one line per content block. The first line has a partial output count; the full row wins.
    row({ cwd: '/z/dup' }, {}, { ...JSON.parse(A).message.usage, output_tokens: 7 }),
    A,
    row({ cwd: '/z/dup' }, {}, { ...JSON.parse(A).message.usage, output_tokens: 500 }),
    row({ requestId: 'r9' }, { id: 'm9', model: '<synthetic>' }, { input_tokens: 5, output_tokens: 5 }),
    B, C, G,
  ])
  put(home, '-x-repo/s1/subagents/agent-a.jsonl', [D, E, F, F])
  return home
}

const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} is not ${expected}`)
const sums = (o) => [o.input, o.output, o.cacheWrite, o.cacheRead, o.tokens, o.messages]
const window = { since: '2026-03-01', until: '2026-03-31', now: new Date(2026, 2, 31, 12) }

test('PRICES: the table holds [input, output, cacheRead] per model id prefix', () => {
  assert.deepEqual(PRICES['claude-opus-5'], [5, 25, 0.5])
  assert.deepEqual(PRICES['claude-opus-5-5'], [4, 20, 0.2])
  assert.deepEqual(PRICES['claude-sonnet-4-6'], [3, 15, 0.3])
  assert.deepEqual(PRICES['claude-haiku-4-5'], [1, 5, 0.1])
  assert.deepEqual(PRICES['claude-3-5-haiku'], [0.8, 4, 0.08])
})

test('readUsage: dedupe, synthetic rows, cache writes, fast speed, window and totals', () => {
  const u = readUsage({ home: makeHome(), ...window })
  assert.equal(u.files, 2)
  assert.equal(u.lines, 13)
  assert.deepEqual(sums(u.totals), [2310, 1610, 480, 3000, 7400, 6])
  // A: 1000 in, 500 out, 2000 read, 100 5m + 300 1h writes. B: 80 writes without a breakdown. D: fast. F twice: no requestId, no dedupe.
  close(u.totals.cost, 0.013275 + 0.0008 + 0.036 + 0 + 0.001)
  close(u.cacheHit, 3000 / (2310 + 480 + 3000))
  close(u.subagentShare, 2000 / 7400)
  assert.deepEqual(u.unknownModels, ['claude-unknown-9'])

  assert.deepEqual(u.byDay.map((d) => [d.day, d.tokens, d.messages]), [['2026-03-10', 5920, 3], ['2026-03-11', 1480, 3]])
  close(u.byDay[0].cost, 0.049275)
  assert.deepEqual(u.byProject.map((p) => [p.project, p.tokens, p.messages]), [['/x/repo', 7200, 4], ['/y/other', 200, 2]])
  assert.deepEqual(u.byModel.map((m) => [m.model, m.tokens, m.messages]), [
    ['claude-sonnet-4-6', 5900, 2], ['claude-haiku-4-5-20251001', 1280, 1], ['claude-opus-4-8', 200, 2], ['claude-unknown-9', 20, 1],
  ])
  close(u.byModel[0].cost, 0.049275)
  assert.equal(u.byModel[3].cost, 0)
})

test('readUsage: since and until are inclusive local days; until defaults to today', () => {
  const home = makeHome()
  assert.deepEqual(readUsage({ home, since: '2026-03-10', until: '2026-03-10' }).byDay.map((d) => d.day), ['2026-03-10'])
  assert.deepEqual(readUsage({ home, until: '2026-03-10' }).byDay.map((d) => d.day), ['2026-02-01', '2026-03-10'])
  assert.deepEqual(readUsage({ home, since: '2026-03-11', until: '2026-12-31' }).byDay.map((d) => d.day), ['2026-03-11', '2026-04-05'])
  assert.deepEqual(readUsage({ home, now: new Date(2026, 2, 15, 12) }).byDay.map((d) => d.day), ['2026-02-01', '2026-03-10', '2026-03-11'])
})

test('readUsage: a home without transcripts gives zero totals', () => {
  const u = readUsage({ home: temp('ac-usage-empty-'), ...window })
  assert.deepEqual([u.files, u.lines, u.totals.tokens, u.totals.cost, u.cacheHit, u.subagentShare], [0, 0, 0, 0, 0, 0])
  assert.deepEqual([u.byDay, u.byProject, u.byModel, u.unknownModels], [[], [], [], []])
})

test('readUsage: the longest model prefix prices a row', () => {
  const home = temp('ac-usage-prefix-')
  const one = (model, id) => row({ requestId: id }, { id, model }, { input_tokens: 1_000_000, output_tokens: 0 })
  put(home, 'p/s.jsonl', [one('claude-opus-5-5-20260101', 'a'), one('claude-opus-5-20260101', 'b'), one('claude-opus-4-1-2025', 'c'), one('claude-opus-4-8', 'd'), one('claude-sonnet-5-5', 'e'), one('claude-sonnet-5', 'f')])
  const cost = Object.fromEntries(readUsage({ home, until: '2026-12-31' }).byModel.map((m) => [m.model, m.cost]))
  assert.deepEqual(cost, {
    'claude-opus-5-5-20260101': 4, 'claude-opus-5-20260101': 5, 'claude-opus-4-1-2025': 15, 'claude-opus-4-8': 5, 'claude-sonnet-5-5': 2, 'claude-sonnet-5': 2,
  })
})

test('readUsage: a project is the repo root of the cwd', () => {
  const dir = realpathSync(temp('ac-usage-git-'))
  const git = (...args) => spawnSync('git', args, { cwd: join(dir, 'repo'), encoding: 'utf8', timeout: 10_000 })
  mkdirSync(join(dir, 'repo/sub'), { recursive: true })
  mkdirSync(join(dir, 'plain'))
  git('init', '-q')
  git('-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-q', '--allow-empty', '-m', 'init')
  git('worktree', 'add', '-q', join(dir, 'linked'), '-b', 'other')
  const home = temp('ac-usage-home2-')
  const cwds = [join(dir, 'repo/sub'), join(dir, 'linked'), join(dir, 'plain'), join(dir, 'gone'), '/a/b/.claude/worktrees/w2/deep']
  put(home, 'p/s.jsonl', cwds.map((cwd, i) => row({ cwd, requestId: `r${i}` }, { id: `m${i}` }, { input_tokens: 1, output_tokens: 1 })))
  const projects = readUsage({ home, until: '2026-12-31' }).byProject.map((p) => p.project).sort()
  assert.deepEqual(projects, [join(dir, 'gone'), join(dir, 'plain'), join(dir, 'repo'), '/a/b'].sort())
})

test('ac usage prints a summary and --json; a bad date is a usage error', async () => {
  const home = makeHome()
  const bin = join(REPO, 'bin/ac.mjs')
  const env = { ...process.env, HOME: home, CODEX_HOME: '' }
  const json = await runNode([bin, 'usage', '--since', '2026-03-01', '--until', '2026-03-31', '--json'], { env })
  assert.equal(json.code, 0, json.stderr)
  const data = JSON.parse(json.stdout)
  assert.equal(data.ok, true)
  assert.equal(data.totals.tokens, 7400)
  const text = await runNode([bin, 'usage', '--since', '2026-03-01', '--until', '2026-03-31'], { env })
  assert.equal(text.code, 0, text.stderr)
  assert.match(text.stdout, /7,400/)
  assert.match(text.stdout, /\/x\/repo/)
  assert.match(text.stdout, /claude-sonnet-4-6/)
  assert.match(text.stdout, /claude-unknown-9/)
  for (const args of [['--since', 'soon'], ['--until', '2026-13-45'], ['--bogus'], ['extra']]) {
    const bad = await runNode([bin, 'usage', ...args], { env })
    assert.equal(bad.code, 2, args.join(' '))
    assert.match(bad.stderr, /Usage: ac usage/)
  }
  const help = await runNode([bin, 'usage', '--help'], { env })
  assert.equal(help.code, 0)
  assert.match(help.stdout, /--since/)
})

// A session is the sessionId of the lines. It is a "graph" session when any line of it calls a tool of the codebase-memory MCP server.
const call = (...names) => ({ content: [{ type: 'text', text: 'mcp__codebase-memory is a graph' }, ...names.map((name) => ({ type: 'tool_use', id: 't', name, input: {} }))] })
const turn = (session, id, usage, { day = [3, 10], message = {}, ...over } = {}) => row({ sessionId: session, requestId: id, timestamp: at(...day), ...over }, { id, ...message }, usage)
const sessionHome = () => {
  const home = temp('ac-usage-sessions-')
  put(home, '-x-repo/g1.jsonl', [
    turn('g1', 'a1', { input_tokens: 100, output_tokens: 50, cache_read_input_tokens: 800, cache_creation_input_tokens: 50 }, { message: call('mcp__codebase-memory-mcp__search_graph') }),
  ])
  put(home, '-x-repo/g2.jsonl', [
    // Streaming: the full line has no tool call, a partial line of the same message has it. The session still counts as graph.
    turn('g2', 'b1', { input_tokens: 1000, output_tokens: 1 }, { message: call('mcp__codebase-memory__trace_path') }),
    turn('g2', 'b1', { input_tokens: 1000, output_tokens: 900 }, { message: { content: [{ type: 'text', text: 'done' }] } }),
    turn('g2', 'b2', { input_tokens: 1000, output_tokens: 100 }, { day: [3, 12] }),
  ])
  put(home, '-x-repo/g2/subagents/agent-a.jsonl', [turn('g2', 'b3', { input_tokens: 99, output_tokens: 1 }, { isSidechain: true })])
  put(home, '-x-repo/n1.jsonl', [
    turn('n1', 'c1', { input_tokens: 2000, output_tokens: 0 }, { message: call('Read', 'mcp__context7__query-docs') }),
    turn('n2', 'c2', { input_tokens: 4000, output_tokens: 0 }, { cwd: '/y/other' }),
    turn('n3', 'c3', { input_tokens: 6000, output_tokens: 0 }),
    turn('n3', 'c4', { input_tokens: 1, output_tokens: 0 }, { day: [3, 20] }),
  ])
  put(home, '-x-repo/none.jsonl', [row({ requestId: 'z1' }, { id: 'z1' }, { input_tokens: 7, output_tokens: 0 })])
  return home
}

test('readUsage: bySession gives one row per sessionId with project, days, tokens and the graph flag', () => {
  const u = readUsage({ home: sessionHome(), until: '2026-12-31' })
  assert.deepEqual(u.bySession.map((r) => [r.session, r.tokens]), [['n3', 6001], ['n2', 4000], ['g2', 3100], ['n1', 2000], ['g1', 1000], ['(unknown)', 7]])
  const by = Object.fromEntries(u.bySession.map((r) => [r.session, r]))
  assert.deepEqual(u.bySession.map((r) => r.graph), [false, false, true, false, true, false])
  assert.deepEqual([by.g2.project, by.n2.project, by.g2.first, by.g2.last, by.g2.messages], ['/x/repo', '/y/other', '2026-03-10', '2026-03-12', 3])
  assert.deepEqual([by.n3.first, by.n3.last, by.n3.messages], ['2026-03-10', '2026-03-20', 2])
  close(by.g1.cacheHit, 800 / 950)
  assert.equal(by.n1.cacheHit, 0)
  close(by.g1.cost, (100 * 3 + 50 * 15 + 800 * 0.3 + 50 * 1.25 * 3) / 1e6)
  assert.deepEqual(u.sessionSummary, { graph: { count: 2, median: 2050, p90: 2890 }, noGraph: { count: 4, median: 3000, p90: 5401 } })
})

test('readUsage: --since and --project narrow the sessions; an empty set gives zeros', () => {
  const home = sessionHome()
  assert.deepEqual(readUsage({ home, project: '/y/other', until: '2026-12-31' }).bySession.map((r) => r.session), ['n2'])
  const late = readUsage({ home, since: '2026-03-12', until: '2026-12-31' })
  assert.deepEqual(late.bySession.map((r) => [r.session, r.first, r.tokens]), [['g2', '2026-03-12', 1100], ['n3', '2026-03-20', 1]])
  const none = readUsage({ home, project: '/nowhere', until: '2026-12-31' })
  assert.deepEqual([none.bySession, none.sessionSummary, none.totals.tokens], [[], { graph: { count: 0, median: 0, p90: 0 }, noGraph: { count: 0, median: 0, p90: 0 } }, 0])
})

test('ac usage --by session prints the summary and the rows; --project and --by are checked', async () => {
  const home = sessionHome()
  const bin = join(REPO, 'bin/ac.mjs')
  const env = { ...process.env, HOME: home, CODEX_HOME: '' }
  const json = await runNode([bin, 'usage', '--by', 'session', '--until', '2026-12-31', '--json'], { env })
  assert.equal(json.code, 0, json.stderr)
  const data = JSON.parse(json.stdout)
  assert.deepEqual(Object.keys(data).sort(), ['byDay', 'byModel', 'byProject', 'byProvider', 'bySession', 'cacheHit', 'files', 'lines', 'ok', 'sessionSummary', 'subagentShare', 'totals', 'unknownModels'])
  assert.equal(data.bySession.length, 6)
  const text = await runNode([bin, 'usage', '--by', 'session', '--until', '2026-12-31'], { env })
  assert.equal(text.code, 0, text.stderr)
  assert.match(text.stdout, /6 sessions/)
  assert.match(text.stdout, /graph\s+2 sessions\s+median 2,050 tokens\s+p90 2,890 tokens/)
  assert.match(text.stdout, /no graph\s+4 sessions\s+median 3,000 tokens/)
  assert.match(text.stdout, /repo\s+2026-03-10 to 2026-03-12\s+3 msgs\s+3,100 tokens/)
  const one = JSON.parse((await runNode([bin, 'usage', '--by', 'session', '--project', '/y/other/', '--until', '2026-12-31', '--json'], { env })).stdout)
  assert.deepEqual(one.bySession.map((r) => r.session), ['n2'])
  const plain = JSON.parse((await runNode([bin, 'usage', '--until', '2026-12-31', '--json'], { env })).stdout)
  assert.deepEqual(Object.keys(plain).sort(), Object.keys(data).sort())
  assert.deepEqual([plain.bySession.length, plain.sessionSummary.graph.count, plain.sessionSummary.noGraph.count], [6, 2, 4])
  for (const args of [['--by', 'day'], ['--by'], ['--project']]) {
    const bad = await runNode([bin, 'usage', ...args], { env })
    assert.equal(bad.code, 2, args.join(' '))
    assert.match(bad.stderr, /Usage: ac usage/)
  }
})

// ---- Codex sessions ----
// A Codex rollout file is <codex home>/sessions/YYYY/MM/DD/rollout-*.jsonl. The fixtures keep the event shapes of real files and no real text.
const event = (type, payload, timestamp = at(3, 10)) => JSON.stringify({ timestamp, type, payload })
const count = (total) => event('event_msg', { type: 'token_count', info: { total_token_usage: total, last_token_usage: total, model_context_window: 1000 } })
const totals = (input, cached, output, reasoning = 0) => ({ input_tokens: input, cached_input_tokens: cached, cache_write_input_tokens: 0, output_tokens: output, reasoning_output_tokens: reasoning, total_tokens: input + output })
const header = (id, cwd, over = {}) => event('session_meta', { id, session_id: id, timestamp: at(3, 10), cwd, originator: 'codex_exec', cli_version: '0.0.0', source: 'cli', model_provider: 'openai', ...over })
const context = (model) => [event('event_msg', { type: 'task_started', turn_id: 't' }), event('turn_context', { turn_id: 't', cwd: '/x/repo', model })]
const toolCall = (server) => event('event_msg', { type: 'mcp_tool_call_end', call_id: 'c', invocation: { server, tool: 'x', arguments: {} } })
const putCodex = (home, id, lines, day = '2026/03/10') => {
  const file = join(home, 'sessions', day, `rollout-${day.replaceAll('/', '-')}T12-00-00-${id}.jsonl`)
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, `${lines.join('\n')}\n`)
}
const OLD = { input_tokens: 0, cached_input_tokens: 0, output_tokens: 0, reasoning_output_tokens: 0, total_tokens: 303 }

// c1: the final total counts, a repeated total is one step, an event without info is skipped, the last turn_context names the model.
// c2: a sub-agent thread on another day and project. c3: an old file with only total_tokens. c4: no token_count. c5: no session_meta.
const codexFiles = (codex) => {
  putCodex(codex, 'c1', [header('c1', '/x/repo'), ...context('gpt-test-1'), event('event_msg', { type: 'token_count', info: null }), count(totals(1000, 800, 100, 40)), count(totals(1000, 800, 100, 40)),
    ...context('gpt-test-2'), count(totals(5000, 4000, 400, 150)), toolCall('codebase-memory-mcp')])
  putCodex(codex, 'c2', [header('c2', '/y/other', { timestamp: at(3, 11), source: { subagent: 'review' } }), ...context('gpt-test-1'), count(totals(300, 100, 50)), toolCall('playwright')], '2026/03/11')
  putCodex(codex, 'c3', [header('c3', '/x/repo'), count(OLD)])
  putCodex(codex, 'c4', [header('c4', '/x/repo'), ...context('gpt-test-1')])
  putCodex(codex, 'c5', [...context('gpt-test-1'), count(totals(9, 0, 1))])
}
const codexHome = () => {
  const home = temp('ac-usage-codex-')
  codexFiles(join(home, '.codex'))
  return home
}
const mixedHome = () => {
  const home = makeHome()
  codexFiles(join(home, '.codex'))
  return home
}

test('readUsage: a Codex session is one row from the final token_count, with its day, project, model and graph flag', () => {
  const u = readUsage({ home: codexHome(), ...window })
  assert.equal(u.files, 5)
  assert.deepEqual(sums(u.totals), [1503, 450, 0, 4100, 6053, 4])
  assert.equal(u.totals.cost, 0)
  assert.deepEqual(u.unknownModels, ['(unknown)', 'gpt-test-1', 'gpt-test-2'])
  assert.deepEqual(u.bySession.map((r) => [r.provider, r.session, r.project, r.first, r.last, r.tokens, r.messages, r.graph]), [
    ['codex', 'c1', '/x/repo', '2026-03-10', '2026-03-10', 5400, 2, true],
    ['codex', 'c2', '/y/other', '2026-03-11', '2026-03-11', 350, 1, false],
    ['codex', 'c3', '/x/repo', '2026-03-10', '2026-03-10', 303, 1, false],
  ])
  const c1 = u.bySession[0]
  assert.deepEqual([c1.input, c1.cacheRead, c1.output, c1.cacheWrite, c1.cost], [1000, 4000, 400, 0, 0])
  close(c1.cacheHit, 4000 / 5000)
  assert.deepEqual(u.byModel.map((m) => [m.model, m.tokens]), [['gpt-test-2', 5400], ['gpt-test-1', 350], ['(unknown)', 303]])
  assert.deepEqual(u.byProject.map((p) => [p.project, p.tokens]), [['/x/repo', 5703], ['/y/other', 350]])
  close(u.subagentShare, 350 / 6053)
  assert.deepEqual(u.sessionSummary.graph, { count: 1, median: 5400, p90: 5400 })
  assert.deepEqual(u.byProvider.map((p) => [p.provider, p.tokens, p.messages]), [['codex', 6053, 4]])
})

test('readUsage: provider selects claude, codex or both; every row and total carries its provider', () => {
  const home = mixedHome()
  const all = readUsage({ home, ...window })
  assert.equal(all.totals.tokens, 7400 + 6053)
  assert.deepEqual(all.byProvider.map((p) => [p.provider, p.tokens, p.messages]), [['claude', 7400, 6], ['codex', 6053, 4]])
  assert.equal(all.byProvider.reduce((sum, p) => sum + p.cost, 0), all.totals.cost)
  assert.deepEqual([...new Set(all.bySession.map((r) => r.provider))].sort(), ['claude', 'codex'])
  assert.equal(all.bySession.filter((r) => r.provider === 'codex').length, 3)
  assert.deepEqual(readUsage({ home, ...window, provider: 'all' }).totals, all.totals)
  const claude = readUsage({ home, ...window, provider: 'claude' })
  assert.deepEqual([claude.totals.tokens, claude.byProvider.map((p) => p.provider), claude.files], [7400, ['claude'], 2])
  assert.ok(claude.bySession.every((r) => r.provider === 'claude'))
  const codex = readUsage({ home, ...window, provider: 'codex' })
  assert.deepEqual([codex.totals.tokens, codex.byProvider.map((p) => p.provider), codex.files], [6053, ['codex'], 5])
  assert.ok(codex.bySession.every((r) => r.provider === 'codex'))
  assert.deepEqual(codex.unknownModels, ['(unknown)', 'gpt-test-1', 'gpt-test-2'])
})

test('readUsage: since, until and project cut the Codex sessions by the day of their start', () => {
  const home = codexHome()
  assert.deepEqual(readUsage({ home, since: '2026-03-11', until: '2026-03-31' }).bySession.map((r) => r.session), ['c2'])
  assert.deepEqual(readUsage({ home, since: '2026-03-01', until: '2026-03-10' }).bySession.map((r) => r.session), ['c1', 'c3'])
  assert.deepEqual(readUsage({ home, project: '/y/other', ...window }).bySession.map((r) => r.session), ['c2'])
  assert.deepEqual(readUsage({ home, since: '2026-05-01', until: '2026-05-31' }).byProvider, [])
})

test('readUsage: a home without a Codex folder reads Claude only; a given home ignores CODEX_HOME', () => {
  const home = makeHome()
  const u = readUsage({ home, ...window })
  assert.deepEqual([u.files, u.byProvider.map((p) => p.provider)], [2, ['claude']])
  const old = process.env.CODEX_HOME
  process.env.CODEX_HOME = join(codexHome(), '.codex')
  try { assert.equal(readUsage({ home, ...window }).totals.tokens, 7400) } finally { if (old === undefined) delete process.env.CODEX_HOME; else process.env.CODEX_HOME = old }
})

test('ac usage --provider filters the sources, CODEX_HOME moves the Codex folder, and the option is checked', async () => {
  const home = makeHome()
  const alt = temp('ac-usage-alt-')
  codexFiles(alt)
  const bin = join(REPO, 'bin/ac.mjs')
  const run = (args, codex) => runNode([bin, 'usage', '--since', '2026-03-01', '--until', '2026-03-31', ...args], { env: { ...process.env, HOME: home, CODEX_HOME: codex } })
  const json = async (args, codex) => JSON.parse((await run([...args, '--json'], codex)).stdout)
  assert.deepEqual((await json([], '')).byProvider.map((p) => p.provider), ['claude'])
  const all = await json([], alt)
  assert.deepEqual([all.totals.tokens, all.byProvider.map((p) => p.provider)], [13453, ['claude', 'codex']])
  assert.deepEqual((await json(['--provider', 'codex'], alt)).byProvider.map((p) => [p.provider, p.tokens]), [['codex', 6053]])
  assert.deepEqual((await json(['--provider', 'claude'], alt)).byProvider.map((p) => [p.provider, p.tokens]), [['claude', 7400]])
  assert.equal((await json(['--provider', 'all'], alt)).totals.tokens, 13453)
  const text = await run([], alt)
  assert.match(text.stdout, /By provider/)
  assert.match(text.stdout, /codex\s+6,053 tokens/)
  assert.match(text.stdout, /gpt-test-2/)
  const sessions = await run(['--by', 'session', '--provider', 'codex'], alt)
  assert.match(sessions.stdout, /3 sessions/)
  assert.match(sessions.stdout, /repo\s+2026-03-10 to 2026-03-10\s+2 msgs\s+5,400 tokens\s+\$0\.00\s+cache 80\.0%\s+graph\s+codex/)
  for (const args of [['--provider', 'gpt'], ['--provider', ''], ['--provider']]) {
    const bad = await run(args, alt)
    assert.equal(bad.code, 2, args.join(' '))
    assert.match(bad.stderr, /--provider needs|Usage: ac usage/)
  }
  assert.match((await run(['--help'], alt)).stdout, /--provider/)
})

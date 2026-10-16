// app.js — the page of `ac ui`. It builds the DOM with textContent only. Server data never goes into HTML.

const token = new URLSearchParams(location.search).get('token') ?? ''
history.replaceState(null, '', location.pathname)

const $ = (id) => document.getElementById(id)
const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v)
const nodes = (kids) => kids.flat(Infinity).filter((x) => x != null && x !== false)
const fill = (el, ...kids) => el.replaceChildren(...nodes(kids))
const add = (el, ...kids) => el.append(...nodes(kids))
const h = (tag, props, ...kids) => {
  const el = document.createElement(tag)
  for (const [k, v] of Object.entries(props ?? {})) {
    if (k.startsWith('on')) el.addEventListener(k.slice(2), v)
    else if (k in el) el[k] = v
    else el.setAttribute(k, v)
  }
  el.append(...nodes(kids))
  return el
}
const say = (text, err) => { $('status').textContent = text; $('status').className = err ? 'err' : 'ok' }
const api = async (path, body) => {
  const post = body !== undefined
  const res = await fetch(`/api/${path}`, { method: post ? 'POST' : 'GET', headers: { 'x-ac-token': token, ...(post ? { 'content-type': 'application/json' } : {}) }, body: post ? JSON.stringify(body) : undefined })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw Object.assign(new Error(data.error ?? res.statusText), { status: res.status })
  return data
}

const note = (text, cls = 'muted') => h('p', { className: cls }, text)
const errors = (d) => (d?.errors ?? []).map((e) => note(e, 'err'))
const act = (label, fn) => h('button', {
  onclick: async (e) => {
    const b = e.currentTarget
    b.disabled = true
    try { await fn() } catch (err) { say(err.message, true) }
    b.disabled = false
  },
}, label)
const table = (head, rows) => (rows.length
  ? h('div', { className: 'scroll' }, h('table', {}, h('thead', {}, h('tr', {}, head.map((t) => h('th', {}, t)))),
    h('tbody', {}, rows.map((r) => h('tr', {}, r.map((c) => h('td', {}, c ?? '')))))))
  : note('None.'))
const kv = (obj) => h('dl', {}, Object.entries(obj).flatMap(([k, v]) => [h('dt', {}, k), h('dd', {}, String(v ?? ''))]))
const pre = (data) => h('pre', {}, typeof data === 'string' ? data : JSON.stringify(data, null, 2))
const tile = (label, value, cls = '') => h('div', { className: `tile ${cls}`.trim() }, h('small', {}, label), h('b', {}, value))
const ver = (v, tag) => `${v ?? '-'}${tag ? ` (${tag})` : ''}`
const num = (x) => Math.round(x ?? 0).toLocaleString('en-US')
const pct = (x) => `${((x ?? 0) * 100).toFixed(1)} %`

let current = 'projects'
let stop = []
let seq = 0
const reload = () => show(current)

// The sync diff and its "Apply sync" button. `after` runs when a sync was applied.
const syncBox = (first, after) => {
  const box = h('div', { className: 'card' })
  const draw = (s) => fill(box,
    h('h3', {}, s.errors?.length ? 'Sync diff' : s.drift ? `Sync diff: ${s.changes.length} change(s)` : 'Sync: up to date'),
    errors(s), (s.warnings ?? []).map((w) => note(w, 'warn')),
    s.changes?.length ? table(['Action', 'Path', 'Key'], s.changes.map((x) => [x.action, x.path, x.key])) : null,
    act('Apply sync', async () => {
      const r = await api('sync', {})
      say(r.ok ? 'Sync applied.' : 'Sync failed.', !r.ok)
      return after ? after() : draw(r)
    }))
  draw(first)
  return box
}

const CHECK_CLASS = { ok: 'ok', warn: 'warn', fail: 'err' }

// The checks and the token items of `ac doctor --tokens`. It runs after the tab is drawn.
const doctorBox = () => {
  const out = h('div', note('Running the checks.'))
  api('doctor').then((d) => fill(out, errors(d),
    table(['Status', 'Check', 'Detail'], d.checks.map((c) => [h('span', { className: CHECK_CLASS[c.status] ?? 'muted' }, c.status), c.name, c.detail])),
    d.tokens ? [h('div', { className: 'tiles' }, tile('Always-on tokens', num(d.tokens.total)), tile('SessionStart chars', num(d.tokens.startChars))),
      table(['Item', 'Chars', 'Tokens'], d.tokens.items.map((i) => [i.name, num(i.chars), num(i.tokens)]))] : null),
  (err) => fill(out, note(err.message, 'err')))
  return out
}

async function projects(box) {
  const [p, s] = await Promise.all([api('project'), api('sync')])
  $('root').textContent = p.root
  const others = h('div', note('Loading other projects. This can take 10 s or more.'))
  api('project/others').then((o) => others.replaceChildren(o.others.length
    ? table(['Project', ''], o.others.map((root) => [root, act('Switch', async () => { await api('project', { root }); reload() })]))
    : note('The usage data of the last 90 days has no other project with .agents/compass.json.')), (err) => others.replaceChildren(note(err.message, 'err')))
  add(box, h('h2', {}, 'Project'),
    kv({ Root: p.root, 'Compass in the project': p.lock ? ver(p.lock.version, p.lock.tag) : 'not synced yet', 'Compass checkout': ver(s.version, s.tag), Drift: s.drift ? 'yes' : 'no' }),
    syncBox(s, reload), h('h2', {}, 'Doctor'), doctorBox(), h('h2', {}, 'Other projects'), others)
}

const KINDS = {
  skill: 'Skills', rule: 'Rules', agent: 'Agents', pack: 'Packs', mcp: 'MCP servers', plugin: 'Claude plugins', upstream: 'Upstream sources', file: 'Files', block: 'Blocks',
  key: 'Settings (owned keys)', seed: 'Seed files', schema: 'OpenSpec schema',
}
const FILTERS = { all: () => true, recommended: (a) => a.recommended, on: (a) => a.on, off: (a) => !a.on }

// The always-on context of the current config and of the recommended set, against the target. It shows nothing when the answer has no `always`.
const alwaysTiles = (always) => {
  if (!isObj(always)) return null
  const over = (v) => (v > always.budget ? 'warn' : '')
  return [
    h('div', { className: 'tiles' }, tile('Always-on now', `≈ ${num(always.current)} tokens`, over(always.current)), tile('With the recommended set', `≈ ${num(always.recommended)}`, over(always.recommended)), tile('Target', num(always.budget))),
    always.note ? note(always.note) : null,
  ]
}

async function assets(box) {
  let data = await api('assets')
  let filter = 'all'
  let query = ''
  const count = h('span', { className: 'muted' })
  const filters = h('span', { className: 'bar' })
  const list = h('div')
  const tiles = h('div')
  const diff = h('div')
  const apply = (res) => { data = res; drawList(); diff.replaceChildren(syncBox(data.sync)) }
  const row = (a) => [
    h('input', {
      type: 'checkbox', checked: a.on, disabled: !a.available,
      onchange: async (e) => {
        const el = e.currentTarget
        el.disabled = true
        try { apply(await api('assets', { kind: a.kind, id: a.id, on: el.checked })) } catch (err) { el.checked = !el.checked; el.disabled = false; say(err.message, true) }
      },
    }),
    h('b', {}, a.title ?? a.id), a.description, a.userInvoked ? 'user-invoked' : Number.isFinite(a.tokens) ? num(a.tokens) : '',
    [a.recommended ? h('span', { className: 'badge rec' }, `recommended: ${a.reason ?? ''}`) : null, a.available ? null : h('span', { className: 'badge no' }, `not available: ${a.reason ?? ''}`)],
  ]
  function drawList() {
    const all = data.assets ?? []
    fill(tiles, alwaysTiles(data.always))
    count.textContent = `${all.filter((a) => a.on).length} on, ${all.filter((a) => a.recommended).length} recommended`
    filters.replaceChildren(...Object.keys(FILTERS).map((f) => h('button', { className: f === filter ? 'on' : '', onclick: () => { filter = f; drawList() } }, f)))
    const shown = all.filter((a) => FILTERS[filter](a) && `${a.kind} ${a.id} ${a.title} ${a.description}`.toLowerCase().includes(query))
    fill(list, Object.entries(KINDS).map(([kind, label]) => {
      const part = shown.filter((a) => a.kind === kind)
      return part.length ? h('div', {}, h('h3', {}, `${label} (${part.length})`), table(['On', 'Name', 'Description', 'Tokens', 'Badges'], part.map(row))) : null
    }))
  }
  drawList()
  add(diff, syncBox(data.sync))
  add(box, h('h2', {}, 'Assets'), errors(data), tiles,
    h('div', { className: 'bar' }, filters, h('input', { type: 'search', placeholder: 'Search', oninput: (e) => { query = e.target.value.toLowerCase(); drawList() } }), count,
      act('Apply the recommended set', async () => { apply(await api('assets/recommended', {})); say('The recommended set is on.') })),
    list, diff)
}

const fileCard = (f) => {
  const name = h('input', { placeholder: 'NAME', size: 24 })
  const value = h('input', { type: 'password', placeholder: 'value', autocomplete: 'off', size: 30 })
  return h('div', { className: 'card' }, h('h3', {}, f.file), table(['Name', 'State'], f.vars.map((v) => [v.name, v.state])),
    h('div', { className: 'bar' }, name, value, act('Save value', async () => {
      await api('env/value', { file: f.file, name: name.value, value: value.value })
      say(`${name.value} saved.`)
      reload()
    })))
}

const transfer = () => {
  const to = h('input', { placeholder: 'key.pub, user or host/user, ...', size: 40 })
  const file = h('input', { value: 'env-bundle.age', size: 30 })
  const out = h('div')
  const go = (path, body) => async () => {
    const r = await api(path, body())
    fill(out, errors(r), pre(r))
  }
  return h('div', { className: 'card' }, h('h3', {}, 'Share values with age'),
    h('div', { className: 'bar' }, to, act('Export', go('env/export', () => ({ to: to.value })))),
    h('div', { className: 'bar' }, file, act('Import', go('env/import', () => ({ file: file.value })))), out)
}

async function env(box) {
  const d = await api('env')
  const c = d.check
  add(box, h('h2', {}, 'Env check'), errors(c),
    c.findings ? [note(`${c.findings.length} finding(s). Catalog: ${c.catalog ?? 'none'}.`), table(['Level', 'Kind', 'Name', 'Detail', 'Files'], c.findings.map((f) => [f.level, f.kind, f.name, f.detail, (f.files ?? []).join(', ')]))] : null,
    h('h2', {}, 'Local env files'), d.files.length ? d.files.map(fileCard) : note('No git-ignored local env file was found.'), transfer())
}

let logStream = null
function watch(name, log) {
  logStream?.close()
  const es = new EventSource(`/api/run/logs?name=${encodeURIComponent(name)}&token=${encodeURIComponent(token)}`)
  let lines = []
  log.textContent = ''
  es.addEventListener('lines', (e) => { lines = [...lines, ...JSON.parse(e.data)].slice(-1000); log.textContent = lines.join('\n'); log.scrollTop = log.scrollHeight })
  es.addEventListener('fail', (e) => say(JSON.parse(e.data), true))
  logStream = es
  stop.push(() => es.close())
}

async function run(box) {
  const s = await api('run')
  const log = h('pre')
  const stack = (what) => async () => {
    const r = await api(`run/${what}`, {})
    say(r.ok ? `The stack is ${what === 'up' ? 'starting' : 'down'}.` : (r.errors ?? ['Failed.']).join(' '), !r.ok)
    reload()
  }
  add(box, h('h2', {}, 'Local stack'), errors(s), h('div', { className: 'bar' }, act('Up', stack('up')), act('Down', stack('down'))),
    s.processes ? table(['Name', 'Status', 'Ready', 'Restarts', ''], s.processes.map((p) => [p.name, p.status, p.ready, p.restarts, act('Logs', async () => watch(p.name, log))])) : null,
    h('h3', {}, 'Logs'), log)
}

const report = (path, label) => h('a', { href: `/api/report?path=${encodeURIComponent(path)}&token=${encodeURIComponent(token)}`, target: '_blank', rel: 'noopener' }, label)

async function tests(box) {
  const d = await api('tests')
  const exit = (r) => (r.timedOut ? 'timeout' : r.exitCode ?? '-')
  add(box, h('h2', {}, 'Registry'), errors(d),
    d.commands.length ? table(['Name', ''], d.commands.map((n) => [n, act('Run', async () => {
      say(`Running ${n}. This can take a long time.`)
      const r = await api('tests/run', { name: n })
      say(`${n}: ${r.ok ? 'passed' : `failed (${r.exitCode ?? 'no exit code'})`}.`, !r.ok)
      reload()
    })])) : note('No command is in agent-compass.commands.json.'),
    h('h2', {}, 'History'),
    table(['Started', 'Name', 'Exit', 'Duration', 'Reports'], d.history.map((r) => [r.startedAt, r.name, exit(r), `${(r.durationMs / 1000).toFixed(1)} s`,
      [report(`${r.dir}/output.log`, 'log'), ...r.junit.map((p) => report(p, 'junit')), ...r.html.map((p) => report(p, 'html'))]])))
}

let days = 30
let provider = 'all'
let fresh = false

const PROVIDER_LABELS = { all: 'All', claude: 'Claude', codex: 'Codex' }
const dayRange = (r) => (r.first === r.last ? r.first : `${r.first} to ${r.last}`)
const spread = (label, g) => [label, num(g?.count), num(g?.median), num(g?.p90)]

async function usage(box) {
  const u = await api(`usage?days=${days}&provider=${provider}${fresh ? '&fresh=1' : ''}`)
  fresh = false
  const by = (list, key) => table([key, 'Tokens', 'Cost (USD)', 'Messages'], list.map((r) => [r[key.toLowerCase()], num(r.tokens), (r.cost ?? 0).toFixed(2), num(r.messages)]))
  const out = h('div')
  add(box, h('h2', {}, 'Usage'),
    h('div', { className: 'bar' }, h('span', { className: 'bar' }, [7, 30, 90].map((d) => h('button', { className: d === days ? 'on' : '', onclick: () => { days = d; reload() } }, `${d} days`))),
      h('span', { className: 'bar' }, Object.entries(PROVIDER_LABELS).map(([p, label]) => h('button', { className: p === provider ? 'on' : '', onclick: () => { provider = p; reload() } }, label))),
      act('Refresh', async () => { fresh = true; reload() })),
    h('div', { className: 'tiles' }, tile('Tokens', num(u.totals?.tokens)), tile('Cost (USD)', (u.totals?.cost ?? 0).toFixed(2)), tile('Cache hit', pct(u.cacheHit)), tile('Sub-agent share', pct(u.subagentShare))),
    u.unknownModels?.length ? note(`No price for: ${u.unknownModels.join(', ')}. These models cost 0 here.`, 'warn') : null,
    h('h3', {}, 'Quota'),
    u.quota ? act('Load quota', async () => { const r = await api('usage/quota', {}); out.replaceChildren(pre(r.text)) }) : note('CodexBar is not on PATH. Quota is not available.'), out,
    h('h3', {}, 'By provider'), by(u.byProvider ?? [], 'Provider'),
    h('h3', {}, `Sessions (${num(u.sessionCount)})`),
    note('A graph session called a codebase-memory MCP tool. A Codex session counts on the day it started.'),
    table(['Group', 'Sessions', 'Median tokens', 'p90 tokens'], [spread('Graph', u.sessionSummary?.graph), spread('No graph', u.sessionSummary?.noGraph)]),
    u.sessionCount > u.bySession.length ? note(`The table shows the ${u.bySession.length} largest sessions.`) : null,
    table(['Provider', 'Project', 'Days', 'Messages', 'Tokens', 'Cost (USD)', 'Cache hit', 'Graph'],
      u.bySession.map((r) => [r.provider, r.project, dayRange(r), num(r.messages), num(r.tokens), (r.cost ?? 0).toFixed(2), pct(r.cacheHit), r.graph ? 'graph' : ''])),
    h('h3', {}, 'By day'), by(u.byDay ?? [], 'Day'), h('h3', {}, 'By project'), by(u.byProject ?? [], 'Project'), h('h3', {}, 'By model'), by(u.byModel ?? [], 'Model'))
}

// A read-only pull of the open issues from `gh`, `glab` or `jira`, run in the project root.
function tracker() {
  const out = h('div')
  const pull = (name, label) => act(`Pull ${label} issues`, async () => {
    const r = await api('delivery/pull', { tracker: name })
    fill(out, errors(r), r.ok ? [note(`${r.count} open issue(s) from ${label}.`),
      table(['Number', 'Title', 'State', 'Labels', 'Assignee', 'Link'], r.rows.map((i) => [i.number, i.title, i.state, i.labels, i.assignee, i.url ? h('a', { href: i.url, target: '_blank', rel: 'noopener' }, 'open') : null]))] : null)
  })
  return h('div', {}, h('h2', {}, 'Tracker issues'),
    note('Compass runs "gh issue list", "glab issue list" or "jira issue list" in the project root. It needs the CLI on PATH and a login. This page holds no token: the CLI keeps it.'),
    h('div', { className: 'bar' }, pull('github', 'GitHub'), pull('gitlab', 'GitLab'), pull('jira', 'Jira')), out)
}

async function delivery(box) {
  const d = await api('delivery')
  if (d.ok === false) return add(box, errors(d))
  const cols = [...new Set(d.tickets.rows.flatMap(Object.keys))].slice(0, 8)
  add(box, tracker(), h('h2', {}, `RAID register (${d.raid.length})`),
    table(['File', 'Id', 'Kind', 'Status', 'Owner', 'Ticket', 'Title'], d.raid.map((r) => [r.file, r.id, r.kind, r.status, r.owner, r.ticket, r.title])),
    h('h2', {}, `Tickets (${d.tickets.count})`), d.tickets.count > 50 ? note('The table shows the first 50 rows.') : null, table(cols, d.tickets.rows.map((r) => cols.map((c) => r[c]))),
    h('h2', {}, `Audit rows (${d.audit.total})`), table(['Status', 'Count'], Object.entries(d.audit.counts)),
    h('h2', {}, `ADRs (${d.adrs.length})`), table(['File', 'Title', 'Status'], d.adrs.map((a) => [a.file, a.title, a.status])))
}

async function promote(box) {
  const d = await api('promote')
  const out = h('div')
  const outcome = (r, skill, dry) => h('div', { className: 'card' },
    h('h3', {}, `${skill}: ${r.ok ? (dry ? 'ready to promote' : 'promoted') : 'not ready'}`), kv({ From: r.from, To: r.to }),
    errors(r), (r.warnings ?? []).map((w) => note(w, 'warn')), r.files?.length ? table(['Files'], r.files.map((f) => [typeof f === 'string' ? f : JSON.stringify(f)])) : null,
    dry && r.ok ? act('Promote', async () => { out.replaceChildren(outcome(await api('promote', { skill, dry: false }), skill, false)) }) : null)
  add(box, h('h2', {}, 'Promote a project skill into compass'),
    d.candidates.length ? table(['Skill', 'Target', ''], d.candidates.map((x) => [x.name, x.target, act('Preview', async () => out.replaceChildren(outcome(await api('promote', { skill: x.name, dry: true }), x.name, true)))]))
      : note('No project skill can be promoted.'), out)
}

const TABS = { projects, assets, env, run, tests, usage, delivery, promote }

async function show(name) {
  const mine = ++seq
  current = name
  stop.forEach((f) => f())
  stop = []
  for (const b of $('tabs').children) b.classList.toggle('on', b.dataset.tab === name)
  $('view').replaceChildren(note('Loading.'))
  const box = h('div')
  try { await TABS[name](box) } catch (err) { box.replaceChildren(note(err.status === 501 ? `Not available: ${err.message}` : err.message, 'err')) }
  if (mine === seq) $('view').replaceChildren(box)
}

$('tabs').append(...Object.keys(TABS).map((n) => h('button', { 'data-tab': n, onclick: () => show(n) }, n[0].toUpperCase() + n.slice(1))))
show(current)

import assert from 'node:assert/strict'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { doctorGlobal, formatGlobal } from '../engine/global.mjs'
import { runNode } from './helpers.mjs'

const AC = dirname(dirname(fileURLToPath(import.meta.url)))
const BIN = join(AC, 'bin/ac.mjs')
const temps = []
test.after(() => { for (const d of temps) rmSync(d, { recursive: true, force: true }) })
const temp = () => { const d = mkdtempSync(join(tmpdir(), 'ac-global-')); temps.push(d); return d }

const put = (root, files) => {
  for (const [rel, data] of Object.entries(files)) {
    mkdirSync(dirname(join(root, rel)), { recursive: true })
    writeFileSync(join(root, rel), typeof data === 'string' ? data : `${JSON.stringify(data, null, 2)}\n`)
  }
}
const cmd = (command) => ({ hooks: [{ type: 'command', command }] })
const say = (n) => `node -e "process.stdout.write('x'.repeat(${n}))"`

// A home with two enabled plugins (one disabled), user MCP servers, user hooks and a Codex config.
const makeHome = ({ settings = {}, extra = {} } = {}) => {
  const home = temp()
  const plugin = (name) => ({ [`${name}@m`]: [{ scope: 'user', installPath: join(home, 'cache', name) }] })
  put(home, {
    '.claude/settings.json': {
      enabledPlugins: { 'alpha@m': true, 'beta@m': true, 'gamma@m': false, 'ponytail@ponytail': true },
      hooks: { SessionStart: [cmd(say(10))], UserPromptSubmit: [cmd(say(5))], Stop: [cmd(say(1))] },
      ...settings,
    },
    '.claude.json': { mcpServers: { docs: { command: 'docs' }, files: { command: 'files' } } },
    '.claude/plugins/installed_plugins.json': { version: 2, plugins: { ...plugin('alpha'), ...plugin('beta'), ...plugin('gamma'), ...plugin('ponytail') } },
    'cache/alpha/.mcp.json': { mcpServers: { search: { command: 'search' } } },
    'cache/beta/.mcp.json': { web: { command: 'web' }, db: { command: 'db' } },
    'cache/alpha/hooks/hooks.json': { hooks: { SessionStart: [cmd(say(20))], PreToolUse: [cmd(say(1))] } },
    '.codex/config.toml': `model = "x"\n\n[mcp_servers.docs]\ncommand = "docs"\n\n[mcp_servers.docs.env]\nA = "1"\n\n[mcp_servers."two words"]\ncommand = "x"\n\n[plugins."alpha@m"]\nenabled = true\n\n[plugins."old@m"]\nenabled = false\n`,
    ...extra,
  })
  return home
}

const cli = (home, args) => runNode([BIN, 'doctor', '--global', ...args], { env: { ...process.env, HOME: home }, cwd: temp() })

test('doctor --global reports plugins, MCP servers, hooks and Codex', () => {
  const r = doctorGlobal({ AC, root: temp(), home: makeHome() })
  assert.equal(r.ok, true)
  assert.deepEqual(r.claude.plugins, ['alpha@m', 'beta@m', 'ponytail@ponytail'])
  assert.deepEqual(r.claude.mcp.map((s) => `${s.name}:${s.from}`), ['docs:user', 'files:user', 'search:alpha@m', 'web:beta@m', 'db:beta@m'])
  assert.deepEqual(r.claude.hooks.map((h) => `${h.event}:${h.from}`), ['SessionStart:user settings', 'UserPromptSubmit:user settings', 'SessionStart:alpha@m'])
  assert.deepEqual(r.codex, { mcp: ['docs', 'two words'], plugins: ['alpha@m'] })
  assert.deepEqual(r.warnings, [])
})

test('the recommended set prints the exact command for each missing item', () => {
  const home = makeHome()
  const items = Object.fromEntries(doctorGlobal({ AC, root: temp(), home }).recommended.map((c) => [c.name, c]))
  assert.equal(items.ponytail.ok, true)
  assert.match(items['compass-user'].fix, new RegExp(`^claude plugin marketplace add ${AC} && claude plugin install compass-user@agent-compass$`))
  assert.equal(items.caveman.fix, 'claude plugin marketplace add JuliusBrussee/caveman && claude plugin install caveman@caveman')
  assert.match(items['i-have-adhd'].fix, /install i-have-adhd@i-have-adhd$/)
  assert.ok(items.statusLine.fix.includes(`"command":"node \\"${AC}/plugins/compass-user/scripts/statusline.mjs\\""`), items.statusLine.fix)
})

test('an installed plugin that is off gets an enable command; a set status line is ok', () => {
  const home = makeHome({
    settings: { statusLine: { type: 'command', command: 'echo hi' }, enabledPlugins: { 'compass-user@agent-compass': true } },
    extra: {
      '.claude/plugins/installed_plugins.json': { plugins: {
        'compass-user@agent-compass': [{ scope: 'user', installPath: '/x/compass-user/1.0.0' }],
        'caveman@caveman': [{ scope: 'user', installPath: '/x/caveman' }],
      } },
    },
  })
  const items = Object.fromEntries(doctorGlobal({ AC, root: temp(), home }).recommended.map((c) => [c.name, c]))
  assert.equal(items['compass-user'].ok, true)
  assert.equal(items.statusLine.ok, true)
  assert.equal(items.caveman.fix, 'claude plugin enable caveman@caveman')
})

test('the budgets are warnings and the exit code stays 0', async () => {
  const plugins = Object.fromEntries(Array.from({ length: 16 }, (_, i) => [`p${i}@m`, true]))
  const servers = Object.fromEntries(Array.from({ length: 11 }, (_, i) => [`s${i}`, { command: 's' }]))
  const home = makeHome({ settings: { enabledPlugins: plugins }, extra: { '.claude.json': { mcpServers: servers } } })
  const r = await cli(home, ['--json'])
  assert.equal(r.code, 0, r.stderr)
  const out = JSON.parse(r.stdout)
  assert.equal(out.ok, true)
  assert.equal(out.global, true)
  assert.deepEqual(out.warnings.map((w) => w.replace(/^\d+ /, '')), ['enabled Claude plugins; the budget is 15', 'Claude MCP servers at user level; the budget is 10'])
  assert.match((await cli(home, [])).stdout, /warn +16 enabled Claude plugins/)
})

test('missing files are empty and an unreadable file is the only failure', async () => {
  const empty = await cli(temp(), [])
  assert.equal(empty.code, 0, empty.stderr)
  assert.match(empty.stdout, /0 enabled plugin\(s\): none/)
  const bad = await cli(makeHome({ extra: { '.claude/settings.json': '{ not json' } }), [])
  assert.equal(bad.code, 1)
  assert.match(bad.stdout, /error: .*settings\.json is not readable/)
})

test('without --measure no hook runs; with it each SessionStart hook runs once', () => {
  const root = temp()
  const marker = 'node -e "require(\'fs\').appendFileSync(\'marker\', process.env.CLAUDE_PLUGIN_ROOT + \'|\')"'
  const home = makeHome({
    settings: { hooks: { SessionStart: [cmd(say(10))], UserPromptSubmit: [cmd(marker)] } },
    extra: { 'cache/alpha/hooks/hooks.json': { hooks: { SessionStart: [cmd(marker)] } } },
  })
  assert.equal(doctorGlobal({ AC, root, home }).measure, undefined)
  assert.equal(existsSync(join(root, 'marker')), false)
  const r = doctorGlobal({ AC, root, home, measure: true })
  assert.equal(r.measure.items.length, 2)
  assert.equal(r.measure.total, 10)
  assert.equal(readFileSync(join(root, 'marker'), 'utf8'), `${join(home, 'cache/alpha')}|`)
})

test('--measure flags a hook above 1,000 characters, a total above 2,000 and a failing hook', () => {
  const hooks = { SessionStart: [cmd(say(1001)), cmd(say(900)), cmd(say(900)), cmd('exit 3')] }
  const r = doctorGlobal({ AC, root: temp(), home: makeHome({ settings: { hooks } }), measure: true })
  assert.deepEqual(r.measure.items.map((i) => i.chars), [1001, 900, 900, 0, 20])
  assert.equal(r.warnings.filter((w) => /prints 1001 characters/.test(w)).length, 1)
  assert.equal(r.warnings.filter((w) => /exit code 3/.test(w)).length, 1)
  assert.ok(r.warnings.some((w) => /print 2821 characters; the budget is 2000/.test(w)))
  assert.equal(r.ok, true)
})

test('null and non-object entries and a non-string installPath in installed_plugins.json do not stop the report', () => {
  const home = makeHome()
  put(home, { '.claude/plugins/installed_plugins.json': { version: 2, plugins: { 'alpha@m': [null, 7, { scope: 'user', installPath: 5 }], 'beta@m': 'oops' } } })
  const r = doctorGlobal({ AC, root: home, home, env: {} })
  assert.equal(r.ok, true, r.errors.join('\n'))
  assert.deepEqual(r.claude.plugins, ['alpha@m', 'beta@m', 'ponytail@ponytail'])
  assert.deepEqual(r.claude.mcp.map((s) => s.from), ['user', 'user'], 'no plugin MCP file is read without a string installPath')
})

test('a directory named config.toml is an error line, and the rest of the report still prints', async () => {
  const home = makeHome()
  rmSync(join(home, '.codex/config.toml'))
  mkdirSync(join(home, '.codex/config.toml'))
  const r = doctorGlobal({ AC, root: home, home, env: {} })
  assert.equal(r.ok, false)
  assert.equal(r.errors.length, 1)
  assert.match(r.errors[0], /config\.toml: /)
  assert.deepEqual(r.claude.plugins, ['alpha@m', 'beta@m', 'ponytail@ponytail'])
  const cli = await runNode([BIN, 'doctor', '--global'], { env: { ...process.env, HOME: home, CLAUDE_CONFIG_DIR: '', CODEX_HOME: '' } })
  assert.equal(cli.code, 1)
  assert.match(cli.stderr + cli.stdout, /^error: .*config\.toml: /m)
  assert.match(cli.stdout, /enabled plugin/)
})

test('CLAUDE_CONFIG_DIR moves settings.json, .claude.json and the plugin registry', () => {
  const home = makeHome()
  const moved = temp()
  put(moved, { 'settings.json': { enabledPlugins: { 'solo@m': true } }, '.claude.json': { mcpServers: { only: { command: 'x' } } } })
  const r = doctorGlobal({ AC, root: home, home, env: { CLAUDE_CONFIG_DIR: moved } })
  assert.deepEqual(r.claude.plugins, ['solo@m'])
  assert.deepEqual(r.claude.mcp.map((s) => s.name), ['only'])
  assert.deepEqual(r.codex.mcp, ['docs', 'two words'], 'Codex still reads ~/.codex')
})

test('CODEX_HOME moves the Codex config', () => {
  const home = makeHome()
  const codexHome = temp()
  put(codexHome, { 'config.toml': '[mcp_servers.one]\ncommand = "x"\n' })
  const r = doctorGlobal({ AC, root: home, home, env: { CODEX_HOME: codexHome } })
  assert.deepEqual(r.codex.mcp, ['one'])
  assert.deepEqual(r.claude.plugins, ['alpha@m', 'beta@m', 'ponytail@ponytail'], 'Claude still reads ~/.claude')
})

test('the status line command uses the unversioned compass path in quotes, and runs from a path with a space', async () => {
  const { cpSync } = await import('node:fs')
  const { spawnSync } = await import('node:child_process')
  const spaced = join(temp(), 'my compass')
  cpSync(join(AC, 'plugins/compass-user/scripts'), join(spaced, 'plugins/compass-user/scripts'), { recursive: true })
  const home = makeHome()
  const fix = doctorGlobal({ AC: spaced, root: home, home, env: {} }).recommended.find((c) => c.name === 'statusLine').fix
  const { statusLine } = JSON.parse(fix.slice(fix.indexOf('{')))
  const script = join(spaced, 'plugins/compass-user/scripts/statusline.mjs')
  assert.equal(statusLine.command, `node ${JSON.stringify(script)}`)
  assert.doesNotMatch(statusLine.command, /\/\d+\.\d+\.\d+\//, 'no plugin version in the path')
  const run = spawnSync('sh', ['-c', statusLine.command], { input: JSON.stringify({ model: { display_name: 'Opus' } }), encoding: 'utf8', timeout: 10_000 })
  assert.equal(run.status, 0, run.stderr)
  assert.match(run.stdout, /Opus/)
})

test('a hook command that is listed more than once for one event is a warning', () => {
  const home = makeHome({ settings: { hooks: { SessionStart: [cmd('remind'), cmd('remind'), cmd('remind'), cmd(say(10))], UserPromptSubmit: [cmd('remind')] } } })
  const r = doctorGlobal({ AC, root: home, home, env: {} })
  assert.deepEqual(r.warnings.filter((w) => /is listed \d+ times/.test(w)), ['the SessionStart hook "remind" is listed 3 times; it runs 3 times'])
})

test('the hook list covers the four events that inject text; --measure still runs SessionStart only', () => {
  const root = temp()
  const marker = (tag) => `node -e "require('fs').appendFileSync('marker', '${tag}|')"`
  const hooks = {
    SessionStart: [cmd(marker('start'))],
    UserPromptSubmit: [cmd(marker('prompt'))],
    SubagentStart: [cmd(marker('subagent'))],
    PreCompact: [cmd(marker('compact'))],
    Stop: [cmd(marker('stop'))],
  }
  const home = makeHome({ settings: { hooks }, extra: { 'cache/alpha/hooks/hooks.json': { hooks: { SubagentStart: [cmd(say(2))] } } } })
  const listed = doctorGlobal({ AC, root, home }).claude.hooks.map((h) => `${h.event}:${h.from}`)
  assert.deepEqual(listed, ['SessionStart:user settings', 'UserPromptSubmit:user settings', 'SubagentStart:user settings', 'PreCompact:user settings', 'SubagentStart:alpha@m'])
  const r = doctorGlobal({ AC, root, home, measure: true })
  assert.equal(r.measure.items.length, 1)
  assert.equal(readFileSync(join(root, 'marker'), 'utf8'), 'start|')
  assert.match(formatGlobal(r), /5 SessionStart, UserPromptSubmit, SubagentStart or PreCompact hook\(s\)/)
})

test('the options of doctor --global are checked', async () => {
  const home = temp()
  for (const args of [['doctor', '--measure'], ['sync', '--global'], ['doctor', '--global', '--tokens']]) {
    const r = await runNode([BIN, ...args], { env: { ...process.env, HOME: home }, cwd: temp() })
    assert.equal(r.code, 2, args.join(' '))
  }
})

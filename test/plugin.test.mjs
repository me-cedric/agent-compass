import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { runNode } from './helpers.mjs'

const REPO = dirname(dirname(fileURLToPath(import.meta.url)))
const PLUGIN = join(REPO, 'plugins/compass-user')
const read = (...p) => readFileSync(join(REPO, ...p), 'utf8')
const json = (...p) => JSON.parse(read(...p))
const VERSION = json('package.json').version
const temps = []
test.after(() => { for (const d of temps) rmSync(d, { recursive: true, force: true }) })
const temp = () => { const d = mkdtempSync(join(tmpdir(), 'ac-plugin-')); temps.push(d); return d }

test('the plugin copies the core output style and the core hook byte for byte', () => {
  assert.equal(read('plugins/compass-user/output-styles/compass.md'), read('core/files/.claude/output-styles/compass.md'))
  assert.equal(read('plugins/compass-user/hooks/compass.mjs'), read('core/files/.agents/hooks/compass.mjs'))
})

test('hooks.json wires the same events, matchers and modes as the core Claude settings', () => {
  const wire = (hooks, prefix) => Object.fromEntries(Object.entries(hooks).map(([event, groups]) => [event, groups.map((g) => ({
    matcher: g.matcher, modes: g.hooks.map((h) => [h.command.replace(prefix, ''), h.onFailure]),
  }))]))
  const core = Object.fromEntries(Object.entries(json('core/keys.json')['.claude/settings.json'])
    .filter(([key]) => key.startsWith('hooks.')).map(([key, groups]) => [key.slice(6), groups]))
  assert.deepEqual(
    wire(json('plugins/compass-user/hooks/hooks.json').hooks, 'node "${CLAUDE_PLUGIN_ROOT}/hooks/compass.mjs" '),
    wire(core, 'node "${CLAUDE_PROJECT_DIR:-.}/.agents/hooks/compass.mjs" '),
  )
  assert.equal(json('plugins/compass-user/hooks/hooks.json').hooks.PreToolUse[0].hooks[0].onFailure, 'block')
})

test('the manifests, the marketplaces and the package have one version and one plugin name', () => {
  const claude = json('plugins/compass-user/.claude-plugin/plugin.json')
  const codex = json('plugins/compass-user/.codex-plugin/plugin.json')
  const market = json('.claude-plugin/marketplace.json')
  const codexMarket = json('.agents/plugins/marketplace.json')
  assert.deepEqual([claude.name, codex.name, market.plugins[0].name, codexMarket.plugins[0].name], Array(4).fill('compass-user'))
  assert.deepEqual([claude.version, codex.version, market.plugins[0].version], Array(3).fill(VERSION))
  assert.equal(market.name, codexMarket.name)
  assert.equal(codex.skills, './skills/')
  assert.equal(market.plugins[0].source, './plugins/compass-user')
  assert.equal(codexMarket.plugins[0].source.path, './plugins/compass-user')
})

test('the compass-style skill is 40 lines or fewer and names the four skills', () => {
  const text = read('plugins/compass-user/skills/compass-style/SKILL.md')
  assert.ok(text.trimEnd().split('\n').length <= 40)
  assert.match(text, /^---\nname: compass-style\n/)
  for (const skill of ['ponytail', 'i-have-adhd', 'caveman', 'asd-ste100']) assert.ok(text.includes(`\`${skill}\``), skill)
})

const STATUS = join(PLUGIN, 'scripts/statusline.mjs')
const assistant = (usage, extra = {}) => ({ type: 'assistant', message: { usage }, ...extra })
const status = (input, lines) => {
  const dir = temp()
  const transcript = join(dir, 't.jsonl')
  if (lines) writeFileSync(transcript, `${lines.map((l) => (typeof l === 'string' ? l : JSON.stringify(l))).join('\n')}\n`)
  return runNode([STATUS], { input: typeof input === 'string' ? input : JSON.stringify({ transcript_path: transcript, ...input }) })
}
const base = { model: { display_name: 'Opus' }, workspace: { current_dir: '/work/my-project' } }

test('statusline prints the model, the directory, the cache share and the context size', async () => {
  const r = await status(base, [
    assistant({ input_tokens: 1, cache_read_input_tokens: 1 }),
    assistant({ input_tokens: 100, cache_creation_input_tokens: 400, cache_read_input_tokens: 9500, output_tokens: 7 }),
    assistant({ input_tokens: 5000, cache_read_input_tokens: 0 }, { isSidechain: true }),
    assistant({ input_tokens: 0, cache_read_input_tokens: 0 }),
    { type: 'user', message: { content: 'hi' } },
  ])
  assert.equal(r.code, 0, r.stderr)
  assert.equal(r.stdout, 'Opus · my-project · cache 95% · ctx 10k\n')
})

test('statusline reads only the last 64 KB and skips the cut line', async () => {
  const filler = assistant({ input_tokens: 1, cache_read_input_tokens: 1 }, { pad: 'x'.repeat(2000) })
  const lines = [assistant({ input_tokens: 90000 }), ...Array(40).fill(filler), assistant({ input_tokens: 2000, cache_read_input_tokens: 2000 })]
  const r = await status(base, lines)
  assert.equal(r.stdout, 'Opus · my-project · cache 50% · ctx 4k\n')
  const old = await status(base, [assistant({ input_tokens: 90000 }), ...Array(40).fill({ type: 'user', pad: 'x'.repeat(2000) })])
  assert.equal(old.stdout, 'Opus · my-project\n', 'a message outside the window is not read')
})

test('statusline never throws: on an error it prints the model only', async () => {
  assert.equal((await status({ ...base, transcript_path: join(temp(), 'missing.jsonl') }, null)).stdout, 'Opus\n')
  assert.equal((await status(base, ['not json', '{', ''])).stdout, 'Opus · my-project\n')
  assert.equal((await status({ ...base, workspace: null }, [])).stdout, 'Opus\n')
  const empty = await status('not json')
  assert.deepEqual([empty.code, empty.stdout.trim()], [0, ''])
  const none = await status(JSON.stringify(base))
  assert.deepEqual([none.code, none.stdout], [0, 'Opus · my-project\n'])
})

// A provider test installs the plugin from this repo into an empty config. The real configuration never changes.
const available = (bin) => { const r = spawnSync(bin, ['--version'], { stdio: 'ignore', timeout: 30_000 }); return !r.error && r.status === 0 }
const sh = (bin, args, env) => {
  const r = spawnSync(bin, args, { env, encoding: 'utf8', timeout: 20_000, stdio: ['ignore', 'pipe', 'pipe'] })
  assert.equal(r.status, 0, `${bin} ${args.join(' ')}: ${r.error?.message ?? ''} ${r.stdout}${r.stderr}`)
  return r.stdout
}
const isolated = (extra) => {
  const home = temp()
  mkdirSync(join(home, 'cfg'))
  return { ...process.env, HOME: home, ...Object.fromEntries(Object.entries(extra).map(([k, v]) => [k, join(home, v)])) }
}

test('claude: the plugin validates and installs into an isolated config', { skip: !available('claude') && 'claude is not on PATH', timeout: 60_000 }, () => {
  const env = isolated({ CLAUDE_CONFIG_DIR: 'cfg', CLAUDE_CODE_PLUGIN_CACHE_DIR: 'cfg/plugins' })
  sh('claude', ['plugin', 'validate', REPO], env)
  sh('claude', ['plugin', 'validate', PLUGIN], env)
  sh('claude', ['plugin', 'marketplace', 'add', REPO], env)
  sh('claude', ['plugin', 'install', 'compass-user@agent-compass'], env)
  const list = sh('claude', ['plugin', 'list'], env)
  assert.match(list, /compass-user@agent-compass/)
  assert.match(list, new RegExp(`Version: ${VERSION.replaceAll('.', '\\.')}`))
  assert.match(list, /enabled/)
})

test('codex: the plugin installs into an isolated CODEX_HOME', { skip: !available('codex') && 'codex is not on PATH', timeout: 60_000 }, () => {
  const env = isolated({ CODEX_HOME: 'cfg' })
  sh('codex', ['plugin', 'marketplace', 'add', REPO], env)
  sh('codex', ['plugin', 'add', 'compass-user@agent-compass'], env)
  assert.match(sh('codex', ['plugin', 'list'], env), new RegExp(`compass-user@agent-compass\\s+installed, enabled\\s+${VERSION.replaceAll('.', '\\.')}`))
})

test('copilot: the plugin installs into an isolated COPILOT_HOME', { skip: !available('copilot') && 'copilot is not on PATH', timeout: 60_000 }, () => {
  const env = isolated({ COPILOT_HOME: 'cfg' })
  sh('copilot', ['plugin', 'marketplace', 'add', REPO], env)
  sh('copilot', ['plugin', 'install', 'compass-user@agent-compass'], env)
  assert.match(sh('copilot', ['plugin', 'list'], env), new RegExp(`compass-user@agent-compass \\(v${VERSION.replaceAll('.', '\\.')}\\)`))
})

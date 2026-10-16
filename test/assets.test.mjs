import assert from 'node:assert/strict'
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { KINDS, listAssets, recommendedConfig, setAsset, writeConfig } from '../engine/assets.mjs'
import { loadConfig, PATH_DEFAULTS } from '../engine/config.mjs'
import { detectSignals, STACK_IDS } from '../engine/detect.mjs'
import { buildPlan } from '../engine/plan.mjs'
import { loadUpstream } from '../engine/upstream.mjs'
import { runNode } from './helpers.mjs'

const REPO = dirname(dirname(fileURLToPath(import.meta.url)))
const temps = []
test.after(() => { for (const dir of temps) rmSync(dir, { recursive: true, force: true }) })

// An empty upstream cache keeps the plan the same on every machine.
process.env.AC_CACHE = mkdtempSync(join(tmpdir(), 'ac-assets-cache-'))
temps.push(process.env.AC_CACHE)

const makeHost = (files = {}) => {
  const root = mkdtempSync(join(tmpdir(), 'ac-assets-'))
  temps.push(root)
  for (const [rel, text] of Object.entries(files)) {
    mkdirSync(dirname(join(root, rel)), { recursive: true })
    writeFileSync(join(root, rel), text)
  }
  return root
}

const freeze = (v) => (v && typeof v === 'object' ? Object.values(v).forEach(freeze) || Object.freeze(v) : v)
const TS = 'typescript-lsp@claude-plugins-official'
const SWIFT = 'swift-lsp@claude-plugins-official'
const BASE = { version: 1, packs: ['p1'], exclude: ['x'], mcp: ['m1'], plugins: ['q1@m'], upstream: ['u1'], paths: { delivery: 'd' } }
const REACT = JSON.stringify({ dependencies: { react: '19' } })
const WEB_HOST = { 'package.json': REACT, '.github/workflows/ci.yml': 'on: push\n', '.env.example': 'A=1\n', 'sonar-project.properties': 'sonar.projectKey=x\n' }

const cfgOf = (root) => loadConfig(root, REPO, { init: true }).config
const planOf = (root, config) => buildPlan({ AC: REPO, root, config, paths: PATH_DEFAULTS })
const find = (list, kind, id) => list.assets.find((a) => a.kind === kind && a.id === id)

test('detectSignals adds the tool signals to the stacks and the packs', () => {
  const root = makeHost({
    'package.json': JSON.stringify({ dependencies: { react: '19', pg: '8' }, devDependencies: { '@storybook/react': '8' } }),
    '.github/workflows/ci.yml': 'on: push\n',
    '.gitlab-ci.yml': 'stages: []\n',
    'sonar-project.properties': 'sonar.projectKey=x\n',
    'deploy/helm/app/Chart.yaml': 'name: app\n',
    '.figma-ref/index.json': '{}',
    '.gitmodules': '[submodule "vendor/agent-compass"]\n\tpath = vendor/agent-compass\n',
  })
  const signals = detectSignals(root)
  for (const id of ['react-web', 'security', 'github', 'gitlab', 'sonar', 'storybook', 'postgres', 'helm', 'figma', 'compass-submodule']) {
    assert.ok(signals.has(id), id)
  }
  assert.deepEqual([...detectSignals(makeHost())], [])
})

test('detectSignals: helm dirs, the figma file key and the depth limit', () => {
  assert.ok(detectSignals(makeHost({ 'charts/.keep': '' })).has('helm'))
  assert.ok(detectSignals(makeHost({ 'helm/.keep': '' })).has('helm'))
  assert.ok(!detectSignals(makeHost({ 'a/b/c/d/Chart.yaml': 'x: 1\n' })).has('helm'))
  const screens = (screen) => ({ 'docs/designs/screens.json': JSON.stringify({ version: 1, screens: [screen] }) })
  assert.ok(detectSignals(makeHost(screens({ id: 'SCR-001', figma: { fileKey: 'k', nodeId: '1:2' } }))).has('figma'))
  assert.ok(!detectSignals(makeHost(screens({ id: 'SCR-001' }))).has('figma'))
  assert.ok(!detectSignals(makeHost({ '.gitmodules': '[submodule "x"]\n\tpath = x\n' })).has('compass-submodule'))
})

test('listAssets lists every kind with the plan state, the stack fit and the recommendation', () => {
  const root = makeHost(WEB_HOST)
  const list = listAssets({ AC: REPO, root })
  assert.deepEqual(list.errors, [])
  assert.ok(list.stacks.includes('react-web'))
  assert.ok(list.signals.includes('github') && list.signals.includes('react-web'))
  assert.deepEqual(list.packs, { detected: ['env', 'security'], configured: [] })
  for (const kind of KINDS) assert.ok(list.assets.some((a) => a.kind === kind), `kind ${kind}`)
  const keys = list.assets.map((a) => `${a.kind}:${a.id}`)
  assert.equal(new Set(keys).size, keys.length, 'ids are unique inside a kind')
  for (const a of list.assets) {
    assert.ok(KINDS.includes(a.kind) && a.id && a.title, `${a.kind}:${a.id}`)
    assert.ok(['on', 'available', 'recommended'].every((k) => typeof a[k] === 'boolean') && typeof a.reason === 'string' && typeof a.description === 'string')
    assert.match(a.source, /^(compass|core|catalog|pack:[a-z0-9-]+|upstream:[a-z0-9-]+)$/)
  }

  const react = find(list, 'rule', '.claude/rules/stack-react.md')
  assert.deepEqual([react.on, react.available, react.recommended, react.reason], [true, true, true, 'stack react-web'])
  const nest = find(list, 'rule', '.claude/rules/stack-nestjs.md')
  assert.deepEqual([nest.on, nest.available, nest.recommended], [false, false, false])
  assert.match(nest.reason, /needs stack nestjs-api/)
  const worker = find(list, 'agent', 'worker')
  assert.deepEqual([worker.source, worker.on, worker.recommended, worker.reason], ['core', true, true, 'baseline'])
  assert.deepEqual([find(list, 'skill', 'review').source, find(list, 'skill', 'review').on], ['compass', true])
  assert.ok(find(list, 'block', 'AGENTS.md').on && find(list, 'file', '.claude/output-styles/compass.md').on)

  const env = find(list, 'pack', 'env')
  assert.deepEqual([env.on, env.recommended, env.reason], [true, true, 'pack env detected'])
  assert.deepEqual([find(list, 'skill', 'env').source, find(list, 'skill', 'env').on], ['pack:env', true])
  const ci = find(list, 'pack', 'ci-github')
  assert.deepEqual([ci.on, ci.recommended, ci.reason], [false, true, 'signal github'])
  assert.equal(find(list, 'pack', 'ci-gitlab').recommended, false)
  assert.equal(find(list, 'pack', 'renovate').recommended, false)
  assert.equal(find(list, 'skill', 'e2e').on, false)

  const playwright = find(list, 'mcp', 'playwright')
  assert.deepEqual([playwright.on, playwright.recommended, playwright.reason, playwright.source], [true, true, 'stack react-web', 'catalog'])
  assert.deepEqual([find(list, 'mcp', 'github').on, find(list, 'mcp', 'github').recommended, find(list, 'mcp', 'github').reason], [false, true, 'signal github'])
  assert.equal(find(list, 'mcp', 'sonarqube').recommended, true)
  assert.equal(find(list, 'mcp', 'context7').reason, 'baseline')
  assert.equal(find(list, 'mcp', 'context7').on, false)
  const graph = find(list, 'mcp', 'codebase-memory')
  assert.deepEqual([graph.on, graph.auto, graph.recommended, graph.reason], [true, true, true, 'baseline'])
  assert.equal(find(list, 'mcp', 'grafana').recommended, false)
  assert.equal(find(list, 'mcp', 'projectmem').recommended, false)
  const lsp = find(list, 'plugin', TS)
  assert.deepEqual([lsp.on, lsp.auto, lsp.available, lsp.recommended, lsp.reason, lsp.source], [true, true, true, true, 'stack react-web', 'catalog'])
  assert.match(lsp.description, /TypeScript/)
  const swift = find(list, 'plugin', SWIFT)
  assert.deepEqual([swift.on, swift.auto, swift.available, swift.recommended, swift.reason], [false, false, true, false, 'opt-in'])
  assert.equal(find(list, 'upstream', 'ponytail').recommended, true)
  assert.equal(find(list, 'upstream', 'taste').recommended, true)
  assert.equal(find(list, 'upstream', 'android').recommended, false)
  assert.equal(find(list, 'upstream', 'taste').source, 'upstream:taste')
})

test('listAssets: renovate is recommended with the compass submodule and without a renovate config', () => {
  const sub = { '.gitmodules': '[submodule "v"]\n\tpath = v\n\turl = https://example.test/agent-compass.git\n' }
  assert.equal(find(listAssets({ AC: REPO, root: makeHost(sub) }), 'pack', 'renovate').recommended, true)
  assert.equal(find(listAssets({ AC: REPO, root: makeHost({ ...sub, 'renovate.json': '{}' }) }), 'pack', 'renovate').recommended, false)
  assert.equal(find(listAssets({ AC: REPO, root: makeHost({ '.gitlab-ci.yml': 'stages: []\n' }) }), 'pack', 'ci-gitlab').recommended, true)
})

test('listAssets reports a broken config and works without .agents/compass.json', () => {
  const broken = listAssets({ AC: REPO, root: makeHost({ '.agents/compass.json': '{ "packs": ["nope"] }' }) })
  assert.match(broken.errors.join('\n'), /unknown pack "nope"/)
  assert.deepEqual(broken.assets, [])
  assert.deepEqual(listAssets({ AC: REPO, root: makeHost() }).errors, [])
})

test('the plan honours agent: and pack: excludes', () => {
  const root = makeHost({ '.env.example': 'A=1\n' })
  const base = cfgOf(root)
  const plan = planOf(root, base)
  assert.ok(plan.files.has('.claude/agents/worker.md') && plan.files.has('.codex/agents/worker.toml') && plan.files.has('.github/agents/worker.agent.md'))
  assert.ok(plan.packs.includes('env') && plan.skills.has('env'))
  const off = planOf(root, { ...base, exclude: ['agent:worker', 'pack:env'] })
  for (const path of ['.claude/agents/worker.md', '.codex/agents/worker.toml', '.github/agents/worker.agent.md']) assert.ok(!off.files.has(path), path)
  assert.ok(off.files.has('.claude/agents/scout.md'))
  assert.ok(!off.packs.includes('env') && !off.skills.has('env'))
  assert.ok(!planOf(root, { ...base, packs: ['e2e'], exclude: ['pack:e2e'] }).skills.has('e2e'))
})

test('setAsset toggles skills, rules and agents and never mutates its input', () => {
  const config = freeze({ ...BASE })
  const off = setAsset(config, { kind: 'skill', id: 'review' }, false)
  assert.deepEqual(off.exclude, ['x', 'review'])
  assert.deepEqual(setAsset(off, { kind: 'skill', id: 'review' }, false).exclude, ['x', 'review'])
  assert.deepEqual(setAsset(freeze(off), { kind: 'skill', id: 'review' }, true).exclude, ['x'])
  assert.deepEqual({ ...off, exclude: BASE.exclude }, BASE, 'other keys stay as they are')
  assert.deepEqual(config.exclude, ['x'])

  const rule = { kind: 'rule', id: '.claude/rules/stack-react.md' }
  assert.deepEqual(setAsset(config, rule, false).exclude, ['x', '.claude/rules/stack-react.md'])
  const both = freeze({ ...BASE, exclude: ['a', '.claude/rules/stack-react.md', 'stack-react', 'b'] })
  assert.deepEqual(setAsset(both, rule, true).exclude, ['a', 'b'])
  const nested = { kind: 'rule', id: '.claude/rules/common/style.md' }
  assert.deepEqual(setAsset(setAsset(config, nested, false), nested, true).exclude, ['x'])

  assert.deepEqual(setAsset(config, { kind: 'agent', id: 'worker' }, false).exclude, ['x', 'agent:worker'])
  assert.deepEqual(setAsset(freeze({ ...BASE, exclude: ['agent:worker'] }), { kind: 'agent', id: 'worker' }, true).exclude, [])
  for (const kind of ['file', 'block']) {
    const off2 = setAsset(config, { kind, id: 'docs/a.md' }, false)
    assert.deepEqual(off2.exclude, ['x', 'docs/a.md'])
    assert.deepEqual(setAsset(freeze(off2), { kind, id: 'docs/a.md' }, true).exclude, ['x'])
  }
})

test('switching the compass hook script off also switches off the hook keys that call it', () => {
  const root = makeHost(WEB_HOST)
  const hook = find(listAssets({ AC: REPO, root }), 'file', '.agents/hooks/compass.mjs')
  assert.deepEqual(hook.also.sort(), ['.claude/settings.json', '.codex/hooks.json'].flatMap((f) => ['PreToolUse', 'SessionStart', 'Stop'].map((e) => `${f}#hooks.${e}`)))
  const off = setAsset(cfgOf(root), hook, false)
  assert.deepEqual(off.exclude, ['.agents/hooks/compass.mjs', ...hook.also])
  const plan = planOf(root, off)
  assert.ok(!plan.files.has('.agents/hooks/compass.mjs'))
  assert.ok(![...(plan.keys.get('.claude/settings.json') ?? new Map()).keys()].some((k) => k.startsWith('hooks.')), 'no hook key calls a missing script')
  assert.deepEqual(setAsset(off, hook, true).exclude, [])
  assert.equal(find(listAssets({ AC: REPO, root }), 'file', '.claude/output-styles/compass.md').also, undefined)
})

test('setAsset: packs, MCP servers and upstream sources', () => {
  const config = freeze({ ...BASE })
  const pack = { kind: 'pack', id: 'env', auto: false }
  const on = setAsset(config, pack, true)
  assert.deepEqual(on.packs, ['p1', 'env'])
  assert.deepEqual(setAsset(on, pack, true).packs, ['p1', 'env'])
  const off = setAsset(on, pack, false)
  assert.deepEqual([off.packs, off.exclude], [['p1'], ['x']], 'a manual pack leaves no exclude entry')
  assert.deepEqual(setAsset(config, { kind: 'pack', id: 'env', auto: true }, false).exclude, ['x', 'pack:env'])
  assert.deepEqual(setAsset(config, { kind: 'pack', id: 'env' }, false).exclude, ['x', 'pack:env'], 'an asset without auto gets the exclude entry')
  const detected = freeze({ ...BASE, exclude: ['pack:env'] })
  assert.deepEqual([setAsset(detected, { kind: 'pack', id: 'env', auto: true }, true).packs, setAsset(detected, { kind: 'pack', id: 'env', auto: true }, true).exclude], [['p1'], []])
  assert.deepEqual(setAsset(detected, { kind: 'pack', id: 'env' }, true).packs, ['p1', 'env'])

  const mcp = { kind: 'mcp', id: 'playwright', auto: true }
  assert.deepEqual(setAsset(config, mcp, false).exclude, ['x', 'mcp:playwright'])
  assert.deepEqual(setAsset(freeze({ ...BASE, exclude: ['mcp:playwright'] }), mcp, true).exclude, [])
  assert.deepEqual(setAsset(config, { kind: 'mcp', id: 'github', auto: false }, true).mcp, ['m1', 'github'])
  assert.deepEqual([setAsset(config, { kind: 'mcp', id: 'm1', auto: false }, false).mcp, setAsset(config, { kind: 'mcp', id: 'm1', auto: false }, false).exclude], [[], ['x']])
  assert.deepEqual(setAsset({ version: 1, packs: [], exclude: [] }, { kind: 'mcp', id: 'github', auto: false }, true).mcp, ['github'])

  const plugin = { kind: 'plugin', id: TS, auto: true }
  assert.deepEqual([setAsset(config, plugin, false).exclude, setAsset(config, plugin, false).plugins], [['x', `plugin:${TS}`], ['q1@m']])
  assert.deepEqual([setAsset(freeze({ ...BASE, exclude: [`plugin:${TS}`] }), plugin, true).exclude, setAsset(freeze({ ...BASE, exclude: [`plugin:${TS}`] }), plugin, true).plugins], [[], ['q1@m']])
  assert.deepEqual(setAsset(config, { kind: 'plugin', id: SWIFT, auto: false }, true).plugins, ['q1@m', SWIFT])
  assert.deepEqual([setAsset(config, { kind: 'plugin', id: 'q1@m', auto: false }, false).plugins, setAsset(config, { kind: 'plugin', id: 'q1@m', auto: false }, false).exclude], [[], ['x']])
  assert.deepEqual(setAsset({ version: 1, packs: [], exclude: [] }, { kind: 'plugin', id: SWIFT, auto: false }, true).plugins, [SWIFT])

  assert.deepEqual(setAsset(config, { kind: 'upstream', id: 'taste' }, true).upstream, ['u1', 'taste'])
  assert.deepEqual([setAsset(config, { kind: 'upstream', id: 'u1' }, false).upstream, setAsset(config, { kind: 'upstream', id: 'u1' }, false).exclude], [[], ['x']])
})

test('setAsset: a skill of an inactive pack also activates the pack', () => {
  const config = freeze({ ...BASE, exclude: ['pack:e2e', 'e2e'] })
  const next = setAsset(config, { kind: 'skill', id: 'e2e', source: 'pack:e2e' }, true)
  assert.deepEqual([next.packs, next.exclude], [['p1', 'e2e'], []])
  assert.deepEqual(setAsset(config, { kind: 'skill', id: 'e2e', source: 'pack:e2e' }, false).packs, ['p1'])
})

test('listAssets follows setAsset for every kind', () => {
  const root = makeHost(WEB_HOST)
  const flip = (kind, id, on) => {
    const asset = find(listAssets({ AC: REPO, root }), kind, id)
    assert.equal(asset.on, !on, `${kind}:${id} starts ${!on}`)
    writeConfig(root, setAsset(cfgOf(root), asset, on))
    assert.equal(find(listAssets({ AC: REPO, root }), kind, id).on, on, `${kind}:${id} turns ${on}`)
  }
  const cases = [
    ['skill', 'review'], ['rule', '.claude/rules/stack-react.md'], ['agent', 'worker'], ['pack', 'env'], ['mcp', 'playwright'], ['mcp', 'codebase-memory'], ['plugin', TS],
    ['file', '.claude/output-styles/compass.md'], ['block', 'AGENTS.md'],
  ]
  for (const [kind, id] of cases) { flip(kind, id, false); flip(kind, id, true) }
  flip('pack', 'ci-github', true)
  flip('pack', 'ci-github', false)
  flip('mcp', 'context7', true)
  flip('mcp', 'context7', false)
  flip('plugin', SWIFT, true)
  flip('plugin', SWIFT, false)
  flip('upstream', 'ponytail', true)
  flip('upstream', 'ponytail', false)
  flip('skill', 'e2e', true)
  assert.ok(find(listAssets({ AC: REPO, root }), 'pack', 'e2e').on)
  assert.deepEqual(cfgOf(root).exclude, [])
})

test('recommendedConfig applies the recommended set and keeps the other excludes', () => {
  const root = makeHost(WEB_HOST)
  const config = freeze({
    version: 1,
    packs: ['e2e'],
    exclude: ['review', 'agent:worker', 'pack:env', 'mcp:playwright', 'mcp:github', `plugin:${TS}`, 'mcp:codebase-memory', '.claude/rules/stack-react.md', 'stack-react', 'keep-me', 'nest-only'],
    upstream: ['mattpocock'],
    mcp: ['grafana'],
    paths: {},
  })
  const next = recommendedConfig({ AC: REPO, root, config })
  assert.deepEqual(next.exclude, ['keep-me', 'nest-only'])
  assert.deepEqual(next.packs, ['e2e', 'ci-github'])
  assert.ok(!next.packs.includes('env'), 'a detected pack stays automatic')
  assert.ok(next.mcp.includes('grafana') && next.mcp.includes('github') && next.mcp.includes('sonarqube') && next.mcp.includes('context7'))
  assert.ok(!next.mcp.includes('playwright') && !next.mcp.includes('codebase-memory'), 'a stack server stays automatic')
  assert.equal(next.plugins, undefined, 'a stack plugin stays automatic')
  assert.ok(['ponytail', 'taste', 'mattpocock'].every((id) => next.upstream.includes(id)) && !next.upstream.includes('android'))
  assert.deepEqual(next.paths, {})

  writeConfig(root, next)
  const after = listAssets({ AC: REPO, root })
  assert.deepEqual(after.errors, [])
  const missing = after.assets.filter((a) => a.recommended && a.available && !a.on).map((a) => `${a.kind}:${a.id}`)
  assert.deepEqual(missing, [], 'every recommended asset is on')
})

test('writeConfig writes 2-space JSON and a round trip keeps a small file as it is', () => {
  const root = makeHost()
  const text = `${JSON.stringify({ version: 1, packs: [], exclude: [] }, null, 2)}\n`
  writeConfig(root, { version: 1, packs: [], exclude: [], upstream: [], mcp: [], plugins: [], paths: {} })
  assert.equal(readFileSync(join(root, '.agents/compass.json'), 'utf8'), text)
  writeConfig(root, cfgOf(root))
  assert.equal(readFileSync(join(root, '.agents/compass.json'), 'utf8'), text)
  writeConfig(root, { ...cfgOf(root), mcp: ['github'], plugins: [SWIFT], paths: { delivery: 'd' } })
  const saved = JSON.parse(readFileSync(join(root, '.agents/compass.json'), 'utf8'))
  assert.deepEqual([saved.mcp, saved.plugins, saved.paths], [['github'], [SWIFT], { delivery: 'd' }])
})

test('the catalog suggest lists and the upstream stacks lists name known signals', () => {
  const known = new Set([...STACK_IDS, 'env', 'local-run', 'e2e', 'security', 'github', 'gitlab', 'sonar', 'storybook', 'postgres', 'helm', 'figma', 'compass-submodule', '*'])
  const catalog = JSON.parse(readFileSync(join(REPO, 'mcp/catalog.json'), 'utf8')).servers
  const suggest = Object.fromEntries(Object.entries(catalog).filter(([, e]) => e.suggest).map(([name, e]) => [name, e.suggest]))
  assert.deepEqual(suggest, {
    argocd: ['helm'], kubernetes: ['helm'], github: ['github'], sonarqube: ['sonar'], dbhub: ['postgres'], figma: ['figma'],
    storybook: ['storybook'], 'process-compose': ['local-run'], context7: ['*'],
  })
  assert.deepEqual(catalog['codebase-memory'].stacks, ['*'])
  for (const [name, list] of Object.entries(suggest)) assert.ok(list.every((s) => known.has(s)), name)
  const { sources, errors } = loadUpstream(REPO)
  assert.deepEqual(errors, [])
  const stacks = Object.fromEntries(Object.entries(sources).filter(([, s]) => s.stacks).map(([id, s]) => [id, s.stacks]))
  assert.deepEqual(Object.keys(stacks).sort(), ['agent-device', 'android', 'apple-macos', 'dimillian', 'gtk', 'swift-ios', 'taste', 'winui'])
  for (const [id, list] of Object.entries(stacks)) assert.ok(list.every((s) => STACK_IDS.includes(s)), id)
  assert.ok(['ponytail', 'caveman', 'i-have-adhd', 'asd-ste100', 'mattpocock'].every((id) => !sources[id].stacks))
})

test('upstream.json: stacks must be a list of strings', () => {
  const ac = makeHost({ 'upstream.json': JSON.stringify({ sources: { a: { repo: '/x', sha: 'a'.repeat(40), licence: 'MIT', skills: ['s'], stacks: 'react-web' } } }) })
  assert.match(loadUpstream(ac).errors.join('\n'), /source "a"/)
})

test('ac ui runs the cli of ui/server.mjs', async () => {
  const ac = makeHost({ 'package.json': '{ "version": "1.0.0-test" }\n', 'ui/server.mjs': 'export const cli = (argv, { AC }) => { console.log(JSON.stringify({ argv, AC })); return 3 }\n' })
  for (const dir of ['bin', 'engine']) cpSync(join(REPO, dir), join(ac, dir), { recursive: true })
  const r = await runNode([join(ac, 'bin/ac.mjs'), 'ui', '--port', '0'])
  assert.equal(r.code, 3)
  assert.deepEqual(JSON.parse(r.stdout), { argv: ['--port', '0'], AC: realpathSync(ac) })
  assert.ok(existsSync(join(ac, 'ui/server.mjs')))
})

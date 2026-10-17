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
import { measureTokens } from '../engine/tokens.mjs'
import { loadUpstream } from '../engine/upstream.mjs'
import { frontmatter } from '../engine/util.mjs'
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
const tokensOf = (chars) => Math.ceil(chars / 4)

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
  assert.deepEqual(KINDS, ['skill', 'rule', 'agent', 'pack', 'mcp', 'plugin', 'upstream', 'file', 'block', 'key', 'seed', 'schema'])
  for (const kind of KINDS) assert.ok(list.assets.some((a) => a.kind === kind), `kind ${kind}`)
  const order = list.assets.map((a) => KINDS.indexOf(a.kind))
  assert.deepEqual(order, [...order].sort((a, b) => a - b), 'the assets come in the order of KINDS')
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
  assert.deepEqual([ci.on, ci.recommended, ci.reason], [false, false, 'opt-in: the CI seeds need your install and test commands first'])
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
  const ponytail = find(list, 'upstream', 'ponytail')
  assert.deepEqual([ponytail.recommended, ponytail.available], [false, true])
  assert.match(ponytail.reason, /user level/)
  const taste = find(list, 'upstream', 'taste')
  assert.equal(taste.recommended, false)
  assert.match(taste.reason, /by hand/)
  assert.equal(find(list, 'upstream', 'mattpocock').recommended, true)
  assert.equal(find(list, 'upstream', 'android').recommended, false)
  assert.equal(find(list, 'upstream', 'taste').source, 'upstream:taste')
})

test('listAssets: renovate is recommended with the compass submodule and without a renovate config', () => {
  const sub = { '.gitmodules': '[submodule "v"]\n\tpath = v\n\turl = https://example.test/agent-compass.git\n' }
  assert.equal(find(listAssets({ AC: REPO, root: makeHost(sub) }), 'pack', 'renovate').recommended, true)
  assert.equal(find(listAssets({ AC: REPO, root: makeHost({ ...sub, 'renovate.json': '{}' }) }), 'pack', 'renovate').recommended, false)
  assert.equal(find(listAssets({ AC: REPO, root: makeHost({ '.gitlab-ci.yml': 'stages: []\n' }) }), 'pack', 'ci-gitlab').recommended, false, 'a CI pack stays opt-in')
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

test('a user-invoked skill is marked and costs no always-on tokens', () => {
  const list = listAssets({ AC: REPO, root: makeHost(WEB_HOST) })
  const adr = find(list, 'skill', 'adr')
  assert.deepEqual([adr.userInvoked, adr.tokens], [true, 0])
  assert.equal(find(list, 'skill', 'review').userInvoked, undefined)
  assert.ok(find(list, 'skill', 'review').tokens > 0)
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

test('the recommended set per stack: no user-level or large upstream sources; api-contract-sync for API and web stacks only', () => {
  const lib = listAssets({ AC: REPO, root: makeHost({ 'package.json': JSON.stringify({ name: 'lib', dependencies: { zod: '4' } }) }) })
  assert.deepEqual(lib.assets.filter((a) => a.kind === 'upstream' && a.recommended).map((a) => a.id), ['mattpocock'])
  assert.equal(find(lib, 'skill', 'api-contract-sync').available, false)
  const ios = listAssets({ AC: REPO, root: makeHost({ 'Package.swift': '// swift-tools-version:6.0\n', 'App.xcodeproj/project.pbxproj': 'SDKROOT = iphoneos;\n' }) })
  assert.deepEqual(ios.assets.filter((a) => a.kind === 'upstream' && a.recommended).map((a) => a.id).sort(), ['agent-device', 'dimillian', 'mattpocock'])
  assert.equal(find(ios, 'upstream', 'swift-ios').recommended, false)
  const web = listAssets({ AC: REPO, root: makeHost(WEB_HOST) })
  assert.equal(find(web, 'skill', 'api-contract-sync').recommended, true)
})

test('an asset that Konvoy owns is not available, and the recommended set keeps its exclude', () => {
  const root = makeHost({ ...WEB_HOST, '.agents/konvoy.json': JSON.stringify({ compass_skills: { review: '0.9.1' }, host_files: ['.claude/agents/reviewer.md', '.claude/output-styles/compass.md'] }) })
  const config = { version: 1, packs: [], exclude: ['review', 'agent:reviewer', '.claude/output-styles/compass.md'], paths: {} }
  writeConfig(root, config)
  const list = listAssets({ AC: REPO, root })
  for (const [kind, id] of [['skill', 'review'], ['agent', 'reviewer'], ['file', '.claude/output-styles/compass.md']]) {
    const a = find(list, kind, id)
    assert.deepEqual([a.available, a.recommended, a.reason], [false, false, 'Konvoy owns it (.agents/konvoy.json)'], `${kind} ${id}`)
  }
  const next = recommendedConfig({ AC: REPO, root, config })
  assert.deepEqual(next.exclude, ['review', 'agent:reviewer', '.claude/output-styles/compass.md'])
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
  assert.deepEqual(next.packs, ['e2e'], 'a CI pack stays opt-in')
  assert.ok(!next.packs.includes('env'), 'a detected pack stays automatic')
  assert.ok(next.mcp.includes('grafana') && next.mcp.includes('github') && next.mcp.includes('sonarqube') && next.mcp.includes('context7'))
  assert.ok(!next.mcp.includes('playwright') && !next.mcp.includes('codebase-memory'), 'a stack server stays automatic')
  assert.equal(next.plugins, undefined, 'a stack plugin stays automatic')
  assert.deepEqual(next.upstream, ['mattpocock', 'playwright-cli'], 'style sources are user level; taste is switched on by hand; the Playwright CLI skill fits web stacks')
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
    storybook: ['storybook'], 'process-compose': ['local-run'], context7: ['*'], 'angular-cli': ['angular-web'],
  })
  assert.deepEqual(catalog['codebase-memory'].stacks, ['*'])
  for (const [name, list] of Object.entries(suggest)) assert.ok(list.every((s) => known.has(s)), name)
  const { sources, errors } = loadUpstream(REPO)
  assert.deepEqual(errors, [])
  const stacks = Object.fromEntries(Object.entries(sources).filter(([, s]) => s.stacks).map(([id, s]) => [id, s.stacks]))
  assert.deepEqual(Object.keys(stacks).sort(), ['agent-device', 'agent-device-tools', 'android', 'angular', 'apple-macos', 'dimillian', 'dimillian-more', 'expo', 'gtk', 'playwright-cli', 'swift-ios', 'taste', 'winui'])
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

const withCache = (fn) => {
  const keep = process.env.AC_CACHE
  const cache = mkdtempSync(join(tmpdir(), 'ac-assets-source-cache-'))
  temps.push(cache)
  process.env.AC_CACHE = cache
  try { return fn(cache) } finally { process.env.AC_CACHE = keep }
}

// Files of an upstream source in the cache dir of its pinned sha.
const fillSource = (cache, id, files) => {
  const dir = join(cache, id, loadUpstream(REPO).sources[id].sha)
  for (const [rel, text] of Object.entries({ LICENSE: 'MIT\n', ...files })) {
    mkdirSync(dirname(join(dir, rel)), { recursive: true })
    writeFileSync(join(dir, rel), text)
  }
}
const skillText = (name, description) => `---\nname: ${name}\ndescription: ${description}\n---\nBody.\n`
const fillMattpocock = (cache) => fillSource(cache, 'mattpocock', {
  'grill-me/SKILL.md': skillText('grill-me', 'Grill the plan.'),
  'grilling/SKILL.md': skillText('grilling', 'Ask one question at a time.'),
})

const hasSchema = (plan, id) => [...plan.files.keys()].some((f) => f.startsWith(id))

test('key assets: one per owned key; off drops the key from the plan and on restores it', () => {
  const root = makeHost(WEB_HOST)
  const keys = listAssets({ AC: REPO, root }).assets.filter((a) => a.kind === 'key')
  const owned = Object.entries(JSON.parse(readFileSync(join(REPO, 'core/keys.json'), 'utf8'))).flatMap(([file, map]) => Object.keys(map).map((k) => `${file}#${k}`))
  assert.deepEqual(keys.map((a) => a.id), owned)
  assert.deepEqual(Object.fromEntries(keys.map((a) => [a.id, a.title])), {
    '.claude/settings.json#outputStyle': 'output style',
    '.claude/settings.json#hooks.PreToolUse': 'guard',
    '.claude/settings.json#hooks.Stop': 'gate',
    '.claude/settings.json#hooks.SessionStart': 'start',
    '.claude/settings.json#permissions.deny': 'tracker deny',
    '.claude/settings.json#permissions.ask': 'tracker ask',
    '.claude/settings.json#attribution': 'attribution',
    '.codex/config.toml#model_verbosity': 'Codex verbosity',
    '.codex/config.toml#model_reasoning_summary': 'Codex reasoning summary',
    '.codex/hooks.json#hooks.PreToolUse': 'Codex guard',
    '.codex/hooks.json#hooks.Stop': 'Codex gate',
    '.codex/hooks.json#hooks.SessionStart': 'Codex start',
  })
  for (const a of keys) {
    assert.deepEqual([a.source, a.on, a.available, a.recommended, a.reason], ['core', true, true, true, 'baseline'], a.id)
    assert.match(a.description, /^[A-Z][^\n]+\.$/, a.id)
    const [file, key] = a.id.split('#')
    const off = setAsset(cfgOf(root), a, false)
    assert.deepEqual(off.exclude, [a.id])
    assert.ok(!planOf(root, off).keys.get(file)?.has(key), `${a.id} off`)
    assert.ok(planOf(root, setAsset(off, a, true)).keys.get(file).has(key), `${a.id} on`)
  }
})

test('a key that the Konvoy ledger owns is not available', () => {
  const root = makeHost({ ...WEB_HOST, '.agents/konvoy.json': JSON.stringify({ owns: { keys: { '.claude/settings.json': ['permissions.deny'] } } }) })
  const list = listAssets({ AC: REPO, root })
  assert.deepEqual([find(list, 'key', '.claude/settings.json#permissions.deny').available, find(list, 'key', '.claude/settings.json#permissions.ask').available], [false, true])
  assert.equal(find(list, 'key', '.claude/settings.json#permissions.deny').reason, 'Konvoy owns it (.agents/konvoy.json)')
})

test('a key that the Konvoy ledger owns as a whole file or as an overlapping key is not available', () => {
  const owned = makeHost({ ...WEB_HOST, '.agents/konvoy.json': JSON.stringify({ owns: { files: ['.codex/hooks.json'], keys: { '.claude/settings.json': ['permissions'] } } }) })
  const list = listAssets({ AC: REPO, root: owned })
  const ids = ['.codex/hooks.json#hooks.PreToolUse', '.codex/hooks.json#hooks.Stop', '.codex/hooks.json#hooks.SessionStart', '.claude/settings.json#permissions.deny', '.claude/settings.json#permissions.ask']
  for (const id of ids) assert.deepEqual([find(list, 'key', id).available, find(list, 'key', id).reason], [false, 'Konvoy owns it (.agents/konvoy.json)'], id)
  assert.equal(find(list, 'key', '.codex/config.toml#model_verbosity').available, true)
  const exclude = ids.slice(0, 3)
  assert.deepEqual(recommendedConfig({ AC: REPO, root: owned, config: { version: 1, packs: [], exclude } }).exclude, exclude)
})

test('recommendedConfig keeps the excludes of keys, seeds and the schema: they are the project choices', () => {
  const root = makeHost({ ...WEB_HOST, 'docs/openspec/.keep': '' })
  const own = ['.claude/settings.json#permissions.ask', '.claude/settings.json#outputStyle', '.osv-scanner.toml', 'docs/openspec/schemas/konvoy-delivery/']
  const config = { version: 1, packs: [], exclude: [...own, 'review'] }
  assert.deepEqual(recommendedConfig({ AC: REPO, root, config }).exclude, own)
  writeConfig(root, config)
  const list = listAssets({ AC: REPO, root })
  assert.deepEqual(own.map((id) => find(list, id.includes('#') ? 'key' : id.endsWith('/') ? 'schema' : 'seed', id).recommended), [true, true, true, true], 'the assets stay recommended')
})

test('a hook key is not available while the hook script is off', () => {
  const root = makeHost(WEB_HOST)
  const hook = find(listAssets({ AC: REPO, root }), 'file', '.agents/hooks/compass.mjs')
  writeConfig(root, setAsset(cfgOf(root), hook, false))
  const list = listAssets({ AC: REPO, root })
  for (const id of hook.also) assert.deepEqual([find(list, 'key', id).on, find(list, 'key', id).available, find(list, 'key', id).reason], [false, false, 'switch on .agents/hooks/compass.mjs first'], id)
  assert.equal(find(list, 'key', '.claude/settings.json#permissions.ask').available, true, 'a key that the script does not serve stays available')
  assert.equal(find(list, 'file', '.agents/hooks/compass.mjs').available, true)
  writeConfig(root, setAsset(cfgOf(root), find(list, 'file', '.agents/hooks/compass.mjs'), true))
  assert.ok(hook.also.every((id) => find(listAssets({ AC: REPO, root }), 'key', id).available))
})

test('the key asset of permissions.deny also drops the MCP deny patterns', () => {
  const root = makeHost(WEB_HOST)
  const deny = find(listAssets({ AC: REPO, root }), 'key', '.claude/settings.json#permissions.deny')
  const config = { ...cfgOf(root), mcp: ['figma'] }
  const on = planOf(root, config).keys.get('.claude/settings.json').get('permissions.deny')
  assert.ok(on.includes('mcp__figma__add_code_connect_map') && on.includes('Bash(gh issue delete *)'))
  assert.ok(!planOf(root, setAsset(config, deny, false)).keys.get('.claude/settings.json').has('permissions.deny'))
})

test('seed assets: one per seed file; off drops the file from the plan and on restores it', () => {
  const root = makeHost(WEB_HOST)
  const list = listAssets({ AC: REPO, root })
  assert.ok(list.assets.filter((a) => a.kind === 'seed').length >= 10)
  const osv = find(list, 'seed', '.osv-scanner.toml')
  assert.deepEqual([osv.source, osv.on, osv.available, osv.recommended, osv.reason], ['pack:security', true, true, true, 'pack security detected'])
  assert.ok(osv.title && osv.description)
  const off = setAsset(cfgOf(root), osv, false)
  assert.deepEqual(off.exclude, ['.osv-scanner.toml'])
  assert.ok(planOf(root, cfgOf(root)).files.has('.osv-scanner.toml') && !planOf(root, off).files.has('.osv-scanner.toml'))
  assert.ok(planOf(root, setAsset(off, osv, true)).files.has('.osv-scanner.toml'))
  const check = find(list, 'seed', '.github/workflows/compass-security.yml')
  assert.deepEqual([check.source, check.on, check.recommended], ['pack:ci-github', false, false])
  const next = setAsset(cfgOf(root), check, true)
  assert.deepEqual(next.packs, ['ci-github'], 'a seed of an inactive pack turns the pack on')
  assert.equal(planOf(root, next).files.get('.github/workflows/compass-security.yml').mode, 'seed')
})

test('the schema asset is the OpenSpec schema dir: exclude switches it, the paths move it, Konvoy owns it', () => {
  const id = 'docs/openspec/schemas/konvoy-delivery/'
  const none = find(listAssets({ AC: REPO, root: makeHost(WEB_HOST) }), 'schema', id)
  assert.deepEqual([none.source, none.on, none.available, none.recommended], ['core', false, false, false])
  assert.match(none.reason, /docs\/openspec/)
  const root = makeHost({ ...WEB_HOST, 'docs/openspec/.keep': '' })
  const asset = find(listAssets({ AC: REPO, root }), 'schema', id)
  assert.deepEqual([asset.on, asset.available, asset.recommended], [true, true, true])
  assert.ok(asset.title && asset.description)
  const off = setAsset(cfgOf(root), asset, false)
  assert.deepEqual(off.exclude, [id])
  assert.ok(hasSchema(planOf(root, cfgOf(root)), id) && !hasSchema(planOf(root, off), id) && hasSchema(planOf(root, setAsset(off, asset, true)), id))

  const moved = makeHost({ '.agents/compass.json': JSON.stringify({ version: 1, packs: [], exclude: [], paths: { openspec: 'specs' } }), 'specs/.keep': '' })
  assert.equal(find(listAssets({ AC: REPO, root: moved }), 'schema', 'specs/schemas/konvoy-delivery/').on, true)

  const konvoy = makeHost({ 'docs/openspec/.keep': '', '.agents/konvoy.json': '{}' })
  const owned = find(listAssets({ AC: REPO, root: konvoy }), 'schema', id)
  assert.deepEqual([owned.on, owned.available, owned.reason], [false, false, 'Konvoy owns it (.agents/konvoy.json)'])
})

test('listAssets follows setAsset for the key, seed and schema kinds', () => {
  const root = makeHost({ ...WEB_HOST, 'docs/openspec/.keep': '' })
  for (const [kind, id] of [['key', '.claude/settings.json#hooks.Stop'], ['seed', '.osv-scanner.toml'], ['schema', 'docs/openspec/schemas/konvoy-delivery/']]) {
    for (const on of [false, true]) {
      writeConfig(root, setAsset(cfgOf(root), find(listAssets({ AC: REPO, root }), kind, id), on))
      assert.equal(find(listAssets({ AC: REPO, root }), kind, id).on, on, `${kind}:${id} ${on}`)
    }
  }
  assert.deepEqual(cfgOf(root).exclude, [])
})

test('upstream skills are child skill assets: available when the source is on, with tokens when cached', () => withCache((cache) => {
  const root = makeHost(WEB_HOST)
  const grill = (list) => find(list, 'skill', 'grill-me')
  const first = listAssets({ AC: REPO, root })
  assert.deepEqual([grill(first).source, grill(first).on, grill(first).available, grill(first).reason, grill(first).tokens],
    ['upstream:mattpocock', false, false, 'switch on the source mattpocock first', undefined])
  assert.equal(find(first, 'skill', 'grilling').source, 'upstream:mattpocock')
  assert.equal(grill(first).recommended, true, 'a child follows the recommendation of its source')

  writeConfig(root, setAsset(cfgOf(root), find(first, 'upstream', 'mattpocock'), true))
  const held = grill(listAssets({ AC: REPO, root }))
  assert.deepEqual([held.on, held.available, held.tokens], [true, true, undefined], 'a source that is not in the cache has no token figure')

  fillMattpocock(cache)
  const cached = grill(listAssets({ AC: REPO, root }))
  assert.deepEqual([cached.on, cached.description, cached.tokens], [true, 'Grill the plan.', tokensOf('- grill-me: Grill the plan.'.length)])
  const off = setAsset(cfgOf(root), cached, false)
  assert.deepEqual(off.exclude, ['grill-me'])
  assert.ok(!planOf(root, off).skills.has('grill-me') && planOf(root, off).skills.has('grilling'))
  writeConfig(root, off)
  const after = listAssets({ AC: REPO, root })
  assert.deepEqual([grill(after).on, grill(after).available, grill(after).tokens], [false, true, cached.tokens])
  assert.deepEqual(setAsset(cfgOf(root), grill(after), true).exclude, [])

  const next = recommendedConfig({ AC: REPO, root, config: { ...cfgOf(root), upstream: [], exclude: ['grill-me', 'keep-me'] } })
  assert.deepEqual([next.upstream, next.exclude], [['mattpocock', 'playwright-cli'], ['keep-me']])
}))

test('the text of an upstream skill is found by name, by path and as the root entry', () => withCache((cache) => {
  fillSource(cache, 'asd-ste100', { 'SKILL.md': skillText('asd-ste100', 'STE rules.') })
  fillSource(cache, 'caveman', { 'skills/caveman/SKILL.md': skillText('caveman', 'Short words.'), 'x/caveman-commit/SKILL.md': skillText('caveman-commit', 'Short commits.') })
  const list = listAssets({ AC: REPO, root: makeHost(WEB_HOST) })
  assert.deepEqual(['asd-ste100', 'caveman', 'caveman-commit', 'caveman-review'].map((n) => find(list, 'skill', n).tokens),
    [tokensOf('- asd-ste100: STE rules.'.length), tokensOf('- caveman: Short words.'.length), tokensOf('- caveman-commit: Short commits.'.length), undefined])
}))

test('tokens: a skill, an agent, a block and the output style carry their cost, and the sums agree with measureTokens', () => withCache((cache) => {
  fillMattpocock(cache)
  const root = makeHost(WEB_HOST)
  writeConfig(root, { ...cfgOf(root), upstream: ['mattpocock'] })
  const list = listAssets({ AC: REPO, root })
  const line = (file) => { const d = frontmatter(readFileSync(join(REPO, file), 'utf8')).data; return `- ${d.name}: ${d.description}` }
  assert.equal(find(list, 'skill', 'review').tokens, tokensOf(line('skills/review/SKILL.md').length))
  assert.equal(find(list, 'agent', 'worker').tokens, tokensOf(line('core/agents/worker.md').length))

  const measured = measureTokens({ AC: REPO, root })
  const item = (name) => measured.items.find((i) => i.name === name).tokens
  const sum = (kind) => list.assets.filter((a) => a.kind === kind && a.on).reduce((n, a) => n + (a.tokens ?? 0), 0)
  assert.ok(find(list, 'skill', 'grill-me').on && find(list, 'skill', 'grill-me').tokens > 0)
  assert.equal(sum('skill'), item('skill listing'))
  assert.equal(sum('agent'), item('agent listing'))
  assert.equal(find(list, 'block', 'AGENTS.md').tokens, item('AGENTS.md block'))
  assert.equal(find(list, 'block', 'CLAUDE.md').tokens, item('CLAUDE.md block'))
  assert.equal(find(list, 'file', '.claude/output-styles/compass.md').tokens, item('output style'))
  assert.equal(list.always.current, measured.total, 'the hooks are not synced, so the total is the text only')
  assert.equal(find(list, 'rule', '.claude/rules/stack-react.md').tokens, undefined)
}))

test('always: the estimate of the current config and of the recommended config', () => {
  const root = makeHost(WEB_HOST)
  writeConfig(root, cfgOf(root))
  const full = listAssets({ AC: REPO, root })
  assert.deepEqual([full.always.budget, typeof full.always.note, full.always.current > 0], [2000, 'string', true])
  assert.match(full.always.note, /SessionStart/)
  assert.equal(full.always.recommended, full.always.current)

  writeConfig(root, { ...cfgOf(root), exclude: ['review', 'agent:worker', 'AGENTS.md'] })
  const cut = listAssets({ AC: REPO, root })
  const cost = [find(full, 'skill', 'review'), find(full, 'agent', 'worker'), find(full, 'block', 'AGENTS.md')].reduce((n, a) => n + a.tokens, 0)
  assert.equal(full.always.current - cut.always.current, cost)
  assert.equal(cut.always.recommended, full.always.current, 'the recommended set switches the three assets on again')
  assert.equal(find(cut, 'skill', 'review').tokens, find(full, 'skill', 'review').tokens, 'an asset that is off keeps its figure')
  assert.deepEqual(listAssets({ AC: REPO, root: makeHost({ '.agents/compass.json': '{ "packs": ["nope"] }' }) }).always, { current: 0, recommended: 0, budget: 2000, note: full.always.note })
})

const AC_BIN = join(REPO, 'bin/ac.mjs')
const acAssets = (args) => runNode([AC_BIN, 'assets', ...args])
const acRun = (...args) => runNode([AC_BIN, ...args])

test('ac assets lists the assets by kind as text and as JSON, and writes nothing', async () => {
  const root = makeHost(WEB_HOST)
  const text = await acAssets(['--root', root])
  assert.equal(text.code, 0, text.stderr)
  for (const kind of ['skill', 'agent', 'pack', 'key', 'seed', 'schema']) assert.match(text.stdout, new RegExp(`^${kind} \\(\\d+\\)$`, 'm'), kind)
  assert.match(text.stdout, /^ {2}on {2}\* review +\d+t +baseline$/m)
  assert.match(text.stdout, /^Always-on text: about \d+ tokens now, \d+ with the recommended set\./m)
  assert.ok(!/switch on the source/.test(text.stdout), 'the skills of an off source stay out of the text list')
  assert.ok(!existsSync(join(root, '.agents/compass.json')))
  const r = await acAssets(['--json', '--root', root])
  const out = JSON.parse(r.stdout)
  assert.equal(r.code, 0)
  assert.deepEqual([out.ok, out.errors, out.always.budget], [true, [], 2000])
  assert.ok(out.assets.some((a) => a.kind === 'key') && out.assets.every((a) => a.kind && a.id))
})

test('ac assets off and on switch one asset in compass.json and print the sync diff', async () => {
  const root = makeHost(WEB_HOST)
  assert.equal((await acRun('init', '--root', root)).code, 0)
  const off = await acAssets(['off', 'skill:review', '--root', root])
  assert.equal(off.code, 0, off.stderr)
  assert.deepEqual(cfgOf(root).exclude, ['review'])
  assert.match(off.stdout, /remove {2}\.claude\/skills\/review\/SKILL\.md/)
  assert.match(off.stdout, /ac sync/)
  assert.equal((await acRun('sync', '--root', root)).code, 0)
  const on = await acAssets(['on', 'skill:review', '--root', root])
  assert.equal(on.code, 0, on.stderr)
  assert.deepEqual(cfgOf(root).exclude, [])
  assert.match(on.stdout, /create {2}\.claude\/skills\/review\/SKILL\.md/)

  const key = await acAssets(['off', 'key:.claude/settings.json#hooks.Stop', '--json', '--root', root])
  const out = JSON.parse(key.stdout)
  assert.deepEqual([key.code, out.ok, out.action, out.asset, cfgOf(root).exclude], [0, true, 'off', { kind: 'key', id: '.claude/settings.json#hooks.Stop' }, ['.claude/settings.json#hooks.Stop']])
  assert.ok(out.changes.some((c) => c.path === '.claude/settings.json' && c.key === 'hooks.Stop'))
})

test('ac assets recommended applies the recommended config and keeps the other excludes', async () => {
  const root = makeHost(WEB_HOST)
  assert.equal((await acRun('init', '--root', root)).code, 0)
  writeConfig(root, { ...cfgOf(root), exclude: ['review', 'keep-me'] })
  const r = await acAssets(['recommended', '--root', root])
  assert.equal(r.code, 0, r.stderr)
  assert.deepEqual(cfgOf(root).exclude, ['keep-me'])
  assert.ok(cfgOf(root).mcp.includes('github'))
})

test('ac assets: a usage error exits 2 and a failure exits 1', async () => {
  const root = makeHost(WEB_HOST)
  assert.equal((await acRun('init', '--root', root)).code, 0)
  const code = async (...args) => (await acAssets([...args, '--root', root])).code
  for (const args of [['frob'], ['on'], ['off'], ['on', 'bogus:review'], ['on', 'skill:review', 'extra'], ['recommended', 'skill:review'], ['--nope']]) {
    assert.equal(await code(...args), 2, args.join(' '))
  }
  const help = await acAssets(['--help'])
  assert.equal(help.code, 0)
  assert.match(help.stdout, /^ {2}on <kind>:<id> {3}Switch an asset on/m)
  const missing = await acAssets(['off', 'skill:nope', '--root', root])
  assert.deepEqual([missing.code, /no skill asset "nope"/.test(missing.stderr)], [1, true])
  assert.equal((await acAssets(['off', 'file:.agents/hooks/compass.mjs', '--root', root])).code, 0)
  const hook = await acAssets(['on', 'key:.claude/settings.json#hooks.Stop', '--root', root])
  assert.deepEqual([hook.code, /not available: switch on \.agents\/hooks\/compass\.mjs first/.test(hook.stderr)], [1, true])
  assert.equal((await acAssets(['on', 'file:.agents/hooks/compass.mjs', '--root', root])).code, 0)
  const unfit = await acAssets(['on', 'rule:.claude/rules/stack-nestjs.md', '--root', root])
  assert.deepEqual([unfit.code, /not available: needs stack nestjs-api/.test(unfit.stderr)], [1, true])
  const bare = await acAssets(['off', 'skill:review', '--root', makeHost()])
  assert.deepEqual([bare.code, /ac init/.test(bare.stderr)], [1, true])
  const json = await acAssets(['on', 'skill:nope', '--json', '--root', root])
  assert.deepEqual([json.code, JSON.parse(json.stdout).ok], [1, false])
  assert.equal((await acAssets(['--root', join(root, 'missing')])).code, 1)
})

test('ac assets off and on without a kind resolve a unique name; an ambiguous name lists its forms and exits 2', async () => {
  const root = makeHost(WEB_HOST)
  assert.equal((await acRun('init', '--root', root)).code, 0)
  const off = await acAssets(['off', 'review', '--json', '--root', root])
  assert.equal(off.code, 0, off.stderr)
  assert.deepEqual([JSON.parse(off.stdout).asset, cfgOf(root).exclude], [{ kind: 'skill', id: 'review' }, ['review']])
  const twice = await acAssets(['off', 'env', '--root', root])
  assert.equal(twice.code, 2)
  assert.match(twice.stderr, /"env" is more than one asset: skill:env, pack:env\. Give <kind>:<id>\./)
  assert.deepEqual(JSON.parse((await acAssets(['off', 'env', '--json', '--root', root])).stdout).ok, false)
  assert.deepEqual(cfgOf(root).exclude, ['review'])
  const none = await acAssets(['on', 'nope', '--root', root])
  assert.deepEqual([none.code, /no asset "nope"/.test(none.stderr)], [1, true])
})

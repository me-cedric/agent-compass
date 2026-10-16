import assert from 'node:assert/strict'
import { chmodSync, cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { delimiter, dirname, join } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { PATH_DEFAULTS } from '../engine/config.mjs'
import { STACK_IDS } from '../engine/detect.mjs'
import { doctor } from '../engine/doctor.mjs'
import { mcpPlan } from '../engine/mcp.mjs'
import { tomlRender } from '../engine/merge.mjs'
import { buildPlan } from '../engine/plan.mjs'
import { safeRel } from '../engine/util.mjs'
import { parseToml, runNode } from './helpers.mjs'

const REPO = dirname(dirname(fileURLToPath(import.meta.url)))
const catalog = JSON.parse(readFileSync(join(REPO, 'mcp/catalog.json'), 'utf8'))
const temps = []
test.after(() => { for (const dir of temps) rmSync(dir, { recursive: true, force: true }) })

const temp = (prefix) => {
  const dir = mkdtempSync(join(tmpdir(), prefix))
  temps.push(dir)
  return dir
}

const put = (root, files) => {
  for (const [rel, text] of Object.entries(files)) {
    mkdirSync(dirname(join(root, rel)), { recursive: true })
    writeFileSync(join(root, rel), text)
  }
}

const VAR = /^\$\{([A-Z][A-Z0-9_]*)\}$/
const BEARER = /^Bearer \$\{([A-Z][A-Z0-9_]*)\}$/
const ENTRY_KEYS = ['description', 'status', 'readOnly', 'secrets', 'stacks', 'suggest', 'providers', 'deny', 'files', 'transport', 'command', 'args', 'env', 'url', 'headers']

test('the catalog: every entry has a valid shape', () => {
  assert.equal(catalog.version, 1)
  const names = Object.keys(catalog.servers)
  assert.ok(names.length >= 18, `${names.length} servers`)
  for (const [name, e] of Object.entries(catalog.servers)) {
    assert.match(name, /^[a-z][a-z0-9-]*$/)
    assert.notEqual(name, 'konvoy')
    assert.deepEqual(Object.keys(e).filter((k) => !ENTRY_KEYS.includes(k)), [], `${name}: unknown key`)
    for (const key of ['description', 'readOnly']) assert.ok(typeof e[key] === 'string' && e[key].length > 10, `${name}: ${key}`)
    assert.ok(['adopt', 'trial'].includes(e.status), `${name}: status`)
    assert.ok(Array.isArray(e.stacks) && e.stacks.every((s) => s === '*' || STACK_IDS.includes(s)), `${name}: stacks`)
    assert.ok(e.suggest === undefined || (Array.isArray(e.suggest) && e.suggest.length > 0 && e.suggest.every((s) => typeof s === 'string')), `${name}: suggest`)
    assert.ok(Array.isArray(e.secrets) && e.secrets.every((s) => /^[A-Z][A-Z0-9_]*$/.test(s)), `${name}: secrets`)
    assert.ok((e.providers || ['claude']).every((p) => ['claude', 'codex', 'copilot'].includes(p)), `${name}: providers`)
    assert.ok(Boolean(e.command) !== Boolean(e.url), `${name}: one transport`)
    if (e.transport) assert.ok(e.transport === 'sse' && e.url, `${name}: transport`)
    if (e.deny) assert.ok((e.providers || ['claude']).includes('claude') && e.deny.every((d) => d.startsWith(`mcp__${name}__`)), `${name}: deny`)
    assert.ok(!(e.args || []).some((a) => a.includes('${')), `${name}: "\${" in args`)
    if (e.secrets.length) assert.deepEqual(e.stacks, [], `${name}: a server with secrets is never recommended`)
  }
})

test('the catalog: a secret is "${VAR}" and every listed secret is used', () => {
  for (const [name, e] of Object.entries(catalog.servers)) {
    const used = new Set()
    for (const [key, value] of Object.entries(e.env || {})) {
      if (!value.includes('${')) continue
      assert.match(value, VAR, `${name}: env ${key}`)
      assert.equal(VAR.exec(value)[1], key, `${name}: Codex reads env_vars by name, so ${key} must hold \${${key}}`)
      used.add(key)
    }
    for (const [key, value] of Object.entries(e.headers || {})) {
      if (!value.includes('${')) continue
      assert.ok(VAR.test(value) || (key === 'Authorization' && BEARER.test(value)), `${name}: header ${key}`)
      used.add((VAR.exec(value) || BEARER.exec(value))[1])
    }
    const filed = Object.values(e.files || {}).flatMap((src) => [...readFileSync(join(REPO, src), 'utf8').matchAll(/\$\{(\w+)\}/g)].map((m) => m[1]))
    for (const v of filed) used.add(v)
    assert.deepEqual([...used].sort(), [...e.secrets].sort(), `${name}: secrets`)
  }
})

test('the catalog: versions are pinned, files exist and the read-only controls are set', () => {
  for (const [name, e] of Object.entries(catalog.servers)) {
    if (['npx', 'uvx'].includes(e.command)) assert.ok(e.args.some((a) => /^(@?[\w./-]+)(@|==)\d+\.\d+/.test(a)), `${name}: unpinned package`)
    if (e.command === 'docker') assert.ok(/:\d+\.\d+/.test(e.args.at(-1)), `${name}: unpinned image`)
    for (const [dest, src] of Object.entries(e.files || {})) {
      assert.ok(safeRel(dest) && safeRel(src) && existsSync(join(REPO, src)), `${name}: ${src}`)
      assert.ok(e.args.includes(dest), `${name}: args must name ${dest}`)
    }
  }
  const s = catalog.servers
  assert.ok(s.grafana.args.includes('--disable-write'))
  assert.equal(s.argocd.env.MCP_READ_ONLY, 'true')
  assert.ok(s.kubernetes.args.includes('--read-only'))
  assert.ok(s.scaleway.args.includes('--read-only') && s.scaleway.status === 'trial')
  assert.equal(s['mcp-atlassian'].env.READ_ONLY_MODE, 'true')
  assert.equal(s.github.headers['X-MCP-Readonly'], 'true')
  assert.equal(s.sonarqube.env.SONARQUBE_READ_ONLY, 'true')
  assert.deepEqual(s.figma.providers, ['claude'])
  assert.ok(s.figma.deny.includes('mcp__figma__use_figma'))
  assert.deepEqual(s['process-compose'].providers, ['claude', 'copilot'])
  const k8s = readFileSync(join(REPO, 'mcp/kubernetes.toml'), 'utf8')
  assert.match(k8s, /^read_only = true$/m)
  assert.match(k8s, /\[\[denied_resources\]\]\ngroup = ""\nversion = "v1"\nkind = "Secret"/)
  assert.match(readFileSync(join(REPO, 'mcp/dbhub.toml'), 'utf8'), /name = "execute_sql"\nsource = "default"\nreadonly = true/)
})

const FAKE = {
  version: 1,
  servers: {
    'stdio-one': { description: 'One.', status: 'adopt', readOnly: 'Flag.', secrets: ['API_URL', 'API_TOKEN'], stacks: [], command: 'npx', args: ['-y', 'pkg@1.0.0', '--read-only'], env: { API_URL: '${API_URL}', API_TOKEN: '${API_TOKEN}', MODE: 'ro' } },
    'http-one': { description: 'Two.', status: 'adopt', readOnly: 'Header.', secrets: ['HTTP_TOKEN', 'ORG_ID'], stacks: [], url: 'https://example.test/mcp', headers: { Authorization: 'Bearer ${HTTP_TOKEN}', 'X-Mode': 'ro', 'X-Org': '${ORG_ID}' } },
    'sse-one': { description: 'Three.', status: 'trial', readOnly: 'None.', secrets: [], stacks: ['react-web'], transport: 'sse', url: 'http://localhost:3000/sse', deny: ['mcp__sse-one__stop'] },
  },
}

const fakeCompass = (data = FAKE) => {
  const ac = temp('ac-mcp-compass-')
  put(ac, { 'mcp/catalog.json': JSON.stringify(data) })
  return ac
}

const plan = (AC, config = {}, stacks = []) => mcpPlan({ AC, config: { exclude: [], mcp: [], ...config }, stacks })
const keyOf = (p, file, key) => p.keys.get(file)?.get(key)

test('rendering: Claude, Codex and Copilot entries for a stdio, an http and an sse server', () => {
  const p = plan(fakeCompass(), { mcp: ['stdio-one', 'http-one', 'sse-one'] })
  assert.deepEqual(p.errors, [])
  assert.deepEqual(p.warnings, ['MCP server "sse-one" is a trial server'])
  const claude = (n) => keyOf(p, '.mcp.json', `mcpServers.${n}`)
  assert.deepEqual(claude('stdio-one'), { command: 'npx', args: ['-y', 'pkg@1.0.0', '--read-only'], env: { API_URL: '${API_URL}', API_TOKEN: '${API_TOKEN}', MODE: 'ro' } })
  assert.deepEqual(claude('http-one'), { type: 'http', url: 'https://example.test/mcp', headers: { Authorization: 'Bearer ${HTTP_TOKEN}', 'X-Mode': 'ro', 'X-Org': '${ORG_ID}' } })
  assert.deepEqual(claude('sse-one'), { type: 'sse', url: 'http://localhost:3000/sse' })
  const codex = (n) => keyOf(p, '.codex/config.toml', `mcp_servers.${n}`)
  assert.deepEqual(codex('stdio-one'), { command: 'npx', args: ['-y', 'pkg@1.0.0', '--read-only'], env: { MODE: 'ro' }, env_vars: ['API_URL', 'API_TOKEN'] })
  assert.deepEqual(codex('http-one'), { url: 'https://example.test/mcp', bearer_token_env_var: 'HTTP_TOKEN', http_headers: { 'X-Mode': 'ro' }, env_http_headers: { 'X-Org': 'ORG_ID' } })
  assert.equal(codex('sse-one'), undefined, 'Codex has no sse')
  const copilot = (n) => keyOf(p, '.vscode/mcp.json', `servers.${n}`)
  assert.deepEqual(copilot('stdio-one'), { type: 'stdio', command: 'npx', args: ['-y', 'pkg@1.0.0', '--read-only'], env: { API_URL: '${env:API_URL}', API_TOKEN: '${env:API_TOKEN}', MODE: 'ro' } })
  assert.deepEqual(copilot('http-one').headers, { Authorization: 'Bearer ${env:HTTP_TOKEN}', 'X-Mode': 'ro', 'X-Org': '${env:ORG_ID}' })
  assert.deepEqual(copilot('sse-one'), { type: 'sse', url: 'http://localhost:3000/sse' })
})

test('rendering: the Codex TOML parses and never holds "${"', () => {
  const p = plan(fakeCompass(), { mcp: ['stdio-one', 'http-one'] })
  for (const [key, value] of p.keys.get('.codex/config.toml')) {
    const text = tomlRender(key, value)
    assert.ok(!text.includes('${'), text)
    assert.deepEqual(parseToml(text).mcp_servers[key.split('.')[1]], value)
  }
})

test('selection: the list, the recommendation by stack and the mcp:<name> exclusion', () => {
  const AC = fakeCompass()
  assert.deepEqual(plan(AC).selected, [])
  assert.deepEqual(plan(AC, { mcp: ['http-one'] }, ['react-web']).selected, ['http-one', 'sse-one'])
  assert.deepEqual(plan(AC, { mcp: ['http-one'], exclude: ['mcp:sse-one'] }, ['react-web']).selected, ['http-one'])
  const real = plan(REPO, {}, ['react-web', 'swift-ios'])
  assert.deepEqual(real.selected, ['chrome-devtools', 'codebase-memory', 'playwright', 'xcodebuildmcp', 'agent-device'].sort())
  assert.deepEqual(plan(REPO, {}, ['expo-mobile']).selected, ['agent-device', 'codebase-memory', 'maestro'])
  assert.deepEqual(plan(REPO, {}, ['nestjs-api']).selected, ['codebase-memory'])
  assert.deepEqual(plan(REPO, {}).selected, ['codebase-memory'], 'the code graph is on in every project')
  assert.deepEqual(plan(REPO, { exclude: ['mcp:codebase-memory'] }).selected, [])
  assert.ok(!plan(REPO, {}).selected.includes('context7'), 'context7 stays opt-in')
})

test('the catalog: projectmem is a trial server that no stack picks', () => {
  const e = catalog.servers.projectmem
  assert.deepEqual([e.status, e.stacks, e.suggest, e.secrets, e.command], ['trial', [], undefined, [], 'uvx'])
  assert.ok(e.args.includes('pjm-mcp') && e.args.some((a) => /^projectmem==\d+\.\d+/.test(a)))
  assert.deepEqual(plan(REPO, {}, ['react-web', 'nestjs-api']).selected.filter((n) => n === 'projectmem'), [])
  const p = plan(REPO, { mcp: ['projectmem'] })
  assert.deepEqual(p.warnings, ['MCP server "projectmem" is a trial server'])
  assert.deepEqual(keyOf(p, '.mcp.json', 'mcpServers.projectmem'), { command: 'uvx', args: e.args })
})

test('selection: an unknown name is an error, a bad entry is an error, and a missing catalog is no servers', () => {
  assert.deepEqual(plan(fakeCompass(), { mcp: ['nope'] }).errors, ['.agents/compass.json: unknown MCP server "nope"'])
  assert.deepEqual(plan(temp('ac-mcp-empty-'), {}, ['react-web']).selected, [])
  assert.equal(plan(temp('ac-mcp-empty-'), { mcp: ['x'] }).errors.length, 1)
  const bad = {
    version: 1,
    servers: {
      a: { command: 'x', args: ['--key=${TOKEN}'] },
      b: { command: 'x', env: { TOKEN: 'pre-${TOKEN}' } },
      c: { description: 'No transport.' },
      'd.e': { command: 'x' },
    },
  }
  const p = plan(fakeCompass(bad), { mcp: ['a', 'b', 'c', 'd.e'] })
  assert.equal(p.errors.length, 4, p.errors.join('\n'))
  assert.deepEqual(p.selected, [])
  const broken = fakeCompass()
  writeFileSync(join(broken, 'mcp/catalog.json'), '{ not json')
  assert.match(plan(broken).errors[0], /^mcp\/catalog\.json: /)
})

const TS = 'typescript-lsp@claude-plugins-official'
const LSP = {
  [TS]: ['nestjs-api', 'react-web', 'next-web', 'angular-web', 'expo-mobile', 'turbo-monorepo'],
  'swift-lsp@claude-plugins-official': ['swift-ios', 'macos-desktop'],
  'kotlin-lsp@claude-plugins-official': ['android-compose'],
  'csharp-lsp@claude-plugins-official': ['winui-desktop'],
  'rust-analyzer-lsp@claude-plugins-official': ['gtk-desktop'],
}

test('the catalog: plugins hold one LSP plugin per language, with real stack ids', () => {
  assert.deepEqual(Object.fromEntries(Object.entries(catalog.plugins).map(([id, e]) => [id, e.stacks])), LSP)
  for (const [id, e] of Object.entries(catalog.plugins)) {
    assert.match(id, /^[a-z][a-z0-9-]*@[a-z][a-z0-9-]*$/)
    assert.deepEqual(Object.keys(e).sort(), ['description', 'stacks'], id)
    assert.ok(e.description.length > 10 && e.stacks.every((s) => STACK_IDS.includes(s)), id)
  }
})

test('plugins: a stack enables its plugin; the list adds one; plugin:<id> removes one', () => {
  const key = `enabledPlugins.${TS}`
  const p = plan(REPO, {}, ['react-web'])
  assert.deepEqual([p.errors, p.plugins, keyOf(p, '.claude/settings.json', key)], [[], [TS], true])
  assert.deepEqual(plan(REPO, {}, ['react-web', 'nestjs-api']).plugins, [TS])
  assert.deepEqual(plan(REPO, {}, ['gtk-desktop']).plugins, ['rust-analyzer-lsp@claude-plugins-official'])
  assert.deepEqual(plan(REPO, {}, ['swift-ios', 'macos-desktop']).plugins, ['swift-lsp@claude-plugins-official'])
  assert.deepEqual(plan(REPO, {}, ['openspec']).plugins, [])
  assert.equal(plan(REPO, {}, []).keys.has('.claude/settings.json'), false)
  assert.deepEqual(plan(REPO, { plugins: [TS] }).plugins, [TS])
  assert.deepEqual(plan(REPO, { plugins: [TS], exclude: [`plugin:${TS}`] }, ['react-web']).plugins, [])
  assert.deepEqual(plan(REPO, { exclude: [`plugin:${TS}`] }, ['react-web']).keys.has('.claude/settings.json'), false)
  assert.deepEqual(plan(REPO, { plugins: ['nope@x'] }).errors, ['.agents/compass.json: unknown plugin "nope@x"'])
})

test('plugins: a catalog id with a dot or a bad shape is an error, and "plugins" must be an object', () => {
  const bad = { version: 1, servers: {}, plugins: { 'a.b@c': { description: 'Dot.', stacks: ['react-web'] }, nope: { description: 'No market.', stacks: ['react-web'] } } }
  const p = plan(fakeCompass(bad), {}, ['react-web'])
  assert.deepEqual(p.plugins, [])
  assert.deepEqual(p.errors, ['mcp/catalog.json: "a.b@c" is not a valid plugin id', 'mcp/catalog.json: "nope" is not a valid plugin id'])
  assert.deepEqual(plan(fakeCompass({ version: 1, servers: {}, plugins: [] })).errors, ['mcp/catalog.json: "plugins" must be an object'])
})

const planFor = (AC, config, root = temp('ac-mcp-host-')) => buildPlan({ AC, root, config: { packs: [], exclude: [], upstream: [], mcp: [], ...config }, paths: PATH_DEFAULTS })

test('plan: deny patterns join permissions.deny, once, and an exclude removes them', () => {
  const p = planFor(REPO, { mcp: ['figma', 'github'] })
  assert.deepEqual(p.errors, [])
  const deny = keyOf(p, '.claude/settings.json', 'permissions.deny')
  assert.ok(deny.includes('mcp__figma__use_figma') && deny.includes('mcp__github__*delete*'))
  assert.equal(new Set(deny).size, deny.length)
  assert.deepEqual(keyOf(p, '.mcp.json', 'mcpServers.github').headers['X-MCP-Readonly'], 'true')
  const noDeny = planFor(REPO, { mcp: ['figma'], exclude: ['.claude/settings.json#permissions.deny'] })
  assert.equal(keyOf(noDeny, '.claude/settings.json', 'permissions.deny'), undefined)
  const noKey = planFor(REPO, { mcp: ['github', 'figma'], exclude: ['.mcp.json#mcpServers.github', 'mcp:figma'] })
  assert.equal(keyOf(noKey, '.mcp.json', 'mcpServers.github'), undefined)
  assert.equal(keyOf(noKey, '.mcp.json', 'mcpServers.figma'), undefined)
  assert.ok(!keyOf(noKey, '.claude/settings.json', 'permissions.deny').includes('mcp__figma__use_figma'))
})

test('plan: the plugin key joins .claude/settings.json with the deny list, and a key exclude drops it', () => {
  const root = temp('ac-mcp-react-')
  put(root, { 'package.json': JSON.stringify({ dependencies: { react: '19' } }) })
  const key = `enabledPlugins.${TS}`
  const p = planFor(REPO, { mcp: ['figma'] }, root)
  assert.equal(keyOf(p, '.claude/settings.json', key), true)
  assert.ok(keyOf(p, '.claude/settings.json', 'permissions.deny').includes('mcp__figma__use_figma'))
  const off = planFor(REPO, { exclude: [`.claude/settings.json#${key}`] }, root)
  assert.equal(keyOf(off, '.claude/settings.json', key), undefined)
  assert.equal(planFor(REPO, {}, temp('ac-mcp-bare-')).keys.has('.claude/settings.json'), true, 'core keys still install')
  assert.equal(keyOf(planFor(REPO, {}, temp('ac-mcp-bare-')), '.claude/settings.json', key), undefined)
})

test('plan: a file of a server is a managed file, and two sources for one key are an error', () => {
  const p = planFor(REPO, { mcp: ['kubernetes'] })
  assert.deepEqual(p.errors, [])
  assert.match(p.files.get('.agents/mcp/kubernetes.toml').content.toString(), /read_only = true/)
  assert.equal(p.files.get('.agents/mcp/kubernetes.toml').mode, 'managed')
  const AC = fakeCompass()
  put(AC, { 'core/keys.json': JSON.stringify({ '.mcp.json': { 'mcpServers.http-one': { command: 'other' } } }) })
  assert.deepEqual(planFor(AC, { mcp: ['http-one'] }).errors, ['two sources set .mcp.json#mcpServers.http-one'])
})

const syncAc = () => {
  const ac = temp('ac-mcp-sync-')
  for (const dir of ['bin', 'engine', 'mcp']) cpSync(join(REPO, dir), join(ac, dir), { recursive: true })
  put(ac, { 'package.json': '{ "version": "1.0.0-test" }\n' })
  return ac
}
const run = async (ac, host, ...args) => {
  const r = await runNode([join(ac, 'bin/ac.mjs'), ...args, '--root', host, '--json'])
  return { ...r, json: r.stdout ? JSON.parse(r.stdout) : null }
}

test('sync: Konvoy MCP keys keep their bytes while two servers are written and removed', async () => {
  const ac = syncAc()
  const konvoyJson = '    "konvoy": {\n      "command": "konvoy",   "args": ["mcp"]\n    }'
  const konvoyToml = '[mcp_servers.konvoy]\ncommand = "konvoy"   # keep\nargs = [ "mcp" ]'
  const host = temp('ac-mcp-host-')
  put(host, {
    '.agents/compass.json': JSON.stringify({ version: 1, packs: [], exclude: [], mcp: ['context7', 'playwright'] }),
    '.agents/konvoy.json': '{ "paths": {} }\n',
    '.mcp.json': `{\n  "mcpServers": {\n${konvoyJson}\n  }\n}\n`,
    '.vscode/mcp.json': '{\n  "servers": {\n    "konvoy": { "type": "stdio", "command": "konvoy" }\n  }\n}\n',
    '.codex/config.toml': `model = "x"\n\n${konvoyToml}\n`,
  })
  const first = await run(ac, host, 'sync')
  assert.equal(first.code, 0, first.stdout + first.stderr)
  const mcp = readFileSync(join(host, '.mcp.json'), 'utf8')
  assert.ok(mcp.includes(konvoyJson), 'the Konvoy JSON bytes changed')
  assert.deepEqual(Object.keys(JSON.parse(mcp).mcpServers).sort(), ['codebase-memory', 'context7', 'konvoy', 'playwright'])
  assert.equal(JSON.parse(mcp).mcpServers.context7.url, 'https://mcp.context7.com/mcp')
  const toml = readFileSync(join(host, '.codex/config.toml'), 'utf8')
  assert.ok(toml.includes(konvoyToml), 'the Konvoy TOML bytes changed')
  assert.ok(!toml.includes('${'))
  const parsed = parseToml(toml)
  assert.deepEqual(Object.keys(parsed.mcp_servers).sort(), ['codebase-memory', 'context7', 'konvoy', 'playwright'])
  assert.deepEqual(parsed.mcp_servers.context7, { url: 'https://mcp.context7.com/mcp' })
  assert.deepEqual(Object.keys(JSON.parse(readFileSync(join(host, '.vscode/mcp.json'), 'utf8')).servers).sort(), ['codebase-memory', 'context7', 'konvoy', 'playwright'])

  assert.equal((await run(ac, host, 'sync')).json.changes.length, 0, 'a second sync changes nothing')
  put(host, { '.agents/compass.json': JSON.stringify({ version: 1, packs: [], exclude: [], mcp: ['context7'] }) })
  const after = await run(ac, host, 'sync')
  assert.equal(after.code, 0, after.stdout)
  assert.ok(readFileSync(join(host, '.mcp.json'), 'utf8').includes(konvoyJson))
  assert.ok(readFileSync(join(host, '.codex/config.toml'), 'utf8').includes(konvoyToml))
  assert.deepEqual(Object.keys(JSON.parse(readFileSync(join(host, '.mcp.json'), 'utf8')).mcpServers).sort(), ['codebase-memory', 'context7', 'konvoy'])
})

test('sync: a server with a file and a deny pattern is written, and an unknown name fails the run', async () => {
  const ac = syncAc()
  const host = temp('ac-mcp-host-')
  put(host, { '.agents/compass.json': JSON.stringify({ version: 1, packs: [], exclude: [], mcp: ['kubernetes', 'figma'] }) })
  const r = await run(ac, host, 'sync')
  assert.equal(r.code, 0, r.stdout + r.stderr)
  assert.match(readFileSync(join(host, '.agents/mcp/kubernetes.toml'), 'utf8'), /kind = "Secret"/)
  assert.ok(JSON.parse(readFileSync(join(host, '.claude/settings.json'), 'utf8')).permissions.deny.includes('mcp__figma__use_figma'))
  assert.ok(!existsSync(join(host, '.vscode/mcp.json')) || !('figma' in (JSON.parse(readFileSync(join(host, '.vscode/mcp.json'), 'utf8')).servers || {})))
  put(host, { '.agents/compass.json': JSON.stringify({ version: 1, packs: [], exclude: [], mcp: ['nope'] }) })
  const bad = await run(ac, host, 'check')
  assert.equal(bad.code, 1)
  assert.deepEqual(bad.json.errors, ['.agents/compass.json: unknown MCP server "nope"'])
  put(host, { '.agents/compass.json': JSON.stringify({ version: 1, packs: [], exclude: [], mcp: 'context7' }) })
  const type = await run(ac, host, 'check')
  assert.equal(type.code, 1)
  assert.match(type.json.errors[0], /"mcp" must be a list of MCP server names/)
})

test('sync: an LSP plugin key is written, a user value stays, and a removed plugin leaves', async () => {
  const ac = syncAc()
  const host = temp('ac-mcp-host-')
  const mine = '{\n  "enabledPlugins": {\n    "typescript-lsp@claude-plugins-official": false,\n    "mine@market": true\n  }\n}\n'
  put(host, {
    'package.json': JSON.stringify({ dependencies: { react: '19' } }),
    '.agents/compass.json': JSON.stringify({ version: 1, packs: [], exclude: [], plugins: ['swift-lsp@claude-plugins-official'] }),
    '.claude/settings.json': mine,
  })
  const first = await run(ac, host, 'sync')
  assert.equal(first.code, 0, first.stdout + first.stderr)
  assert.deepEqual(first.json.changes.filter((c) => c.action === 'kept').map((c) => c.key), [`enabledPlugins.${TS}`])
  const settings = JSON.parse(readFileSync(join(host, '.claude/settings.json'), 'utf8'))
  assert.deepEqual(settings.enabledPlugins, { [TS]: false, 'mine@market': true, 'swift-lsp@claude-plugins-official': true })
  put(host, { '.agents/compass.json': JSON.stringify({ version: 1, packs: [], exclude: [`plugin:${TS}`] }) })
  const after = await run(ac, host, 'sync')
  assert.equal(after.code, 0, after.stdout)
  assert.deepEqual(JSON.parse(readFileSync(join(host, '.claude/settings.json'), 'utf8')).enabledPlugins, { [TS]: false, 'mine@market': true })
})

test('config: "plugins" must be a list of plugin ids', async () => {
  const ac = syncAc()
  const host = temp('ac-mcp-host-')
  put(host, { '.agents/compass.json': JSON.stringify({ version: 1, packs: [], exclude: [], plugins: TS }) })
  const r = await run(ac, host, 'check')
  assert.equal(r.code, 1)
  assert.match(r.json.errors[0], /"plugins" must be a list of Claude plugin ids/)
})

test('doctor: one warning for each command of a selected MCP server that is not on PATH', () => {
  const bin = temp('ac-mcp-bin-')
  put(bin, { 'have-cmd': '#!/bin/sh\n', 'not-exec': 'x' })
  chmodSync(join(bin, 'have-cmd'), 0o755)
  const entry = (command) => ({ description: 'A server.', status: 'adopt', readOnly: 'Not applicable.', secrets: [], stacks: [], command })
  const AC = fakeCompass({ version: 1, servers: { a: entry('have-cmd'), b: entry('gone-cmd'), c: entry('gone-cmd'), d: entry('not-exec'), e: { ...FAKE.servers['sse-one'], stacks: [] }, f: entry('off-cmd') } })
  const host = temp('ac-mcp-host-')
  put(host, { '.agents/compass.json': JSON.stringify({ version: 1, packs: [], exclude: ['mcp:f'], mcp: ['a', 'b', 'c', 'd', 'e', 'f'] }) })
  const warns = () => doctor({ AC, root: host }).checks.filter((c) => c.name === 'mcp')
  const warn = (cmd, names) => ({ name: 'mcp', status: 'warn', detail: `"${cmd}" is not on PATH, so the MCP server ${names} cannot start` })
  const old = process.env.PATH
  try {
    process.env.PATH = `${bin}${delimiter}${old}`
    assert.deepEqual(warns(), [warn('gone-cmd', 'b, c'), warn('not-exec', 'd')])
    assert.equal(doctor({ AC, root: host }).ok, true, 'a warning does not fail doctor')
    process.env.PATH = temp('ac-mcp-empty-bin-')
    assert.deepEqual(warns(), [warn('have-cmd', 'a'), warn('gone-cmd', 'b, c'), warn('not-exec', 'd')])
  } finally { process.env.PATH = old }
  put(host, { '.agents/compass.json': JSON.stringify({ version: 1, packs: [], exclude: [], mcp: ['nope'] }) })
  assert.deepEqual(warns(), [], 'a broken config reports its error and no PATH warning')
})

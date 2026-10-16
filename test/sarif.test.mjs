import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { runNode } from './helpers.mjs'

const REPO = dirname(dirname(fileURLToPath(import.meta.url)))
const MERGE = join(REPO, 'packs/security/skills/vuln-triage/scripts/sarif-merge.mjs')
const root = mkdtempSync(join(tmpdir(), 'ac-sarif-'))
test.after(() => rmSync(root, { recursive: true, force: true }))

const write = (name, data) => {
  const file = join(root, name)
  writeFileSync(file, typeof data === 'string' ? data : JSON.stringify(data))
  return file
}
const merge = (...args) => runNode([MERGE, '--root', root, ...args])

// The shape osv-scanner 2.7 writes: absolute file:// URIs, no region, CVSS in the rule properties.
const osvResult = (id, pkg) => ({
  ruleId: id,
  ruleIndex: 0,
  level: 'warning',
  message: { text: `Package '${pkg}' is vulnerable to '${id}'.` },
  locations: [{ physicalLocation: { artifactLocation: { uri: `file://${root}/package-lock.json`, index: -1 } } }],
})
const osv = (results) => ({
  version: '2.1.0',
  runs: [{
    tool: { driver: { name: 'osv-scanner', version: '2.7.0', rules: [
      { id: 'CVE-2020-28500', properties: { 'security-severity': '5.3' } },
      { id: 'CVE-2021-44906', properties: { 'security-severity': '9.8' } },
    ] } },
    results,
  }],
})
// A SAST tool: relative URI, region with a snippet.
const sast = (line, snippet) => ({
  version: '2.1.0',
  runs: [{
    tool: { driver: { name: 'Checkmarx', rules: [{ id: 'Hardcoded_Password', properties: { 'security-severity': '7.5' } }] } },
    results: [{
      ruleId: 'Hardcoded_Password',
      level: 'error',
      message: { text: 'A password is in the source.' },
      locations: [{ physicalLocation: { artifactLocation: { uri: './src/db.ts' }, region: { startLine: line, snippet: { text: snippet } } } }],
    }],
  }],
})

test('sarif-merge joins runs per tool, drops duplicates and adds a fingerprint', async () => {
  const a = write('a.sarif', osv([osvResult('CVE-2020-28500', 'lodash@4.17.15')]))
  const b = write('b.sarif', osv([osvResult('CVE-2020-28500', 'lodash@4.17.15'), osvResult('CVE-2021-44906', 'minimist@1.2.5')]))
  const c = write('c.sarif', sast(10, 'const password = "x"'))
  const out = join(root, 'merged.sarif')
  const r = await merge('--out', out, a, b, c)
  assert.equal(r.code, 0, r.stderr)
  assert.match(r.stderr, /1 duplicate dropped/)
  const merged = JSON.parse(readFileSync(out, 'utf8'))
  assert.equal(merged.version, '2.1.0')
  assert.deepEqual(merged.runs.map((run) => [run.tool.driver.name, run.results.length]), [['osv-scanner', 2], ['Checkmarx', 1]])
  const [first] = merged.runs[0].results
  assert.equal(first.locations[0].physicalLocation.artifactLocation.uri, 'package-lock.json')
  assert.equal(first.ruleIndex, undefined)
  assert.match(first.partialFingerprints['compass/v1'], /^[0-9a-f]{32}$/)
  assert.deepEqual(merged.runs[0].tool.driver.rules.map((rule) => rule.id), ['CVE-2020-28500', 'CVE-2021-44906'])
  assert.equal(merged.runs[1].results[0].locations[0].physicalLocation.artifactLocation.uri, 'src/db.ts')
})

test('the fingerprint follows the snippet, not the line number', async () => {
  const moved = write('moved.sarif', sast(42, 'const  password = "x"'))
  const changed = write('changed.sarif', sast(10, 'const password = "y"'))
  const r = await merge(write('orig.sarif', sast(10, 'const password = "x"')), moved, changed)
  assert.equal(r.code, 0, r.stderr)
  const results = JSON.parse(r.stdout).runs[0].results
  assert.equal(results.length, 2)
  assert.deepEqual(results.map((x) => x.locations[0].physicalLocation.region.startLine), [10, 10])
})

test('--fail-at fails on a finding at or above the CVSS score, and only then', async () => {
  const file = write('gate.sarif', osv([osvResult('CVE-2020-28500', 'lodash@4.17.15'), osvResult('CVE-2021-44906', 'minimist@1.2.5')]))
  const hit = await merge('--fail-at', '9', file)
  assert.equal(hit.code, 1)
  assert.match(hit.stderr, /CVE-2021-44906 .*package-lock\.json.* 9\.8/)
  assert.doesNotMatch(hit.stderr, /CVE-2020-28500 .* 5\.3/)
  const pass = await merge('--fail-at', '9.9', file)
  assert.equal(pass.code, 0, pass.stderr)
})

test('a result-level security-severity wins over the rule', async () => {
  const data = osv([{ ...osvResult('CVE-2020-28500', 'lodash@4.17.15'), properties: { 'security-severity': '9.1' } }])
  const r = await merge('--fail-at', '9', write('override.sarif', data))
  assert.equal(r.code, 1)
  assert.match(r.stderr, /CVE-2020-28500 .* 9\.1/)
})

test('without a snippet, the line keeps two findings of one rule apart', async () => {
  const at = (line) => ({ ruleId: 'R1', message: { text: 'Same text.' }, locations: [{ physicalLocation: { artifactLocation: { uri: 'src/a.ts' }, region: { startLine: line } } }] })
  const data = { version: '2.1.0', runs: [{ tool: { driver: { name: 'semgrep' } }, results: [at(3), at(9), at(3)] }] }
  const r = await merge(write('lines.sarif', data))
  assert.equal(r.code, 0, r.stderr)
  assert.equal(JSON.parse(r.stdout).runs[0].results.length, 2)
})

test('odd URIs keep their text', async () => {
  const at = (uri) => ({ ruleId: 'R1', message: { text: uri }, locations: [{ physicalLocation: { artifactLocation: { uri } } }] })
  const data = { version: '2.1.0', runs: [{ tool: { driver: { name: 'semgrep' } }, results: [at('src/100%.js'), at('file://host/a.js')] }] }
  const r = await merge(write('uris.sarif', data))
  assert.equal(r.code, 0, r.stderr)
  assert.deepEqual(JSON.parse(r.stdout).runs[0].results.map((x) => x.locations[0].physicalLocation.artifactLocation.uri), ['src/100%.js', '//host/a.js'])
})

test('bad input stops with exit 2', async () => {
  assert.equal((await merge()).code, 2)
  assert.equal((await merge(join(root, 'missing.sarif'))).code, 2)
  assert.equal((await merge(write('bad.sarif', '{ not json'))).code, 2)
  assert.equal((await merge(write('norun.sarif', { version: '2.1.0' }))).code, 2)
  assert.equal((await merge('--fail-at', 'high', write('ok.sarif', osv([])))).code, 2)
  assert.equal((await merge(write('null.sarif', { version: '2.1.0', runs: [{ tool: { driver: { name: 'x' } }, results: [null] }] }))).code, 2)
})

test('the CI packs seed their files and call the merge script at the path that the security pack installs', async () => {
  const { buildPlan } = await import('../engine/plan.mjs')
  const { PATH_DEFAULTS } = await import('../engine/config.mjs')
  const host = mkdtempSync(join(tmpdir(), 'ac-quality-host-'))
  try {
    writeFileSync(join(host, '.osv-scanner.toml'), '')
    const config = { packs: ['ci-github', 'ci-gitlab', 'renovate'], exclude: [], upstream: [], mcp: [] }
    const plan = buildPlan({ AC: REPO, root: host, config, paths: PATH_DEFAULTS })
    assert.deepEqual(plan.errors, [])
    assert.ok(plan.packs.includes('security'), 'an .osv-scanner.toml file selects the security pack')
    const seeds = [...plan.files].filter(([, want]) => want.mode === 'seed').map(([rel]) => rel)
    for (const rel of ['.github/workflows/compass-security.yml', '.gitlab/compass/security.yml', 'renovate.json', '.osv-scanner.toml']) {
      assert.ok(seeds.includes(rel), rel)
    }
    JSON.parse(plan.files.get('renovate.json').content)
    const calls = seeds.filter((rel) => plan.files.get(rel).content.toString().includes('sarif-merge.mjs'))
    assert.equal(calls.length, 2)
    for (const rel of calls) {
      const [path] = plan.files.get(rel).content.toString().match(/\.agents\/skills\/vuln-triage\/scripts\/sarif-merge\.mjs/)
      assert.equal(plan.files.get(path)?.mode, 'managed', `${rel} calls ${path}`)
    }
  } finally {
    rmSync(host, { recursive: true, force: true })
  }
})

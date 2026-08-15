import assert from 'node:assert/strict'
import { chmodSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { delimiter, join } from 'node:path'
import { tmpdir } from 'node:os'
import test from 'node:test'

import { runNode } from './helpers.mjs'
import {
  CODEBASE_MEMORY_GITIGNORE,
  CODE_INTEL_CHOICE,
  DESIRED_CONFIG,
  codeIntelChoice,
  codeIntelSelected,
  configDrift,
  fallbackDirs,
  graphIgnored,
  installCbm,
  installPlan,
  isIndexed,
  manualInstallCommand,
  searchDirs,
} from '../scripts/lib/codebase-memory.mjs'
import { doctorChecks, ensureCodeIntelIgnores } from '../scripts/doctor-checks.mjs'
import { FILE_MANIFEST } from '../scripts/manifest.mjs'

const root = new URL('..', import.meta.url).pathname
const script = join(root, 'scripts', 'code-intel.mjs')

const host = (answers) => {
  const dir = mkdtempSync(join(tmpdir(), 'ac-code-intel-'))
  if (answers) writeFileSync(join(dir, 'agent-compass.answers.json'), JSON.stringify(answers, null, 2))
  return dir
}

// A stub on PATH keeps the suite hermetic: it must never download or install a
// real binary, and it must behave identically whether or not the developer
// happens to have codebase-memory-mcp on their machine.
const stubBin = (config = { auto_index: 'true', auto_watch: 'true' }) => {
  const dir = mkdtempSync(join(tmpdir(), 'ac-cbm-stub-'))
  const rows = Object.entries(config).map(([k, v]) => `  ${k.padEnd(24)}= ${v}`).join('\\n')
  writeFileSync(join(dir, 'codebase-memory-mcp'), `#!/bin/sh
case "$1 $2" in
  "--version ") echo "codebase-memory-mcp 9.9.9" ;;
  "config list") printf 'Configuration:\\n${rows}\\n' ;;
  "config set") exit 0 ;;
  "cli --json") echo '{"structuredContent":{"projects":[]},"isError":false}' ;;
  *) exit 1 ;;
esac
`)
  chmodSync(join(dir, 'codebase-memory-mcp'), 0o755)
  return dir
}

// PATH with the stub in front (CBM present) or with every real hit removed
// (CBM absent), so both worlds are testable on any machine.
const withCbm = (dir) => ({ ...process.env, PATH: `${dir}${delimiter}${process.env.PATH}`, HOME: dir })
const withoutCbm = () => ({ ...process.env, PATH: join(tmpdir(), 'ac-empty-path'), HOME: join(tmpdir(), 'ac-empty-home') })

// --- selection semantics ---------------------------------------------------

test('an answers file without the key stays unanswered, not declined', () => {
  const dir = host({ name: 'legacy', providers: ['claude'] })
  assert.equal(codeIntelChoice(dir), null)
  assert.equal(codeIntelSelected(dir), false)
})

test('missing answers file is unanswered', () => {
  assert.equal(codeIntelChoice(host()), null)
})

test('explicit choices round-trip', () => {
  assert.equal(codeIntelSelected(host({ codeIntelligence: CODE_INTEL_CHOICE })), true)
  assert.equal(codeIntelChoice(host({ codeIntelligence: 'none' })), 'none')
  assert.equal(codeIntelSelected(host({ codeIntelligence: 'none' })), false)
})

// --- config drift ----------------------------------------------------------

test('config drift reports only the keys that differ from the compass defaults', () => {
  assert.deepEqual(configDrift({ auto_index: 'true', auto_watch: 'true', ui_port: '9749' }), [])
  const drift = configDrift({ auto_index: 'false', auto_watch: 'true' })
  assert.deepEqual(drift, [{ key: 'auto_index', want: 'true', have: 'false' }])
})

test('a missing config reports every desired key as unset', () => {
  assert.deepEqual(configDrift(null).map((d) => d.key), Object.keys(DESIRED_CONFIG))
  assert.equal(configDrift(null)[0].have, '(unset)')
})

// --- ignore policy ---------------------------------------------------------

test('graphIgnored accepts the bare and trailing-slash forms', () => {
  const dir = host()
  assert.equal(graphIgnored(dir), false)
  writeFileSync(join(dir, '.gitignore'), 'node_modules/\n.codebase-memory\n')
  assert.equal(graphIgnored(dir), true)
  writeFileSync(join(dir, '.gitignore'), 'node_modules/\n.codebase-memory/\n')
  assert.equal(graphIgnored(dir), true)
})

test('ensureCodeIntelIgnores only touches hosts that selected the layer', () => {
  const declined = host({ codeIntelligence: 'none' })
  assert.deepEqual(ensureCodeIntelIgnores(declined), [])
  assert.equal(graphIgnored(declined), false)

  const selected = host({ codeIntelligence: CODE_INTEL_CHOICE })
  assert.deepEqual(ensureCodeIntelIgnores(selected), CODEBASE_MEMORY_GITIGNORE)
  assert.equal(graphIgnored(selected), true)
  // idempotent
  assert.deepEqual(ensureCodeIntelIgnores(selected), [])
})

test('ensureCodeIntelIgnores --dry writes nothing', () => {
  const dir = host({ codeIntelligence: CODE_INTEL_CHOICE })
  assert.deepEqual(ensureCodeIntelIgnores(dir, true), CODEBASE_MEMORY_GITIGNORE)
  assert.equal(graphIgnored(dir), false)
})

// --- doctor integration ----------------------------------------------------

const labels = (checks) => checks.map(([label]) => label)

test('an unselected host gets no required code-intelligence checks', () => {
  const { required, advisory } = doctorChecks(host({ codeIntelligence: 'none' }))
  assert.equal(labels(required).some((l) => l.includes('codebase-memory')), false)
  assert.equal(advisory.some(([l, ok]) => l.includes('codebase-memory not selected') && ok), true)
})

test('a pre-existing host with no answers file never fails on code intelligence', () => {
  const { required } = doctorChecks(host())
  assert.equal(labels(required).some((l) => l.includes('codebase-memory')), false)
})

test('a selected host requires the repo-level facts and only advises machine-level ones', () => {
  const dir = host({ codeIntelligence: CODE_INTEL_CHOICE })
  const { required, advisory } = doctorChecks(dir)
  const ignoreCheck = required.find(([l]) => l.includes('generated graph'))
  const mcpCheck = required.find(([l]) => l.includes('.mcp/codebase-memory.example.json'))
  assert.ok(ignoreCheck, 'ignore rule is required once selected')
  assert.equal(ignoreCheck[1], false)
  assert.ok(mcpCheck)
  assert.equal(mcpCheck[1], false)
  // The binary lives outside the repo: a clone or CI run must not fail on it.
  assert.equal(labels(required).some((l) => l.includes('codebase-memory-mcp installed')), false)
  assert.ok(advisory.some(([l]) => l.includes('codebase-memory-mcp installed')))
  assert.ok(advisory.some(([l]) => l.includes('auto_index/auto_watch') && l.includes('code-intel doctor')))
})

test('host wiring checks never pay for CBM start-up', () => {
  const dir = host({ codeIntelligence: CODE_INTEL_CHOICE })
  const started = Date.now()
  doctorChecks(dir)
  assert.ok(Date.now() - started < 1000, 'doctorChecks must not read the CBM config')
})

test('a selected host passes the repo-level checks once wired', () => {
  const dir = host({ codeIntelligence: CODE_INTEL_CHOICE })
  ensureCodeIntelIgnores(dir)
  mkdirSync(join(dir, '.mcp'), { recursive: true })
  writeFileSync(join(dir, '.mcp', 'codebase-memory.example.json'), '{}')
  const { required } = doctorChecks(dir)
  for (const [label, ok] of required.filter(([l]) => l.includes('codebase-memory'))) {
    assert.equal(ok, true, label)
  }
})

// --- index probe -----------------------------------------------------------

test('isIndexed matches a project path and never guesses from a null listing', () => {
  assert.equal(isIndexed(null, '/repo'), false)
  assert.equal(isIndexed([], '/repo'), false)
  assert.equal(isIndexed([{ path: '/other' }], '/repo'), false)
  assert.equal(isIndexed([{ path: '/repo' }], '/repo'), true)
  assert.equal(isIndexed([{ repo_path: '/repo' }], '/repo'), true)
  // The spelling CBM 0.10.5 returns. Without it every status read reported an
  // indexed repository as "not indexed".
  assert.equal(isIndexed([{ root_path: '/repo' }], '/repo'), true)
})

// --- manifest + template ---------------------------------------------------

test('the MCP example is a managed manifest entry with a portable command', () => {
  const entry = FILE_MANIFEST.find((f) => f.dest === '.mcp/codebase-memory.example.json')
  assert.ok(entry, 'manifest ships the code-intelligence MCP example')
  assert.equal(entry.mode, 'managed')
  const example = JSON.parse(readFileSync(join(root, entry.src), 'utf8'))
  const server = example.mcpServers['codebase-memory-mcp']
  assert.equal(server.command, 'codebase-memory-mcp', 'resolve from PATH, never an absolute developer path')
  assert.equal(JSON.stringify(server).includes('/Users/'), false)
})

// --- platform matrix -------------------------------------------------------
// These run the same on any host: every platform difference is a pure function
// of (platform, env). Separators are normalised because join() follows the
// running host, not the simulated one.

const slashes = (text) => text.replace(/\\/g, '/')

test('POSIX discovery falls back to the install.sh default directory', () => {
  assert.deepEqual(fallbackDirs('linux', { HOME: '/home/dev' }), ['/home/dev/.local/bin'])
  const dirs = searchDirs('darwin', { PATH: '/usr/bin:/usr/local/bin', HOME: '/Users/dev' })
  assert.deepEqual(dirs, ['/usr/bin', '/usr/local/bin', '/Users/dev/.local/bin'])
})

test('Windows discovery uses LOCALAPPDATA, the ; separator, and a bin/ subdir', () => {
  const env = { PATH: 'C:\\Windows;C:\\tools', LOCALAPPDATA: 'C:\\Users\\dev\\AppData\\Local' }
  const dirs = searchDirs('win32', env).map(slashes)
  assert.deepEqual(dirs.slice(0, 2), ['C:/Windows', 'C:/tools'], 'splits PATH on ; not :')
  assert.deepEqual(dirs.slice(2), [
    'C:/Users/dev/AppData/Local/Programs/codebase-memory-mcp',
    'C:/Users/dev/AppData/Local/Programs/codebase-memory-mcp/bin',
  ])
})

test('Windows discovery derives LOCALAPPDATA from USERPROFILE when unset', () => {
  const dirs = fallbackDirs('win32', { USERPROFILE: 'C:\\Users\\dev' }).map(slashes)
  assert.equal(dirs[0], 'C:/Users/dev/AppData/Local/Programs/codebase-memory-mcp')
})

test('both install plans keep --skip-config and never pipe the network into a shell', () => {
  const plans = [
    installPlan({ platform: 'darwin', script: '/tmp/i.sh', downloader: 'curl' }),
    installPlan({ platform: 'linux', script: '/tmp/i.sh', downloader: 'wget' }),
    installPlan({ platform: 'win32', script: 'C:\\tmp\\i.ps1', shell: 'pwsh' }),
  ]
  for (const plan of plans) {
    const rendered = plan.map(([cmd, args]) => `${cmd} ${args.join(' ')}`)
    assert.equal(rendered.length, 2, 'download, then run — never one piped step')
    assert.ok(rendered[0].includes('install.'), 'first step downloads the installer')
    assert.ok(rendered.some((step) => step.includes('--skip-config')), 'config ownership stays with agent-compass')
    assert.equal(rendered.join(' ').includes('|'), false, 'no curl | bash')
  }
})

test('the Windows plan uses the double-dash flag upstream actually parses', () => {
  const [, run] = installPlan({ platform: 'win32', script: 'C:\\tmp\\i.ps1', shell: 'powershell' })
  assert.ok(run[1].includes('--skip-config'))
  // install.ps1 reads $args, so -SkipConfig would be silently ignored and the
  // installer would rewrite every agent's config.
  assert.equal(run[1].join(' ').includes('-SkipConfig'), false)
  assert.equal(manualInstallCommand('win32').includes('-SkipConfig'), false)
  assert.match(manualInstallCommand('win32'), /--skip-config/)
})

test('POSIX falls back to wget when curl is absent', () => {
  const [download] = installPlan({ platform: 'linux', script: '/tmp/i.sh', downloader: 'wget' })
  assert.equal(download[0], 'wget')
})

test('a host with no downloader fails clearly with the manual command', () => {
  for (const [platform, missing] of [['linux', /curl or wget/], ['win32', /pwsh or powershell/]]) {
    const result = installCbm({ dry: true, platform, env: { PATH: '/nonexistent' } })
    assert.equal(result.ok, false)
    assert.match(result.reason, missing)
    assert.match(result.manual, /skip-config/)
  }
})

test('the manual install command keeps upstream --skip-config', () => {
  assert.match(manualInstallCommand(), /skip-?config/i)
})

// --- CLI surface -----------------------------------------------------------

test('code-intel rejects an unknown action', async () => {
  const result = await runNode([script, 'frobnicate'], { cwd: root })
  assert.equal(result.code, 1)
  assert.match(result.stderr, /Unknown code-intel action/)
})

test('code-intel status is read-only and machine-readable', async () => {
  const dir = host({ codeIntelligence: 'none' })
  const result = await runNode([script, 'status', dir, '--json'], { cwd: root, env: withCbm(stubBin()) })
  assert.equal(result.code, 0, result.stderr)
  const status = JSON.parse(result.stdout)
  assert.equal(status.schema, 1)
  assert.equal(status.selected, false)
  assert.equal(status.installed, true)
  assert.equal(status.version, '9.9.9')
  assert.equal(status.graphIgnored, false)
  assert.equal(status.mcpExample, false)
})

test('status reports a missing executable instead of installing one', async () => {
  const dir = host({ codeIntelligence: CODE_INTEL_CHOICE })
  const result = await runNode([script, 'status', dir, '--json'], { cwd: root, env: withoutCbm() })
  assert.equal(result.code, 0, result.stderr)
  const status = JSON.parse(result.stdout)
  assert.equal(status.installed, false)
  assert.equal(status.executable, null)
  assert.deepEqual(status.drift, [], 'no config read means no drift claim')
})

test('code-intel doctor stays green for a host that declined the layer', async () => {
  const dir = host({ codeIntelligence: 'none' })
  const result = await runNode([script, 'doctor', dir, '--json'], { cwd: root, env: withoutCbm() })
  assert.equal(result.code, 0, result.stderr)
  const report = JSON.parse(result.stdout)
  assert.equal(report.ok, true)
  assert.match(report.findings[0].text, /not (configured|selected)/)
})

test('code-intel doctor fails a selected host whose executable is missing', async () => {
  const dir = host({ codeIntelligence: CODE_INTEL_CHOICE })
  const result = await runNode([script, 'doctor', dir, '--json'], { cwd: root, env: withoutCbm() })
  assert.equal(result.code, 1)
  const report = JSON.parse(result.stdout)
  assert.equal(report.ok, false)
  assert.ok(report.findings.some((f) => f.level === 'fail' && f.text.includes('code-intel install')))
})

test('code-intel doctor flags disabled auto-index with the fix command', async () => {
  const dir = host({ codeIntelligence: CODE_INTEL_CHOICE })
  const env = withCbm(stubBin({ auto_index: 'false', auto_watch: 'true' }))
  const result = await runNode([script, 'doctor', dir, '--json'], { cwd: root, env })
  assert.equal(result.code, 1)
  const report = JSON.parse(result.stdout)
  assert.ok(report.findings.some((f) => f.text.includes('auto_index=false') && f.text.includes('code-intel configure')))
})

test('code-intel setup --dry writes nothing', async () => {
  const dir = host()
  const result = await runNode([script, 'setup', dir, '--dry'], { cwd: root, env: withoutCbm() })
  assert.equal(result.code, 0, result.stderr)
  assert.equal(graphIgnored(dir), false)
  assert.equal(codeIntelChoice(dir), null)
  assert.match(result.stdout, /would (add|record|create)/)
  assert.match(result.stdout, /skip-config/, 'previews the binary-only install')
})

test('code-intel setup wires a host and is idempotent', async () => {
  const dir = host()
  const env = withCbm(stubBin())
  const first = await runNode([script, 'setup', dir, '--yes'], { cwd: root, env })
  assert.equal(first.code, 0, first.stderr)
  assert.equal(graphIgnored(dir), true)
  assert.equal(codeIntelSelected(dir), true)
  const example = JSON.parse(readFileSync(join(dir, '.mcp', 'codebase-memory.example.json'), 'utf8'))
  assert.ok(example.mcpServers['codebase-memory-mcp'])

  const second = await runNode([script, 'setup', dir, '--yes'], { cwd: root, env })
  assert.equal(second.code, 0, second.stderr)
  assert.equal(readFileSync(join(dir, '.gitignore'), 'utf8').match(/\.codebase-memory\//g).length, 1)
  assert.match(second.stdout, /already/)
})

test('setup preserves unrelated answers', async () => {
  const dir = host({ name: 'legacy', providers: ['claude'], skillSync: 'symlink' })
  await runNode([script, 'setup', dir, '--yes'], { cwd: root, env: withCbm(stubBin()) })
  const answers = JSON.parse(readFileSync(join(dir, 'agent-compass.answers.json'), 'utf8'))
  assert.equal(answers.name, 'legacy')
  assert.equal(answers.skillSync, 'symlink')
  assert.equal(answers.codeIntelligence, CODE_INTEL_CHOICE)
})

test('install refuses to change machine state without a TTY or --yes', async () => {
  const result = await runNode([script, 'install', host()], { cwd: root, env: withoutCbm() })
  assert.equal(result.code, 1)
  assert.match(result.stderr, /--yes/)
  assert.match(result.stderr, /--dry/)
})

test('mcp-probe ignores the code-intelligence example until the host opts in', async () => {
  const probe = join(root, 'scripts', 'mcp-probe.mjs')
  const dir = host()
  mkdirSync(join(dir, '.mcp'), { recursive: true })
  writeFileSync(join(dir, '.mcp', 'codebase-memory.example.json'), JSON.stringify({
    mcpServers: { 'codebase-memory-mcp': { command: 'codebase-memory-mcp', args: [], cwd: '.' } },
  }))

  const before = await runNode([probe, dir, '--json'], { cwd: root })
  assert.equal(JSON.parse(before.stdout).servers.length, 0, 'catalogue entry is not a readiness gap')

  writeFileSync(join(dir, 'agent-compass.answers.json'), JSON.stringify({ codeIntelligence: CODE_INTEL_CHOICE }))
  const after = await runNode([probe, dir, '--json'], { cwd: root })
  assert.equal(JSON.parse(after.stdout).servers[0].name, 'codebase-memory-mcp')
})

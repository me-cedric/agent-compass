// codebase-memory.mjs — the one place that knows how to find, read, install,
// and configure codebase-memory-mcp (CBM), the optional structural
// code-intelligence layer. Every compass script that touches CBM imports from
// here instead of spawning the binary itself.
//
// Layer split (see docs/tooling/codebase-memory.md):
//   source code   — canonical implementation truth
//   README/DESIGN/ADR — intended architecture and rationale
//   CBM           — current structural truth (symbols, calls, imports, impact)
//   projectmem    — durable engineering history (decisions, failures, fixes)
//
// Agent Compass installs the CBM binary only (`--skip-config`) and generates
// the MCP/provider config itself. CBM never writes compass-owned files.

import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync, rmSync } from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import { join } from 'node:path'

export const CBM_BIN = 'codebase-memory-mcp'
export const CBM_REPO = 'https://github.com/DeusData/codebase-memory-mcp'
export const CBM_INSTALL_SH = 'https://raw.githubusercontent.com/DeusData/codebase-memory-mcp/main/install.sh'
export const CBM_INSTALL_PS1 = 'https://raw.githubusercontent.com/DeusData/codebase-memory-mcp/main/install.ps1'

// Generated graph cache. Local and persistent by default; the shared
// `.codebase-memory/graph.db.zst` artifact is opt-in, never enabled by us.
export const GRAPH_DIR = '.codebase-memory/'
export const CODEBASE_MEMORY_GITIGNORE = ['.codebase-memory/']

// Compass defaults: the whole point is that agents stop rebuilding project
// understanding every session, so both are on when the host selects CBM.
export const DESIRED_CONFIG = { auto_index: 'true', auto_watch: 'true' }

export const MCP_EXAMPLE_REL = '.mcp/codebase-memory.example.json'
export const ANSWERS_KEY = 'codeIntelligence'
export const CODE_INTEL_CHOICE = 'codebase-memory'

// --- platform --------------------------------------------------------------
//
// Every platform difference is resolved by these pure helpers, parameterised by
// platform and env so the whole matrix is testable from one machine. Nothing
// below this block branches on process.platform directly.

const exeName = (name, platform) => (platform === 'win32' ? `${name}.exe` : name)
const pathSep = (platform) => (platform === 'win32' ? ';' : ':')
const homeOf = (env) => env.HOME || env.USERPROFILE || homedir()

// Where each upstream installer puts the binary by default, for the case where
// it is installed but its directory is not on PATH yet (a fresh install in an
// already-running shell). POSIX: install.sh `--dir` default. Windows:
// install.ps1 `$InstallDir` default, checked with and without a bin/ subdir.
export const fallbackDirs = (platform = process.platform, env = process.env) => {
  if (platform !== 'win32') return [join(homeOf(env), '.local', 'bin')]
  const root = join(env.LOCALAPPDATA || join(homeOf(env), 'AppData', 'Local'), 'Programs', 'codebase-memory-mcp')
  return [root, join(root, 'bin')]
}

export const searchDirs = (platform = process.platform, env = process.env) => [
  ...(env.PATH || '').split(pathSep(platform)).filter(Boolean),
  ...fallbackDirs(platform, env),
]

const onPath = (name, platform = process.platform, env = process.env) => (env.PATH || '')
  .split(pathSep(platform))
  .some((dir) => dir && existsSync(join(dir, exeName(name, platform))))

// --- discovery -------------------------------------------------------------

// Walking PATH in-process beats shelling out: doctor and recommend call this on
// every run, and a login shell costs more than the lookup it performs.
export const findExecutable = (platform = process.platform, env = process.env) => {
  for (const dir of searchDirs(platform, env)) {
    const candidate = join(dir, exeName(CBM_BIN, platform))
    if (existsSync(candidate)) return candidate
  }
  return null
}

// --- process helpers -------------------------------------------------------

// One spawn wrapper for every CBM call: bounded, never inherits stdio, always
// returns a result object instead of throwing.
export const runCbm = (bin, args, { timeout = 30_000, cwd } = {}) => {
  if (!bin) return { ok: false, stdout: '', stderr: `${CBM_BIN} not found`, status: 127 }
  const result = spawnSync(bin, args, { encoding: 'utf8', timeout, cwd })
  if (result.error) return { ok: false, stdout: '', stderr: result.error.message, status: 1 }
  return { ok: result.status === 0, stdout: result.stdout || '', stderr: result.stderr || '', status: result.status ?? 1 }
}

export const cbmVersion = (bin) => {
  const result = runCbm(bin, ['--version'], { timeout: 10_000 })
  if (!result.ok) return null
  return result.stdout.trim().split(/\s+/).pop() || null
}

// `config list` prints aligned `key = value` rows; parse them into a plain object.
export const readCbmConfig = (bin) => {
  const result = runCbm(bin, ['config', 'list'], { timeout: 10_000 })
  if (!result.ok) return null
  const config = {}
  for (const line of result.stdout.split(/\r?\n/)) {
    const match = line.match(/^\s{2,}([\w-]+)\s*=\s*(.+?)\s*$/)
    if (match) config[match[1]] = match[2]
  }
  return Object.keys(config).length ? config : null
}

export const setCbmConfig = (bin, key, value) => runCbm(bin, ['config', 'set', key, String(value)], { timeout: 10_000 })

// Which values differ from the compass defaults. Empty array = nothing to do.
export const configDrift = (config) => Object.entries(DESIRED_CONFIG)
  .filter(([key, want]) => String(config?.[key] ?? '') !== want)
  .map(([key, want]) => ({ key, want, have: config?.[key] ?? '(unset)' }))

// Cheap read-only project listing. Never indexes; `index_repository` is the
// only tool that writes a graph and we never call it from status/doctor.
export const indexedProjects = (bin) => {
  const result = runCbm(bin, ['cli', '--json', 'list_projects'], { timeout: 20_000 })
  if (!result.ok) return null
  const line = result.stdout.split(/\r?\n/).reverse().find((l) => l.trim().startsWith('{'))
  if (!line) return null
  try {
    const payload = JSON.parse(line)
    const projects = payload.structuredContent?.projects
    return Array.isArray(projects) ? projects : null
  } catch { return null }
}

const projectPaths = (project) => [project?.path, project?.repo_path, project?.root, project?.repoPath].filter(Boolean)

export const isIndexed = (projects, root) => Array.isArray(projects)
  && projects.some((project) => projectPaths(project).some((path) => path === root))

// --- host wiring -----------------------------------------------------------

const readAnswers = (root) => {
  try { return JSON.parse(readFileSync(join(root, 'agent-compass.answers.json'), 'utf8')) } catch { return null }
}

// null  — host never answered the question (pre-0.7.6 answers file, or none):
//         CBM stays advisory and no check may fail because of it.
// 'none' — explicitly declined.
export const codeIntelChoice = (root) => {
  const answers = readAnswers(root)
  if (!answers || !(ANSWERS_KEY in answers)) return null
  return answers[ANSWERS_KEY] || 'none'
}

export const codeIntelSelected = (root) => codeIntelChoice(root) === CODE_INTEL_CHOICE

const gitignoreLines = (root) => {
  try { return readFileSync(join(root, '.gitignore'), 'utf8').split(/\r?\n/).map((line) => line.trim()) } catch { return [] }
}

// Accept the trailing-slash and bare forms; both ignore the generated cache.
export const graphIgnored = (root) => {
  const lines = gitignoreLines(root)
  return lines.includes('.codebase-memory/') || lines.includes('.codebase-memory')
}

export const mcpExampleInstalled = (root) => existsSync(join(root, MCP_EXAMPLE_REL))

// --- install ---------------------------------------------------------------

// Manual fallback printed whenever automatic installation is impossible, so the
// user always leaves with an exact command instead of a dead end. Both installers
// take `--skip-config` — the PowerShell one parses `$args` rather than a param()
// block, so it is the same double-dash spelling, not `-SkipConfig`.
export const manualInstallCommand = (platform = process.platform) => (platform === 'win32'
  ? `Invoke-WebRequest -Uri ${CBM_INSTALL_PS1} -OutFile install.ps1; Unblock-File .\\install.ps1; .\\install.ps1 --skip-config`
  : `curl -fsSL ${CBM_INSTALL_SH} -o install.sh && sh install.sh --skip-config`)

// The exact commands `install` runs, as data: pure, so --dry prints precisely
// what would execute and so the platform matrix is testable anywhere.
//
// We never pipe the network into a shell, and we never reimplement the
// download — upstream's mandatory SHA-256 checksum verification stays in
// charge on both platforms. `--skip-config` is what keeps provider config
// ownership with agent-compass.
export const installPlan = ({ platform = process.platform, script, downloader = 'curl', shell = 'powershell' }) => {
  if (platform === 'win32') {
    return [
      [shell, ['-NoProfile', '-Command', `Invoke-WebRequest -Uri ${CBM_INSTALL_PS1} -OutFile '${script}'; Unblock-File -Path '${script}'`]],
      [shell, ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', script, '--skip-config']],
    ]
  }
  return [
    downloader === 'wget'
      ? ['wget', ['-qO', script, CBM_INSTALL_SH]]
      : ['curl', ['-fsSL', CBM_INSTALL_SH, '-o', script]],
    ['sh', [script, '--skip-config']],
  ]
}

// Resolve the tools the plan needs, or explain which one is missing.
const installTools = (platform, env) => {
  if (platform === 'win32') {
    const shell = ['pwsh', 'powershell'].find((name) => onPath(name, platform, env))
    return shell ? { shell } : { missing: 'pwsh or powershell' }
  }
  const downloader = ['curl', 'wget'].find((name) => onPath(name, platform, env))
  return downloader ? { downloader } : { missing: 'curl or wget' }
}

export const installCbm = ({ dry = false, platform = process.platform, env = process.env } = {}) => {
  const tools = installTools(platform, env)
  const script = join(tmpdir(), `codebase-memory-install-${process.pid}${platform === 'win32' ? '.ps1' : '.sh'}`)
  if (tools.missing) {
    return { ok: false, reason: `${tools.missing} not found`, manual: manualInstallCommand(platform) }
  }
  const steps = installPlan({ platform, script, ...tools })
  if (dry) return { ok: true, dry: true, steps: steps.map(([cmd, args]) => `${cmd} ${args.join(' ')}`) }
  try {
    for (const [cmd, args] of steps) {
      const result = spawnSync(cmd, args, { stdio: 'inherit', timeout: 300_000 })
      if (result.error || result.status !== 0) {
        return { ok: false, reason: `${cmd} failed`, manual: manualInstallCommand(platform) }
      }
    }
  } finally {
    // Never leave a downloaded installer behind in the temp directory.
    try { rmSync(script, { force: true }) } catch {}
  }
  return { ok: true }
}

// --- status ----------------------------------------------------------------

// One read-only snapshot every caller (status, doctor, recommend) shares.
// Both probes are opt-out and neither ever triggers indexing. They are separate
// flags because they cost very differently: `config list` and `list_projects`
// each pay CBM's ~1.7s start-up, while finding the binary and reading the
// version are free. Host wiring checks must stay cheap, so `agent-compass
// doctor` turns both off and defers config reporting to `code-intel doctor`.
export const snapshot = (root, { probeIndex = true, probeConfig = true } = {}) => {
  const bin = findExecutable()
  const installed = Boolean(bin)
  const config = installed && probeConfig ? readCbmConfig(bin) : null
  const projects = installed && probeIndex ? indexedProjects(bin) : null
  return {
    choice: codeIntelChoice(root),
    selected: codeIntelSelected(root),
    installed,
    executable: bin,
    version: installed ? cbmVersion(bin) : null,
    config,
    // No config probe means no evidence of drift — never report a key as wrong
    // just because we chose not to read it.
    drift: installed && probeConfig ? configDrift(config) : [],
    autoIndex: config?.auto_index ?? null,
    autoWatch: config?.auto_watch ?? null,
    indexed: projects === null ? null : isIndexed(projects, root),
    mcpExample: mcpExampleInstalled(root),
    graphIgnored: graphIgnored(root),
  }
}

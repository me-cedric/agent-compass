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
import { existsSync, readFileSync } from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import { delimiter, join } from 'node:path'

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

const isWin = process.platform === 'win32'
const exe = (name) => (isWin ? `${name}.exe` : name)

// --- discovery -------------------------------------------------------------

// PATH first, then the installer's documented default directory (~/.local/bin),
// which a non-login shell may not have on PATH yet. Walking PATH in-process
// beats shelling out: doctor and recommend call this on every run.
export const findExecutable = () => {
  const dirs = [...(process.env.PATH || '').split(delimiter), join(homedir(), '.local', 'bin')]
  for (const dir of dirs) {
    if (!dir) continue
    const candidate = join(dir, exe(CBM_BIN))
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
// user always leaves with an exact command instead of a dead end.
export const manualInstallCommand = () => (isWin
  ? `Invoke-WebRequest -Uri ${CBM_INSTALL_PS1} -OutFile install.ps1; Unblock-File .\\install.ps1; .\\install.ps1 -SkipConfig`
  : `curl -fsSL ${CBM_INSTALL_SH} -o install.sh && sh install.sh --skip-config`)

// Download the official installer to a temp file, then run it. We do not pipe
// the network straight into a shell, and we do not reimplement the download:
// upstream's mandatory SHA-256 checksum verification stays in charge.
// `--skip-config` is what keeps provider config ownership with agent-compass.
export const installCbm = ({ dry = false } = {}) => {
  if (isWin) {
    return { ok: false, reason: 'automatic install is POSIX-only', manual: manualInstallCommand() }
  }
  const script = join(tmpdir(), `codebase-memory-install-${process.pid}.sh`)
  const steps = [
    ['curl', ['-fsSL', CBM_INSTALL_SH, '-o', script]],
    ['sh', [script, '--skip-config']],
  ]
  if (dry) return { ok: true, dry: true, steps: steps.map(([cmd, args]) => `${cmd} ${args.join(' ')}`) }
  for (const [cmd, args] of steps) {
    const result = spawnSync(cmd, args, { stdio: 'inherit', timeout: 300_000 })
    if (result.error || result.status !== 0) {
      return { ok: false, reason: `${cmd} failed`, manual: manualInstallCommand() }
    }
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

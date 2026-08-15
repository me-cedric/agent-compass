#!/usr/bin/env node
// code-intel.mjs — manage the optional structural code-intelligence layer
// (codebase-memory-mcp). Agent Compass installs the binary only and owns the
// MCP/provider configuration itself; CBM never writes compass-owned files.
//
//   agent-compass code-intel status      read-only report (never indexes)
//   agent-compass code-intel install     install the CBM executable for this user
//   agent-compass code-intel configure   auto_index=true, auto_watch=true
//   agent-compass code-intel setup       status → install → configure → wire → verify
//   agent-compass code-intel doctor      actionable diagnostics, exit 1 when broken

import { existsSync, copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { parseCliArgs, resolveRoot } from './lib/args.mjs'
import { c, confirm, sym } from './lib/tui.mjs'
import {
  ANSWERS_KEY,
  CBM_BIN,
  CBM_REPO,
  CODEBASE_MEMORY_GITIGNORE,
  CODE_INTEL_CHOICE,
  DESIRED_CONFIG,
  MCP_EXAMPLE_REL,
  configDrift,
  findExecutable,
  installCbm,
  manualInstallCommand,
  readCbmConfig,
  setCbmConfig,
  snapshot,
} from './lib/codebase-memory.mjs'

const AC = dirname(dirname(fileURLToPath(import.meta.url)))
const ACTIONS = ['status', 'install', 'configure', 'setup', 'doctor']

const { values, positionals } = parseCliArgs({
  name: 'code-intel',
  script: 'code-intel.mjs',
  usage: `agent-compass code-intel <${ACTIONS.join('|')}> [root] [options]`,
  summary: `Manage codebase-memory-mcp, the optional structural code-intelligence layer.

  status      Report installation, config, MCP wiring, and ignore policy. Never indexes.
  install     Install the CBM executable for the current user (binary only, no sudo).
  configure   Set the Agent Compass defaults (${Object.entries(DESIRED_CONFIG).map(([k, v]) => `${k}=${v}`).join(', ')}).
  setup       Idempotent chain: status → install if missing → configure → wire host → verify.
  doctor      Actionable diagnostics. Exits 1 only when the host selected CBM and it is broken.`,
  positionals: [{ name: 'action', required: false }, { name: 'root', required: false }],
  options: {
    yes: { type: 'boolean', desc: 'Approve machine-level changes without prompting.' },
    dry: { type: 'boolean', desc: 'Print the actions without running them.' },
    json: { type: 'boolean', desc: 'Machine-readable status/doctor output.' },
  },
})

const action = positionals[0] || 'status'
if (!ACTIONS.includes(action)) {
  console.error(`Unknown code-intel action: ${action}\nExpected one of: ${ACTIONS.join(', ')}`)
  process.exit(1)
}

const ROOT = resolveRoot(positionals.slice(1))
const yes = Boolean(values.yes)
const dry = Boolean(values.dry)
const json = Boolean(values.json)

const mark = (ok) => (ok ? sym.ok() : sym.fail())
const note = (text) => console.log(`  ${text}`)

// --- status ----------------------------------------------------------------

const describe = (snap) => {
  const lines = []
  lines.push(`${mark(snap.installed)} executable: ${snap.installed ? `${snap.executable} (${snap.version || 'unknown version'})` : `missing — run \`agent-compass code-intel install\``}`)
  lines.push(`${snap.selected ? sym.ok() : sym.skip()} host selection: ${snap.choice === null ? 'unanswered (advisory)' : snap.choice}`)
  if (snap.installed) {
    for (const [key, want] of Object.entries(DESIRED_CONFIG)) {
      const have = snap.config?.[key] ?? '(unset)'
      lines.push(`${mark(have === want)} ${key}: ${have}`)
    }
  }
  lines.push(`${snap.mcpExample ? sym.ok() : sym.skip()} MCP config: ${snap.mcpExample ? MCP_EXAMPLE_REL : `${MCP_EXAMPLE_REL} not installed`}`)
  lines.push(`${snap.graphIgnored ? sym.ok() : sym.skip()} .codebase-memory/ ignored: ${snap.graphIgnored ? 'yes' : 'no'}`)
  const indexed = snap.indexed === null ? 'unknown (binary or index db unavailable)' : snap.indexed ? 'yes' : 'no — index on first agent query'
  lines.push(`${snap.indexed ? sym.ok() : sym.skip()} this repository indexed: ${indexed}`)
  return lines
}

const runStatus = () => {
  const snap = snapshot(ROOT)
  if (json) { console.log(JSON.stringify({ schema: 1, root: ROOT, ...snap }, null, 2)); return snap }
  console.log(`\ncodebase-memory-mcp status → ${ROOT}\n`)
  describe(snap).forEach((line) => console.log(line))
  console.log(`\n${c.dim(`upstream: ${CBM_REPO}`)}`)
  return snap
}

// --- install ---------------------------------------------------------------

const approve = async (question) => {
  if (yes) return true
  if (!process.stdin.isTTY) {
    console.error(`${sym.fail()} ${question}\n  Non-interactive shell: re-run with --yes to approve, or --dry to preview.`)
    return false
  }
  return confirm({ message: question, initial: true })
}

const runInstall = async () => {
  if (findExecutable()) {
    console.log(`${sym.ok()} ${CBM_BIN} already installed — nothing to do.`)
    return true
  }
  if (dry) {
    const plan = installCbm({ dry: true })
    console.log(`${sym.skip()} would install ${CBM_BIN} (binary only, no agent config):`)
    ;(plan.steps || [plan.manual]).forEach((step) => note(`$ ${step}`))
    return true
  }
  const ok = await approve(`Install ${CBM_BIN} into ~/.local/bin (user-level, no sudo)?`)
  if (!ok) { console.log(`${sym.skip()} install declined. Manual command:\n  ${manualInstallCommand()}`); return false }
  const result = installCbm()
  if (!result.ok) {
    console.error(`${sym.fail()} automatic install failed (${result.reason}). Run it yourself:\n  ${result.manual}`)
    return false
  }
  const bin = findExecutable()
  if (!bin) {
    console.error(`${sym.fail()} installer finished but ${CBM_BIN} is still not on PATH.\n  Add ~/.local/bin to PATH, or run:\n  ${manualInstallCommand()}`)
    return false
  }
  console.log(`${sym.ok()} installed ${bin}`)
  return true
}

// --- configure -------------------------------------------------------------

const runConfigure = () => {
  const bin = findExecutable()
  if (!bin) {
    console.error(`${sym.fail()} ${CBM_BIN} not found. Run \`agent-compass code-intel install\` first.`)
    return false
  }
  const drift = configDrift(readCbmConfig(bin))
  if (!drift.length) { console.log(`${sym.ok()} CBM config already matches Agent Compass defaults.`); return true }
  if (dry) {
    drift.forEach(({ key, want, have }) => console.log(`${sym.skip()} would set ${key}=${want} (currently ${have})`))
    return true
  }
  let ok = true
  for (const { key, want } of drift) {
    const result = setCbmConfig(bin, key, want)
    console.log(`${mark(result.ok)} ${key}=${want}${result.ok ? '' : ` — ${result.stderr.trim() || 'failed'}`}`)
    if (!result.ok) ok = false
  }
  return ok
}

// --- host wiring -----------------------------------------------------------

const appendGitignore = () => {
  const path = join(ROOT, '.gitignore')
  const existing = existsSync(path) ? readFileSync(path, 'utf8') : ''
  const missing = CODEBASE_MEMORY_GITIGNORE.filter((line) => !existing.split(/\r?\n/).some((l) => l.trim() === line))
  if (!missing.length) return []
  if (!dry) {
    const prefix = existing && !existing.endsWith('\n') ? '\n' : ''
    writeFileSync(path, `${existing}${prefix}${existing ? '\n' : ''}# codebase-memory-mcp generated graph (local cache; shared artifact is opt-in)\n${missing.join('\n')}\n`)
  }
  return missing
}

const placeMcpExample = () => {
  const dest = join(ROOT, MCP_EXAMPLE_REL)
  if (existsSync(dest)) return 'present'
  const src = join(AC, 'templates', 'mcp', 'codebase-memory.example.json')
  if (ROOT === AC) return 'self'
  if (!existsSync(src)) return 'missing-template'
  if (dry) return 'would-create'
  mkdirSync(dirname(dest), { recursive: true })
  copyFileSync(src, dest)
  return 'created'
}

// Record the choice so doctor/recommend stop treating CBM as merely advisory.
// agent-compass itself is not a host: it ships the template rather than
// installing it, so it never carries a host answers file for this key.
const recordChoice = () => {
  if (ROOT === AC) return 'self'
  const path = join(ROOT, 'agent-compass.answers.json')
  let answers = {}
  try { answers = JSON.parse(readFileSync(path, 'utf8')) } catch {}
  if (answers[ANSWERS_KEY] === CODE_INTEL_CHOICE) return 'present'
  if (dry) return 'would-record'
  writeFileSync(path, JSON.stringify({ ...answers, [ANSWERS_KEY]: CODE_INTEL_CHOICE }, null, 2) + '\n')
  return 'recorded'
}

// --- setup -----------------------------------------------------------------

const runSetup = async () => {
  console.log(`\ncodebase-memory-mcp setup ${dry ? '(dry run) ' : ''}→ ${ROOT}\n`)
  const installed = await runInstall()
  if (!installed && !dry) return false
  // A dry run against a machine without CBM has nothing to read; say so
  // instead of failing the whole preview.
  const configured = findExecutable()
    ? runConfigure()
    : (console.log(`${sym.skip()} config: skipped — ${CBM_BIN} not installed yet`), true)
  const ignores = appendGitignore()
  console.log(`${sym.ok()} .gitignore: ${ignores.length ? `${dry ? 'would add' : 'added'} ${ignores.join(', ')}` : 'already ignores .codebase-memory/'}`)
  const mcp = placeMcpExample()
  const mcpLabel = {
    present: `${MCP_EXAMPLE_REL} already present`,
    created: `created ${MCP_EXAMPLE_REL}`,
    'would-create': `would create ${MCP_EXAMPLE_REL}`,
    self: 'agent-compass itself — canonical example lives at templates/mcp/codebase-memory.example.json',
    'missing-template': 'template missing from this agent-compass checkout',
  }[mcp]
  console.log(`${mcp === 'missing-template' ? sym.fail() : sym.ok()} MCP: ${mcpLabel}`)
  const choice = recordChoice()
  const choiceLabel = {
    self: 'agent-compass itself — no host answers file to record',
    present: `${ANSWERS_KEY} already set`,
    recorded: `recorded ${ANSWERS_KEY}="${CODE_INTEL_CHOICE}"`,
    'would-record': `would record ${ANSWERS_KEY}="${CODE_INTEL_CHOICE}"`,
  }[choice]
  console.log(`${sym.ok()} answers: ${choiceLabel}`)
  console.log('')
  const snap = snapshot(ROOT, { probeIndex: !dry })
  describe(snap).forEach((line) => console.log(line))
  console.log(`\nCopy ${MCP_EXAMPLE_REL} into your MCP client config, then restart the agent session.`)
  return configured && mcp !== 'missing-template'
}

// --- doctor ----------------------------------------------------------------

const runDoctor = () => {
  // Doctor reports wiring, not index contents — skip the project listing.
  const snap = snapshot(ROOT, { probeIndex: false })
  const selected = snap.selected
  const findings = []
  if (!selected) {
    findings.push(snap.installed
      ? { level: 'ok', text: `${CBM_BIN} installed but not selected for this host. Run \`agent-compass code-intel setup\` to wire it in.` }
      : { level: 'info', text: `${CBM_BIN} not configured. Recommended for large or multi-module repositories to reduce broad agent exploration.` })
  } else {
    if (!snap.installed) findings.push({ level: 'fail', text: `${CBM_BIN} selected but the executable is missing.\n  Run: agent-compass code-intel install` })
    for (const { key, want, have } of snap.drift) {
      findings.push({ level: 'warn', text: `${CBM_BIN} ${key}=${have}\n  Run: agent-compass code-intel configure  (want ${key}=${want})` })
    }
    if (!snap.mcpExample) findings.push({ level: 'warn', text: `${MCP_EXAMPLE_REL} missing.\n  Run: agent-compass code-intel setup` })
    if (!snap.graphIgnored) findings.push({ level: 'warn', text: `.codebase-memory/ is not gitignored — the generated graph would be committed.\n  Run: agent-compass code-intel setup` })
  }
  const broken = selected && (!snap.installed || snap.drift.length > 0 || !snap.mcpExample || !snap.graphIgnored)
  if (json) {
    console.log(JSON.stringify({ schema: 1, root: ROOT, ok: !broken, findings, ...snap }, null, 2))
    return !broken
  }
  console.log(`\ncodebase-memory-mcp doctor → ${ROOT}\n`)
  if (!findings.length) {
    console.log(`${sym.ok()} ${CBM_BIN} installed (${snap.version})`)
    console.log(`${sym.ok()} automatic indexing enabled`)
    console.log(`${sym.ok()} watcher enabled`)
    console.log(`${sym.ok()} MCP config available (${MCP_EXAMPLE_REL})`)
    console.log(`${sym.ok()} generated graph ignored`)
  } else {
    for (const finding of findings) {
      const glyph = finding.level === 'fail' ? sym.fail() : finding.level === 'warn' ? '!' : finding.level === 'ok' ? sym.ok() : '○'
      console.log(`${glyph} ${finding.text}`)
    }
  }
  return !broken
}

// --- dispatch --------------------------------------------------------------

const run = async () => {
  switch (action) {
    case 'status': runStatus(); return true
    case 'install': return runInstall()
    case 'configure': return runConfigure()
    case 'setup': return runSetup()
    case 'doctor': return runDoctor()
    default: return false
  }
}

process.exit((await run()) ? 0 : 1)

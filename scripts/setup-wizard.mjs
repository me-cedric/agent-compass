#!/usr/bin/env node
// setup-wizard.mjs — interactive host setup planner + executor.

import { spawnSync } from 'node:child_process'
import { createInterface } from 'node:readline/promises'
import { stdin as input, stdout as output } from 'node:process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { detectStacks, selectAssets } from './lib/profiles.mjs'

const AC = dirname(dirname(fileURLToPath(import.meta.url)))
const args = process.argv.slice(2)
const help = `Usage: node scripts/setup-wizard.mjs [host-dir] [--global] [--yes] [--dry] [--no-run]

Create agent-compass.answers.json and an adoption plan, then optionally run setup-host.

Options:
  --global  Plan user-level setup instead of project setup.
  --yes     Use detected/default answers.
  --dry     Print plan, write nothing.
  --no-run  Write plan only; do not run setup-host.
  --help    Show this help.
`
if (args.includes('--help')) { console.log(help); process.exit(0) }

const HOST = resolve(args.find((a) => !a.startsWith('--')) || process.cwd())
const yes = args.includes('--yes')
const dry = args.includes('--dry')
const noRun = args.includes('--no-run')
const global = args.includes('--global')

const readJson = (path) => { try { return JSON.parse(readFileSync(path, 'utf8')) } catch { return null } }
const pkg = readJson(join(HOST, 'package.json')) || {}
const detectPm = () => existsSync(join(HOST, 'pnpm-lock.yaml')) ? 'pnpm'
  : existsSync(join(HOST, 'yarn.lock')) ? 'yarn'
    : existsSync(join(HOST, 'bun.lockb')) ? 'bun'
      : 'npm'

const ask = async (rl, label, fallback) => {
  if (yes) return fallback
  const answer = await rl.question(`${label} [${fallback}]: `)
  return answer.trim() || fallback
}

const rl = yes ? null : createInterface({ input, output })
const answers = {
  name: await ask(rl, 'Project name', pkg.name || HOST.split('/').pop()),
  scope: await ask(rl, 'Package scope', '@scope'),
  packageManager: await ask(rl, 'Package manager', detectPm()),
  stacks: (await ask(rl, 'Stacks comma-list', detectStacks(HOST).join(',') || 'generic')).split(',').map((s) => s.trim()).filter(Boolean),
  providers: (await ask(rl, 'Agent providers comma-list', 'claude,codex,copilot,cursor,windsurf,gemini')).split(',').map((s) => s.trim()).filter(Boolean),
  useSpecKit: (await ask(rl, 'Install Spec Kit bridge? yes/no', 'yes')).toLowerCase().startsWith('y'),
  skillSync: await ask(rl, 'Skill sync mode copy|symlink|none', 'copy'),
  skillScope: await ask(rl, 'Skill scope fit|all (fit = core + detected stacks only)', 'fit'),
}
if (rl) rl.close()

const plan = `# Agent Compass Setup Plan

Host: \`${HOST}\`
Mode: \`${global ? 'global' : 'project'}\`

## Answers

\`\`\`json
${JSON.stringify(answers, null, 2)}
\`\`\`

## Execution

1. Run \`${global ? 'global-setup' : 'setup-host --strict'}\`.
2. ${answers.useSpecKit ? 'Install Spec Kit bridge files.' : 'Skip Spec Kit bridge.'}
3. ${answers.skillSync === 'none' ? 'Skip skill sync.' : `Sync ${answers.skillScope === 'all' ? 'all skills' : 'fit-based skills (core + detected stacks)'} using ${answers.skillSync}.`}
4. Run provider verification, recommendations, quality gates, and dashboard.
`

if (dry) {
  console.log(plan)
  process.exit(0)
}

const planDir = global ? join(HOST, '.agent-compass') : join(HOST, '.agent')
mkdirSync(planDir, { recursive: true })
if (!global) writeFileSync(join(HOST, 'agent-compass.answers.json'), JSON.stringify(answers, null, 2) + '\n')
writeFileSync(join(planDir, 'setup-plan.md'), plan)
console.log(join(planDir, 'setup-plan.md'))

if (!noRun) {
  const setup = global
    ? spawnSync(process.execPath, [join(AC, 'scripts', 'global-setup.mjs'), HOST, `--${answers.skillSync === 'none' ? 'copy' : answers.skillSync}`, ...(answers.skillSync === 'none' ? ['--no-skills'] : [])], { stdio: 'inherit' })
    : spawnSync(process.execPath, [join(AC, 'scripts', 'setup-host.mjs'), HOST, '--strict'], { stdio: 'inherit' })
  if (setup.status) process.exit(setup.status)
  if (global) {
    spawnSync(process.execPath, [join(AC, 'scripts', 'provider-verify.mjs'), HOST, '--global', '--write'], { stdio: 'inherit' })
    process.exit(0)
  }
  if (answers.useSpecKit) spawnSync(process.execPath, [join(AC, 'scripts', 'spec-kit-bridge.mjs'), HOST], { stdio: 'inherit' })
  if (answers.skillSync !== 'none') {
    const scopeArgs = answers.skillScope === 'all' ? [] : ['--only', selectAssets(detectStacks(HOST)).skills.join(',')]
    spawnSync(process.execPath, [join(AC, 'scripts', 'skills-sync.mjs'), HOST, `--${answers.skillSync}`, ...scopeArgs], { stdio: 'inherit' })
  }
  spawnSync(process.execPath, [join(AC, 'scripts', 'provider-verify.mjs'), HOST, '--write'], { stdio: 'inherit' })
  spawnSync(process.execPath, [join(AC, 'scripts', 'recommend.mjs'), HOST, '--write'], { stdio: 'inherit' })
  spawnSync(process.execPath, [join(AC, 'scripts', 'quality-gates.mjs'), HOST, '--write'], { stdio: 'inherit' })
  spawnSync(process.execPath, [join(AC, 'scripts', 'migration-plan.mjs'), HOST, '--write'], { stdio: 'inherit' })
  spawnSync(process.execPath, [join(AC, 'scripts', 'spec-validation-map.mjs'), HOST, '--write'], { stdio: 'inherit' })
  spawnSync(process.execPath, [join(AC, 'scripts', 'mcp-probe.mjs'), HOST, '--write'], { stdio: 'inherit' })
  spawnSync(process.execPath, [join(AC, 'scripts', 'failure-mine.mjs'), HOST, '--write'], { stdio: 'inherit' })
  spawnSync(process.execPath, [join(AC, 'scripts', 'dashboard.mjs'), HOST, '--write'], { stdio: 'inherit' })
}

#!/usr/bin/env node
// setup-wizard.mjs — interactive host setup planner + executor.

import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { parseCliArgs, resolveRoot } from './lib/args.mjs'
import { PROFILES, STYLE_SKILLS, detectStacks, selectAssets } from './lib/profiles.mjs'
import { confirm, multiselect, select, text } from './lib/tui.mjs'

const AC = dirname(dirname(fileURLToPath(import.meta.url)))

const { values, positionals } = parseCliArgs({
  name: 'wizard',
  script: 'setup-wizard.mjs',
  summary: 'Create agent-compass.answers.json and an adoption plan, then optionally run setup-host.',
  positionals: [{ name: 'host-dir', required: false }],
  options: {
    global: { type: 'boolean', desc: 'Plan user-level setup instead of project setup.' },
    yes: { type: 'boolean', desc: 'Use detected/default answers (no prompts).' },
    dry: { type: 'boolean', desc: 'Print plan, write nothing.' },
    'no-run': { type: 'boolean', desc: 'Write plan only; do not run setup-host.' },
  },
})

const HOST = resolveRoot(positionals)
const yes = Boolean(values.yes)
const dry = Boolean(values.dry)
const noRun = Boolean(values['no-run'])
const global = Boolean(values.global)

if (!yes && !process.stdin.isTTY) {
  console.error('non-interactive terminal: pass --yes or run in a TTY')
  process.exit(1)
}

const readJson = (path) => { try { return JSON.parse(readFileSync(path, 'utf8')) } catch { return null } }
const pkg = readJson(join(HOST, 'package.json')) || {}
const detectPm = () => existsSync(join(HOST, 'pnpm-lock.yaml')) ? 'pnpm'
  : existsSync(join(HOST, 'yarn.lock')) ? 'yarn'
    : existsSync(join(HOST, 'bun.lockb')) ? 'bun'
      : 'npm'

const PROVIDERS = ['claude', 'codex', 'gemini', 'copilot']
const detected = detectStacks(HOST)
const defaults = {
  name: pkg.name || HOST.split('/').pop(),
  scope: '@scope',
  packageManager: detectPm(),
  stacks: detected.length ? detected : ['generic'],
  providers: PROVIDERS,
  useSpecKit: true,
  skillSync: 'copy',
  skillScope: 'fit+style',
}

const promptAnswers = async () => ({
  name: await text({ message: 'Project name', initial: defaults.name }),
  scope: await text({ message: 'Package scope', initial: defaults.scope }),
  packageManager: await select({ message: 'Package manager', options: ['npm', 'pnpm', 'yarn', 'bun'], initial: defaults.packageManager }),
  stacks: await multiselect({
    message: 'Stacks',
    options: [...new Set([...detected, ...Object.keys(PROFILES), 'generic'])],
    initial: defaults.stacks,
  }),
  providers: await multiselect({ message: 'Agent providers', options: PROVIDERS, initial: PROVIDERS }),
  useSpecKit: await confirm({ message: 'Install Spec Kit bridge?', initial: true }),
  skillSync: await select({ message: 'Skill sync mode', options: ['copy', 'symlink', 'none'], initial: 'copy' }),
  skillScope: await select({
    message: 'Skill scope',
    options: [
      { value: 'fit', label: 'fit', hint: 'core + detected stacks' },
      { value: 'fit+style', label: 'fit+style', hint: 'core + detected stacks + working-style skills' },
      { value: 'all', label: 'all' },
    ],
    initial: defaults.skillScope,
  }),
})

const answers = yes ? defaults : await promptAnswers()

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
3. ${answers.skillSync === 'none' ? 'Skip skill sync.' : `Sync ${answers.skillScope === 'all' ? 'all skills' : answers.skillScope === 'fit+style' ? 'fit-based skills plus working-style skills' : 'fit-based skills (core + detected stacks)'} using ${answers.skillSync}.`}
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
    const fitSkills = selectAssets(detectStacks(HOST)).skills
    const styleSkills = answers.skillScope === 'fit+style' ? STYLE_SKILLS : []
    const scoped = [...new Set([...fitSkills, ...styleSkills])]
    const scopeArgs = answers.skillScope === 'all' ? ['--all'] : ['--only', scoped.join(',')]
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

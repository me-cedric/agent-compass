#!/usr/bin/env node
// adopt.mjs — the one-command adopt mission: detect, set up, fit-sync, verify,
// and tell the agent (or human) exactly what to do next. Chains the existing
// building blocks; each remains usable on its own.
//
//   setup-wizard --yes   detection, answers, full setup-host, reports, fit sync
//   agent-onboard        readiness aggregate (doctor + drift + sync)

import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseCliArgs, resolveRoot } from './lib/args.mjs'
import { c, sym } from './lib/tui.mjs'

const AC = dirname(dirname(fileURLToPath(import.meta.url)))

const { values, positionals } = parseCliArgs({
  name: 'adopt',
  script: 'adopt.mjs',
  summary: `One-command host adoption: non-interactive setup (detected answers, fit-based
skill sync), optional policy pack, then readiness verification and next steps.
Never overwrites existing files. Equivalent to:

  node scripts/setup-wizard.mjs <host> --yes
  node scripts/apply-recommendations.mjs <host> --policy <pack>   (with --policy)
  node scripts/agent-onboard.mjs <host>`,
  positionals: [{ name: 'host-dir', required: false }],
  options: {
    policy: { type: 'string', value: '<pack>', desc: 'Apply a policy pack: safe-local-work | solo-dev | startup-fast | strict-enterprise | regulated-api.' },
    dry: { type: 'boolean', desc: 'Show the plan without writing anything.' },
  },
})

const policy = values.policy || null
const HOST = resolveRoot(positionals)
const dry = Boolean(values.dry)

if (!existsSync(HOST)) { console.error(`Host directory not found: ${HOST}`); process.exit(1) }

const run = (script, extra = []) => {
  const result = spawnSync(process.execPath, [join(AC, 'scripts', script), HOST, ...extra], { stdio: 'inherit' })
  if (result.status) {
    console.error(`\n${sym.fail()} ${script} failed (exit ${result.status}). Fix the cause and re-run — adopt is idempotent.`)
    process.exit(result.status)
  }
}

if (dry) {
  run('setup-wizard.mjs', ['--yes', '--dry'])
  if (policy) console.log(`\nWould apply policy pack: ${policy}`)
  process.exit(0)
}

run('setup-wizard.mjs', ['--yes'])
if (policy) run('apply-recommendations.mjs', ['--policy', policy])
run('agent-onboard.mjs')

const registry = join(HOST, 'agent-compass.commands.json')
let placeholders = false
try { placeholders = /replace-me|<[a-z-]+>|TODO/i.test(readFileSync(registry, 'utf8')) } catch {}

console.log(`
${sym.ok()} Adoption complete. Reports live in ${join(HOST, '.agent')}/.

${c.bold('Next steps:')}
  1. ${placeholders ? 'Fill agent-compass.commands.json with the real install/lint/typecheck/test commands — agents depend on it.' : 'Review agent-compass.commands.json — agents run only what it lists.'}
  2. Read .agent/recommendations.md and apply what fits.
  3. Review and commit the new files yourself (adopt never commits).
`)

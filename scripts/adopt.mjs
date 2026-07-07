#!/usr/bin/env node
// adopt.mjs — the one-command adopt mission: detect, set up, fit-sync, verify,
// and tell the agent (or human) exactly what to do next. Chains the existing
// building blocks; each remains usable on its own.
//
//   setup-wizard --yes   detection, answers, full setup-host, reports, fit sync
//   agent-onboard        readiness aggregate (doctor + drift + sync)

import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const AC = dirname(dirname(fileURLToPath(import.meta.url)))
const args = process.argv.slice(2)
const help = `Usage: node scripts/adopt.mjs [host-dir] [--policy <pack>] [--dry]

One-command host adoption: non-interactive setup (detected answers, fit-based
skill sync), optional policy pack, then readiness verification and next steps.
Never overwrites existing files. Equivalent to:

  node scripts/setup-wizard.mjs <host> --yes
  node scripts/apply-recommendations.mjs <host> --policy <pack>   (with --policy)
  node scripts/agent-onboard.mjs <host>

Options:
  --policy <pack>  Apply a policy pack: safe-local-work | solo-dev | startup-fast |
                   strict-enterprise | regulated-api.
  --dry            Show the plan without writing anything.
  --help           Show this help.
`
if (args.includes('--help')) { console.log(help); process.exit(0) }

const policy = (() => { const i = args.indexOf('--policy'); return i === -1 ? null : args[i + 1] || null })()
const HOST = resolve(args.find((a) => !a.startsWith('--') && a !== policy) || process.cwd())
const dry = args.includes('--dry')

if (!existsSync(HOST)) { console.error(`Host directory not found: ${HOST}`); process.exit(1) }

const run = (script, extra = []) => {
  const result = spawnSync(process.execPath, [join(AC, 'scripts', script), HOST, ...extra], { stdio: 'inherit' })
  if (result.status) {
    console.error(`\n✗ ${script} failed (exit ${result.status}). Fix the cause and re-run — adopt is idempotent.`)
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
✓ Adoption complete. Reports live in ${join(HOST, '.agent')}/.

Next steps:
  1. ${placeholders ? 'Fill agent-compass.commands.json with the real install/lint/typecheck/test commands — agents depend on it.' : 'Review agent-compass.commands.json — agents run only what it lists.'}
  2. Read .agent/recommendations.md and apply what fits.
  3. Review and commit the new files yourself (adopt never commits).
`)

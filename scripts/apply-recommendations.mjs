#!/usr/bin/env node
// apply-recommendations.mjs — apply safe recommendation actions for project or global setup.

import { spawnSync } from 'node:child_process'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const AC = dirname(dirname(fileURLToPath(import.meta.url)))
const args = process.argv.slice(2)
const help = `Usage: node scripts/apply-recommendations.mjs [root] [--global] [--dry] [--policy <name>] [--skills copy|symlink|none]

Apply safe Agent Compass setup recommendations. Project mode is default.

Options:
  --global          Configure user-level agent setup instead of a project.
  --dry             Print actions only.
  --policy <name>   Apply a policy pack: strict-enterprise, startup-fast, solo-dev, regulated-api.
  --skills <mode>   copy | symlink | none (default copy)
  --help            Show this help.
`
if (args.includes('--help')) { console.log(help); process.exit(0) }
const flag = (name, fallback = null) => { const i = args.indexOf(name); return i === -1 ? fallback : args[i + 1] || fallback }
const target = resolve(args.find((a) => !a.startsWith('--') && !['copy', 'symlink', 'none'].includes(a) && a !== flag('--policy') && a !== flag('--skills')) || process.cwd())
const dry = args.includes('--dry')
const skills = flag('--skills', 'copy')
const policy = flag('--policy')
const global = args.includes('--global')

const run = (label, script, scriptArgs) => {
  const cmd = [join(AC, 'scripts', script), ...scriptArgs]
  console.log(`${dry ? 'would run' : 'run'} ${label}: node ${cmd.join(' ')}`)
  if (dry) return true
  const result = spawnSync(process.execPath, cmd, { stdio: 'inherit' })
  return result.status === 0
}

const steps = global
  ? [
      ['global setup', 'global-setup.mjs', [target, ...(skills === 'none' ? ['--no-skills'] : [`--${skills}`])]],
      ['provider verification', 'provider-verify.mjs', [target, '--global', '--write']],
    ]
  : [
      ['host setup', 'setup-host.mjs', [target]],
      ['provider verification', 'provider-verify.mjs', [target, '--write']],
      ['recommendations report', 'recommend.mjs', [target, '--write']],
      ['quality gates', 'quality-gates.mjs', [target, '--write']],
      ['spec validation map', 'spec-validation-map.mjs', [target, '--write']],
      ['mcp readiness', 'mcp-probe.mjs', [target, '--write']],
      ['dashboard', 'dashboard.mjs', [target, '--write']],
    ]
if (policy) steps.unshift(['policy pack', 'policy-pack.mjs', [target, '--apply', policy]])
if (!global && skills !== 'none') steps.splice(2, 0, ['skills sync', 'skills-sync.mjs', [target, `--${skills}`]])

const failed = steps.filter(([label, script, scriptArgs]) => !run(label, script, scriptArgs))
if (failed.length) {
  console.error(`${failed.length} recommendation action(s) failed.`)
  process.exit(1)
}
console.log(global ? 'global recommendations applied' : 'project recommendations applied')

#!/usr/bin/env node
// apply-recommendations.mjs — apply safe recommendation actions for project or global setup.

import { spawnSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseCliArgs, resolveRoot } from './lib/args.mjs'

const AC = dirname(dirname(fileURLToPath(import.meta.url)))

const { values, positionals } = parseCliArgs({
  name: 'apply-recommendations',
  script: 'apply-recommendations.mjs',
  summary: 'Apply safe Agent Compass setup recommendations. Project mode is default.',
  positionals: [{ name: 'root', required: false }],
  options: {
    global: { type: 'boolean', desc: 'Configure user-level agent setup instead of a project.' },
    dry: { type: 'boolean', desc: 'Print actions only.' },
    policy: { type: 'string', value: '<name>', desc: 'Apply a policy pack: safe-local-work, strict-enterprise, startup-fast, solo-dev, regulated-api.' },
    skills: { type: 'string', value: '<mode>', default: 'copy', desc: 'copy | symlink | none (default copy)' },
  },
})

const target = resolveRoot(positionals)
const dry = Boolean(values.dry)
const skills = values.skills
const policy = values.policy || null
const global = Boolean(values.global)

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

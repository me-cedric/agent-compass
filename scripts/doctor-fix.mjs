#!/usr/bin/env node
// doctor-fix.mjs — stronger autofix wrapper around setup-host + reports.

import { spawnSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseCliArgs, resolveRoot } from './lib/args.mjs'

const AC = dirname(dirname(fileURLToPath(import.meta.url)))

const { values, positionals } = parseCliArgs({
  name: 'doctor-fix',
  script: 'doctor-fix.mjs',
  summary: 'Autofix host agent setup and regenerate reports.',
  positionals: [{ name: 'host-dir', required: false }],
  options: {
    dry: { type: 'boolean', desc: 'Show what would change; write nothing.' },
  },
})

const root = resolveRoot(positionals)
const dry = Boolean(values.dry)
const steps = [
  ['setup-host.mjs', dry ? ['--dry', root] : [root]],
  ['provider-verify.mjs', dry ? [root] : [root, '--write']],
  ['recommend.mjs', dry ? [root] : [root, '--write']],
  ['quality-gates.mjs', dry ? [root] : [root, '--write']],
  ['dashboard.mjs', dry ? [root] : [root, '--write']],
]
for (const [script, scriptArgs] of steps) {
  const result = spawnSync(process.execPath, [join(AC, 'scripts', script), ...scriptArgs], { stdio: 'inherit' })
  if (result.status) process.exit(result.status)
}

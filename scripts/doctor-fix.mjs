#!/usr/bin/env node
// doctor-fix.mjs — stronger autofix wrapper around setup-host + reports.

import { spawnSync } from 'node:child_process'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const AC = dirname(dirname(fileURLToPath(import.meta.url)))
const args = process.argv.slice(2)
const help = `Usage: node scripts/doctor-fix.mjs [host-dir] [--dry]`
if (args.includes('--help')) { console.log(help); process.exit(0) }
const root = resolve(args.find((a) => !a.startsWith('--')) || process.cwd())
const dry = args.includes('--dry')
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

#!/usr/bin/env node
// upgrade-host.mjs — bump an imported agent-compass submodule and run doctor.

import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join, resolve } from 'node:path'

const help = `Usage: node scripts/upgrade-host.mjs <host-root> [submodule-path] [--dry]

Update an agent-compass submodule, sync managed files, then run doctor.
`

const args = process.argv.slice(2)
if (args.includes('--help')) {
  console.log(help)
  process.exit(0)
}

const positional = args.filter((arg) => !arg.startsWith('--'))
const host = resolve(positional[0] || '')
const submodule = positional[1] || 'docs/agent-compass'
const dry = args.includes('--dry')
const ac = join(host, submodule)
const run = (cmd, cmdArgs, cwd = host) => execFileSync(cmd, cmdArgs, { cwd, encoding: 'utf8' }).trim()

if (!host || !existsSync(host)) {
  console.error('Usage: node scripts/upgrade-host.mjs <host-root> [submodule-path]')
  process.exit(1)
}
if (!existsSync(ac)) {
  console.error(`Missing submodule path: ${ac}`)
  process.exit(1)
}

const commands = [
  ['git', ['submodule', 'update', '--remote', '--merge', submodule]],
  ['node', [join(ac, 'scripts', 'install.mjs'), host]],
  ['node', [join(ac, 'scripts', 'sync.mjs'), host]],
  ['node', [join(ac, 'scripts', 'install.mjs'), '--doctor', '--deep', host]],
]

if (dry) {
  commands.forEach(([cmd, cmdArgs]) => console.log(`${cmd} ${cmdArgs.join(' ')}`))
  process.exit(0)
}

commands.forEach(([cmd, cmdArgs]) => console.log(run(cmd, cmdArgs)))

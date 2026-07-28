#!/usr/bin/env node
// upgrade-host.mjs — bump an imported agent-compass submodule and run doctor.

import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { parseCliArgs } from './lib/args.mjs'

const { values, positionals } = parseCliArgs({
  name: 'upgrade',
  script: 'upgrade-host.mjs',
  summary: 'Update an agent-compass submodule, sync managed files, then run doctor.',
  positionals: [{ name: 'host-root', required: true }, { name: 'submodule-path', required: false }],
  options: {
    dry: { type: 'boolean', desc: 'Print the commands without running them.' },
  },
})

const host = resolve(positionals[0] || '')
const submodule = positionals[1] || 'docs/agent-compass'
const dry = Boolean(values.dry)
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

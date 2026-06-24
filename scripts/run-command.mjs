#!/usr/bin/env node
// run-command.mjs — run a command from agent-compass.commands.json by name, so
// "never invent commands" is enforceable. Refuses unknown commands and gates
// destructive ones behind --confirm. Supports the string form and an optional
// typed form: { "deploy": { "cmd": "...", "destructive": true } }.

import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

const help = `Usage: node scripts/run-command.mjs <name> [root] [--confirm] [--dry] [--list]

Resolve <name> (dotted ok, e.g. projectMemory.brief) in agent-compass.commands.json
and run it. Destructive commands require --confirm.

Options:
  --list      List runnable command names.
  --confirm   Allow a destructive command to run.
  --dry       Print the resolved command without running it.
  --help      Show this help.
`

const args = process.argv.slice(2)
if (args.includes('--help')) { console.log(help); process.exit(0) }

const flags = new Set(args.filter((a) => a.startsWith('--')))
const positional = args.filter((a) => !a.startsWith('--'))
const listing = flags.has('--list')
const name = listing ? null : positional[0]
const ROOT = resolve((listing ? positional[0] : positional[1]) || process.cwd())
const DESTRUCTIVE = /\b(push|deploy|publish|release|force)\b|\brm\s|reset\s+--hard|drop\s+(table|database)|--force\b/i

let registry
try {
  registry = JSON.parse(readFileSync(join(ROOT, 'agent-compass.commands.json'), 'utf8'))
} catch {
  console.error('No agent-compass.commands.json found. Run install first.')
  process.exit(1)
}

const resolveEntry = (key) => key.split('.').reduce((node, part) => (node && typeof node === 'object' ? node[part] : undefined), registry)
const isRunnable = (v) => typeof v === 'string' || (v && typeof v === 'object' && typeof v.cmd === 'string')

const runnableNames = (node, prefix = '') => Object.entries(node).flatMap(([key, value]) => {
  if (Array.isArray(value)) return []
  if (isRunnable(value)) return [`${prefix}${key}`]
  if (value && typeof value === 'object') return runnableNames(value, `${prefix}${key}.`)
  return []
})

if (listing || !name) {
  console.log('Runnable commands:\n' + runnableNames(registry).map((n) => `  ${n}`).join('\n'))
  process.exit(0)
}

const entry = resolveEntry(name)
if (!isRunnable(entry)) {
  console.error(`"${name}" is not a configured command. Do not invent one. Try --list.`)
  process.exit(1)
}
const cmd = typeof entry === 'string' ? entry : entry.cmd
const destructive = typeof entry === 'object' ? Boolean(entry.destructive) : DESTRUCTIVE.test(cmd)

if (destructive && !flags.has('--confirm')) {
  console.error(`"${name}" looks destructive (${cmd}). Re-run with --confirm to proceed.`)
  process.exit(1)
}
if (flags.has('--dry')) { console.log(cmd); process.exit(0) }

const result = spawnSync(cmd, { cwd: ROOT, shell: true, stdio: 'inherit' })
process.exit(result.status === null ? 1 : result.status)

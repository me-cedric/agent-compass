#!/usr/bin/env node
// run-command.mjs — run a command from agent-compass.commands.json by name, so
// "never invent commands" is enforceable. Refuses unknown commands and gates
// destructive ones behind --confirm. Supports the string form and an optional
// typed form: { "deploy": { "cmd": "...", "destructive": true } }.

import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseCliArgs, resolveRoot } from './lib/args.mjs'

const { values, positionals } = parseCliArgs({
  name: 'run',
  script: 'run-command.mjs',
  summary: `Resolve <name> (dotted ok, e.g. projectMemory.brief) in agent-compass.commands.json
and run it. Destructive commands require --confirm.`,
  positionals: [
    { name: 'name', required: false },
    { name: 'root', required: false },
  ],
  options: {
    list: { type: 'boolean', desc: 'List runnable command names.' },
    confirm: { type: 'boolean', desc: 'Allow a destructive command to run.' },
    dry: { type: 'boolean', desc: 'Print the resolved command without running it.' },
  },
})

const listing = Boolean(values.list)
const name = listing ? null : positionals[0]
const ROOT = resolveRoot(listing ? positionals : positionals.slice(1))
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

if (destructive && !values.confirm) {
  console.error(`"${name}" looks destructive (${cmd}). Re-run with --confirm to proceed.`)
  process.exit(1)
}
if (values.dry) { console.log(cmd); process.exit(0) }

const result = spawnSync(cmd, { cwd: ROOT, shell: true, stdio: 'inherit' })
process.exit(result.status === null ? 1 : result.status)

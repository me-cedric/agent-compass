#!/usr/bin/env node
// task-log.mjs — append/read structured completion-gate records.

import { existsSync, mkdirSync, readFileSync, writeFileSync, appendFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

const args = process.argv.slice(2)
const help = `Usage: node scripts/task-log.mjs [root] --add --goal <text> [--mode <mode>] [--files <csv>] [--commands <csv>] [--validation <text>] [--risks <text>] [--next <text>]
       node scripts/task-log.mjs [root] --list [--markdown]
`
if (args.includes('--help')) { console.log(help); process.exit(0) }
const flag = (name, fallback = '') => { const i = args.indexOf(name); return i === -1 ? fallback : args[i + 1] || fallback }
const positional = args.filter((a, i) => !a.startsWith('--') && !args[i - 1]?.startsWith('--'))
const root = resolve(positional[0] || process.cwd())
const logPath = join(root, '.agent', 'task-log.jsonl')
const rows = () => existsSync(logPath) ? readFileSync(logPath, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l)) : []

if (args.includes('--add')) {
  const goal = flag('--goal')
  if (!goal) { console.error('--goal required'); process.exit(1) }
  const row = {
    schema: 1,
    createdAt: new Date().toISOString(),
    goal,
    mode: flag('--mode', 'implementation'),
    files: flag('--files').split(',').map((s) => s.trim()).filter(Boolean),
    commands: flag('--commands').split(',').map((s) => s.trim()).filter(Boolean),
    validation: flag('--validation', 'not run'),
    risks: flag('--risks', 'none stated'),
    next: flag('--next', ''),
  }
  mkdirSync(join(root, '.agent'), { recursive: true })
  appendFileSync(logPath, JSON.stringify(row) + '\n')
  console.log(`logged ${row.goal}`)
  process.exit(0)
}

const data = rows()
if (args.includes('--markdown')) {
  console.log(`# Agent Task Log

| Date | Mode | Goal | Validation |
| ---- | ---- | ---- | ---------- |
${data.map((r) => `| ${r.createdAt} | ${r.mode} | ${String(r.goal).replaceAll('|', '\\|')} | ${String(r.validation).replaceAll('|', '\\|')} |`).join('\n')}
`)
} else {
  console.log(JSON.stringify({ schema: 1, root, count: data.length, tasks: data }, null, 2))
}

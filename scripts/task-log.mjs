#!/usr/bin/env node
// task-log.mjs — append/read structured completion-gate records.

import { existsSync, mkdirSync, readFileSync, appendFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseCliArgs, resolveRoot } from './lib/args.mjs'

const { values, positionals } = parseCliArgs({
  name: 'task-log',
  script: 'task-log.mjs',
  summary: 'Append/read structured completion-gate records.',
  positionals: [{ name: 'root', required: false }],
  options: {
    add: { type: 'boolean', desc: 'Append a record (requires --goal).' },
    goal: { type: 'string', value: '<text>', desc: 'What the task set out to do (required with --add).' },
    mode: { type: 'string', value: '<mode>', desc: 'Task mode (default: implementation).' },
    files: { type: 'string', value: '<csv>', desc: 'Comma-separated changed files.' },
    commands: { type: 'string', value: '<csv>', desc: 'Comma-separated commands run.' },
    validation: { type: 'string', value: '<text>', desc: 'Validation result (default: not run).' },
    risks: { type: 'string', value: '<text>', desc: 'Remaining risks (default: none stated).' },
    next: { type: 'string', value: '<text>', desc: 'Suggested next step.' },
    list: { type: 'boolean', desc: 'Read the log (default when --add is absent).' },
    markdown: { type: 'boolean', desc: 'Render the log as markdown instead of JSON.' },
  },
})

const root = resolveRoot(positionals)
const logPath = join(root, '.agent', 'task-log.jsonl')
const rows = () => existsSync(logPath) ? readFileSync(logPath, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l)) : []

if (values.add) {
  const goal = values.goal || ''
  if (!goal) { console.error('--goal required'); process.exit(1) }
  const row = {
    schema: 1,
    createdAt: new Date().toISOString(),
    goal,
    mode: values.mode || 'implementation',
    files: (values.files || '').split(',').map((s) => s.trim()).filter(Boolean),
    commands: (values.commands || '').split(',').map((s) => s.trim()).filter(Boolean),
    validation: values.validation || 'not run',
    risks: values.risks || 'none stated',
    next: values.next || '',
  }
  mkdirSync(join(root, '.agent'), { recursive: true })
  appendFileSync(logPath, JSON.stringify(row) + '\n')
  console.log(`logged ${row.goal}`)
  process.exit(0)
}

const data = rows()
if (values.markdown) {
  console.log(`# Agent Task Log

| Date | Mode | Goal | Validation |
| ---- | ---- | ---- | ---------- |
${data.map((r) => `| ${r.createdAt} | ${r.mode} | ${String(r.goal).replaceAll('|', '\\|')} | ${String(r.validation).replaceAll('|', '\\|')} |`).join('\n')}
`)
} else {
  console.log(JSON.stringify({ schema: 1, root, count: data.length, tasks: data }, null, 2))
}

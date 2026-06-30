#!/usr/bin/env node
// failure-mine.mjs — mine task logs/traces for reusable agent failures.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

const args = process.argv.slice(2)
const help = `Usage: node scripts/failure-mine.mjs [root] [--write] [--json]`
if (args.includes('--help')) { console.log(help); process.exit(0) }
const root = resolve(args.find((a) => !a.startsWith('--')) || process.cwd())
const readJsonl = (rel) => existsSync(join(root, rel)) ? readFileSync(join(root, rel), 'utf8').trim().split('\n').filter(Boolean).map((l) => { try { return JSON.parse(l) } catch { return null } }).filter(Boolean) : []
const tasks = readJsonl('.agent/task-log.jsonl')
const traces = readJsonl('.agent/trace/agent-trace.example.jsonl').concat(readJsonl('.agent/trace.jsonl'))
const failures = [
  ...tasks.filter((t) => /fail|partial|not run/i.test(`${t.validation} ${t.risks}`)).map((t) => ({ source: 'task-log', goal: t.goal, signal: t.validation || t.risks })),
  ...traces.filter((t) => /fail|regress|error/i.test(`${t.outcome || ''} ${t.result || ''}`)).map((t) => ({ source: 'trace', goal: t.goal || t.task || 'unknown', signal: t.outcome || t.result })),
]
const themes = {}
for (const f of failures) {
  const key = /test/i.test(f.signal) ? 'tests' : /doc|spec/i.test(f.signal) ? 'docs/spec drift' : /secret|security/i.test(f.signal) ? 'security' : 'general'
  themes[key] = (themes[key] || 0) + 1
}
const report = `# Agent Failure Mining

Failures found: ${failures.length}

## Themes

${Object.entries(themes).map(([k, v]) => `- ${k}: ${v}`).join('\n') || '- none'}

## Candidate Improvements

${Object.keys(themes).map((k) => `- Add/adjust eval or rule for ${k}.`).join('\n') || '- No failure-driven improvements found.'}
`
if (args.includes('--json')) console.log(JSON.stringify({ schema: 1, root, failures, themes }, null, 2))
else if (args.includes('--write')) {
  mkdirSync(join(root, '.agent'), { recursive: true })
  writeFileSync(join(root, '.agent', 'failure-mining.md'), report)
  console.log(join(root, '.agent', 'failure-mining.md'))
} else console.log(report)

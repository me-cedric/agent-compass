#!/usr/bin/env node
// failure-mine.mjs — mine task logs/traces for reusable agent failures.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseCliArgs, resolveRoot } from './lib/args.mjs'

const { values, positionals } = parseCliArgs({
  name: 'failure-mine',
  script: 'failure-mine.mjs',
  summary: 'Mine task logs/traces for reusable agent failures.',
  positionals: [{ name: 'root', required: false }],
  options: {
    write: { type: 'boolean', desc: 'Save the report to .agent/failure-mining.md.' },
    json: { type: 'boolean', desc: 'Print machine-readable JSON instead of markdown.' },
  },
})

const root = resolveRoot(positionals)
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
if (values.json) console.log(JSON.stringify({ schema: 1, root, failures, themes }, null, 2))
else if (values.write) {
  mkdirSync(join(root, '.agent'), { recursive: true })
  writeFileSync(join(root, '.agent', 'failure-mining.md'), report)
  console.log(join(root, '.agent', 'failure-mining.md'))
} else console.log(report)

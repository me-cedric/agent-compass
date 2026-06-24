#!/usr/bin/env node
// trace-to-evals.mjs — turn failed / high-friction trace rows into regression
// eval scenarios the next agent must pass. Closes the loop between the trace log
// (#10) and customization evals (#3). Output validates with agent-evals.

import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const help = `Usage: node scripts/trace-to-evals.mjs --file <trace.jsonl> [--out <path>] [--min-corrections N] [root]

Emit regression eval scenarios from failed or high-correction trace rows.

Options:
  --file <path>         Trace JSONL (required).
  --out <path>          Write the fixture; otherwise print it.
  --min-corrections N   Treat rows with >= N corrections as regressions (default 2).
  --help                Show this help.
`

const args = process.argv.slice(2)
if (args.includes('--help')) { console.log(help); process.exit(0) }

const flag = (name) => { const i = args.indexOf(name); return i === -1 ? null : args[i + 1] }
const ROOT = resolve(args.find((a) => !a.startsWith('--') && ![flag('--file'), flag('--out'), flag('--min-corrections')].includes(a)) || process.cwd())
const file = flag('--file')
const minCorrections = Number(flag('--min-corrections') || 2)

if (!file) { console.error('Pass --file <trace.jsonl>.'); process.exit(1) }

let rows
try {
  rows = readFileSync(resolve(ROOT, file), 'utf8').split('\n').map((l) => l.trim()).filter(Boolean).map((l) => JSON.parse(l))
} catch (error) {
  console.error(`failed to read trace: ${error.message}`)
  process.exit(1)
}

const regressions = rows.filter((r) => r.validation === 'failed' || Number(r.corrections || 0) >= minCorrections)

if (!regressions.length) {
  console.log('No regressions found in trace — nothing to generate.')
  process.exit(0)
}

const fixture = {
  schema: 1,
  purpose: 'Regression scenarios generated from agent trace failures.',
  references: [],
  scenarios: regressions.map((row, index) => ({
    id: `regression-${index + 1}`,
    prompt: `Redo work like "${row.task}" (${row.type || 'change'}) without repeating the prior ${row.outcome || 'failure'}.`,
    expect: [
      'addresses the prior failure cause',
      row.lesson ? `applies the lesson: ${row.lesson}` : 'runs and reports validation',
    ],
    reject: [
      `repeats the ${row.outcome || 'failure'} outcome`,
      'skips validation',
    ],
  })),
}

const out = flag('--out')
const serialized = JSON.stringify(fixture, null, 2) + '\n'
if (out) {
  writeFileSync(resolve(ROOT, out), serialized)
  console.log(`wrote ${regressions.length} regression scenario(s) to ${out}`)
} else {
  process.stdout.write(serialized)
}

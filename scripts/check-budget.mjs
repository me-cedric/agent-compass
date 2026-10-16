#!/usr/bin/env node
// check-budget.mjs — fail when AGENTS.md, README.md or the compass contract block is longer than its budget in
// docs/remaster/plan.md. The repository has no file or code-line budget (owner decision, 2026-10-16).

import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseCliArgs } from './lib/args.mjs'

const { values, positionals } = parseCliArgs({
  name: 'check-budget',
  usage: 'node scripts/check-budget.mjs [root] [options]',
  summary: 'Check the length budgets of AGENTS.md, README.md and the compass contract block.',
  positionals: [{ name: 'root', required: false }],
  options: { root: { type: 'string', value: '<dir>', desc: 'Check another root directory.' } },
})

const ROOT = resolve(values.root || positionals[0] || dirname(dirname(fileURLToPath(import.meta.url))))
const lines = (rel) => (existsSync(join(ROOT, rel)) ? readFileSync(join(ROOT, rel), 'utf8').split('\n').length - 1 : 0)
const checks = [
  ['AGENTS.md', lines('AGENTS.md'), 150, ' lines'],
  ['README.md', lines('README.md'), 150, ' lines'],
  ['core/blocks/AGENTS.md', lines('core/blocks/AGENTS.md'), 120, ' lines'],
]
const over = checks.filter(([, n, max]) => n > max)
if (over.length) {
  for (const [name, n, max, unit] of over) console.error(`✗ ${name}: ${n}${unit}; the budget is ${max}`)
  process.exit(1)
}
console.log(`✓ budget check passed — ${checks.map(([name, n, max]) => `${name} ${n}/${max}`).join(', ')}.`)

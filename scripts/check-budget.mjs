#!/usr/bin/env node
// check-budget.mjs — fail when the repository is over a size budget of docs/remaster/plan.md.
// Files: tracked and untracked, not ignored. Code: engine/*.mjs, ui/*.mjs and bin/ac.mjs (migrate/ is outside).

import { spawnSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseCliArgs } from './lib/args.mjs'

const { values, positionals } = parseCliArgs({
  name: 'check-budget',
  usage: 'node scripts/check-budget.mjs [root] [options]',
  summary: 'Check the size budgets: files, engine + UI + CLI lines, AGENTS.md, README.md and the compass contract block.',
  positionals: [{ name: 'root', required: false }],
  options: { root: { type: 'string', value: '<dir>', desc: 'Check another root directory.' } },
})

const ROOT = resolve(values.root || positionals[0] || dirname(dirname(fileURLToPath(import.meta.url))))
const lines = (rel) => (existsSync(join(ROOT, rel)) ? readFileSync(join(ROOT, rel), 'utf8').split('\n').length - 1 : 0)
const mjs = (dir) => (existsSync(join(ROOT, dir)) ? readdirSync(join(ROOT, dir)).filter((f) => f.endsWith('.mjs')).map((f) => `${dir}/${f}`) : [])

const git = spawnSync('git', ['-C', ROOT, 'ls-files', '--cached', '--others', '--exclude-standard'],
  { encoding: 'utf8', timeout: 30_000, env: { ...process.env, GIT_TERMINAL_PROMPT: '0' } })
if (git.status !== 0) {
  console.error(`✗ git ls-files failed in ${ROOT}`)
  process.exit(1)
}

const code = [...mjs('engine'), ...mjs('ui'), 'bin/ac.mjs'].reduce((sum, rel) => sum + lines(rel), 0)
const checks = [
  ['files', git.stdout.split('\n').filter(Boolean).length, 220, ''],
  ['engine + UI + CLI', code, 4000, ' lines'],
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

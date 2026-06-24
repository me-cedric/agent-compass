#!/usr/bin/env node
// check-change-companions.mjs — fail when a code change ships without its test
// companion (AGENTS.md §6). Enforces the one high-value rule by default; run it
// on a diff in pre-push or CI. Host tool — not part of agent-compass's own gate.

import { execFileSync } from 'node:child_process'
import { resolve } from 'node:path'

const help = `Usage: node scripts/check-change-companions.mjs [root] [--base <ref>] [--files a,b] [--allow <reason>] [--strict]

Fail when changed source files have no test companion in the same change.

Options:
  --base <ref>   Diff <ref>...HEAD (default: staged changes).
  --files a,b    Explicit comma-separated file list (skips git).
  --allow <why>  Record an explicit reason and pass anyway.
  --strict       Exit 1 on violations (default warns, exit 0).
  --help         Show this help.
`

const args = process.argv.slice(2)
if (args.includes('--help')) { console.log(help); process.exit(0) }

const flag = (name) => { const i = args.indexOf(name); return i === -1 ? null : args[i + 1] }
const ROOT = resolve(args.find((a) => !a.startsWith('--') && ![flag('--base'), flag('--files'), flag('--allow')].includes(a)) || process.cwd())

const SOURCE = /\.(ts|tsx|js|jsx|mjs|cjs|py|go|rb|rs|java|kt|swift|php)$/i
const TEST = /(\.test\.|\.spec\.|_test\.|test_|\/__tests__\/|\/tests?\/)/i
const CONFIG = /(\.config\.|\.eslintrc|\.prettier|tsconfig|\.d\.ts$)/i

let files
const filesFlag = flag('--files')
if (filesFlag) {
  files = filesFlag.split(',').map((f) => f.trim()).filter(Boolean)
} else {
  const base = flag('--base')
  const gitArgs = base ? ['diff', '--name-only', `${base}...HEAD`] : ['diff', '--cached', '--name-only']
  try {
    files = execFileSync('git', gitArgs, { cwd: ROOT, encoding: 'utf8' }).split('\n').map((f) => f.trim()).filter(Boolean)
  } catch (error) {
    console.error(`git diff failed: ${error.message}`)
    process.exit(1)
  }
}

const sources = files.filter((f) => SOURCE.test(f) && !TEST.test(f) && !CONFIG.test(f))
const tests = files.filter((f) => TEST.test(f))
const allow = flag('--allow')

const violations = []
if (sources.length && !tests.length) {
  violations.push(`source changed without a test companion:\n${sources.map((s) => `  ${s}`).join('\n')}`)
}

if (!violations.length) {
  console.log('✓ change-companion check passed.')
  process.exit(0)
}
if (allow) {
  console.log(`change-companion check overridden: ${allow}\n${violations.join('\n')}`)
  process.exit(0)
}
console.error(`✗ change-companion check:\n${violations.join('\n')}\n\nAdd a test, or pass --allow "<reason>" (docs/config-only, external integration).`)
process.exit(args.includes('--strict') ? 1 : 0)

#!/usr/bin/env node
// check-change-companions.mjs — fail when a code change ships without its test
// companion (AGENTS.md §6). Enforces the one high-value rule by default; run it
// on a diff in pre-push or CI. Host tool — not part of agent-compass's own gate.

import { execFileSync } from 'node:child_process'
import { parseCliArgs, resolveRoot } from './lib/args.mjs'

const { values, positionals } = parseCliArgs({
  name: 'check-companions',
  script: 'check-change-companions.mjs',
  summary: 'Fail when changed source files have no test companion in the same change.',
  positionals: [{ name: 'root', required: false }],
  options: {
    base: { type: 'string', value: '<ref>', desc: 'Diff <ref>...HEAD (default: staged changes).' },
    files: { type: 'string', value: 'a,b', desc: 'Explicit comma-separated file list (skips git).' },
    allow: { type: 'string', value: '<why>', desc: 'Record an explicit reason and pass anyway.' },
    strict: { type: 'boolean', desc: 'Exit 1 on violations (default warns, exit 0).' },
  },
})

const ROOT = resolveRoot(positionals)

const SOURCE = /\.(ts|tsx|js|jsx|mjs|cjs|py|go|rb|rs|java|kt|swift|php)$/i
const TEST = /(\.test\.|\.spec\.|_test\.|test_|\/__tests__\/|\/tests?\/)/i
const CONFIG = /(\.config\.|\.eslintrc|\.prettier|tsconfig|\.d\.ts$)/i

let files
const filesFlag = values.files
if (filesFlag) {
  files = filesFlag.split(',').map((f) => f.trim()).filter(Boolean)
} else {
  const base = values.base
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
const allow = values.allow

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
process.exit(values.strict ? 1 : 0)

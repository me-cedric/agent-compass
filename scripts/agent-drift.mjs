#!/usr/bin/env node
// agent-drift.mjs — read-only drift dashboard. Runs the agent-guidance
// validators in one place and reports pass/fail. Safe for scheduled CI:
// it spawns the existing check scripts and mutates nothing.

import { spawnSync } from 'node:child_process'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const help = `Usage: node scripts/agent-drift.mjs [--root <dir>] [--json] [--strict]

Run the agent-guidance validators (conformance, evals, indexes, docs, actions,
naming) and print one drift dashboard. Read-only.

Options:
  --root <dir>  Root to validate (default: the agent-compass repo).
  --json        Machine-readable output.
  --strict      Exit 1 when any check fails.
  --help        Show this help.
`

if (process.argv.includes('--help')) {
  console.log(help)
  process.exit(0)
}

const arg = (name) => {
  const i = process.argv.indexOf(name)
  return i === -1 ? null : process.argv[i + 1]
}

const AC = dirname(dirname(fileURLToPath(import.meta.url)))
const ROOT = resolve(arg('--root') || AC)
const json = process.argv.includes('--json')
const strict = process.argv.includes('--strict')

// Eval fixtures ship with the standards source, so always validate them at AC.
const checks = [
  ['provider customization wiring', 'agent-conformance.mjs', ['--root', ROOT, '--strict']],
  ['teaching / tool-offer evals', 'agent-evals.mjs', ['--root', AC]],
  ['catalog & index freshness', 'check-indexes.mjs', ['--root', ROOT]],
  ['docs links & template placeholders', 'check-docs.mjs', ['--root', ROOT]],
  ['GitHub Action versions', 'check-actions.mjs', ['--root', ROOT]],
  ['generic naming & skill frontmatter', 'check-naming.mjs', ['--root', ROOT]],
]

const results = checks.map(([label, script, args]) => {
  const run = spawnSync(process.execPath, [join(AC, 'scripts', script), ...args], { encoding: 'utf8' })
  const out = `${run.stdout || ''}${run.stderr || ''}`.trim().split('\n').filter(Boolean)
  return { label, ok: run.status === 0, detail: run.status === 0 ? '' : out.slice(-2).join(' · ') }
})

const failed = results.filter((result) => !result.ok)

if (json) {
  console.log(JSON.stringify({ root: ROOT, ok: failed.length === 0, results }, null, 2))
} else {
  console.log(`# Agent Drift Report

Root: ${ROOT}

| Check | Result |
| ----- | ------ |
${results.map((r) => `| ${r.label} | ${r.ok ? 'passed' : `DRIFT — ${r.detail}`} |`).join('\n')}

${failed.length ? `✗ ${failed.length} drift issue(s).` : '✓ no drift detected.'}

Host adoption drift (pointers, hooks, projectmem wiring) is reported separately
by \`node scripts/install.mjs --doctor --deep <host>\`.`)
}

if (strict && failed.length) process.exit(1)

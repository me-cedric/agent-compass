#!/usr/bin/env node
// setup-host.mjs — one command for full host adoption.
// Runs only agent-compass scripts; no global config edits, no dependency install.

import { spawnSync } from 'node:child_process'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const help = `Usage: node scripts/setup-host.mjs [host-dir] [--dry] [--strict]

Install or refresh agent-compass host setup, then generate agent startup files.

Options:
  --dry      Preview install only; generated reports are skipped.
  --strict   Exit 1 if onboarding check has any gap.
  --help     Show this help.
`

const args = process.argv.slice(2)
if (args.includes('--help')) { console.log(help); process.exit(0) }

const AC = dirname(dirname(fileURLToPath(import.meta.url)))
const HOST = resolve(args.find((a) => !a.startsWith('--')) || process.cwd())
const dry = args.includes('--dry')
const strict = args.includes('--strict')

if (HOST === AC) {
  console.error('Refusing to set up agent-compass into itself. Pass a host project path.')
  process.exit(1)
}

const run = (label, script, scriptArgs = []) => {
  const command = [join(AC, 'scripts', script), ...scriptArgs]
  const result = spawnSync(process.execPath, command, { encoding: 'utf8' })
  const ok = result.status === 0
  const output = `${result.stdout || ''}${result.stderr || ''}`.trim()
  console.log(`${ok ? '✓' : '✗'} ${label}`)
  if (!ok && output) console.log(output.split('\n').slice(-8).join('\n'))
  return ok
}

const steps = [
  ['install missing managed files', 'install.mjs', dry ? ['--dry', HOST] : [HOST]],
  ['safe fixes', 'install.mjs', dry ? ['--dry', '--fix', HOST] : ['--fix', HOST]],
  ['doctor deep', 'install.mjs', ['--doctor', '--deep', HOST]],
]

if (!dry) {
  steps.push(
    ['context pack', 'context-pack.mjs', [HOST, '--write']],
    ['doctor report', 'doctor-report.mjs', [HOST, '--write']],
    ['agent runbook', 'runbook.mjs', [HOST, '--write']],
    ['provider verification', 'provider-verify.mjs', [HOST, '--write']],
    ['recommendations', 'recommend.mjs', [HOST, '--write']],
    ['quality gates', 'quality-gates.mjs', [HOST, '--write']],
    ['migration plan', 'migration-plan.mjs', [HOST, '--write']],
    ['spec validation map', 'spec-validation-map.mjs', [HOST, '--write']],
    ['mcp readiness', 'mcp-probe.mjs', [HOST, '--write']],
    ['failure mining', 'failure-mine.mjs', [HOST, '--write']],
    ['dashboard', 'dashboard.mjs', [HOST, '--write']],
    ['onboarding gate', 'agent-onboard.mjs', strict ? [HOST, '--strict'] : [HOST]],
  )
}

const failed = steps.filter(([label, script, scriptArgs]) => !run(label, script, scriptArgs))

console.log(`\nagent-compass setup-host → ${HOST}`)
console.log(failed.length ? `partial: ${failed.length} step(s) failed.` : 'ready: host setup generated and checked.')

if (failed.length) process.exit(1)

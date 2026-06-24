#!/usr/bin/env node
// agent-onboard.mjs — one-command readiness check for a new dev or fresh agent.
// Runs doctor + guidance drift + managed-file sync check, then points at the
// runbook and smoke test. Read-only aggregator; --strict fails on any gap.

import { spawnSync } from 'node:child_process'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const help = `Usage: node scripts/agent-onboard.mjs [host-dir] [--strict]

Aggregate readiness checks and print the startup route.

Options:
  --strict   Exit 1 if any check fails.
  --help     Show this help.
`

const args = process.argv.slice(2)
if (args.includes('--help')) { console.log(help); process.exit(0) }

const AC = dirname(dirname(fileURLToPath(import.meta.url)))
const HOST = resolve(args.find((a) => !a.startsWith('--')) || process.cwd())
const strict = args.includes('--strict')

const step = (label, scriptArgs) => {
  const run = spawnSync(process.execPath, [join(AC, 'scripts', scriptArgs[0]), ...scriptArgs.slice(1)], { encoding: 'utf8' })
  const out = `${run.stdout || ''}${run.stderr || ''}`.trim().split('\n').filter(Boolean)
  return { label, ok: run.status === 0, detail: run.status === 0 ? '' : out.slice(-1)[0] || '' }
}

const results = [
  step('host wiring (doctor)', ['install.mjs', '--doctor', '--deep', HOST]),
  step('guidance drift', ['agent-drift.mjs', '--root', AC, '--strict']),
  step('managed-file sync', ['sync.mjs', HOST, '--check']),
]
const failed = results.filter((r) => !r.ok)

console.log(`# Agent Onboarding — ${HOST}

| Check | Result |
| ----- | ------ |
${results.map((r) => `| ${r.label} | ${r.ok ? 'ready' : `fix — ${r.detail}`} |`).join('\n')}

Startup route:
1. Read AGENTS.md (or the host pointer to docs/agent-compass/AGENTS.md).
2. Generate the runbook: node ${join('docs', 'agent-compass', 'scripts', 'runbook.mjs')} . --write
3. Generate the context pack: node ${join('docs', 'agent-compass', 'scripts', 'context-pack.mjs')} . --write
4. Run provider smoke prompts: .agent/provider-discovery-smoke.md

${failed.length ? `✗ ${failed.length} item(s) need attention.` : '✓ ready.'}`)

if (strict && failed.length) process.exit(1)

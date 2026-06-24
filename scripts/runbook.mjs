#!/usr/bin/env node
// runbook.mjs — generate a compact .agent/RUNBOOK.md from local agent files.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

const help = `Usage: node scripts/runbook.mjs [root] [--write]

Print a compact agent runbook. With --write, save to .agent/RUNBOOK.md.
`

const args = process.argv.slice(2)
if (args.includes('--help')) {
  console.log(help)
  process.exit(0)
}

const root = resolve(args.find((arg) => !arg.startsWith('--')) || process.cwd())
const read = (path) => existsSync(join(root, path)) ? readFileSync(join(root, path), 'utf8').trim() : ''
const commands = read('agent-compass.commands.json')

const runbook = `# Agent Runbook

## Start Here

1. Read \`AGENTS.md\`.
2. Read \`agent-compass.commands.json\` before choosing commands.
3. Read relevant specs under \`specs/\`.
4. Read project memory summaries and pre-action warnings when configured.
5. Use \`docs/architecture/repo-map.md\` — match your task type to its Task
   Routing table before broad search, to avoid wrong-layer edits.
6. Use provider-native tools when useful: skills/prompts, MCP, hooks, subagents,
   goals/plans, or review modes. See \`docs/tooling/agent-provider-capabilities.md\`.
7. Run \`node docs/agent-compass/scripts/agent-conformance.mjs --root . --write\`
   after changing agent guidance.

## Commands

\`\`\`json
${commands || '{}'}
\`\`\`

## Completion Gate

- changed files
- commands run
- validation result per command
- failures pre-existing or introduced
- remaining risks

## Teaching

Use \`docs/workflows/agent-teaching.md\` only for explanations, onboarding, or
valuable prompt/tool coaching. Do not coach every turn.

## Provider Smoke Test

Use \`.agent/provider-discovery-smoke.md\` or generated \`.agent/agent-conformance.md\`
to ask Claude, Codex, and Copilot which guidance/tools they loaded.
`

if (args.includes('--write')) {
  const out = join(root, '.agent', 'RUNBOOK.md')
  mkdirSync(join(root, '.agent'), { recursive: true })
  writeFileSync(out, runbook)
  console.log(out)
} else {
  console.log(runbook)
}

#!/usr/bin/env node
// provider-verify.mjs — deterministic provider setup verification.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

const args = process.argv.slice(2)
const help = `Usage: node scripts/provider-verify.mjs [root] [--global] [--write] [--json] [--strict]`
if (args.includes('--help')) { console.log(help); process.exit(0) }
const root = resolve(args.find((a) => !a.startsWith('--')) || process.cwd())
const global = args.includes('--global')
const has = (p) => existsSync(join(root, p))
const reads = (p, re) => has(p) && re.test(readFileSync(join(root, p), 'utf8'))
const projectChecks = [
  ['AGENTS.md', has('AGENTS.md'), 'root contract/pointer'],
  ['CLAUDE.md points to AGENTS', reads('CLAUDE.md', /AGENTS\.md/), 'Claude'],
  ['CODEX.md points to AGENTS', reads('CODEX.md', /AGENTS\.md/), 'Codex'],
  ['Copilot instructions point to AGENTS', reads('.github/copilot-instructions.md', /AGENTS\.md/), 'Copilot'],
  ['Cursor rule exists', has('.cursor/rules/agent-compass.mdc'), 'Cursor'],
  ['Windsurf rule exists', has('.windsurf/rules/agent-compass.md'), 'Windsurf'],
  ['Codex hooks/config exist', has('.codex/config.toml') && has('.codex/hooks.json'), 'Codex'],
  ['Claude agents/hooks exist', has('.claude/agents/reviewer.md') && has('.claude/hooks/remind-completion-gate.sh'), 'Claude'],
  ['Copilot prompts/agents exist', has('.github/prompts/prompt-upgrade.prompt.md') && has('.github/agents/agent-compass-teacher.agent.md'), 'Copilot'],
  ['MCP examples exist', has('.mcp/README.md') && has('.mcp/recommended.example.json'), 'MCP'],
  ['Provider smoke prompt exists', has('.agent/provider-discovery-smoke.md'), 'all'],
]
const globalChecks = [
  ['global manifest exists', has('.agent-compass/manifest.json'), 'all'],
  ['global Codex pointer exists', has('.codex/AGENTS.md'), 'Codex'],
  ['global Claude pointer exists', has('.claude/CLAUDE.md'), 'Claude'],
  ['global universal skills exist', has('.agents/skills/caveman/SKILL.md'), 'all'],
  ['global Codex skills exist', has('.codex/skills/caveman/SKILL.md'), 'Codex'],
  ['global Claude skills exist', has('.claude/skills/caveman/SKILL.md'), 'Claude'],
]
const checks = global ? globalChecks : projectChecks
const report = `# Provider Verification

Root: \`${root}\`
Mode: \`${global ? 'global' : 'project'}\`

| Check | Status | Provider |
| ----- | ------ | -------- |
${checks.map(([label, ok, provider]) => `| ${label} | ${ok ? 'ok' : 'missing'} | ${provider} |`).join('\n')}
`
if (args.includes('--json')) console.log(JSON.stringify({ schema: 1, root, checks: checks.map(([label, ok, provider]) => ({ label, ok, provider })) }, null, 2))
else if (args.includes('--write')) {
  mkdirSync(join(root, '.agent'), { recursive: true })
  writeFileSync(join(root, '.agent', 'provider-verification.md'), report)
  console.log(join(root, '.agent', 'provider-verification.md'))
} else console.log(report)
if (args.includes('--strict') && checks.some(([, ok]) => !ok)) process.exit(1)

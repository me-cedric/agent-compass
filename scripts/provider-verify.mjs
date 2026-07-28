#!/usr/bin/env node
// provider-verify.mjs — deterministic provider setup verification.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseCliArgs, resolveRoot } from './lib/args.mjs'
import { STYLE_SKILLS } from './lib/profiles.mjs'

const { values, positionals } = parseCliArgs({
  name: 'provider-verify',
  script: 'provider-verify.mjs',
  summary: 'Deterministic provider setup verification.',
  positionals: [{ name: 'root', required: false }],
  options: {
    global: { type: 'boolean', desc: 'Verify user-level setup instead of a project.' },
    write: { type: 'boolean', desc: 'Write report to .agent/provider-verification.md.' },
    json: { type: 'boolean', desc: 'Print machine-readable JSON instead of markdown.' },
    strict: { type: 'boolean', desc: 'Exit 1 when any check fails.' },
  },
})
const root = resolveRoot(positionals)
const has = (p) => existsSync(join(root, p))
const reads = (p, re) => has(p) && re.test(readFileSync(join(root, p), 'utf8'))
const hasSkills = (base, names = STYLE_SKILLS) => names.every((name) => has(join(base, name, 'SKILL.md')))
const projectChecks = [
  ['AGENTS.md', has('AGENTS.md'), 'root contract/pointer'],
  ['CLAUDE.md points to AGENTS', reads('CLAUDE.md', /AGENTS\.md/), 'Claude'],
  ['CODEX.md points to AGENTS', reads('CODEX.md', /AGENTS\.md/), 'Codex'],
  ['Copilot instructions point to AGENTS', reads('.github/copilot-instructions.md', /AGENTS\.md/), 'Copilot'],
  ['GEMINI.md points to AGENTS', reads('GEMINI.md', /AGENTS\.md/), 'Gemini'],
  ['Gemini settings example exists', has('.gemini/settings.example.json'), 'Gemini'],
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
  ['global universal working-style skills exist', hasSkills('.agents/skills'), 'all'],
  ['global Codex working-style skills exist', hasSkills('.codex/skills'), 'Codex'],
  ['global Claude working-style skills exist', hasSkills('.claude/skills'), 'Claude'],
]
const checks = values.global ? globalChecks : projectChecks
const report = `# Provider Verification

Root: \`${root}\`
Mode: \`${values.global ? 'global' : 'project'}\`

| Check | Status | Provider |
| ----- | ------ | -------- |
${checks.map(([label, ok, provider]) => `| ${label} | ${ok ? 'ok' : 'missing'} | ${provider} |`).join('\n')}
`
if (values.json) console.log(JSON.stringify({ schema: 1, root, checks: checks.map(([label, ok, provider]) => ({ label, ok, provider })) }, null, 2))
else if (values.write) {
  mkdirSync(join(root, '.agent'), { recursive: true })
  writeFileSync(join(root, '.agent', 'provider-verification.md'), report)
  console.log(join(root, '.agent', 'provider-verification.md'))
} else console.log(report)
if (values.strict && checks.some(([, ok]) => !ok)) process.exit(1)

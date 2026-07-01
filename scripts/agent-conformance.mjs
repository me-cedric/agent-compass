#!/usr/bin/env node
// agent-conformance.mjs — inspect agent customization wiring and generate
// provider smoke prompts. Does not run external agents.

import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'

const help = `Usage: node scripts/agent-conformance.mjs [--root <dir>] [--write] [--json] [--strict]

Inspect Claude/Codex/Copilot agent customization artifacts and print smoke
prompts that ask each agent what guidance/tools it loaded.

Options:
  --root <dir>  Check another root directory.
  --write       Save prompt packet to .agent/agent-conformance.md.
  --json        Print machine-readable checks.
  --strict      Exit 1 when any check is missing.
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

const ROOT = resolve(arg('--root') || process.cwd())
const has = (...parts) => existsSync(join(ROOT, ...parts)) || existsSync(join(ROOT, 'docs', 'agent-compass', ...parts))
const any = (...paths) => paths.some((path) => has(...path.split('/')))

const checks = [
  ['core AGENTS contract', any('AGENTS.md')],
  ['Claude pointer', any('CLAUDE.md')],
  ['Codex pointer', any('CODEX.md')],
  ['Copilot instructions', any('.github/copilot-instructions.md')],
  ['command registry', any('agent-compass.commands.json')],
  ['provider capabilities guide', any('docs/tooling/agent-provider-capabilities.md')],
  ['teaching workflow', any('docs/workflows/agent-teaching.md')],
  ['improvement loop', any('docs/workflows/agent-improvement-loop.md')],
  ['agent-teacher skill', any('skills/agent-teacher/SKILL.md')],
  ['Copilot explain prompt', any('.github/prompts/explain-project.prompt.md', 'templates/agent/.github/prompts/explain-project.prompt.md')],
  ['Copilot prompt-upgrade prompt', any('.github/prompts/prompt-upgrade.prompt.md', 'templates/agent/.github/prompts/prompt-upgrade.prompt.md')],
  ['Copilot teacher agent', any('.github/agents/agent-compass-teacher.agent.md', 'templates/agent/.github/agents/agent-compass-teacher.agent.md')],
  ['Codex config template', any('.codex/config.toml', 'templates/codex/.codex/config.toml')],
  ['Claude reviewer agent template', any('.claude/agents/reviewer.md', 'templates/claude/.claude/agents/reviewer.md')],
  ['Claude hook template', any('.claude/settings.example.json', 'templates/claude/.claude/settings.example.json')],
  ['Copilot MCP allowlist template', any('.mcp/copilot-cloud.example.json', 'templates/mcp/copilot-cloud.example.json')],
  ['provider discovery smoke template', any('templates/conformance/provider-discovery-smoke.md')],
  ['teaching eval fixture', any('templates/evals/agent-teaching-evals.json')],
  ['work-intake template', any('docs/work-intake-template.md', 'templates/intake/work-intake.md')],
  ['agent-ready issue form', any('.github/ISSUE_TEMPLATE/agent-ready-task.yml', 'templates/agent/.github/ISSUE_TEMPLATE/agent-ready-task.yml')],
  ['MCP tool contract', any('.mcp/tool-contract.md', 'templates/mcp/tool-contract.md')],
  ['model/permission profiles guide', any('docs/tooling/agent-permissions.md')],
  ['trace/outcome log template', any('.agent/trace/README.md', 'templates/trace/README.md')],
  ['drift report script', any('scripts/agent-drift.mjs')],
  ['headroom context-compression guide', any('docs/tooling/headroom.md')],
  ['sync engine + file manifest', any('scripts/sync.mjs') && any('scripts/manifest.mjs')],
  ['context pack generator', any('scripts/context-pack.mjs')],
  ['typed command runner', any('scripts/run-command.mjs')],
  ['model routing guide', any('docs/tooling/model-routing.md')],
  ['cached update check', any('scripts/check-update.mjs')],
  ['unified CLI dispatcher', any('scripts/cli.mjs')],
  ['host setup wizard', any('scripts/setup-wizard.mjs')],
  ['safe recommendation applier', any('scripts/apply-recommendations.mjs')],
  ['global setup', any('scripts/global-setup.mjs')],
  ['provider verifier', any('scripts/provider-verify.mjs')],
  ['policy packs', any('scripts/policy-pack.mjs') && any('templates/policies/solo-dev.json')],
  ['MCP readiness probe', any('scripts/mcp-probe.mjs')],
  ['spec validation mapper', any('scripts/spec-validation-map.mjs')],
  ['design importer', any('scripts/design-importer.mjs')],
  ['failure mining', any('scripts/failure-mine.mjs')],
  ['skill metadata enforcement', any('scripts/check-naming.mjs')],
  ['architecture-advisor skill', any('skills/architecture-advisor/SKILL.md')],
  ['architecture decision workflow', any('docs/workflows/architecture-decision.md')],
  ['architecture templates', any('templates/architecture/architecture-decision.md')],
  ['architecture advisor agent', any('.claude/agents/architecture-advisor.md', 'templates/claude/.claude/agents/architecture-advisor.md')],
  ['recommended MCP servers catalog', any('.mcp/recommended.example.json', 'templates/mcp/recommended.example.json')],
  ['recommended MCP servers guide', any('docs/tooling/mcp-servers.md')],
]

const providerPrompts = [
  ['Claude', `Read AGENTS.md, CLAUDE.md, docs/tooling/agent-provider-capabilities.md, and docs/workflows/agent-teaching.md. Do not edit files. Report:
1. Which instruction files you loaded.
2. Which Claude-native levers are available here: skills, hooks, subagents/agent teams, MCP, plugins.
3. Which command registry or validation source you would use.
4. One case where you would teach the user, and one case where you would stay silent.`],
  ['Codex', `Read AGENTS.md, CODEX.md, docs/tooling/agent-provider-capabilities.md, and docs/workflows/agent-teaching.md. Do not edit files. Report:
1. Which guidance files you loaded.
2. Whether /plan, /goal, /review, subagents, hooks, skills, and MCP are useful for this repo.
3. Which validation commands are allowed by agent-compass.commands.json.
4. One tool offer you would make only when valuable.`],
  ['Copilot', `Read AGENTS.md, .github/copilot-instructions.md, any .github/instructions files, .github/prompts, .github/agents, and docs/workflows/agent-teaching.md. Do not edit files. Report:
1. Which repository/path instructions apply.
2. Which prompt files and custom agents are available.
3. Which MCP tools should be allowlisted before cloud-agent use.
4. One selective teaching example.`],
]

const packet = `# Agent Conformance Prompts

Run these manually in each provider surface after changing agent guidance. They
prove discovery and behavior without asking agents to mutate files.

${providerPrompts.map(([name, prompt]) => `## ${name}

\`\`\`text
${prompt}
\`\`\``).join('\n\n')}

## Expected

- Agent names loaded guidance files, not vague "project rules".
- Agent uses command registry before commands.
- Agent mentions provider-native tools only when useful.
- Agent teaches selectively, not every turn.
`

if (process.argv.includes('--write')) {
  const out = join(ROOT, '.agent', 'agent-conformance.md')
  mkdirSync(dirname(out), { recursive: true })
  writeFileSync(out, packet)
}

if (process.argv.includes('--json')) {
  console.log(JSON.stringify({ root: ROOT, checks: checks.map(([label, ok]) => ({ label, ok })) }, null, 2))
} else {
  console.log(`# Agent Conformance

Root: ${ROOT}

| Check | Result |
| ----- | ------ |
${checks.map(([label, ok]) => `| ${label} | ${ok ? 'passed' : 'missing'} |`).join('\n')}

${packet}`)
}

if (process.argv.includes('--strict') && checks.some(([, ok]) => !ok)) process.exit(1)

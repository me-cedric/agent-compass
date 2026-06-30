#!/usr/bin/env node
// spec-kit-bridge.mjs — optional host bridge for Spec Kit without vendoring upstream.

import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'

const args = process.argv.slice(2)
const help = `Usage: node scripts/spec-kit-bridge.mjs [host-dir] [--dry]

Create generic Spec Kit bridge docs/config. Does not install the upstream CLI.
`
if (args.includes('--help')) { console.log(help); process.exit(0) }
const root = resolve(args.find((a) => !a.startsWith('--')) || process.cwd())
const dry = args.includes('--dry')
const files = {
  '.specify/README.md': `# Spec Kit Bridge

This project can use GitHub Spec Kit for specification-driven development.

Flow:

1. \`speckit specify\` or provider command creates \`specs/<feature>/spec.md\`.
2. Clarify open questions.
3. Plan.
4. Generate tasks.
5. Implement only after plan/tasks approval.

Agent Compass remains the agent contract. Spec Kit produces feature artifacts.
`,
  '.specify/extensions.yml': `installed:
  - agent-context
settings:
  auto_execute_hooks: true
hooks:
  after_specify:
    - extension: agent-context
      command: speckit.agent-context.update
      enabled: true
      optional: true
      priority: 10
      description: Refresh agent context after specification
  after_plan:
    - extension: agent-context
      command: speckit.agent-context.update
      enabled: true
      optional: true
      priority: 10
      description: Refresh agent context after planning
`,
  '.specify/extensions/agent-context/agent-context-config.yml': `context_file: AGENTS.md
context_files:
  - AGENTS.md
  - CLAUDE.md
context_markers:
  start: "<!-- SPECKIT START -->"
  end: "<!-- SPECKIT END -->"
`,
  'docs/spec-kit/README.md': `# Spec Kit Usage

Use Spec Kit for new features or high-risk behavior changes.

Agent rule: never implement directly from rough requirements. Produce spec,
clarify, plan, tasks, then implement with Agent Compass validation.

Install/update upstream Spec Kit separately and keep generated files reviewed.
`,
  '.github/prompts/speckit-bridge.prompt.md': `---
agent: agent
description: Run the Agent Compass compatible Spec Kit flow.
---

Use AGENTS.md and docs/spec-kit/README.md.

Feature request:
\${input:request:Describe feature}

Produce or update:
- specs/<feature>/spec.md
- plan.md
- tasks.md

Stop before implementation unless explicitly approved.
`,
}
for (const [rel, text] of Object.entries(files)) {
  const dest = join(root, rel)
  if (existsSync(dest)) continue
  if (dry) { console.log(`would create ${rel}`); continue }
  mkdirSync(dirname(dest), { recursive: true })
  writeFileSync(dest, text)
  console.log(`created ${rel}`)
}

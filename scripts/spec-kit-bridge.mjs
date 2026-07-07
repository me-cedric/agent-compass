#!/usr/bin/env node
// spec-kit-bridge.mjs — optional host bridge for Spec Kit without vendoring upstream.

import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'

const args = process.argv.slice(2)
const help = `Usage: node scripts/spec-kit-bridge.mjs [host-dir] [--dry]

Create generic Spec Kit bridge docs/config and provider prompts/agents.
Does not install the upstream CLI.
`
if (args.includes('--help')) { console.log(help); process.exit(0) }
const root = resolve(args.find((a) => !a.startsWith('--')) || process.cwd())
const dry = args.includes('--dry')
const specKitCommands = [
  ['constitution', 'Update or review the project constitution.'],
  ['specify', 'Create or update a feature specification from a feature request.'],
  ['clarify', 'Resolve high-impact open questions in a feature spec.'],
  ['plan', 'Create the technical plan and design artifacts from an approved spec.'],
  ['tasks', 'Create ordered, test-first implementation tasks from the plan.'],
  ['analyze', 'Check spec, plan, tasks, contracts, and docs for inconsistencies.'],
  ['checklist', 'Create or update validation checklists for a feature spec.'],
  ['implement', 'Execute approved Spec Kit tasks with Agent Compass validation.'],
  ['converge', 'Reconcile code, tests, docs, and specs after implementation.'],
  ['agent-context-update', 'Refresh agent context markers from current Spec Kit artifacts.'],
  ['taskstoissues', 'Convert Spec Kit tasks into deduped GitHub issues.'],
]
const title = (id) => id.split('-').map((part) => part[0].toUpperCase() + part.slice(1)).join(' ')
const skillName = (id) => `speckit-${id}`
const commandName = (id) => `speckit.${id}`
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
for (const [id, description] of specKitCommands) {
  files[`.github/prompts/${commandName(id)}.prompt.md`] = `---
agent: ${commandName(id)}
description: ${description}
---

Input:
\${input:request:${description}}

Follow \`AGENTS.md\`, \`docs/workflows/spec-driven-development.md\`,
\`docs/spec-kit/README.md\`, and the \`${skillName(id)}\` skill when available.

Keep Agent Compass as the baseline contract. Use existing \`specs/\` artifacts
before creating new ones. Stop before implementation unless this is
\`${commandName('implement')}\` and implementation was explicitly approved.
`
  files[`.github/agents/${commandName(id)}.agent.md`] = `---
name: Spec Kit ${title(id)}
description: ${description}
tools: ["read", "search"]
---

You are the ${commandName(id)} agent.

Read \`AGENTS.md\` first. Follow \`docs/workflows/spec-driven-development.md\`,
\`docs/spec-kit/README.md\` when present, and \`skills/${skillName(id)}/SKILL.md\`
when available.

Rules:

- Use existing \`specs/\` artifacts before creating new truth.
- Keep specs behavior-focused; put implementation decisions in plans/tasks.
- Preserve Agent Compass validation, docs sync, security, and completion gates.
- Do not commit, push, open issues, or implement unless the user explicitly asks.

For \`${commandName('taskstoissues')}\`, use GitHub only after confirming the git
remote points at the same repository, then skip tasks that already have issues.
`
}
for (const [rel, text] of Object.entries(files)) {
  const dest = join(root, rel)
  if (existsSync(dest)) continue
  if (dry) { console.log(`would create ${rel}`); continue }
  mkdirSync(dirname(dest), { recursive: true })
  writeFileSync(dest, text)
  console.log(`created ${rel}`)
}

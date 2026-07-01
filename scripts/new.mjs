#!/usr/bin/env node
// new.mjs — golden-path scaffolds. Emit standards-conformant stubs so agents
// don't hand-roll structure: `skill`, `adr`, `spec`, `arch`, `instinct`.

import { copyFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const help = `Usage: node scripts/new.mjs <kind> <name> [root] [--dry]

Scaffold a standards-conformant stub.

Kinds:
  skill <name>     skills/<name>/SKILL.md with valid frontmatter
  adr <name>       docs/decisions/<name>.md from the ADR template
  spec <name>      specs/<name>/spec.md from the spec template
  arch <name>      docs/architecture/decisions/<name>.md from the decision template
  instinct <name>  knowledge/instincts/<name>.md knowledge note
  stack <name>     stacks/<name>.md stack preset
  workflow <name>  docs/workflows/<name>.md playbook
  tooling <name>   docs/tooling/<name>.md tool guide

Options:
  --dry   Print what would be created.
  --help  Show this help.

After scaffolding, the script prints the wiring steps (index entries, checks)
required for the new asset to pass \`npm run check\`.
`

const args = process.argv.slice(2)
if (args.includes('--help')) { console.log(help); process.exit(0) }
if (args.filter((a) => !a.startsWith('--')).length < 2) { console.log(help); process.exit(1) }

const AC = dirname(dirname(fileURLToPath(import.meta.url)))
const positional = args.filter((a) => !a.startsWith('--'))
const [kind, name] = positional
const ROOT = resolve(positional[2] || process.cwd())
const dry = args.includes('--dry')

if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(name)) {
  console.error(`Name must be kebab-case: got "${name}".`)
  process.exit(1)
}

const emit = (rel, content) => {
  const dest = join(ROOT, rel)
  if (existsSync(dest)) { console.error(`Refusing to overwrite ${rel}.`); process.exit(1) }
  if (dry) { console.log(`would create ${rel}`); return }
  mkdirSync(dirname(dest), { recursive: true })
  writeFileSync(dest, content)
  console.log(`created ${rel}`)
}

const copyTemplate = (srcRel, destRel) => {
  const src = join(AC, srcRel)
  if (!existsSync(src)) { console.error(`Template missing: ${srcRel}`); process.exit(1) }
  const dest = join(ROOT, destRel)
  if (existsSync(dest)) { console.error(`Refusing to overwrite ${destRel}.`); process.exit(1) }
  if (dry) { console.log(`would create ${destRel}`); return }
  mkdirSync(dirname(dest), { recursive: true })
  copyFileSync(src, dest)
  console.log(`created ${destRel}`)
}

const nextSteps = (steps) => {
  if (dry || !steps.length) return
  console.log('\nNext:')
  steps.forEach((s) => console.log(`  - ${s}`))
}

if (kind === 'skill') {
  emit(`skills/${name}/SKILL.md`, `---
name: ${name}
description: One-line trigger summary — when should an agent load this skill?
risk_level: low
writes_files: false
requires_tools: []
---

# ${name}

## When to use

- ...

## Steps

1. ...

## Output

- ...
`)
  nextSteps([
    'Fill in description (it drives auto-triggering) and correct risk_level / writes_files / requires_tools.',
    'Add the skill to the catalog table in skills/README.md (lint:indexes enforces this).',
    'Run `npm run check` to validate frontmatter and indexes.',
  ])
} else if (kind === 'adr') {
  copyTemplate('docs/decisions/000-template.md', `docs/decisions/${name}.md`)
  nextSteps(['Fill in status, context, decision, and consequences.'])
} else if (kind === 'spec') {
  copyTemplate('templates/specs/spec-template.md', `specs/${name}/spec.md`)
  nextSteps(['Resolve every [NEEDS CLARIFICATION] before writing plan.md and tasks.md.'])
} else if (kind === 'arch') {
  copyTemplate('templates/architecture/architecture-decision.md', `docs/architecture/decisions/${name}.md`)
  nextSteps(['Complete the decision record; tag every claim Known/Assumed/Unknown.'])
} else if (kind === 'instinct') {
  emit(`knowledge/instincts/${name}.md`, `---
id: ${name}
trigger: 'when <the concrete situation this applies to>'
confidence: 0.7
domain: general
source: hand-authored
---

# <Imperative one-line pattern statement>

## Action

<The shape to reach for, with a minimal code or config example.>

## Why

<The gotcha or failure this prevents.>
`)
  nextSteps([
    'Keep it short and concrete; generalize project-specific names before promoting.',
    'Promote proven instincts into skills/ or docs/ via docs/workflows/knowledge-capture.md.',
  ])
} else if (kind === 'stack') {
  const title = name.split('-').map((w) => w[0].toUpperCase() + w.slice(1)).join(' ')
  emit(`stacks/${name}.md`, `# Preset: ${title}

<One line: what kind of app/service this preset builds.>

## Components

- <framework / runtime>
- <data layer>
- <testing>

## agent-compass pieces

- Skills: <matching skills/ entries, or (none yet)>
- Templates: <matching templates/ files>
- Guidelines: [testing-tdd](../docs/guidelines/testing-tdd.md),
  [coding-style](../docs/guidelines/coding-style.md)

## Feature layout

<Module/folder shape a new feature follows.>

## Validation

<The lint/typecheck/test commands this stack runs.>
`)
  nextSteps([
    `Add a link row for ${name}.md in stacks/README.md (lint:indexes enforces this).`,
    'If bootstrap should offer this stack, map it in scripts/bootstrap.mjs STACK_DOC_BY_APP and scripts/lib/profiles.mjs.',
    'Run `npm run check`.',
  ])
} else if (kind === 'workflow' || kind === 'tooling') {
  const dir = kind === 'workflow' ? 'docs/workflows' : 'docs/tooling'
  const title = name.split('-').map((w) => w[0].toUpperCase() + w.slice(1)).join(' ')
  emit(`${dir}/${name}.md`, `# ${title}

<One line: when an agent or human reaches for this.>

## When to use

- ...

## Steps

1. ...

## Validation

- ...
`)
  nextSteps([
    `Add a link row for ${name}.md in ${dir}/README.md (lint:indexes enforces this).`,
    'Run `npm run check`.',
  ])
} else {
  console.error(`Unknown kind "${kind}". Use: skill | adr | spec | arch | instinct | stack | workflow | tooling.`)
  process.exit(1)
}

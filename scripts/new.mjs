#!/usr/bin/env node
// new.mjs — golden-path scaffolds. Emit standards-conformant stubs so agents
// don't hand-roll structure: `skill`, `adr`, `spec`.

import { copyFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const help = `Usage: node scripts/new.mjs <kind> <name> [root] [--dry]

Scaffold a standards-conformant stub.

Kinds:
  skill <name>   skills/<name>/SKILL.md with valid frontmatter
  adr <name>     docs/decisions/<name>.md from the ADR template
  spec <name>    specs/<name>/spec.md from the spec template

Options:
  --dry   Print what would be created.
  --help  Show this help.
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

if (kind === 'skill') {
  emit(`skills/${name}/SKILL.md`, `---
name: ${name}
description: One-line summary of when an agent should use this skill.
---

# ${name}

## When to use

- ...

## Steps

1. ...

## Output

- ...
`)
} else if (kind === 'adr') {
  copyTemplate('docs/decisions/000-template.md', `docs/decisions/${name}.md`)
} else if (kind === 'spec') {
  copyTemplate('templates/specs/spec-template.md', `specs/${name}/spec.md`)
} else {
  console.error(`Unknown kind "${kind}". Use: skill | adr | spec.`)
  process.exit(1)
}

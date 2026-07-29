#!/usr/bin/env node
// skill-docs.mjs — generate skill counts and capability-pack catalogs in the
// root and skills READMEs from the canonical filesystem/pack definitions.

import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  CAPABILITY_PACKS,
  ROOT_CAPABILITY_PACK_IDS,
  SUBPACK_IDS,
  rootCapabilitySkills,
} from './lib/capability-packs.mjs'
import { parseCliArgs } from './lib/args.mjs'

const { values, positionals } = parseCliArgs({
  name: 'skill-docs',
  usage: 'node scripts/skill-docs.mjs [root] [--check|--write]',
  summary: 'Generate README skill counts and capability-pack catalogs.',
  positionals: [{ name: 'root', required: false }],
  options: {
    root: { type: 'string', value: '<dir>', desc: 'Use another Agent Compass root.' },
    check: { type: 'boolean', desc: 'Fail if generated sections are stale (default).' },
    write: { type: 'boolean', desc: 'Rewrite generated sections.' },
  },
})

if (values.check && values.write) {
  console.error('Choose only one of --check or --write.')
  process.exit(1)
}

const ROOT = resolve(values.root || positionals[0] || dirname(dirname(fileURLToPath(import.meta.url))))

const packTable = (ids) => [
  '| Pack | Skills | Covers |',
  '| ---- | -----: | ------ |',
  ...ids.map((id) => {
    const pack = CAPABILITY_PACKS[id]
    return `| **${id}** | ${pack.skills.length} | ${pack.description} |`
  }),
].join('\n')

const skillLines = (skills) => {
  const lines = []
  for (let index = 0; index < skills.length; index += 6) {
    lines.push(`- ${skills.slice(index, index + 6).map((name) => `\`${name}\``).join(', ')}`)
  }
  return lines.join('\n')
}

const details = (ids) => ids.map((id) => {
  const pack = CAPABILITY_PACKS[id]
  return `<details>
<summary><strong>${pack.label} (${pack.skills.length})</strong></summary>

${skillLines(pack.skills)}

</details>`
}).join('\n\n')

const importedCount = (() => {
  const lockFile = join(ROOT, 'skills', 'upstream-lock.json')
  if (!existsSync(lockFile)) return new Set(rootCapabilitySkills()).size
  return Object.keys(JSON.parse(readFileSync(lockFile, 'utf8')).skills || {}).length
})()

const totalSkillCount = readdirSync(join(ROOT, 'skills'), { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && existsSync(join(ROOT, 'skills', entry.name, 'SKILL.md')))
  .length

const generated = {
  SKILL_BADGE: `![Skills](https://img.shields.io/badge/skills-${totalSkillCount}-orange)`,
  CAPABILITY_PACKS: `${packTable(ROOT_CAPABILITY_PACK_IDS)}

### Focused subpacks

Use smaller packs when a host only needs one cloud, Kubernetes, observability,
AI operations, scanning, secrets, hardening, or compliance area.

${packTable(SUBPACK_IDS)}`,
  OPERATIONAL_SKILLS: `### Operational capability packs

${importedCount} upstream-derived skills stay opt-in so normal host/global adoption remains
small. Sync one or more root packs or focused subpacks:

\`\`\`bash
node scripts/cli.mjs skills-sync --list-packs
node scripts/cli.mjs skills-sync /path/to/host --pack devops-platform
node scripts/cli.mjs skills-sync /path/to/host --pack aws,kubernetes,observability
node scripts/cli.mjs catalog --type capability-pack --md
\`\`\`

#### Root packs

${packTable(ROOT_CAPABILITY_PACK_IDS)}

#### Focused subpacks

${packTable(SUBPACK_IDS)}

Every imported skill includes an Agent Compass operational safety gate and pinned MIT provenance. Upstream executable scripts and assets are not vendored.

#### Root-pack contents

${details(ROOT_CAPABILITY_PACK_IDS)}

#### Focused-subpack contents

${details(SUBPACK_IDS)}`,
}

const replaceBlock = (text, key, content, file) => {
  const start = `<!-- BEGIN GENERATED:${key} -->`
  const end = `<!-- END GENERATED:${key} -->`
  const from = text.indexOf(start)
  const to = text.indexOf(end)
  if (from === -1 || to === -1 || to < from) {
    throw new Error(`${file}: missing generated markers for ${key}`)
  }
  return `${text.slice(0, from)}${start}\n${content.trim()}\n${end}${text.slice(to + end.length)}`
}

const targets = [
  {
    file: join(ROOT, 'README.md'),
    blocks: ['SKILL_BADGE', 'CAPABILITY_PACKS'],
  },
  {
    file: join(ROOT, 'skills', 'README.md'),
    blocks: ['OPERATIONAL_SKILLS'],
  },
]

const drift = []
for (const target of targets) {
  const before = readFileSync(target.file, 'utf8')
  const after = target.blocks.reduce(
    (text, key) => replaceBlock(text, key, generated[key], target.file),
    before,
  )
  if (before === after) continue
  drift.push(target.file)
  if (values.write) writeFileSync(target.file, after)
}

if (drift.length && !values.write) {
  console.error(`✗ generated skill documentation drift:\n${drift.map((file) => `  ${file}`).join('\n')}`)
  process.exit(1)
}

if (values.write) {
  console.log(`✓ wrote generated skill documentation (${drift.length} file${drift.length === 1 ? '' : 's'} changed).`)
} else {
  console.log('✓ generated skill documentation is current.')
}

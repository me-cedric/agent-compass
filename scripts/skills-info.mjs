#!/usr/bin/env node
// skills-info.mjs — fast skill discovery and exact metadata/provenance lookup.

import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { parseCliArgs } from './lib/args.mjs'
import { CAPABILITY_PACKS } from './lib/capability-packs.mjs'

const { values, positionals } = parseCliArgs({
  name: 'skills',
  usage: 'agent-compass skills [name] [options]',
  summary: 'Search skills, filter capability packs, or inspect exact skill metadata and provenance.',
  positionals: [{ name: 'name', required: false }],
  options: {
    list: { type: 'boolean', desc: 'List skills (default when no name is provided).' },
    grep: { type: 'string', value: '<term>', desc: 'Search names, descriptions, and pack ids.' },
    pack: { type: 'string', value: '<id>', desc: 'List skills in one capability pack.' },
    json: { type: 'boolean', desc: 'Print machine-readable JSON.' },
    md: { type: 'boolean', desc: 'Print a Markdown table or detail card.' },
  },
})

if (values.json && values.md) {
  console.error('Choose only one of --json or --md.')
  process.exit(1)
}

const AC = dirname(dirname(fileURLToPath(import.meta.url)))

const frontmatter = (text) => {
  const match = text.match(/^---\n([\s\S]*?)\n---\n/)
  if (!match) return {}
  const out = {}
  const lines = match[1].split('\n')
  for (let index = 0; index < lines.length; index += 1) {
    const item = lines[index].match(/^([\w-]+):\s*(.*)$/)
    if (!item) continue
    let value = item[2].replace(/^['"]|['"]$/g, '')
    if (/^[>|][+-]?$/.test(value)) {
      const block = []
      while (index + 1 < lines.length && /^\s+\S/.test(lines[index + 1])) {
        block.push(lines[index += 1].trim())
      }
      value = block.join(' ')
    }
    out[item[1]] = value
  }
  return out
}

const packIdsBySkill = new Map()
for (const [id, pack] of Object.entries(CAPABILITY_PACKS)) {
  for (const name of pack.skills) {
    const ids = packIdsBySkill.get(name) || []
    ids.push(id)
    packIdsBySkill.set(name, ids)
  }
}

const skills = readdirSync(join(AC, 'skills'), { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && existsSync(join(AC, 'skills', entry.name, 'SKILL.md')))
  .map((entry) => {
    const meta = frontmatter(readFileSync(join(AC, 'skills', entry.name, 'SKILL.md'), 'utf8'))
    return {
      name: entry.name,
      description: meta.description || '',
      risk_level: meta.risk_level || '',
      writes_files: meta.writes_files === 'true',
      requires_tools: (meta.requires_tools || '[]').replace(/[\[\]\s]/g, '').split(',').filter(Boolean),
      packs: (packIdsBySkill.get(entry.name) || []).sort(),
      source: meta.source || '',
      source_commit: meta.source_commit || '',
      path: `skills/${entry.name}/SKILL.md`,
    }
  })
  .sort((a, b) => a.name.localeCompare(b.name))

const name = positionals[0]
if (name && (values.list || values.grep || values.pack)) {
  console.error('Use a skill name for details, or use --list/--grep/--pack for discovery.')
  process.exit(1)
}

const renderDetail = (skill) => {
  console.log(`# ${skill.name}\n`)
  console.log(skill.description || '_No description._')
  console.log(`\n- Risk: \`${skill.risk_level || 'unknown'}\``)
  console.log(`- Writes files: \`${skill.writes_files}\``)
  console.log(`- Required tools: ${skill.requires_tools.length ? skill.requires_tools.map((tool) => `\`${tool}\``).join(', ') : 'none'}`)
  console.log(`- Capability packs: ${skill.packs.length ? skill.packs.map((pack) => `\`${pack}\``).join(', ') : 'none'}`)
  console.log(`- Source: ${skill.source || 'local'}`)
  console.log(`- Source commit: ${skill.source_commit ? `\`${skill.source_commit}\`` : 'n/a'}`)
  console.log(`- Path: \`${skill.path}\``)
}

if (name) {
  const skill = skills.find((item) => item.name === name)
  if (!skill) {
    console.error(`Unknown skill: ${name}`)
    process.exit(1)
  }
  if (values.json) console.log(JSON.stringify(skill, null, 2))
  else renderDetail(skill)
  process.exit(0)
}

let selected = skills
if (values.pack) {
  const pack = CAPABILITY_PACKS[values.pack]
  if (!pack) {
    console.error(`Unknown capability pack: ${values.pack}`)
    process.exit(1)
  }
  const selectedNames = new Set(pack.skills)
  selected = selected.filter((skill) => selectedNames.has(skill.name))
}
if (values.grep) {
  const term = values.grep.toLowerCase()
  selected = selected.filter((skill) => [
    skill.name,
    skill.description,
    ...skill.packs,
  ].join(' ').toLowerCase().includes(term))
}

if (values.json) {
  console.log(JSON.stringify({ schema: 1, count: selected.length, skills: selected }, null, 2))
} else {
  console.log('| Skill | Risk | Writes | Packs | Description |')
  console.log('| ----- | ---- | ------ | ----- | ----------- |')
  for (const skill of selected) {
    const description = skill.description.replaceAll('|', '\\|')
    console.log(`| \`${skill.name}\` | ${skill.risk_level || '—'} | ${skill.writes_files ? 'yes' : 'no'} | ${skill.packs.join(', ') || '—'} | ${description} |`)
  }
}

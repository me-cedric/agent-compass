#!/usr/bin/env node
// skills-info.mjs — fast skill discovery and exact metadata/provenance lookup.

import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { parseCliArgs } from './lib/args.mjs'
import { CAPABILITY_PACKS } from './lib/capability-packs.mjs'
import { referenceSources } from './lib/external-install.mjs'
import { readSourceRegistry } from './lib/upstream-sources.mjs'

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

// Tracked skills are not on disk, so their metadata comes from the source
// registry: the pin, the licence, the pack membership, and the install command.
// A caller asking "what is <name>?" gets an answer either way.
const trackedSkills = (() => {
  let registry
  try { registry = readSourceRegistry(AC) } catch { return [] }
  const out = []
  for (const [id, source] of Object.entries(referenceSources(registry))) {
    for (const slug of source.upstreamSkills || []) {
      out.push({
        name: slug,
        description: `Tracked in ${id}. ${source.recommended?.includes(slug) ? 'Curated by Agent Compass.' : 'Not curated — read it before use.'}`,
        risk_level: source.adapter === 'operational' ? 'medium' : 'low',
        writes_files: source.adapter === 'operational',
        requires_tools: [],
        packs: (packIdsBySkill.get(slug) || []).sort(),
        source: source.repository,
        source_commit: source.commit,
        tracked: id,
        license: source.license,
        recommended: Boolean(source.recommended?.includes(slug)),
        install: `agent-compass external-skills <host> --source ${id} --skill ${slug}`,
        path: `tracked: ${source.repository}`,
      })
    }
  }
  return out
})()

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

// A local skill wins a name collision: it is what the agent would actually load.
const localNames = new Set(skills.map((skill) => skill.name))
const allSkills = [...skills, ...trackedSkills.filter((skill) => !localNames.has(skill.name))]
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
  if (skill.tracked) {
    console.log(`- Licence: ${skill.license}`)
    console.log(`- Not stored here. Install: \`${skill.install}\``)
  }
}

if (name) {
  const skill = allSkills.find((item) => item.name === name)
  if (!skill) {
    console.error(`Unknown skill: ${name}`)
    process.exit(1)
  }
  if (values.json) console.log(JSON.stringify(skill, null, 2))
  else renderDetail(skill)
  process.exit(0)
}

// A capability pack names skills that live in the tracked operational source, not
// in this repository, so a pack listing reports the pack itself plus how to
// install it rather than filtering the local skill folders (which would be empty).
if (values.pack) {
  const pack = CAPABILITY_PACKS[values.pack]
  if (!pack) {
    console.error(`Unknown capability pack: ${values.pack}`)
    process.exit(1)
  }
  const payload = {
    schema: 1,
    pack: values.pack,
    label: pack.label,
    description: pack.description,
    count: pack.skills.length,
    source: 'devops-security',
    install: `agent-compass external-skills <host> --source devops-security --skill ${pack.skills.join(',')}`,
    skills: pack.skills,
  }
  if (values.json) {
    console.log(JSON.stringify(payload, null, 2))
  } else {
    console.log(`# ${pack.label} (${pack.skills.length} skills)\n`)
    console.log(`${pack.description}\n`)
    console.log('Tracked in `devops-security`, not stored here. Install:\n')
    console.log(`    ${payload.install}\n`)
    for (const skillName of pack.skills) console.log(`- \`${skillName}\``)
  }
  process.exit(0)
}

let selected = allSkills
if (values.grep) {
  // A skill slug is hyphenated and a person types spaces, so match both forms.
  // This matters more now that a tracked skill has no vendored description text
  // to search: its slug is often the only thing that carries the words.
  const loosen = (value) => value.toLowerCase().replace(/[-_\s]+/g, ' ').trim()
  const term = loosen(values.grep)
  selected = selected.filter((skill) => loosen([
    skill.name,
    skill.description,
    skill.tracked || '',
    ...skill.packs,
  ].join(' ')).includes(term))
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

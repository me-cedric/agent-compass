#!/usr/bin/env node
// catalog.mjs — machine-readable catalog of every compass asset (skills,
// stacks, templates, workflows, tooling/guideline/architecture docs, knowledge
// instincts, CLI commands). Agents query this instead of re-crawling the tree,
// and selection logic ("include what fits, not everything") reads it as data.
//
// Output is deterministic: same tree in, same JSON out.

import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { basename, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseCliArgs } from './lib/args.mjs'
import { CAPABILITY_PACKS } from './lib/capability-packs.mjs'

const { values } = parseCliArgs({
  name: 'catalog',
  script: 'catalog.mjs',
  summary: `Print the agent-compass asset catalog as JSON (default) or a Markdown table.

Types: skill | capability-pack | stack | template-group | workflow | tooling |
       guideline | architecture | instinct | command`,
  options: {
    type: { type: 'string', value: '<t>', desc: 'Only assets of one type.' },
    grep: { type: 'string', value: '<term>', desc: 'Case-insensitive match against id, title, and description.' },
    md: { type: 'boolean', desc: 'Human-readable Markdown table instead of JSON.' },
  },
})

const AC = dirname(dirname(fileURLToPath(import.meta.url)))
const read = (rel) => readFileSync(join(AC, rel), 'utf8')
const listMd = (rel) => existsSync(join(AC, rel))
  ? readdirSync(join(AC, rel)).filter((f) => f.endsWith('.md') && f !== 'README.md').sort()
  : []

const frontmatter = (text) => {
  const match = text.match(/^---\n([\s\S]*?)\n---\n/)
  if (!match) return {}
  const out = {}
  const lines = match[1].split('\n')
  for (let i = 0; i < lines.length; i++) {
    const kv = lines[i].match(/^([\w-]+):\s*(.*)$/)
    if (!kv) continue
    let value = kv[2].replace(/^['"]|['"]$/g, '')
    if (/^[>|][+-]?$/.test(value)) {
      const block = []
      while (i + 1 < lines.length && /^\s+\S/.test(lines[i + 1])) block.push(lines[++i].trim())
      value = block.join(' ')
    }
    out[kv[1]] = value
  }
  return out
}

const title = (text) => text.replace(/^---\n[\s\S]*?\n---\n/, '').match(/^#\s+(.+)$/m)?.[1]?.trim() || ''

const firstParagraph = (text) => {
  const body = text.replace(/^---\n[\s\S]*?\n---\n/, '')
  const lines = body.split('\n')
  const start = lines.findIndex((l) => /^#\s/.test(l))
  for (let i = start + 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line || /^[#>|\[!`-]/.test(line)) continue
    return line.length > 160 ? line.slice(0, 157) + '…' : line
  }
  return ''
}

const assets = []

// Skills — SKILL.md frontmatter is the contract (enforced by lint:naming).
for (const entry of readdirSync(join(AC, 'skills'), { withFileTypes: true })) {
  if (!entry.isDirectory() || !existsSync(join(AC, 'skills', entry.name, 'SKILL.md'))) continue
  const fm = frontmatter(read(join('skills', entry.name, 'SKILL.md')))
  assets.push({
    id: entry.name,
    type: 'skill',
    path: `skills/${entry.name}/SKILL.md`,
    description: fm.description || '',
    risk_level: fm.risk_level || '',
    writes_files: fm.writes_files === 'true',
    requires_tools: (fm.requires_tools || '[]').replace(/[\[\]\s]/g, '').split(',').filter(Boolean),
  })
}

// Capability packs — broad opt-in selections, never part of automatic stack fit.
for (const [id, pack] of Object.entries(CAPABILITY_PACKS)) {
  assets.push({
    id,
    type: 'capability-pack',
    path: 'scripts/lib/capability-packs.mjs',
    description: pack.description,
    kind: pack.kind,
    parent: pack.parent || null,
    skill_count: pack.skills.length,
    skills: pack.skills,
  })
}

const mdAssets = (dir, type) => {
  for (const file of listMd(dir)) {
    const text = read(join(dir, file))
    assets.push({
      id: basename(file, '.md'),
      type,
      path: `${dir}/${file}`,
      title: title(text),
      description: frontmatter(text).description || firstParagraph(text),
    })
  }
}

mdAssets('stacks', 'stack')
mdAssets('docs/workflows', 'workflow')
mdAssets('docs/tooling', 'tooling')
mdAssets('docs/guidelines', 'guideline')
mdAssets('docs/architecture', 'architecture')

// Knowledge instincts — trigger/domain frontmatter.
for (const file of listMd('knowledge/instincts')) {
  const fm = frontmatter(read(join('knowledge/instincts', file)))
  assets.push({
    id: basename(file, '.md'),
    type: 'instinct',
    path: `knowledge/instincts/${file}`,
    description: fm.trigger || '',
    domain: fm.domain || '',
  })
}

// Template groups — one entry per copyable group.
const templatesIndex = existsSync(join(AC, 'templates/README.md')) ? read('templates/README.md') : ''
for (const entry of readdirSync(join(AC, 'templates'), { withFileTypes: true })) {
  if (!entry.isDirectory()) continue
  const row = templatesIndex.match(new RegExp(`\\\`${entry.name}/\\\`[^|]*\\|\\s*([^|\n]+)`))
  assets.push({
    id: entry.name,
    type: 'template-group',
    path: `templates/${entry.name}/`,
    description: row ? row[1].trim() : '',
  })
}

// CLI commands — cli.mjs exports COMMANDS as data (dispatch is main-guarded).
const { COMMANDS } = await import('./cli.mjs')
for (const [name, entry] of Object.entries(COMMANDS)) {
  assets.push({ id: name, type: 'command', path: 'scripts/cli.mjs', group: entry.group, description: entry.desc })
}

assets.sort((a, b) => a.type.localeCompare(b.type) || a.id.localeCompare(b.id))

const typeFilter = values.type
const grep = values.grep?.toLowerCase()
let selected = assets
if (typeFilter) selected = selected.filter((a) => a.type === typeFilter)
if (grep) selected = selected.filter((a) => `${a.id} ${a.title || ''} ${a.description || ''}`.toLowerCase().includes(grep))

if (values.md) {
  console.log('| Type | Id | Description | Path |')
  console.log('| ---- | -- | ----------- | ---- |')
  for (const a of selected) console.log(`| ${a.type} | \`${a.id}\` | ${(a.description || a.title || '').replaceAll('|', '\\|')} | \`${a.path}\` |`)
} else {
  console.log(JSON.stringify({ schema: 1, count: selected.length, assets: selected }, null, 2))
}

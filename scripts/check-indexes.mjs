#!/usr/bin/env node
// check-indexes.mjs — fail when catalog README files drift from actual files.
// Covers stacks, workflows, tooling, guidelines, architecture, knowledge
// instincts, skills (both directions), template manifest coverage, bootstrap
// app mappings, and CLI command documentation.

import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseCliArgs } from './lib/args.mjs'
import { FILE_MANIFEST } from './manifest.mjs'
import { COMMANDS } from './cli.mjs'

const { values, positionals } = parseCliArgs({
  name: 'check-indexes',
  usage: 'node scripts/check-indexes.mjs [root] [options]',
  summary: `Fail when stack, workflow, skill, or bootstrap app catalogs drift.
Also checks guideline/architecture indexes, knowledge instincts, template
manifest coverage, and CLI command documentation.`,
  positionals: [{ name: 'root', required: false }],
  options: {
    root: { type: 'string', value: '<dir>', desc: 'Check another root directory.' },
  },
})

const ROOT = resolve(values.root || positionals[0] || dirname(dirname(fileURLToPath(import.meta.url))))
const hits = []

const mdFiles = (dir) => readdirSync(join(ROOT, dir))
  .filter((file) => file.endsWith('.md') && file !== 'README.md')
  .sort()

const checkMarkdownLinks = (dir, indexFile) => {
  const indexPath = join(ROOT, indexFile)
  const index = readFileSync(indexPath, 'utf8')
  for (const file of mdFiles(dir)) {
    if (!index.includes(`](${file})`)) hits.push(`${indexFile}: missing ${file}`)
  }
}

const checkKnowledge = () => {
  const indexFile = 'knowledge/README.md'
  const index = readFileSync(join(ROOT, indexFile), 'utf8')
  for (const file of mdFiles('knowledge/instincts')) {
    const stem = file.replace(/\.md$/, '')
    if (!index.includes(file) && !index.includes(`\`${stem}\``)) {
      hits.push(`${indexFile}: missing instinct ${file}`)
    }
  }
}

const checkSkills = () => {
  const indexFile = 'skills/README.md'
  const index = readFileSync(join(ROOT, indexFile), 'utf8')
  for (const entry of readdirSync(join(ROOT, 'skills'), { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    if (!existsSync(join(ROOT, 'skills', entry.name, 'SKILL.md'))) continue
    if (!index.includes(`\`${entry.name}\``)) hits.push(`${indexFile}: missing ${entry.name}`)
  }
}

// Reverse direction: every skill named in a catalog table row must exist.
const checkSkillsReverse = () => {
  const indexFile = 'skills/README.md'
  const index = readFileSync(join(ROOT, indexFile), 'utf8')
  const seen = new Set()
  for (const line of index.split('\n')) {
    if (!line.startsWith('|')) continue
    const firstCell = line.split('|')[1] || ''
    for (const match of firstCell.matchAll(/`([a-z0-9][a-z0-9-]*)`/g)) {
      const name = match[1]
      if (seen.has(name)) continue
      seen.add(name)
      if (!existsSync(join(ROOT, 'skills', name, 'SKILL.md'))) {
        hits.push(`${indexFile}: stale entry ${name} (no skills/${name}/SKILL.md)`)
      }
    }
  }
}

const checkTemplateGroups = () => {
  const indexFile = 'templates/README.md'
  const index = readFileSync(join(ROOT, indexFile), 'utf8')
  for (const entry of readdirSync(join(ROOT, 'templates'), { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    if (!index.includes(`\`${entry.name}/\``)) hits.push(`${indexFile}: missing ${entry.name}/`)
  }
}

// Every manifest source under templates/ must be represented in the catalog:
// grouped files by their `<group>/` directory, loose files by name.
const checkManifestCoverage = () => {
  const indexFile = 'templates/README.md'
  const index = readFileSync(join(ROOT, indexFile), 'utf8')
  const needed = new Set()
  for (const { src } of FILE_MANIFEST) {
    if (!src.startsWith('templates/')) continue
    const rel = src.slice('templates/'.length)
    needed.add(rel.includes('/') ? `\`${rel.split('/')[0]}/\`` : rel)
  }
  for (const needle of [...needed].sort()) {
    if (!index.includes(needle)) hits.push(`${indexFile}: missing manifest entry ${needle}`)
  }
}

// Every CLI command must be documented as `<name>` in docs/tooling/cli.md.
const checkCliDocs = () => {
  const docFile = 'docs/tooling/cli.md'
  const docPath = join(ROOT, docFile)
  if (!existsSync(docPath)) {
    hits.push(`${docFile}: missing (cannot verify CLI command coverage)`)
    return
  }
  const doc = readFileSync(docPath, 'utf8')
  for (const name of Object.keys(COMMANDS)) {
    if (!doc.includes(`\`${name}\``)) hits.push(`${docFile}: missing command \`${name}\``)
  }
}

const checkBootstrapMappings = () => {
  const stacksIndex = readFileSync(join(ROOT, 'stacks/README.md'), 'utf8')
  const bootstrap = readFileSync(join(ROOT, 'scripts/bootstrap.mjs'), 'utf8')
  const mapping = bootstrap.match(/STACK_DOC_BY_APP = \{([\s\S]*?)\n\}/)?.[1] || ''
  for (const match of mapping.matchAll(/'([^']+)': '([^']+)'/g)) {
    const [, app, doc] = match
    if (!existsSync(join(ROOT, doc))) hits.push(`scripts/bootstrap.mjs: ${app} maps to missing ${doc}`)
    if (!stacksIndex.includes(`](${doc.replace('stacks/', '')})`)) hits.push(`stacks/README.md: missing bootstrap app ${app} (${doc})`)
  }
}

checkMarkdownLinks('stacks', 'stacks/README.md')
checkMarkdownLinks('docs/workflows', 'docs/workflows/README.md')
checkMarkdownLinks('docs/tooling', 'docs/tooling/README.md')
checkMarkdownLinks('docs/guidelines', 'docs/guidelines/README.md')
checkMarkdownLinks('docs/architecture', 'docs/architecture/README.md')
checkKnowledge()
checkSkills()
checkSkillsReverse()
checkTemplateGroups()
checkManifestCoverage()
checkCliDocs()
checkBootstrapMappings()

if (hits.length) {
  console.error(`✗ ${hits.length} index drift issue(s):\n`)
  hits.forEach((hit) => console.error(`  ${hit}`))
  process.exit(1)
}

console.log('✓ index check passed — stack, workflow, skill, knowledge, template, and CLI catalogs match files.')

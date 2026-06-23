#!/usr/bin/env node
// check-indexes.mjs — fail when catalog README files drift from actual files.

import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { dirname } from 'node:path'

const help = `Usage: node scripts/check-indexes.mjs [--root <dir>]

Fail when stack, workflow, skill, or bootstrap app catalogs drift.

Options:
  --root <dir>  Check another root directory.
  --help        Show this help.
`

if (process.argv.includes('--help')) {
  console.log(help)
  process.exit(0)
}

const rootArg = process.argv.indexOf('--root')
const ROOT = rootArg === -1 ? dirname(dirname(fileURLToPath(import.meta.url))) : process.argv[rootArg + 1]
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

const checkSkills = () => {
  const indexFile = 'skills/README.md'
  const index = readFileSync(join(ROOT, indexFile), 'utf8')
  for (const entry of readdirSync(join(ROOT, 'skills'), { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    if (!existsSync(join(ROOT, 'skills', entry.name, 'SKILL.md'))) continue
    if (!index.includes(`\`${entry.name}\``)) hits.push(`${indexFile}: missing ${entry.name}`)
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
checkSkills()
checkTemplateGroups()
checkBootstrapMappings()

if (hits.length) {
  console.error(`✗ ${hits.length} index drift issue(s):\n`)
  hits.forEach((hit) => console.error(`  ${hit}`))
  process.exit(1)
}

console.log('✓ index check passed — stack, workflow, and skill catalogs match files.')

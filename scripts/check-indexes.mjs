#!/usr/bin/env node
// check-indexes.mjs — fail when catalog README files drift from actual files.

import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { dirname } from 'node:path'

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)))
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

checkMarkdownLinks('stacks', 'stacks/README.md')
checkMarkdownLinks('docs/workflows', 'docs/workflows/README.md')
checkSkills()

if (hits.length) {
  console.error(`✗ ${hits.length} index drift issue(s):\n`)
  hits.forEach((hit) => console.error(`  ${hit}`))
  process.exit(1)
}

console.log('✓ index check passed — stack, workflow, and skill catalogs match files.')

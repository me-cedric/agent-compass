#!/usr/bin/env node
// gen-depgraph.mjs — Mermaid dependency graph from local JS/TS imports, so an
// agent sees structure and blast radius before editing a shared file. ponytail:
// JS/TS relative imports only; not a full module resolver.

import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { parseCliArgs, resolveRoot } from './lib/args.mjs'

const { values, positionals } = parseCliArgs({
  name: 'depgraph',
  script: 'gen-depgraph.mjs',
  summary: 'Generate a Mermaid import graph at docs/architecture/dependencies.md.',
  positionals: [{ name: 'root', required: false }],
  options: {
    dir: { type: 'string', value: '<subdir>', desc: 'Directory to scan (default: src if present, else scripts).' },
    write: { type: 'boolean', desc: 'Write docs/architecture/dependencies.md.' },
    check: { type: 'boolean', desc: 'Exit 1 if the file is missing or stale (read-only).' },
  },
})

const ROOT = resolveRoot(positionals)
const SUBDIR = values.dir || (existsSync(join(ROOT, 'src')) ? 'src' : 'scripts')
const SCAN = join(ROOT, SUBDIR)
const OUT = join(ROOT, 'docs', 'architecture', 'dependencies.md')
const CODE = /\.(ts|tsx|js|jsx|mjs|cjs)$/
const IGNORE = new Set(['node_modules', '.git', 'dist', 'build', 'coverage', '__tests__'])

const walk = (dir, out = []) => {
  if (!existsSync(dir)) return out
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (IGNORE.has(entry.name)) continue
    const full = join(dir, entry.name)
    if (entry.isDirectory()) walk(full, out)
    else if (CODE.test(entry.name)) out.push(full)
  }
  return out
}

const files = walk(SCAN).sort()
const fileSet = new Set(files)
const rel = (f) => relative(SCAN, f)
const resolveImport = (fromFile, spec) => {
  const base = join(dirname(fromFile), spec)
  for (const candidate of [base, `${base}.mjs`, `${base}.js`, `${base}.ts`, join(base, 'index.mjs'), join(base, 'index.js'), join(base, 'index.ts')]) {
    if (fileSet.has(candidate)) return candidate
  }
  return null
}

const edges = []
const importRe = /(?:import[^'"]*from|import|require\()\s*['"](\.[^'"]+)['"]/g
for (const file of files) {
  const text = readFileSync(file, 'utf8')
  for (const match of text.matchAll(importRe)) {
    const target = resolveImport(file, match[1])
    if (target && target !== file) edges.push([rel(file), rel(target)])
  }
}
edges.sort((a, b) => (a[0] + a[1]).localeCompare(b[0] + b[1]))

const id = (name) => name.replace(/[^a-zA-Z0-9]/g, '_')
const dependedOnBy = {}
for (const [from, to] of edges) (dependedOnBy[to] = dependedOnBy[to] || []).push(from)

const lines = ['# Dependency Graph', '', `Scanned \`${SUBDIR}/\` — ${files.length} files, ${edges.length} internal edges.`, '', '```mermaid', 'graph LR']
for (const file of files.map(rel)) lines.push(`  ${id(file)}["${file}"]`)
for (const [from, to] of edges) lines.push(`  ${id(from)} --> ${id(to)}`)
lines.push('```', '', '## Depended on by', '')
const hot = Object.keys(dependedOnBy).sort()
if (hot.length) for (const to of hot) lines.push(`- \`${to}\` ← ${dependedOnBy[to].sort().map((f) => `\`${f}\``).join(', ')}`)
else lines.push('- (no internal dependencies found)')
const serialized = lines.join('\n') + '\n'

if (values.check) {
  const current = existsSync(OUT) ? readFileSync(OUT, 'utf8') : ''
  if (current !== serialized) { console.error('✗ dependencies.md is missing or stale — run with --write'); process.exit(1) }
  console.log('✓ dependency graph up to date.')
} else if (values.write) {
  mkdirSync(dirname(OUT), { recursive: true })
  writeFileSync(OUT, serialized)
  console.log(OUT)
} else {
  process.stdout.write(serialized)
}

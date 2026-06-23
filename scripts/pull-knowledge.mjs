#!/usr/bin/env node
// pull-knowledge.mjs — harvest reusable signal from another project into
// knowledge/incoming/<project>/ for review. NEVER auto-merges. Dependency-free.
//
//   node scripts/pull-knowledge.mjs ../some-project
//
// Then review knowledge/incoming/<project>/INDEX.md and promote the generic bits
// (see docs/workflows/knowledge-capture.md). incoming/ is gitignored.

import { existsSync, readdirSync, statSync, mkdirSync, copyFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve, relative, join, basename } from 'node:path'
import { fileURLToPath } from 'node:url'

const AC = dirname(dirname(fileURLToPath(import.meta.url)))
const target = resolve(process.argv[2] || '')
if (!process.argv[2] || !existsSync(target)) {
  console.error('Usage: node scripts/pull-knowledge.mjs <path-to-project>')
  process.exit(1)
}
const projName = basename(target)
const dest = join(AC, 'knowledge', 'incoming', projName)

const IGNORE = new Set(['node_modules', '.git', 'dist', 'build', 'coverage', '.turbo', '.next', '.expo', 'ios', 'android'])
const found = []

const walk = (dir, depth, onFile, maxDepth = 6) => {
  if (depth > maxDepth) return
  let entries = []
  try { entries = readdirSync(dir, { withFileTypes: true }) } catch { return }
  for (const e of entries) {
    if (IGNORE.has(e.name)) continue
    const full = join(dir, e.name)
    if (e.isDirectory()) walk(full, depth + 1, onFile, maxDepth)
    else onFile(full)
  }
}

const add = (full, category) => {
  const rel = relative(target, full)
  if (found.some((f) => f.rel === rel)) return
  found.push({ rel, category, full })
}

// 1) Agent + instinct files (high value).
for (const f of ['AGENTS.md', 'CLAUDE.md', 'CODEX.md', '.github/copilot-instructions.md']) {
  if (existsSync(join(target, f))) add(join(target, f), 'agent-config')
}
const instinctsDir = join(target, '.claude', 'instincts')
if (existsSync(instinctsDir)) walk(instinctsDir, 0, (f) => f.endsWith('.md') && add(f, 'instinct'), 2)

// 2) Config files by name (root + one level into apps/packages).
const CONFIG = /(^|\/)(turbo\.json|pnpm-workspace\.yaml|tsconfig(\.\w+)?\.json|eslint\.config\.(mjs|cjs|js)|commitlint\.config\.(js|cjs|mjs)|\.prettierrc|\.osv-scanner\.toml|sonar-project\.properties|Dockerfile)$/
walk(target, 0, (f) => { if (CONFIG.test(f)) add(f, 'config') }, 4)
const huskyDir = join(target, '.husky')
if (existsSync(huskyDir)) walk(huskyDir, 0, (f) => !f.includes('/_/') && statSync(f).isFile() && add(f, 'hook'), 2)

// 3) Module READMEs (bounded).
let readmeCount = 0
walk(join(target, 'apps'), 0, (f) => {
  if (readmeCount < 50 && /README\.md$/.test(f) && /\/src\//.test(f)) { add(f, 'module-readme'); readmeCount++ }
}, 7)

if (!found.length) {
  console.log(`No reusable signal found in ${target}.`)
  process.exit(0)
}

// Copy + check whether agent-compass already has something similarly named.
const acHas = (name) => {
  let hit = false
  walk(join(AC, 'templates'), 0, (f) => { if (basename(f) === name) hit = true }, 5)
  walk(join(AC, 'knowledge'), 0, (f) => { if (basename(f) === name) hit = true }, 5)
  walk(join(AC, 'skills'), 0, (f) => { if (basename(f) === name) hit = true }, 4)
  return hit
}

const rows = []
for (const item of found) {
  const out = join(dest, item.rel)
  try {
    mkdirSync(dirname(out), { recursive: true })
    copyFileSync(item.full, out)
    rows.push({ ...item, status: acHas(basename(item.rel)) ? 'exists-in-base' : 'new' })
  } catch (e) {
    rows.push({ ...item, status: 'copy-failed' })
  }
}

const byCat = {}
for (const r of rows) (byCat[r.category] ||= []).push(r)
const index = `# Pulled knowledge — ${projName}

Source: \`${target}\`
Staged: ${rows.length} files. **Nothing is merged.** Review, then promote the
generic items (see ../../../docs/workflows/knowledge-capture.md) and delete the rest.

${Object.entries(byCat).map(([cat, items]) => `## ${cat}\n\n| File | Status |\n| ---- | ------ |\n${items.map((i) => `| \`${i.rel}\` | ${i.status} |`).join('\n')}`).join('\n\n')}

> \`new\` = no same-named file in agent-compass yet · \`exists-in-base\` = compare and
> reconcile · promote by rewriting away project-specific names (\`@scope\`, \`<project>\`).
`
writeFileSync(join(dest, 'INDEX.md'), index)

console.log(`\n✓ Staged ${rows.length} files → ${relative(process.cwd(), dest)}`)
console.log(`✓ Review ${relative(process.cwd(), join(dest, 'INDEX.md'))}`)
console.log(`\n${rows.filter((r) => r.status === 'new').length} new · ${rows.filter((r) => r.status === 'exists-in-base').length} overlap with base\n`)

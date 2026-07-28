#!/usr/bin/env node
// pull-knowledge.mjs — harvest reusable signal from another project into
// knowledge/incoming/<project>/ for review. NEVER auto-merges. Dependency-free.
//
//   node scripts/pull-knowledge.mjs ../some-project
//
// Then review knowledge/incoming/<project>/INDEX.md and promote the generic bits
// (see docs/workflows/knowledge-capture.md). incoming/ is gitignored.

import { existsSync, readdirSync, readFileSync, statSync, mkdirSync, copyFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve, relative, join, basename } from 'node:path'
import { fileURLToPath } from 'node:url'

import { isBareDate, isReservedExampleEmail } from './lib/redact.mjs'
import { parseCliArgs } from './lib/args.mjs'

const AC = dirname(dirname(fileURLToPath(import.meta.url)))

const { values, positionals } = parseCliArgs({
  name: 'pull-knowledge',
  script: 'pull-knowledge.mjs',
  summary: `Stage reusable project signal under knowledge/incoming/<project> for review.
Never auto-merges staged files.`,
  positionals: [{ name: 'path-to-project', required: true }],
  options: {
    'allow-sensitive': { type: 'boolean', desc: 'Stage files even when redaction warnings are found.' },
  },
})

const allowSensitive = Boolean(values['allow-sensitive'])
const targetArg = positionals[0]
const target = resolve(targetArg || '')
if (!targetArg || !existsSync(target)) {
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

const DENY = [
  'par' + 'cus', 'vel' + 'hop', 'orbi' + 'lity', 'eo' + 'via', 'nex' + 'terite',
  'fresh' + 'mile', 'mone' + 'tico', '\\bcts\\b', 'parking[-_ ]?lots?', 'free[-_ ]?spots?', 'ev[-_ ]charging',
]
const DENY_RE = new RegExp(`(${DENY.join('|')})`, 'i')
const SECRET_RE = /(-----BEGIN [A-Z ]*PRIVATE KEY-----|AKIA[0-9A-Z]{16}|ghp_[A-Za-z0-9_]{20,}|(?:api|access|secret|private)[-_ ]?(?:key|token|secret)\s*[:=]\s*['"]?[A-Za-z0-9_./+=-]{16,})/i
const PERSONAL_RE = /([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}|\+?\d[\d .()-]{8,}\d)/gi
// First personal-data hit that is not a documentation placeholder (reserved
// example email) or a bare ISO date (config validity fields, not PII).
const findPersonal = (text) => {
  for (const match of text.matchAll(PERSONAL_RE)) {
    const value = match[1]
    if (isReservedExampleEmail(value) || isBareDate(value)) continue
    return match
  }
  return null
}
const scanBeforeCopy = () => {
  if (allowSensitive) return
  const warnings = []
  for (const item of found) {
    let text
    try { text = readFileSync(item.full, 'utf8') } catch { continue }
    const secret = SECRET_RE.exec(text)
    const denied = DENY_RE.exec(text)
    const personal = findPersonal(text)
    if (secret) warnings.push(`${item.rel}: possible secret (${secret[1].slice(0, 40)})`)
    if (denied) warnings.push(`${item.rel}: denied project/domain token (${denied[1]})`)
    if (personal) warnings.push(`${item.rel}: possible personal data (${personal[1].slice(0, 40)})`)
  }
  if (warnings.length) {
    console.error(`✗ Refusing to stage ${warnings.length} sensitive item(s). Redact first, or rerun with --allow-sensitive for manual quarantine:\n`)
    warnings.forEach((warning) => console.error(`  ${warning}`))
    process.exit(1)
  }
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
scanBeforeCopy()

// Copy + check whether agent-compass already has something similarly named,
// and whether the content actually differs. Never match staged files under
// knowledge/incoming — a file must not count as its own base.
const findBaseMatch = (name) => {
  let hit = null
  const record = (f) => { if (!hit && basename(f) === name && !f.includes('/incoming/')) hit = f }
  walk(join(AC, 'templates'), 0, record, 5)
  walk(join(AC, 'knowledge'), 0, record, 5)
  walk(join(AC, 'skills'), 0, record, 4)
  return hit
}
const baseStatus = (item) => {
  const base = findBaseMatch(basename(item.rel))
  if (!base) return 'new'
  try {
    return readFileSync(base, 'utf8') === readFileSync(item.full, 'utf8') ? 'identical' : 'differs'
  } catch { return 'differs' }
}

const rows = []
for (const item of found) {
  const out = join(dest, item.rel)
  try {
    mkdirSync(dirname(out), { recursive: true })
    copyFileSync(item.full, out)
    rows.push({ ...item, status: baseStatus(item) })
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

> \`new\` = no same-named file in agent-compass yet · \`differs\` = base has a
> same-named file with different content — diff and reconcile · \`identical\` =
> already in base, delete from staging · promote by rewriting away
> project-specific names (\`@scope\`, \`<project>\`).
`
writeFileSync(join(dest, 'INDEX.md'), index)

const count = (status) => rows.filter((r) => r.status === status).length
console.log(`\n✓ Staged ${rows.length} files → ${relative(process.cwd(), dest)}`)
console.log(`✓ Review ${relative(process.cwd(), join(dest, 'INDEX.md'))}`)
console.log(`\n${count('new')} new · ${count('differs')} differ from base · ${count('identical')} identical\n`)

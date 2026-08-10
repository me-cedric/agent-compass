#!/usr/bin/env node
// pull-knowledge.mjs — harvest reusable signal from another project into
// knowledge/incoming/<project>/ for review. NEVER auto-merges. Dependency-free.
//
//   node scripts/pull-knowledge.mjs ../some-project
//
// Then review knowledge/incoming/<project>/INDEX.md and promote the generic bits
// (see docs/workflows/knowledge-capture.md). incoming/ is gitignored.
//
// Every category carries a cap, so one large project cannot flood staging.

import { existsSync, readdirSync, readFileSync, statSync, lstatSync, realpathSync, mkdirSync, copyFileSync, writeFileSync, rmSync } from 'node:fs'
import { dirname, resolve, relative, join, basename, extname } from 'node:path'
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
let target = resolve(targetArg || '')
if (!targetArg || !existsSync(target)) {
  console.error('Usage: node scripts/pull-knowledge.mjs <path-to-project>')
  process.exit(1)
}
// Resolve the target once. Symlinks are followed while walking, so every path
// must be comparable against the same root — on macOS /var is a symlink to
// /private/var, and a mixed pair makes every relative path escape the root.
target = realpathSync(target)
const projName = basename(target)
const dest = join(AC, 'knowledge', 'incoming', projName)

// Directory names never worth walking. Build output and git worktrees are the
// two that matter most: a worktree duplicates the whole repository at a stale
// commit, and a build tree can hold tens of thousands of copied files.
const IGNORE = new Set([
  'node_modules', '.git', 'dist', 'build', 'coverage', '.turbo', '.next', '.expo',
  'ios', 'android', 'target', 'worktrees', 'test-results', 'playwright-report',
  'shots', 'out', 'gen', '.venv', 'vendor', '.pnpm-store', '__pycache__',
])

// Caps per category. A project with more assets than this gets a truncation
// note in INDEX.md — never a silent cut.
const CAPS = {
  skill: 60,
  'skill-payload': 400,
  'agent-role': 30,
  doc: 25,
  'module-doc': 50,
  ci: 20,
  devcontainer: 15,
  'style-contract': 5,
}
const MAX_DOC_BYTES = 64 * 1024
const MAX_SKILL_FILES = 20
const MAX_SKILL_BYTES = 256 * 1024

const found = []
const truncated = []
const seenReal = new Set()

const isDir = (full) => {
  // A symlink to a directory must be walked: .claude/skills/<name> is commonly a
  // relative symlink into the canonical skills tree.
  try { return statSync(full).isDirectory() } catch { return false }
}

const walk = (dir, depth, onFile, maxDepth = 6) => {
  if (depth > maxDepth) return
  let entries = []
  try { entries = readdirSync(dir, { withFileTypes: true }) } catch { return }
  for (const e of entries) {
    if (IGNORE.has(e.name)) continue
    const full = join(dir, e.name)
    if (e.isDirectory() || (e.isSymbolicLink() && isDir(full))) walk(full, depth + 1, onFile, maxDepth)
    else onFile(full)
  }
}

const countIn = (category) => found.filter((f) => f.category === category).length

const add = (full, category) => {
  const cap = CAPS[category]
  if (cap && countIn(category) >= cap) {
    if (!truncated.some((t) => t.category === category)) truncated.push({ category, cap })
    return false
  }
  if (isVendored(full)) return false
  // Dedupe by real path so a symlinked tree does not stage the same file twice.
  let real
  try { real = realpathSync(full) } catch { real = full }
  if (seenReal.has(real) || isVendored(real)) return false
  const rel = relative(target, full)
  if (rel.startsWith('..')) return false
  seenReal.add(real)
  found.push({ rel, category, full })
  return true
}

const sizeOf = (full) => { try { return statSync(full).size } catch { return 0 } }

const DENY = [
  'par' + 'cus', 'vel' + 'hop', 'orbi' + 'lity', 'eo' + 'via', 'nex' + 'terite',
  'fresh' + 'mile', 'mone' + 'tico', '\\bcts\\b', 'parking[-_ ]?lots?', 'free[-_ ]?spots?', 'ev[-_ ]charging',
]
const DENY_RE = new RegExp(`(${DENY.join('|')})`, 'i')
const SECRET_RE = /(-----BEGIN [A-Z ]*PRIVATE KEY-----|AKIA[0-9A-Z]{16}|ghp_[A-Za-z0-9_]{20,}|(?:api|access|secret|private)[-_ ]?(?:key|token|secret)\s*[:=]\s*['"]?[A-Za-z0-9_./+=-]{16,})/i
const PERSONAL_RE = /([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}|\+?\d[\d .()-]{8,}\d)/gi
// A git commit hash holds long digit runs, so the phone-number branch above
// matches inside one. Skip any numeric hit that sits inside a hex run: a
// provenance block that pins a commit is not personal data.
const HEX_RUN_RE = /\b[0-9a-f]{7,}\b/gi
const hexSpans = (text) => [...text.matchAll(HEX_RUN_RE)].map((m) => [m.index, m.index + m[0].length])
// A dotted number is a pinned tool version, not a phone number.
const isVersionNumber = (value) => /^\d+(\.\d+)+$/.test(value.trim())
// First personal-data hit that is not a documentation placeholder (reserved
// example email), a bare ISO date (config validity fields, not PII), a pinned
// version, or a digit run inside a commit hash.
const findPersonal = (text) => {
  const spans = hexSpans(text)
  for (const match of text.matchAll(PERSONAL_RE)) {
    const value = match[1]
    if (isReservedExampleEmail(value) || isBareDate(value) || isVersionNumber(value)) continue
    if (spans.some(([start, end]) => match.index >= start && match.index < end)) continue
    return match
  }
  return null
}
// Report every warning, then refuse unless --allow-sensitive. The flag exists
// for manual quarantine, so it must still say what it staged.
const scanBeforeCopy = () => {
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
  if (!warnings.length) return
  if (allowSensitive) {
    console.error(`! Staging ${warnings.length} sensitive item(s) under --allow-sensitive. Quarantine them; never promote them as-is:\n`)
    warnings.forEach((warning) => console.error(`  ${warning}`))
    return
  }
  console.error(`✗ Refusing to stage ${warnings.length} sensitive item(s). Redact first, or rerun with --allow-sensitive for manual quarantine:\n`)
  warnings.forEach((warning) => console.error(`  ${warning}`))
  process.exit(1)
}

// A vendored corpus carries a generated manifest that names its source, so it
// belongs to its upstream and not to this project. Without this check a project
// that vendors agent-compass re-imports the base into itself.
// A generated tree the project owns has no such manifest, so it stays in scope.
const isVendorManifest = (file) => {
  try {
    const manifest = JSON.parse(readFileSync(file, 'utf8'))
    return Boolean(manifest.source_repo || manifest.source_commit)
  } catch { return false }
}
const vendoredRoots = []
walk(target, 0, (f) => {
  const name = basename(f)
  if (name === 'MISSIONS.md' || name === 'agent-compass.commands.json') vendoredRoots.push(dirname(f))
  else if (name === 'manifest.json' && isVendorManifest(f)) vendoredRoots.push(dirname(f))
}, 5)
const isVendored = (full) => vendoredRoots.some((root) => full === root || full.startsWith(`${root}/`))

// 1) Agent contract files (high value). One per provider.
for (const f of ['AGENTS.md', 'AGENT.md', 'CLAUDE.md', 'CODEX.md', 'GEMINI.md', '.github/copilot-instructions.md']) {
  if (existsSync(join(target, f))) add(join(target, f), 'agent-config')
}
const instinctsDir = join(target, '.claude', 'instincts')
if (existsSync(instinctsDir)) walk(instinctsDir, 0, (f) => f.endsWith('.md') && add(f, 'instinct'), 2)

// 2) Agent skills. A SKILL.md is the densest reusable unit a project owns, and
// the folder around it is one asset: the licence and the runnable payload travel
// with the prose or the promoted skill breaks.
const SKILL_PAYLOAD_DIRS = new Set(['references', 'scripts', 'examples', 'assets'])
const stageSkillDir = (skillDir) => {
  const files = []
  walk(skillDir, 0, (f) => {
    const rel = relative(skillDir, f)
    const top = rel.split('/')[0]
    const keep = rel === 'SKILL.md' || (!rel.includes('/') && /^(LICENSE|LICENCE|DESIGN\.md|README\.md)$/.test(rel))
      || SKILL_PAYLOAD_DIRS.has(top)
    if (keep) files.push(f)
  }, 3)
  const bytes = files.reduce((sum, f) => sum + sizeOf(f), 0)
  if (files.length > MAX_SKILL_FILES || bytes > MAX_SKILL_BYTES) {
    truncated.push({ category: 'skill', cap: `${basename(skillDir)}: ${files.length} files / ${Math.round(bytes / 1024)} KB over the per-skill bound` })
    return false
  }
  const manifest = files.find((f) => basename(f) === 'SKILL.md')
  if (!manifest || !add(manifest, 'skill')) return false
  for (const f of files) if (f !== manifest) add(f, 'skill-payload')
  return true
}
const skillsTrees = []
walk(target, 0, (f) => {
  if (basename(f) !== 'SKILL.md') return
  const skillDir = dirname(f)
  const treeDir = dirname(skillDir)
  if (basename(treeDir) !== 'skills' || isVendored(treeDir)) return
  let real
  try { real = realpathSync(skillDir) } catch { real = skillDir }
  if (skillsTrees.includes(real)) return
  skillsTrees.push(real)
}, 6)
for (const skillDir of skillsTrees) stageSkillDir(skillDir)

// A style contract binds every agent in a session. Short, generic, promotable.
walk(target, 0, (f) => /(^|\/)(STYLE-CONTRACT|style-contract)\.md$/.test(f) && add(f, 'style-contract'), 5)

// 3) Provider agent roles and slash commands: a reusable division of labour and
// a reusable prompt contract. Skip a vendored copy for the same reason as above.
for (const sub of [['.claude', 'agents'], ['.claude', 'commands'], ['.github', 'agents'], ['.github', 'prompts'], ['.github', 'instructions']]) {
  const dir = join(target, ...sub)
  if (!existsSync(dir) || isVendored(dir)) continue
  walk(dir, 0, (f) => f.endsWith('.md') && add(f, 'agent-role'), 3)
}

// 4) Config files by name (root + a few levels into apps/packages).
const CONFIG = /(^|\/)(turbo\.json|pnpm-workspace\.yaml|tsconfig(\.\w+)?\.json|eslint\.config\.(mjs|cjs|js)|commitlint\.config\.(js|cjs|mjs)|\.prettierrc|\.osv-scanner\.toml|sonar-project\.properties|rust-toolchain\.toml|\.gitattributes|Dockerfile)$/
walk(target, 0, (f) => { if (CONFIG.test(f)) add(f, 'config') }, 4)
const huskyDir = join(target, '.husky')
// A dangling hook symlink must not kill the run, so guard the stat.
if (existsSync(huskyDir)) walk(huskyDir, 0, (f) => !f.includes('/_/') && existsSync(f) && add(f, 'hook'), 2)

// 5) Pipelines carry the verify, security, and release job shapes.
for (const f of ['.gitlab-ci.yml', '.gitlab-ci.yaml']) {
  if (existsSync(join(target, f))) add(join(target, f), 'ci')
}
for (const sub of [['.gitlab', 'ci'], ['.github', 'workflows']]) {
  const dir = join(target, ...sub)
  if (existsSync(dir)) walk(dir, 0, (f) => /\.ya?ml$/.test(f) && add(f, 'ci'), 2)
}

// 6) A devcontainer makes a tool reproducible for any project.
const devcontainerDir = join(target, '.devcontainer')
if (existsSync(devcontainerDir)) {
  walk(devcontainerDir, 0, (f) => /(devcontainer\.json|\.sh)$/.test(f) && add(f, 'devcontainer'), 2)
}

// 7) Project docs carry the reasoning a new project must reproduce. Depth 1
// only: deeper trees are usually generated reference, not durable rationale.
const docsDir = join(target, 'docs')
if (existsSync(docsDir)) {
  walk(docsDir, 0, (f) => {
    if (!f.endsWith('.md') || sizeOf(f) > MAX_DOC_BYTES) return
    add(f, 'doc')
  }, 1)
}

// 8) Module docs show how a real project satisfies the documentation rule. The
// root README is already covered by the agent-config category.
walk(target, 0, (f) => {
  if (!/(README|DESIGN|RESOURCES)\.md$/.test(basename(f))) return
  if (relative(target, f) === 'README.md') return
  if (relative(target, f).startsWith('docs/')) return
  add(f, 'module-doc')
}, 5)

if (!found.length) {
  console.log(`No reusable signal found in ${target}.`)
  process.exit(0)
}
scanBeforeCopy()

// Build the base index once: findBaseMatch used to rewalk the whole repo per
// staged item, which is quadratic as the staged set grows.
const baseIndex = new Map()
const indexBase = (dir, depth) => walk(dir, 0, (f) => {
  if (f.includes('/incoming/')) return
  const name = basename(f)
  if (!baseIndex.has(name)) baseIndex.set(name, f)
}, depth)
indexBase(join(AC, 'templates'), 5)
indexBase(join(AC, 'knowledge'), 5)
indexBase(join(AC, 'skills'), 4)
indexBase(join(AC, 'docs'), 4)

const isFile = (full) => { try { return statSync(full).isFile() } catch { return false } }
// These names repeat all over both repos, so a name-only match against one of
// them says nothing. Report 'new' instead of a false 'differs'.
const AMBIGUOUS_NAMES = new Set(['SKILL.md', 'README.md', 'LICENSE', 'LICENCE', 'DESIGN.md', 'index.md', 'package.json'])
const baseStatus = (item) => {
  // Resolve the base in order of precision: same relative path, then the same
  // asset inside skills/ (a skill folder keeps its name wherever it lives), then
  // the file name. Name-only matching alone reports every SKILL.md against the
  // first one it finds, which reads as a false 'differs'.
  const skillRel = item.rel.match(/(?:^|.*\/)skills\/(.+)$/)?.[1]
  const candidates = [join(AC, item.rel), skillRel ? join(AC, 'skills', skillRel) : '']
  const name = basename(item.rel)
  const base = candidates.find((c) => c && isFile(c)) || (AMBIGUOUS_NAMES.has(name) ? '' : baseIndex.get(name))
  if (!base) return { status: 'new', base: '' }
  const shown = relative(AC, base)
  try {
    return { status: readFileSync(base, 'utf8') === readFileSync(item.full, 'utf8') ? 'identical' : 'differs', base: shown }
  } catch { return { status: 'differs', base: shown } }
}

// Clear the previous staging first: a file removed from the source must not
// linger and read as current.
rmSync(dest, { recursive: true, force: true })

const rows = []
for (const item of found) {
  const out = join(dest, item.rel)
  try {
    mkdirSync(dirname(out), { recursive: true })
    copyFileSync(item.full, out)
    rows.push({ ...item, ...baseStatus(item) })
  } catch (e) {
    rows.push({ ...item, status: 'copy-failed', base: '', error: e.message })
  }
}

const byCat = {}
for (const r of rows) (byCat[r.category] ||= []).push(r)
const catOrder = ['agent-config', 'style-contract', 'skill', 'skill-payload', 'agent-role', 'instinct', 'doc', 'module-doc', 'ci', 'devcontainer', 'config', 'hook']
const cats = Object.keys(byCat).sort((a, b) => {
  const ia = catOrder.indexOf(a); const ib = catOrder.indexOf(b)
  return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib)
})
const index = `# Pulled knowledge — ${projName}

Source: \`${target}\`
Staged: ${rows.length} files. **Nothing is merged.** Review, then promote the
generic items (see ../../../docs/workflows/knowledge-capture.md) and delete the rest.

${cats.map((cat) => `## ${cat}\n\n| File | Status | Base |\n| ---- | ------ | ---- |\n${byCat[cat].map((i) => `| \`${i.rel}\` | ${i.status} | ${i.base ? `\`${i.base}\`` : '—'} |`).join('\n')}`).join('\n\n')}
${truncated.length ? `\n## truncated\n\nThese limits were reached, so the list above is incomplete:\n\n${truncated.map((t) => `- \`${t.category}\`: ${t.cap}`).join('\n')}\n` : ''}
> \`new\` = no same-named file in agent-compass yet · \`differs\` = the named base
> file has different content — diff and reconcile · \`identical\` = already in
> base, delete from staging · promote by rewriting away project-specific names
> (\`@scope\`, \`<project>\`).
>
> A vendored corpus is skipped: a \`skills/\` tree whose parent carries a
> generated \`manifest.json\` belongs to its upstream, not to this project.
`
mkdirSync(dest, { recursive: true })
writeFileSync(join(dest, 'INDEX.md'), index)

const count = (status) => rows.filter((r) => r.status === status).length
const failed = rows.filter((r) => r.status === 'copy-failed')
console.log(`\n✓ Staged ${rows.length} files → ${relative(process.cwd(), dest)}`)
console.log(`✓ Review ${relative(process.cwd(), join(dest, 'INDEX.md'))}`)
console.log(`\n${count('new')} new · ${count('differs')} differ from base · ${count('identical')} identical\n`)
for (const t of truncated) console.log(`! truncated ${t.category}: ${t.cap}`)
if (failed.length) {
  console.error(`✗ ${failed.length} file(s) failed to copy:`)
  failed.forEach((r) => console.error(`  ${r.rel}: ${r.error}`))
  process.exit(1)
}

#!/usr/bin/env node
// install.mjs — wire agent-compass into a host project. Non-destructive:
// only creates files that don't already exist; never overwrites. Dependency-free.
//
// Run from the host project root (after adding agent-compass as a submodule):
//   node docs/agent-compass/scripts/install.mjs            # apply (create missing)
//   node docs/agent-compass/scripts/install.mjs --dry      # preview only
//   node docs/agent-compass/scripts/install.mjs <host-dir> # explicit host root

import { existsSync, readFileSync, writeFileSync, mkdirSync, copyFileSync, chmodSync } from 'node:fs'
import { dirname, resolve, relative, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { doctorChecks, ensureProjectmemIgnores, fixHuskyHookModes } from './doctor-checks.mjs'
import { FILE_MANIFEST, LOCK_REL, TEXT_RE, isHook, sha, loadSubst, renderSource, acVersion } from './manifest.mjs'

const AC = dirname(dirname(fileURLToPath(import.meta.url)))
const args = process.argv.slice(2)
const help = `Usage: node scripts/install.mjs [--dry] [--doctor] [--deep] [host-dir]

Wire agent-compass pointers, hooks, and config templates into a host project.

Options:
  --dry       Preview files that would be created.
  --doctor    Verify host wiring.
  --deep      Include advisory checks for optional agent workflows.
  --fix       Append projectmem ignores and chmod existing Husky hooks.
  --help      Show this help.
`

if (args.includes('--help')) {
  console.log(help)
  process.exit(0)
}

const dry = args.includes('--dry')
const doctor = args.includes('--doctor')
const deep = args.includes('--deep')
const fix = args.includes('--fix')
const HOST = resolve(args.find((a) => !a.startsWith('--')) || process.cwd())

if (HOST === AC) {
  console.error('Refusing to install agent-compass into itself. Run from the host project root.')
  process.exit(1)
}

// Substitutions from a prior bootstrap run (shared with sync.mjs).
const { scope, name, subst } = loadSubst(HOST)

const created = []
const skipped = []

const runFix = () => {
  const ignored = ensureProjectmemIgnores(HOST, dry)
  const fixedHooks = fixHuskyHookModes(HOST, dry)
  console.log(`\nagent-compass fix ${dry ? '(dry run) ' : ''}→ ${HOST}\n`)
  console.log(`.gitignore projectmem lines: ${ignored.gitignore.length ? ignored.gitignore.join(', ') : 'ok'}`)
  console.log(`.prettierignore projectmem lines: ${ignored.prettierignore.length ? ignored.prettierignore.join(', ') : 'ok'}`)
  console.log(`Husky hook modes: ${fixedHooks.length ? fixedHooks.join(', ') : 'ok'}`)
}

const runDoctor = () => {
  const { required: checks, advisory, deepChecks } = doctorChecks(HOST, { deep })
  const failed = checks.filter(([, ok]) => !ok)
  console.log(`\nagent-compass doctor → ${HOST}\n`)
  console.log('Required checks:')
  checks.forEach(([label, ok, detail]) => console.log(`${ok ? '✓' : '✗'} ${label}${!ok && detail?.length ? ` (${detail.join(', ')})` : ''}`))
  console.log('\nAdvisory checks:')
  advisory.forEach(([label, ok]) => console.log(`${ok ? '✓' : '·'} ${label}`))
  if (deep) {
    const missing = deepChecks.filter(([, ok]) => !ok)
    console.log('\nDeep advisory checks:')
    deepChecks.forEach(([label, ok]) => console.log(`${ok ? '✓' : '·'} ${label}`))
    if (missing.length) console.log(`\nDeep advisory: ${missing.length} optional setup file(s) missing.`)
  }
  if (failed.length) {
    console.error(`\n${failed.length} required check(s) failed. Run --fix for safe fixes; remove local path leaks manually.`)
    process.exit(1)
  }
  console.log('\n✓ doctor passed')
}

if (doctor) {
  if (fix) runFix()
  runDoctor()
  process.exit(0)
}

if (fix) {
  runFix()
  process.exit(0)
}

const place = (srcRel, destRel, transform = true) => {
  const src = join(AC, srcRel)
  const dest = join(HOST, destRel)
  if (!existsSync(src)) return
  if (existsSync(dest)) { skipped.push(destRel); return }
  if (dry) { created.push(destRel + ' (dry)'); return }
  mkdirSync(dirname(dest), { recursive: true })
  if (transform && TEXT_RE.test(srcRel)) {
    writeFileSync(dest, subst(readFileSync(src, 'utf8')))
  } else {
    copyFileSync(src, dest)
  }
  if (isHook(srcRel)) chmodSync(dest, 0o755)
  created.push(destRel)
}

const writeTextIfMissing = (destRel, text) => {
  const dest = join(HOST, destRel)
  if (existsSync(dest)) { skipped.push(destRel); return }
  if (dry) { created.push(destRel + ' (dry)'); return }
  mkdirSync(dirname(dest), { recursive: true })
  writeFileSync(dest, text)
  created.push(destRel)
}

// 1) Root AGENTS.md pointer (only if the host has none).
const acRel = relative(HOST, AC) || '.'
if (!existsSync(join(HOST, 'AGENTS.md'))) {
  const pointer = `# ${name} — Agent Guide

This project follows the shared **agent-compass** contract.

- Read \`${acRel}/AGENTS.md\` first — it is the canonical agent contract.
- Guidelines: \`${acRel}/docs/guidelines/\` · Architecture: \`${acRel}/docs/architecture/\` · Tooling: \`${acRel}/docs/tooling/\`
- Skills: \`${acRel}/skills/\` · Templates: \`${acRel}/templates/\`

Add project-specific conventions below this line; they take precedence over the
agent-compass baseline on conflict.
`
  if (!dry) writeFileSync(join(HOST, 'AGENTS.md'), pointer)
  created.push('AGENTS.md')
} else {
  skipped.push('AGENTS.md (exists — add a pointer to ' + acRel + '/AGENTS.md manually)')
}

const pointerText = (tool) => `# ${name} — ${tool} Agent Guide

Read \`${acRel}/AGENTS.md\` first. It is the canonical agent-compass contract.

Host project \`AGENTS.md\` takes precedence when it adds project-specific rules.
`
const toolPointers = [
  ['CLAUDE.md', pointerText('Claude')],
  ['CODEX.md', pointerText('Codex')],
  ['GEMINI.md', pointerText('Gemini')],
  ['.github/copilot-instructions.md', pointerText('GitHub Copilot')],
  ['.cursor/rules/agent-compass.mdc', `---
description: Agent Compass contract
alwaysApply: true
---

Read \`${acRel}/AGENTS.md\` first. It is the canonical agent-compass contract.

Host project \`AGENTS.md\` takes precedence when it adds project-specific rules.
`],
  ['.windsurf/rules/agent-compass.md', pointerText('Windsurf')],
]
for (const [dest, text] of toolPointers) writeTextIfMissing(dest, text)

// 2) Husky hooks (only if the host has no .husky yet).
if (!existsSync(join(HOST, '.husky'))) {
  for (const h of ['pre-commit', 'pre-push', 'commit-msg', 'post-merge']) place(`templates/monorepo/husky/${h}`, `.husky/${h}`)
} else {
  skipped.push('.husky/ (exists)')
}

// 3) Common config + agent templates — created only if missing (see manifest.mjs).
for (const { src, dest } of FILE_MANIFEST) place(src, dest)

// Record a version lock so `sync.mjs` knows the baseline for managed files.
if (!dry) {
  const lock = { version: acVersion(AC), syncedAt: new Date().toISOString(), managed: {} }
  for (const { src, dest, mode } of FILE_MANIFEST) {
    if (mode !== 'managed') continue
    const dpath = join(HOST, dest)
    if (!existsSync(dpath)) continue
    // Only claim "in sync" when the host file matches what we ship.
    if (sha(readFileSync(dpath, 'utf8')) === sha(renderSource(AC, src, subst))) lock.managed[dest] = sha(renderSource(AC, src, subst))
  }
  mkdirSync(join(HOST, '.agent'), { recursive: true })
  writeFileSync(join(HOST, LOCK_REL), JSON.stringify(lock, null, 2) + '\n')
  created.push(LOCK_REL)
}

const ignored = ensureProjectmemIgnores(HOST, dry)
if (ignored.gitignore.length) created.push(`.gitignore projectmem ignores${dry ? ' (dry)' : ''}`)
if (ignored.prettierignore.length) created.push(`.prettierignore projectmem ignores${dry ? ' (dry)' : ''}`)
const fixedHooks = fixHuskyHookModes(HOST, dry)
if (fixedHooks.length) created.push(`husky hook modes: ${fixedHooks.join(', ')}${dry ? ' (dry)' : ''}`)

const specAdvisories = [
  ['specs/README.md exists', existsSync(join(HOST, 'specs', 'README.md'))],
  ['specs/constitution.md exists', existsSync(join(HOST, 'specs', 'constitution.md'))],
]
if (!dry) {
  const missingSpecs = specAdvisories.filter(([, ok]) => !ok)
  if (missingSpecs.length) {
    skipped.push(`spec advisory (${missingSpecs.map(([label]) => label).join(', ')})`)
  }
}

// --- report ---
console.log(`\nagent-compass install ${dry ? '(dry run) ' : ''}→ ${HOST}`)
console.log(`  source: ${AC}`)
console.log(`  scope:  ${scope}   name: ${name}\n`)
console.log('Created:')
created.length ? created.forEach((f) => console.log('  + ' + f)) : console.log('  (nothing)')
console.log('\nSkipped (already present):')
skipped.length ? skipped.forEach((f) => console.log('  · ' + f)) : console.log('  (none)')
console.log(`\nNext steps:
  - Review created files; substitute remaining placeholders (<project>, <app>, <PM>).
  - If you have turbo/pnpm workspace files, copy the relevant ones from
    ${acRel}/templates/monorepo/ and adapt.
  - Wire husky: add "prepare": "husky" to package.json, then run install.
  - Copy .mcp/*.example.json into your local MCP client config, replace /absolute/path/to/repo, and never commit local MCP config.
  - Verify wiring: node ${acRel}/scripts/install.mjs --doctor
  - Read ${acRel}/AGENTS.md and ${acRel}/docs/guidelines/.\n`)

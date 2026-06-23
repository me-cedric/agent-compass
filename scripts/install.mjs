#!/usr/bin/env node
// install.mjs — wire agent-compass into a host project. Non-destructive:
// only creates files that don't already exist; never overwrites. Dependency-free.
//
// Run from the host project root (after adding agent-compass as a submodule):
//   node docs/agent-compass/scripts/install.mjs            # apply (create missing)
//   node docs/agent-compass/scripts/install.mjs --dry      # preview only
//   node docs/agent-compass/scripts/install.mjs <host-dir> # explicit host root

import { existsSync, readFileSync, writeFileSync, mkdirSync, copyFileSync, statSync } from 'node:fs'
import { dirname, resolve, relative, join, basename } from 'node:path'
import { fileURLToPath } from 'node:url'

const AC = dirname(dirname(fileURLToPath(import.meta.url)))
const args = process.argv.slice(2)
const dry = args.includes('--dry')
const HOST = resolve(args.find((a) => !a.startsWith('--')) || process.cwd())

if (HOST === AC) {
  console.error('Refusing to install agent-compass into itself. Run from the host project root.')
  process.exit(1)
}

// Optional substitutions from a prior bootstrap run.
let scope = '@scope'
let name = basename(HOST)
const answersPath = join(HOST, 'agent-compass.answers.json')
if (existsSync(answersPath)) {
  try {
    const a = JSON.parse(readFileSync(answersPath, 'utf8'))
    scope = a.scope || scope
    name = a.name || name
  } catch {}
}
const subst = (text) => text.replace(/@scope\b/g, scope).replace(/<project>/g, name)

const created = []
const skipped = []
const TEXT = /\.(md|json|ya?ml|mjs|cjs|js|ts|toml|properties|txt|sh|tpl)$|^\.|husky\//

const place = (srcRel, destRel, transform = true) => {
  const src = join(AC, srcRel)
  const dest = join(HOST, destRel)
  if (!existsSync(src)) return
  if (existsSync(dest)) { skipped.push(destRel); return }
  if (dry) { created.push(destRel + ' (dry)'); return }
  mkdirSync(dirname(dest), { recursive: true })
  if (transform && TEXT.test(srcRel)) {
    writeFileSync(dest, subst(readFileSync(src, 'utf8')))
  } else {
    copyFileSync(src, dest)
  }
  if (srcRel.includes('husky/')) try { statSync(dest); } catch {}
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

// 2) Husky hooks (only if the host has no .husky yet).
if (!existsSync(join(HOST, '.husky'))) {
  for (const h of ['pre-commit', 'pre-push', 'commit-msg']) place(`templates/monorepo/husky/${h}`, `.husky/${h}`)
} else {
  skipped.push('.husky/ (exists)')
}

// 3) Common config templates — created only if missing.
const configs = [
  ['templates/monorepo/.editorconfig', '.editorconfig'],
  ['templates/monorepo/.prettierrc', '.prettierrc'],
  ['templates/monorepo/.prettierignore', '.prettierignore'],
  ['templates/monorepo/commitlint.config.js', 'commitlint.config.js'],
  ['templates/monorepo/.nvmrc', '.nvmrc'],
  ['templates/monorepo/.npmrc', '.npmrc'],
  ['templates/monorepo/tsconfig.base.json', 'tsconfig.base.json'],
  ['templates/security/.osv-scanner.toml', '.osv-scanner.toml'],
  ['templates/monorepo/env.example.tpl', '.env.example'],
]
for (const [s, d] of configs) place(s, d)

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
  - Read ${acRel}/AGENTS.md and ${acRel}/docs/guidelines/.\n`)

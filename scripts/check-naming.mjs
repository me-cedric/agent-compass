#!/usr/bin/env node
// check-naming.mjs — fail if project / client / company / domain-specific names
// leak into the repo. Keeps agent-compass generic and reusable.
//
//   node scripts/check-naming.mjs        # exits 1 (with locations) if any found
//
// Real technology names (keycloak, postgres, docker, turbo, …) are ALLOWED.
// To forbid a new name, add it to DENY below. Exit code feeds CI (see ci.yml).

import { readdirSync, readFileSync } from 'node:fs'
import { join, extname, basename, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)))
const SELF = basename(fileURLToPath(import.meta.url))
const IGNORE = new Set(['.git', 'node_modules', 'incoming'])
const TEXT = new Set(['.md', '.mjs', '.cjs', '.js', '.ts', '.tsx', '.json', '.yml', '.yaml', '.toml', '.properties', '.sh', '.tpl', '.txt', ''])

// Forbidden tokens (case-insensitive regex fragments). Extend as new projects
// are mined. Use \\b for short words to avoid matching inside other words.
const DENY = [
  'parcus', 'velhop', 'orbility', 'eovia', 'nexterite', 'freshmile', 'monetico',
  '\\bcts\\b', 'parking[-_ ]?lots?', 'free[-_ ]?spots?', 'ev[-_ ]charging',
]
const RE = new RegExp(`(${DENY.join('|')})`, 'i')

const hits = []
const walk = (dir) => {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (IGNORE.has(e.name)) continue
    const full = join(dir, e.name)
    if (e.isDirectory()) walk(full)
    else if (basename(e.name) !== SELF && TEXT.has(extname(e.name))) {
      let txt
      try { txt = readFileSync(full, 'utf8') } catch { continue }
      txt.split('\n').forEach((line, i) => {
        const m = RE.exec(line)
        if (m) hits.push(`${full.replace(ROOT + '/', '')}:${i + 1}: "${m[1]}"  ${line.trim().slice(0, 80)}`)
      })
    }
  }
}
walk(ROOT)

if (hits.length) {
  console.error(`✗ ${hits.length} project/domain-specific name(s) found — replace with generic placeholders:\n`)
  hits.forEach((h) => console.error('  ' + h))
  console.error('\nSee CONTRIBUTING.md → "Generic naming". Real tech names (keycloak, postgres, …) are allowed.')
  process.exit(1)
}
console.log('✓ naming check passed — no project/domain-specific names.')

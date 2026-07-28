#!/usr/bin/env node
// check-naming.mjs — fail if project / client / company / domain-specific names
// leak into the repo. Keeps agent-compass generic and reusable.
//
//   node scripts/check-naming.mjs        # exits 1 (with locations) if any found
//
// Real technology names (keycloak, postgres, docker, turbo, …) are ALLOWED.
// To forbid a new name, add it to DENY below. Exit code feeds CI (see ci.yml).

import { readdirSync, readFileSync } from 'node:fs'
import { join, extname, basename, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseCliArgs } from './lib/args.mjs'

const { values, positionals } = parseCliArgs({
  name: 'check-naming',
  usage: 'node scripts/check-naming.mjs [root] [options]',
  summary: `Fail if project/domain names leak into generic agent-compass files.
Also validates SKILL.md frontmatter and metadata.`,
  positionals: [{ name: 'root', required: false }],
  options: {
    root: { type: 'string', value: '<dir>', desc: 'Check another root directory (also accepted as a positional).' },
  },
})

const ROOT = resolve(values.root || positionals[0] || dirname(dirname(fileURLToPath(import.meta.url))))
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
const skillHits = []
const checkSkillFrontmatter = (full, txt) => {
  if (basename(full) !== 'SKILL.md') return
  const fm = txt.match(/^---\n([\s\S]*?)\n---\n/)
  if (!fm) {
    skillHits.push(`${full.replace(ROOT + '/', '')}: missing frontmatter`)
    return
  }
  if (!/^name:\s*\S+/m.test(fm[1])) skillHits.push(`${full.replace(ROOT + '/', '')}: missing frontmatter name`)
  if (!/^description:\s*(?:\S|[>|])/m.test(fm[1])) skillHits.push(`${full.replace(ROOT + '/', '')}: missing frontmatter description`)
  if (!/^risk_level:\s*(low|medium|high)\s*$/m.test(fm[1])) skillHits.push(`${full.replace(ROOT + '/', '')}: missing/invalid risk_level (low|medium|high)`)
  if (!/^writes_files:\s*(true|false)\s*$/m.test(fm[1])) skillHits.push(`${full.replace(ROOT + '/', '')}: missing/invalid writes_files (true|false)`)
  if (!/^requires_tools:\s*(\[[^\]]*\]|$)/m.test(fm[1])) skillHits.push(`${full.replace(ROOT + '/', '')}: missing requires_tools list`)
}
const walk = (dir) => {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (IGNORE.has(e.name)) continue
    const full = join(dir, e.name)
    if (e.isDirectory()) walk(full)
    else if (basename(e.name) !== SELF && TEXT.has(extname(e.name))) {
      let txt
      try { txt = readFileSync(full, 'utf8') } catch { continue }
      checkSkillFrontmatter(full, txt)
      txt.split('\n').forEach((line, i) => {
        const m = RE.exec(line)
        if (m) hits.push(`${full.replace(ROOT + '/', '')}:${i + 1}: "${m[1]}"  ${line.trim().slice(0, 80)}`)
      })
    }
  }
}
walk(ROOT)

if (hits.length || skillHits.length) {
  if (hits.length) {
    console.error(`✗ ${hits.length} project/domain-specific name(s) found — replace with generic placeholders:\n`)
    hits.forEach((h) => console.error('  ' + h))
    console.error('\nSee CONTRIBUTING.md → "Generic naming". Real tech names (keycloak, postgres, …) are allowed.')
  }
  if (skillHits.length) {
    console.error(`\n✗ ${skillHits.length} skill frontmatter issue(s) found:\n`)
    skillHits.forEach((h) => console.error('  ' + h))
  }
  process.exit(1)
}
console.log('✓ naming check passed — no project/domain-specific names; skill frontmatter valid.')

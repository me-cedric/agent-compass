#!/usr/bin/env node
// check-skill-quality.mjs — validate imported operational skills against their
// reviewed lock, metadata contract, safety gate, and payload/link boundaries.

import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { parseCliArgs } from './lib/args.mjs'
import { rootCapabilitySkills } from './lib/capability-packs.mjs'
import { SAFETY_GATE, verifyLocalLock } from './lib/upstream-skills.mjs'

const { values, positionals } = parseCliArgs({
  name: 'check-skill-quality',
  usage: 'node scripts/check-skill-quality.mjs [root] [options]',
  summary: 'Validate imported operational skills against the reviewed safety and provenance contract.',
  positionals: [{ name: 'root', required: false }],
  options: {
    root: { type: 'string', value: '<dir>', desc: 'Check another Agent Compass root.' },
    json: { type: 'boolean', desc: 'Print a machine-readable result.' },
  },
})

const ROOT = resolve(values.root || positionals[0] || dirname(dirname(fileURLToPath(import.meta.url))))
const LOCK_FILE = join(ROOT, 'skills', 'upstream-lock.json')
const hits = []

if (!existsSync(LOCK_FILE)) {
  hits.push('skills/upstream-lock.json: missing imported-skill lock')
}

const lock = existsSync(LOCK_FILE) ? JSON.parse(readFileSync(LOCK_FILE, 'utf8')) : { skills: {} }
const names = Object.keys(lock.skills || {}).sort()
const expectedNames = lock.selection?.rootPacks ? rootCapabilitySkills() : names
hits.push(...verifyLocalLock(ROOT, lock, expectedNames))
if (lock.selection?.skillCount !== undefined && lock.selection.skillCount !== names.length) {
  hits.push(`lock skillCount drift: declared ${lock.selection.skillCount}, locked ${names.length}`)
}

const frontmatter = (text) => {
  const block = text.match(/^---\n([\s\S]*?)\n---/)
  if (!block) return {}
  return Object.fromEntries(
    block[1].split('\n')
      .map((line) => line.match(/^([a-z_]+):\s*(.*)$/))
      .filter(Boolean)
      .map((match) => [match[1], match[2].replace(/^["']|["']$/g, '')]),
  )
}

for (const name of names) {
  const file = join(ROOT, 'skills', name, 'SKILL.md')
  if (!existsSync(file)) continue
  const text = readFileSync(file, 'utf8')
  const meta = frontmatter(text)
  const entry = lock.skills[name]

  if (meta.name !== name) hits.push(`${name}: frontmatter name mismatch`)
  if (meta.risk_level !== entry.riskLevel) {
    hits.push(`${name}: risk_level must equal locked value ${entry.riskLevel}`)
  }
  if (meta.writes_files !== 'true') hits.push(`${name}: writes_files must be true`)
  if (meta.source !== lock.upstream?.repository) hits.push(`${name}: source repository drift`)
  if (meta.source_commit !== lock.upstream?.commit) hits.push(`${name}: source commit drift`)
  if (!text.includes(SAFETY_GATE.trim())) hits.push(`${name}: safety gate missing or modified`)
  if (!/^## Provenance$/m.test(text)) hits.push(`${name}: provenance section missing`)
  if (/!?\[[^\]]*\]\((?:\.\.?\/)[^)]+\)/.test(text)) hits.push(`${name}: relative Markdown link present`)
}

const result = {
  ok: hits.length === 0,
  skillCount: names.length,
  issues: hits,
}

if (values.json) {
  console.log(JSON.stringify(result, null, 2))
} else if (hits.length) {
  console.error(`✗ ${hits.length} imported-skill quality issue(s):\n`)
  hits.forEach((hit) => console.error(`  ${hit}`))
} else {
  console.log(`✓ skill quality passed for ${names.length} imported skills.`)
}

if (hits.length) process.exit(1)

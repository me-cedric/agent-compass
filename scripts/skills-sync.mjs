#!/usr/bin/env node
// skills-sync.mjs — copy or symlink Agent Compass skills into host provider dirs.

import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, symlinkSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseCliArgs, resolveRoot } from './lib/args.mjs'

const AC = dirname(dirname(fileURLToPath(import.meta.url)))

const { values, positionals } = parseCliArgs({
  name: 'skills-sync',
  script: 'skills-sync.mjs',
  summary: `Copy or symlink Agent Compass skills into host provider dirs.

Targets: agents (.agents/skills), claude (.claude/skills), codex (.agents/skills), all
Default: --copy --target all`,
  positionals: [{ name: 'host-dir', required: false }],
  options: {
    copy: { type: 'boolean', desc: 'Copy skills into provider dirs (default).' },
    symlink: { type: 'boolean', desc: 'Symlink skills instead of copying.' },
    target: { type: 'string', value: '<name>', desc: 'Provider target: agents | claude | codex | all (default: all).' },
    only: { type: 'string', value: '<a,b,c>', desc: 'Sync a fit-based subset (comma-separated skill names; see `recommend --json` assets.skills).' },
    dry: { type: 'boolean', desc: 'Show what would sync; write nothing.' },
  },
})

const root = resolveRoot(positionals)
const mode = values.symlink ? 'symlink' : 'copy'
const target = values.target || 'all'
const only = values.only?.split(',').map((s) => s.trim()).filter(Boolean) || null
const dry = Boolean(values.dry)
const targets = {
  agents: '.agents/skills',
  codex: '.agents/skills',
  claude: '.claude/skills',
}
const selected = target === 'all' ? Object.entries(targets) : [[target, targets[target]]]
if (selected.some(([, dir]) => !dir)) { console.error(`Unknown target: ${target}`); process.exit(1) }

let skills = readdirSync(join(AC, 'skills'), { withFileTypes: true }).filter((d) => d.isDirectory())
if (only) {
  const known = new Set(skills.map((d) => d.name))
  const unknown = only.filter((name) => !known.has(name))
  if (unknown.length) { console.error(`Unknown skill(s): ${unknown.join(', ')}`); process.exit(1) }
  skills = skills.filter((d) => only.includes(d.name))
}
for (const [, relDir] of selected) {
  const dir = join(root, relDir)
  if (!dry) mkdirSync(dir, { recursive: true })
  for (const skill of skills) {
    const src = join(AC, 'skills', skill.name)
    const dest = join(dir, skill.name)
    if (dry) {
      console.log(`would ${mode} ${skill.name} -> ${relDir}`)
      continue
    }
    if (existsSync(dest)) rmSync(dest, { recursive: true, force: true })
    if (mode === 'symlink') symlinkSync(src, dest, 'dir')
    else cpSync(src, dest, { recursive: true })
  }
}
if (!dry) console.log(`synced ${skills.length} skills to ${selected.map(([, d]) => d).join(', ')} (${mode})`)

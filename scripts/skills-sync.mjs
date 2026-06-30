#!/usr/bin/env node
// skills-sync.mjs — copy or symlink Agent Compass skills into host provider dirs.

import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, symlinkSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const AC = dirname(dirname(fileURLToPath(import.meta.url)))
const args = process.argv.slice(2)
const help = `Usage: node scripts/skills-sync.mjs [host-dir] [--copy|--symlink] [--target <name>] [--dry]

Targets: agents (.agents/skills), claude (.claude/skills), codex (.agents/skills), all
Default: --copy --target all
`
if (args.includes('--help')) { console.log(help); process.exit(0) }
const flag = (name) => { const i = args.indexOf(name); return i === -1 ? null : args[i + 1] }
const root = resolve(args.find((a) => !a.startsWith('--') && a !== flag('--target')) || process.cwd())
const mode = args.includes('--symlink') ? 'symlink' : 'copy'
const target = flag('--target') || 'all'
const dry = args.includes('--dry')
const targets = {
  agents: '.agents/skills',
  codex: '.agents/skills',
  claude: '.claude/skills',
}
const selected = target === 'all' ? Object.entries(targets) : [[target, targets[target]]]
if (selected.some(([, dir]) => !dir)) { console.error(`Unknown target: ${target}`); process.exit(1) }

const skills = readdirSync(join(AC, 'skills'), { withFileTypes: true }).filter((d) => d.isDirectory())
for (const [, relDir] of selected) {
  const dir = join(root, relDir)
  if (!dry) mkdirSync(dir, { recursive: true })
  for (const skill of skills) {
    const src = join(AC, 'skills', skill.name)
    const dest = join(dir, skill.name)
    if (existsSync(dest)) rmSync(dest, { recursive: true, force: true })
    if (dry) console.log(`would ${mode} ${skill.name} -> ${relDir}`)
    else if (mode === 'symlink') symlinkSync(src, dest, 'dir')
    else cpSync(src, dest, { recursive: true })
  }
}
if (!dry) console.log(`synced ${skills.length} skills to ${selected.map(([, d]) => d).join(', ')} (${mode})`)
